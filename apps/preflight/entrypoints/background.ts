import type {
  ImproveRequest,
  ImproveResponse,
  ModelsRequest,
  ModelsResponse,
  ProbeRequest,
  ProbeResponse,
} from '@/lib/improve/contract';
import { ImproveError, improve, listModels, probeModel } from '@askwell/improve';
import { apiKeys, models, provider } from '@/lib/settings';

type Message = { type: 'open-settings' } | ImproveRequest | ModelsRequest | ProbeRequest;

// Provider calls run here, never in the content script: the key stays in
// the extension's own process and the host page can't observe the request.

async function handleImprove({ prompt, gaps }: ImproveRequest): Promise<ImproveResponse> {
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
    if (message?.type === 'list-models') {
      void handleModels(message).then(sendResponse);
      return true;
    }
  });
});
