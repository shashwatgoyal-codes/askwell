import { describe, expect, it } from 'vitest';
import { highlight } from '@/components/coach/ImproveView';
import { Improvement } from '@askwell/improve';

const added = (runs: { text: string; added: boolean }[]) => runs.filter((r) => r.added).map((r) => r.text);

describe('highlight', () => {
  const rewrite = 'Fix the login bug in my Next.js app. Expected: redirect to /dashboard.';

  it('marks the spans the model reported and keeps the rest plain', () => {
    const runs = highlight(rewrite, [' in my Next.js app.', 'Expected: redirect to /dashboard.']);
    expect(runs.map((r) => r.text).join('')).toBe(rewrite);
    expect(added(runs)).toEqual([' in my Next.js app.', 'Expected: redirect to /dashboard.']);
  });

  it('ignores spans that are not in the rewrite instead of guessing', () => {
    expect(added(highlight(rewrite, ['not there', 'Expected']))).toEqual(['Expected']);
  });

  it('finds spans reported out of order', () => {
    expect(added(highlight(rewrite, ['Expected', 'Next.js']))).toEqual(['Next.js', 'Expected']);
  });

  it('keeps the first of two overlapping spans', () => {
    expect(added(highlight(rewrite, ['login bug in', 'bug in my']))).toEqual(['login bug in']);
  });

  it('ignores empty spans', () => {
    expect(highlight(rewrite, ['', '  '])).toEqual([{ text: rewrite, added: false }]);
  });
});

describe('Improvement contract', () => {
  it('accepts a well-formed answer', () => {
    const ok = { rewrite: 'x', changes: [{ kind: 'goal', added: 'x', reason: 'Says what done is.' }] };
    expect(Improvement.safeParse(ok).success).toBe(true);
  });

  it('rejects an unknown change kind and an empty rewrite', () => {
    expect(Improvement.safeParse({ rewrite: 'x', changes: [{ kind: 'vibes', added: '', reason: '' }] }).success).toBe(false);
    expect(Improvement.safeParse({ rewrite: '', changes: [] }).success).toBe(false);
  });
});
