import type {
  ImproveRequest,
  ImproveResponse,
  ModelsRequest,
  ModelsResponse,
  ProbeRequest,
  ProbeResponse,
  TokenCheckRequest,
  TokenCheckResponse,
} from '@/lib/improve/contract';
import { ImproveError, improve, listModels, probeModel } from '@askwell/improve';
import { adminToken, apiKeys, models, provider, type AdminToken } from '@/lib/settings';

type Message = { type: 'open-settings' } | ImproveRequest | ModelsRequest | ProbeRequest | TokenCheckRequest;

/** Calls a portal endpoint with a token; network failures become a readable error. */
async function portalCall<T>(portal: string, path: string, token: string, body?: unknown): Promise<T | { ok: false; error: string }> {
  try {
    const response = await fetch(`${portal}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as T;
  } catch {
    return { ok: false, error: 'Couldn’t reach the portal. Check its address and your connection.' };
  }
}

async function improveViaPortal(admin: AdminToken, { prompt, gaps }: ImproveRequest): Promise<ImproveResponse> {
  const result = await portalCall<ImproveResponse>(admin.portal, '/api/improve', admin.token, { prompt, gaps });
  if (result.ok) return result;
  // A refused token is fixed in settings; a limit or an outage is not.
  const tokenProblem = /token/i.test(result.error) && !/rewrites for today/i.test(result.error);
  return { ok: false, error: result.error, needsKey: tokenProblem };
}

// Provider calls run here, never in the content script: the key stays in
// the extension's own process and the host page can't observe the request.

async function handleImprove(request: ImproveRequest): Promise<ImproveResponse> {
  const admin = await adminToken.getValue();
  if (admin) return improveViaPortal(admin, request);
  const { prompt, gaps } = request;
  const chosen = await provider.getValue();
  const key = (await apiKeys.getValue())[chosen];
  const model = (await models.getValue())[chosen];
  if (!key) return { ok: false, error: 'No API key is set up yet.', needsKey: true };
  if (!model) return { ok: false, error: 'Pick a model in settings first.', needsKey: true };
  try {
    return { ok: true, improvement: await improve(chosen, key, model, prompt, gaps), model };
  } catch (error) {
    if (error instanceof ImproveError) {
      return { ok: false, error: error.message, needsKey: error.needsKey, detail: error.detail };
    }
    return { ok: false, error: 'Something went wrong while rewriting. Try again.' };
  }
}

async function handleModels({ provider: which, key }: ModelsRequest): Promise<ModelsResponse> {
  try {
    return { ok: true, models: await listModels(which, key) };
  } catch (error) {
    return { ok: false, error: error instanceof ImproveError ? error.message : 'Couldn’t check this key.' };
  }
}

async function handleProbe({ provider: which, key, model }: ProbeRequest): Promise<ProbeResponse> {
  try {
    await probeModel(which, key, model);
    return { ok: true };
  } catch (error) {
    if (error instanceof ImproveError) return { ok: false, error: error.message, detail: error.detail };
    return { ok: false, error: 'Couldn’t check this model.' };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const message = raw as Message;
    if (message?.type === 'open-settings') {
      void browser.runtime.openOptionsPage();
      return;
    }
    if (message?.type === 'improve') {
      void handleImprove(message).then(sendResponse);
      return true; // answer asynchronously
    }
    if (message?.type === 'probe-model') {
      void handleProbe(message).then(sendResponse);
      return true;
    }
    if (message?.type === 'check-token') {
      void portalCall<TokenCheckResponse>(message.portal, '/api/token', message.token).then(sendResponse);
      return true;
    }
    if (message?.type === 'list-models') {
      void handleModels(message).then(sendResponse);
      return true;
    }
  });
});
