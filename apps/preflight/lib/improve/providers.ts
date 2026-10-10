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
  ) {
    super(message);
  }
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
    if (error instanceof ImproveError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ImproveError('Anthropic rejected this key.', true);
    if (error instanceof Anthropic.PermissionDeniedError) throw new ImproveError(`This key can’t use ${model}.`, true);
    if (error instanceof Anthropic.NotFoundError) throw new ImproveError(`Anthropic doesn’t know the model ${model}.`, true);
    if (error instanceof Anthropic.RateLimitError) throw new ImproveError('Anthropic is rate limiting this key. Try again shortly.');
    if (error instanceof Anthropic.APIConnectionError) throw new ImproveError('Couldn’t reach Anthropic. Check your connection.');
    if (error instanceof Anthropic.APIError) throw new ImproveError(`Anthropic returned an error (${error.status}).`);
    throw error;
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
    if (error instanceof OpenAI.AuthenticationError) throw new ImproveError('OpenAI rejected this key.', true);
    if (error instanceof OpenAI.NotFoundError) throw new ImproveError(`OpenAI doesn’t offer ${model} to this key.`, true);
    if (error instanceof OpenAI.RateLimitError) throw new ImproveError('OpenAI is rate limiting this key. Try again shortly.');
    if (error instanceof OpenAI.APIConnectionError) throw new ImproveError('Couldn’t reach OpenAI. Check your connection.');
    if (error instanceof OpenAI.APIError) throw new ImproveError(`OpenAI returned an error (${error.status}).`);
    throw error;
  }
}

async function viaGemini(key: string, model: string, prompt: string, gaps: Gap[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: userMessage(prompt, gaps),
      config: {
        systemInstruction: INSTRUCTIONS,
        responseMimeType: 'application/json',
        responseJsonSchema: IMPROVEMENT_SCHEMA,
      },
    });
    return response.text ?? '';
  } catch (error) {
    if (error instanceof GeminiError) {
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        throw new ImproveError('Gemini rejected this key or model.', true);
      }
      if (error.status === 429) throw new ImproveError('Gemini is rate limiting this key. Try again shortly.');
      throw new ImproveError(`Gemini returned an error (${error.status}).`);
    }
    throw error;
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

// Chat models only: OpenAI's list also holds embeddings, audio and image models.
const OPENAI_CHAT = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_NOT_CHAT = /(audio|realtime|transcribe|tts|image|embedding|search|instruct|moderation)/;

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
      if (id?.startsWith('gemini') && model.supportedActions?.includes('generateContent')) ids.push(id);
    }
    return ids;
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
