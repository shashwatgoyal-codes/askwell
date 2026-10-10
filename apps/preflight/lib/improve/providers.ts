import Anthropic from '@anthropic-ai/sdk';
import { ApiError as GeminiError, GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { Gap } from '@askwell/rules';
import type { Provider } from '../settings';
import { IMPROVEMENT_SCHEMA, INSTRUCTIONS, Improvement, userMessage } from './contract';

// Runs only in the background worker. dangerouslyAllowBrowser is safe here
// in the sense the flag warns about: the key is the user's own, typed into
// this extension, and never reaches a web page or a server of ours.

export class ImproveError extends Error {
  constructor(
    message: string,
    readonly needsKey = false,
    /** The provider's own explanation, shown under ours so a failure can be diagnosed. */
    readonly detail?: string,
  ) {
    super(message);
  }
}

/** The provider's message from an SDK error, trimmed. Never contains the key: providers don't echo it. */
function providerDetail(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  // Gemini's message is the raw JSON body; pull out the human part.
  const inner = error.message.match(/"message":\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  const text = (inner ?? error.message).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 240) : undefined;
}

function asImproveError(provider: Provider, model: string, error: unknown): ImproveError {
  if (error instanceof ImproveError) return error;
  const detail = providerDetail(error);
  if (provider === 'anthropic') {
    if (error instanceof Anthropic.AuthenticationError) return new ImproveError('Anthropic rejected this key.', true, detail);
    if (error instanceof Anthropic.PermissionDeniedError) return new ImproveError(`This key can’t use ${model}.`, true, detail);
    if (error instanceof Anthropic.NotFoundError) return new ImproveError(`Anthropic doesn’t know the model ${model}.`, true, detail);
    if (error instanceof Anthropic.RateLimitError) return new ImproveError('Anthropic is rate limiting this key. Try again shortly.', false, detail);
    if (error instanceof Anthropic.APIConnectionError) return new ImproveError('Couldn’t reach Anthropic. Check your connection.');
    if (error instanceof Anthropic.APIError) return new ImproveError(`Anthropic returned an error (${error.status}).`, false, detail);
  }
  if (provider === 'openai') {
    if (error instanceof OpenAI.AuthenticationError) return new ImproveError('OpenAI rejected this key.', true, detail);
    if (error instanceof OpenAI.NotFoundError) return new ImproveError(`OpenAI doesn’t offer ${model} to this key.`, true, detail);
    if (error instanceof OpenAI.RateLimitError) return new ImproveError('OpenAI is rate limiting this key. Try again shortly.', false, detail);
    if (error instanceof OpenAI.APIConnectionError) return new ImproveError('Couldn’t reach OpenAI. Check your connection.');
    if (error instanceof OpenAI.APIError) return new ImproveError(`OpenAI returned an error (${error.status}).`, false, detail);
  }
  if (provider === 'gemini' && error instanceof GeminiError) {
    if (error.status === 404) return new ImproveError(`Gemini won’t serve ${model} to this key. Pick another model in settings.`, true, detail);
    if (error.status === 429) {
      return new ImproveError('Gemini’s free-tier limit was reached for now. Wait a minute and try again.', false, detail);
    }
    if (error.status === 503) {
      return new ImproveError(`Gemini is overloaded right now (Google’s side, not your key). Try again shortly, or pick a Flash-Lite model.`, false, detail);
    }
    if ([400, 401, 403].includes(error.status)) return new ImproveError('Gemini refused this request.', true, detail);
    return new ImproveError(`Gemini returned an error (${error.status}).`, false, detail);
  }
  if (error instanceof TypeError) return new ImproveError('Couldn’t reach the provider. Check your connection.', false, detail);
  return new ImproveError('Something went wrong talking to the provider.', false, detail);
}

// Server-side fallback ("default") is offered on these models only.
const FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/;
// Effort is accepted from the 4.6 generation on.
const EFFORT_MODELS = /^claude-(fable|mythos|opus-5|sonnet-5|haiku-5|opus-4-[678]|sonnet-4-6)/;

async function viaAnthropic(key: string, model: string, prompt: string, gaps: Gap[]): Promise<string> {
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: INSTRUCTIONS,
      messages: [{ role: 'user', content: userMessage(prompt, gaps) }],
      output_config: {
        format: { type: 'json_schema', schema: IMPROVEMENT_SCHEMA },
        // A rewrite of a few lines; deeper thinking adds wait, not quality.
        ...(EFFORT_MODELS.test(model) ? { effort: 'low' as const } : {}),
      },
      ...(FALLBACK_MODELS.test(model)
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    });
    if (response.stop_reason === 'refusal') throw new ImproveError('The model declined to rewrite this prompt.');
    if (response.stop_reason === 'max_tokens') throw new ImproveError('The rewrite ran too long. Try a shorter prompt.');
    return response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
  } catch (error) {
    throw asImproveError('anthropic', model, error);
  }
}

