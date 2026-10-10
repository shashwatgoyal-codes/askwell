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

/** The last four weeks of daily counts, oldest first. Counts only: never the prompts themselves. */
export const history = storage.defineItem<DayStats[]>('local:history', {
  fallback: [],
});

/** How many days of counts are kept. */
const KEEP_DAYS = 28;

export function today(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Pure, for tests: the history after one more sent prompt with these gaps. */
export function addSent(days: DayStats[], gapIds: CheckId[], day = today()): DayStats[] {
  const last = days[days.length - 1];
  const base: DayStats = last?.day === day ? last : { day, checked: 0, gaps: 0, byCheck: {} };
  const byCheck = { ...base.byCheck };
  for (const id of gapIds) byCheck[id] = (byCheck[id] ?? 0) + 1;
  const next = { day, checked: base.checked + 1, gaps: base.gaps + gapIds.length, byCheck };
  const kept = last?.day === day ? days.slice(0, -1) : days;
  return [...kept, next].slice(-KEEP_DAYS);
}

export async function recordSent(gapIds: CheckId[]): Promise<void> {
  await history.setValue(addSent(await history.getValue(), gapIds));
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
