import type { CheckId } from '@askwell/rules';
import { today, type DayStats } from './settings';

// The popup's weekly view: this week against the one before, from the
// daily counts. Pure, so it can be tested without a browser.

export interface Week {
  checked: number;
  gaps: number;
  /** Gaps per prompt; null with no prompts. */
  rate: number | null;
  /** The same rate for the previous seven days; null with no prompts. */
  previousRate: number | null;
  /** The last seven days, oldest first, including days with nothing. */
  days: { day: string; checked: number; gaps: number }[];
  mostCommon: CheckId | null;
}

function shift(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return today(new Date(y, m - 1, d + by));
}

export function summarise(history: DayStats[], now = today()): Week {
  const byDay = new Map(history.map((h) => [h.day, h]));
  const span = (from: number, to: number) => {
    const days = [];
    for (let i = from; i <= to; i++) {
      const day = shift(now, i);
      const h = byDay.get(day);
      days.push({ day, checked: h?.checked ?? 0, gaps: h?.gaps ?? 0, byCheck: h?.byCheck ?? {} });
    }
    return days;
  };
  const week = span(-6, 0);
  const before = span(-13, -7);
  const sum = (days: typeof week, key: 'checked' | 'gaps') => days.reduce((n, d) => n + d[key], 0);
  const rate = (days: typeof week) => (sum(days, 'checked') ? sum(days, 'gaps') / sum(days, 'checked') : null);

  const counts: Partial<Record<CheckId, number>> = {};
  for (const d of week) for (const [id, n] of Object.entries(d.byCheck) as [CheckId, number][]) counts[id] = (counts[id] ?? 0) + n;
  const mostCommon = (Object.entries(counts) as [CheckId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    checked: sum(week, 'checked'),
    gaps: sum(week, 'gaps'),
    rate: rate(week),
    previousRate: rate(before),
    days: week.map(({ day, checked, gaps }) => ({ day, checked, gaps })),
    mostCommon,
  };
}
