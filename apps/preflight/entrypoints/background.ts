import type { ImproveRequest, ImproveResponse, ModelsRequest, ModelsResponse } from '@/lib/improve/contract';
import { ImproveError, improve, listModels } from '@/lib/improve/providers';
import { apiKeys, models, provider } from '@/lib/settings';

type Message = { type: 'open-settings' } | ImproveRequest | ModelsRequest;

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
    if (error instanceof ImproveError) return { ok: false, error: error.message, needsKey: error.needsKey };
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
    if (message?.type === 'list-models') {
      void handleModels(message).then(sendResponse);
      return true;
    }
  });
});
