import { describe, expect, it } from 'vitest';
import { addSent, type DayStats } from './settings';
import { summarise } from './week';

describe('addSent', () => {
  it('adds to today, starts a new day, and keeps four weeks', () => {
    let h: DayStats[] = [];
    h = addSent(h, ['goal', 'context'], '2026-10-01');
    h = addSent(h, ['goal'], '2026-10-01');
    expect(h).toEqual([{ day: '2026-10-01', checked: 2, gaps: 3, byCheck: { goal: 2, context: 1 } }]);
    h = addSent(h, [], '2026-10-02');
    expect(h.map((d) => d.day)).toEqual(['2026-10-01', '2026-10-02']);

    let long: DayStats[] = [];
    for (let i = 1; i <= 40; i++) long = addSent(long, [], `2026-08-${String(i).padStart(2, '0')}`);
    expect(long).toHaveLength(28);
  });
});

describe('summarise', () => {
  const day = (d: string, checked: number, gaps: number, byCheck = {}) => ({ day: d, checked, gaps, byCheck });

  it('compares this week with the one before, across a month boundary', () => {
    const history = [
      day('2026-09-26', 4, 8, { context: 5, goal: 3 }), // previous week: 2 gaps per prompt
      day('2026-10-03', 5, 2, { goal: 2 }),
      day('2026-10-05', 5, 3, { context: 1, goal: 2 }), // this week: 0.5
    ];
    const week = summarise(history, '2026-10-05');
    expect(week.checked).toBe(10);
    expect(week.gaps).toBe(5);
    expect(week.rate).toBe(0.5);
    expect(week.previousRate).toBe(2);
    expect(week.mostCommon).toBe('goal');
    expect(week.days.map((d) => d.day)).toEqual([
      '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
    ]);
  });

  it('has no rate before anything is sent', () => {
    const week = summarise([], '2026-10-05');
    expect(week.rate).toBeNull();
    expect(week.previousRate).toBeNull();
    expect(week.mostCommon).toBeNull();
  });
});
