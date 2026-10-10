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

/** Nudges about habits across the conversation, separate from the per-prompt checks. */
export const conversationCoaching = storage.defineItem<boolean>('local:conversationCoaching', {
  fallback: true,
});

export interface DayStats {
  day: string;
  checked: number;
  gaps: number;
  byCheck: Partial<Record<CheckId, number>>;
}

/** Today's counts for the popup. Counts only: never the prompts themselves. */
export const stats = storage.defineItem<DayStats>('local:stats', {
  fallback: { day: '', checked: 0, gaps: 0, byCheck: {} },
});

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function recordSent(gapIds: CheckId[]): Promise<void> {
  const current = await stats.getValue();
  const base = current.day === today() ? current : { day: today(), checked: 0, gaps: 0, byCheck: {} };
  const byCheck = { ...base.byCheck };
  for (const id of gapIds) byCheck[id] = (byCheck[id] ?? 0) + 1;
  await stats.setValue({ day: base.day, checked: base.checked + 1, gaps: base.gaps + gapIds.length, byCheck });
}

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
