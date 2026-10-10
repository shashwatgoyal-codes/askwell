import { describe, expect, it } from 'vitest';
import { checkSession } from './session';

const id = (previous: string[], draft: string) => checkSession({ previous, draft })?.id ?? null;

describe('sequential fixing', () => {
  const errors = [
    "TypeError: Cannot read properties of undefined (reading 'id') at getUser (auth.ts:42)",
    'now this: PrismaClientKnownRequestError P2025 at updateSession',
  ];

  it('nudges on the third lone error in a row, as in the mockup', () => {
    const nudge = checkSession({ previous: errors, draft: 'another one: 500 on /api/session/refresh' });
    expect(nudge?.id).toBe('sequentialFixing');
    expect(nudge?.title).toBe('Third error in a row.');
    expect(nudge?.template).toContain('another one: 500 on /api/session/refresh');
  });

  it('counts only the unbroken run at the end', () => {
    expect(id([errors[0]!, 'thanks, now add a dark mode toggle', errors[1]!], 'the build fails with ENOENT on icons')).toBeNull();
  });

  it('waits for two errors before the draft', () => {
    expect(id([errors[0]!], 'another one: 500 on /api/session/refresh')).toBeNull();
  });

  it('ignores a draft that is not an error', () => {
    expect(id(errors, 'ok, explain why that happens in Prisma')).toBeNull();
  });
});

describe('repeat loop', () => {
  it('nudges when the same fix is asked for again', () => {
    expect(id(['add input validation to the signup route', 'do the same for the login route'], 'now do the same for the reset route')).toBe(
      'repeatLoop',
    );
  });

  it('needs an earlier repeat, not just one', () => {
    expect(id(['add input validation to the signup route'], 'do the same for the login route')).toBeNull();
  });
});

describe('context loss', () => {
  it.each(['continue where we left off on the auth refactor', 'pick up the dashboard work from last time', 'add tests to the app we built'])(
    'nudges a new chat that leans on earlier work: %j',
    (draft) => {
      expect(id([], draft)).toBe('contextLoss');
    },
  );

  it('stays quiet once the chat has history', () => {
    expect(id(['we are building a planner in Next.js'], 'continue with the calendar view')).toBeNull();
  });

  it('keeps the draft below the summary lines', () => {
    expect(checkSession({ previous: [], draft: 'continue the auth refactor' })?.template).toMatch(/Next: .*\n\ncontinue the auth refactor$/s);
  });
});

describe('learning loop', () => {
  const long = Array.from({ length: 10 }, (_, i) => `message ${i} about the project`);

  it.each(['thanks, that works', 'perfect', 'it works now!'])('offers a summary when a long session wraps up: %j', (draft) => {
    expect(id(long, draft)).toBe('learningLoop');
  });

  it('not in a short session', () => {
    expect(id(long.slice(0, 4), 'thanks, that works')).toBeNull();
  });
});

describe('quiet', () => {
  it('says nothing for an ordinary next message', () => {
    expect(id(['we use Next.js 16 with Prisma'], 'add a settings page with a theme switch')).toBeNull();
  });

  it('says nothing while still typing', () => {
    expect(id(['a', 'b'], 'fix')).toBeNull();
  });
});
