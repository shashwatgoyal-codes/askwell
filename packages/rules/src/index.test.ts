import { describe, expect, it } from 'vitest';
import { runChecks } from './index';

describe('assumed memory', () => {
  it.each([
    'fix the login bug, same as before',
    'As you know, we use Next.js',
    'do it like before',
    'as discussed, rename the table',
    'like last time, keep it short',
  ])('flags %j', (prompt) => {
    expect(runChecks(prompt).map((gap) => gap.id)).toContain('assumedMemory');
  });

  it.each([
    'Fix the 401 on /api/auth/login. Expected: redirect to /dashboard.',
    'Before you answer, read the error below.',
    'I know the schema is wrong.',
  ])('leaves %j alone', (prompt) => {
    expect(runChecks(prompt).map((gap) => gap.id)).not.toContain('assumedMemory');
  });

  it('quotes the phrase it found', () => {
    expect(runChecks('same as before please')[0]?.message).toContain('same as before');
  });
});
