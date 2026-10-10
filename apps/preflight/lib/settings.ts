import type { CheckId, Sensitivity } from '@askwell/rules';
import { storage } from '#imports';

// Everything here lives in storage.local: on this device, never synced.
// API keys especially: storage.sync would copy them to the browser vendor.

export const sensitivity = storage.defineItem<Sensitivity>('local:sensitivity', {
  fallback: 'balanced',
});

export const disabledChecks = storage.defineItem<CheckId[]>('local:disabledChecks', {
  fallback: [],
});

/** Site ids (see lib/sites.ts) where the user switched coaching off. */
export const disabledSites = storage.defineItem<string[]>('local:disabledSites', {
  fallback: [],
});

export type Provider = 'anthropic' | 'openai' | 'gemini';

export const PROVIDERS: { id: Provider; name: string; keyHint: string }[] = [
  { id: 'anthropic', name: 'Anthropic', keyHint: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', keyHint: 'sk-…' },
  { id: 'gemini', name: 'Gemini', keyHint: 'AIza…' },
];

export const provider = storage.defineItem<Provider>('local:provider', { fallback: 'anthropic' });

export const apiKeys = storage.defineItem<Partial<Record<Provider, string>>>('local:apiKeys', {
  fallback: {},
});

/** The chosen model per provider. Only Anthropic has a default; the others are picked from the key's own model list. */
export const models = storage.defineItem<Partial<Record<Provider, string>>>('local:models', {
  fallback: { anthropic: 'claude-opus-5-5' },
});

export async function clearAll(): Promise<void> {
  await storage.clear('local');
}