async function viaOpenAI(key: string, model: string, prompt: string, gaps: Gap[]): Promise<string> {
  const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const response = await client.responses.create({
      model,
      instructions: INSTRUCTIONS,
      input: userMessage(prompt, gaps),
      text: { format: { type: 'json_schema', name: 'improvement', strict: true, schema: IMPROVEMENT_SCHEMA } },
    });
    return response.output_text;
  } catch (error) {
    throw asImproveError('openai', model, error);
  }
}

// Overload (503) and server errors (500, 504) on Gemini usually clear within
// seconds, and are common on the free tier. Retry those before giving up;
// never retry a 4xx, which will not change by waiting.
const GEMINI_RETRY_DELAYS_MS = [1000, 3000];

async function withGeminiRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const transient = error instanceof GeminiError && [500, 503, 504].includes(error.status);
      const wait = GEMINI_RETRY_DELAYS_MS[attempt];
      if (!transient || wait === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function viaGemini(key: string, model: string, prompt: string, gaps: Gap[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const response = await withGeminiRetry(() => ai.models.generateContent({
      model,
      contents: userMessage(prompt, gaps),
      config: {
        systemInstruction: INSTRUCTIONS,
        responseMimeType: 'application/json',
        responseJsonSchema: IMPROVEMENT_SCHEMA,
      },
    }));
    return response.text ?? '';
  } catch (error) {
    throw asImproveError('gemini', model, error);
  }
}

const CALL: Record<Provider, typeof viaAnthropic> = {
  anthropic: viaAnthropic,
  openai: viaOpenAI,
  gemini: viaGemini,
};

export async function improve(provider: Provider, key: string, model: string, prompt: string, gaps: Gap[]): Promise<Improvement> {
  const text = await CALL[provider](key, model, prompt, gaps);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImproveError('The model answered in a shape Preflight can’t read. Try again.');
  }
  const parsed = Improvement.safeParse(json);
  if (!parsed.success) throw new ImproveError('The model answered in a shape Preflight can’t read. Try again.');
  return parsed.data;
}

/**
 * The smallest real request the model can answer: proves the key can use
 * this model before the user relies on it. Costs a handful of tokens.
 */
export async function probeModel(provider: Provider, key: string, model: string): Promise<void> {
  const ask = 'Reply with the single word OK.';
  try {
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
      await client.messages.create({ model, max_tokens: 1024, messages: [{ role: 'user', content: ask }] });
    } else if (provider === 'openai') {
      const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
      await client.responses.create({ model, input: ask });
    } else {
      const ai = new GoogleGenAI({ apiKey: key });
      await withGeminiRetry(() => ai.models.generateContent({ model, contents: ask }));
    }
  } catch (error) {
    throw asImproveError(provider, model, error);
  }
}

// Chat models only: OpenAI's list also holds embeddings, audio and image models.
const OPENAI_CHAT = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_NOT_CHAT = /(audio|realtime|transcribe|tts|image|embedding|search|instruct|moderation)/;

// Gemini lists models that answer in audio, images or live sessions, or not
// at all to most keys; a text rewrite needs none of them.
const GEMINI_NOT_TEXT = /(tts|image|live|audio|native|embedding|aqa|robotics|computer-use|veo|imagen|learnlm)/;

/** Stable Flash first: fast, cheap, and served to free-tier keys. Previews and experiments last. */
function geminiRank(id: string): number {
  if (/(preview|exp)/.test(id)) return 3;
  if (/flash-lite/.test(id)) return 1;
  if (/flash/.test(id)) return 0;
  return 2;
}

export async function listModels(provider: Provider, key: string): Promise<string[]> {
  try {
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
      const ids: string[] = [];
      for await (const model of client.models.list()) ids.push(model.id);
      return ids;
    }
    if (provider === 'openai') {
      const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
      const found: { id: string; created: number }[] = [];
      for await (const model of client.models.list()) {
        if (OPENAI_CHAT.test(model.id) && !OPENAI_NOT_CHAT.test(model.id)) found.push(model);
      }
      return found.sort((a, b) => b.created - a.created).map((model) => model.id);
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const ids: string[] = [];
    for await (const model of await ai.models.list()) {
      const id = model.name?.replace(/^models\//, '');
      if (id?.startsWith('gemini') && !GEMINI_NOT_TEXT.test(id) && model.supportedActions?.includes('generateContent')) {
        ids.push(id);
      }
    }
    return ids.sort((a, b) => geminiRank(a) - geminiRank(b) || b.localeCompare(a, undefined, { numeric: true }));
  } catch (error) {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof OpenAI.AuthenticationError ||
      (error instanceof GeminiError && [400, 401, 403].includes(error.status))
    ) {
      throw new ImproveError('This key was rejected.', true);
    }
    if (error instanceof Anthropic.APIConnectionError || error instanceof OpenAI.APIConnectionError) {
      throw new ImproveError('Couldn’t reach the provider. Check your connection.');
    }
    throw new ImproveError('The provider returned an error while listing models.');
  }
}
