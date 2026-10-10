import { describe, expect, it } from 'vitest';
import { runChecks, type CheckId, type CheckOptions } from './index';

const ids = (prompt: string, options?: CheckOptions): CheckId[] =>
  runChecks(prompt, options).map((gap) => gap.id);
const strict = { sensitivity: 'strict' } as const;

describe('the mockup prompts', () => {
  it('finds three gaps in the weak prompt, most important first', () => {
    expect(ids('fix the login bug, same as before')).toEqual(['assumedMemory', 'context', 'goal']);
  });

  it('finds nothing in the improved prompt, even on strict', () => {
    const improved =
      'Fix the login bug in my Next.js app. Valid credentials return 401 from /api/auth/login. ' +
      'Error: [paste here]. Expected: redirect to /dashboard. ' +
      'Don’t change the session schema. Reply with a patch only.';
    expect(ids(improved, strict)).toEqual([]);
  });
});

describe('quiet cases', () => {
  it.each(['', 'fix', 'fix the', '   \n  '])('says nothing while still typing: %j', (prompt) => {
    expect(ids(prompt, strict)).toEqual([]);
  });

  it.each([
    'What is a closure in JavaScript?',
    'Write a function that reverses a string in place.',
    'Explain the difference between useMemo and useCallback.',
    'Suggest five names for a planner app.',
    'how do I fix a CORS error in Express',
    'What causes a hydration error in Next.js?',
  ])('leaves an ordinary request alone: %j', (prompt) => {
    expect(ids(prompt)).toEqual([]);
  });
});

describe('assumed memory', () => {
  it.each([
    'fix the login bug, same as before',
    'As you know, we use Next.js for this',
    'do it like before please',
    'as discussed, rename the users table',
    'like last time, keep it short',
  ])('flags %j', (prompt) => {
    expect(ids(prompt)).toContain('assumedMemory');
  });

  it.each([
    'Fix the 401 on /api/auth/login. Expected: redirect to /dashboard.',
    'Before you answer, read the error below carefully.',
    'I know the schema is wrong here.',
  ])('leaves %j alone', (prompt) => {
    expect(ids(prompt)).not.toContain('assumedMemory');
  });

  it('quotes the phrase it found', () => {
    expect(runChecks('same as before please, thanks')[0]?.message).toContain('same as before');
  });
});

describe('context', () => {
  it.each([
    'the signup form is broken again',
    'my tests keep failing on CI',
    'it throws when I click save',
    'login is not working for some users',
    'why do I keep getting a CORS error on my API?',
  ])('flags a bug with no evidence: %j', (prompt) => {
    expect(ids(prompt)).toContain('context');
  });

  it.each([
    'login fails with TypeError: Cannot read properties of undefined (reading \'id\')',
    'the request to /api/session returns 500 after logout',
    'crash at getUser (auth.ts:42) when the session is empty',
    'tests are failing:\n```\nexpected 2, received 3\n```',
    'Prisma throws PrismaClientKnownRequestError on update',
    'the build fails with ENOENT on the icons folder',
  ])('accepts evidence: %j', (prompt) => {
    expect(ids(prompt)).not.toContain('context');
  });

  it.each([
    ['refactor this function to be readable', 'this function'],
    ['why does my code return null here?', 'my code'],
    ['what is wrong with the code below?', 'the code below'],
  ])('flags a reference to something not pasted: %j', (prompt, quoted) => {
    const gap = runChecks(prompt).find((g) => g.id === 'context');
    expect(gap?.message).toContain(quoted);
  });

  it('accepts the reference once the code is pasted', () => {
    expect(ids('refactor this function:\n```js\nfunction a(){return 1}\n```')).not.toContain('context');
  });

  it('ignores error words that only appear inside pasted code', () => {
    expect(ids('Write a parser for this:\n```\nerror: bad token\n```')).toEqual([]);
  });
});

describe('goal', () => {
  it.each([
    'clean up the auth module',
    'optimize the dashboard query',
    'the checkout page is broken on Safari',
  ])('flags no target result: %j', (prompt) => {
    expect(ids(prompt)).toContain('goal');
  });

  it.each([
    'optimize the dashboard query so it runs under 100ms',
    'checkout is broken on Safari; it should show the payment step',
    'fix the redirect: expected /dashboard, got /login',
    'refactor the auth module so that each provider is its own file',
    'refactor this parser to be readable',
    'split the dashboard query into two smaller ones',
  ])('accepts a stated result: %j', (prompt) => {
    expect(ids(prompt)).not.toContain('goal');
  });

  it('is off on relaxed', () => {
    expect(ids('clean up the auth module', { sensitivity: 'relaxed' })).not.toContain('goal');
  });
});

describe('constraints (strict)', () => {
  it('flags a change with no limits', () => {
    expect(ids('refactor the payments service into smaller files', strict)).toContain('constraints');
  });

  it.each([
    'refactor the payments service but keep the public API',
    'migrate the users table without downtime',
    'upgrade to React 19, don’t touch the router',
    'rewrite the parser using only the standard library',
  ])('accepts a stated limit: %j', (prompt) => {
    expect(ids(prompt, strict)).not.toContain('constraints');
  });

  it('is off on balanced', () => {
    expect(ids('refactor the payments service into smaller files')).not.toContain('constraints');
  });

  it('leaves a general how-to question alone', () => {
    expect(ids('how do I fix a CORS error in Express', strict)).toEqual([]);
  });
});

describe('output (strict)', () => {
  it('flags a change with no answer shape', () => {
    expect(ids('rename userId to accountId across the codebase', strict)).toContain('output');
  });

  it.each([
    'rename userId to accountId and show me the diff',
    'fix the race in the queue and explain why it happened',
    'update the config, full file please',
  ])('accepts a stated shape: %j', (prompt) => {
    expect(ids(prompt, strict)).not.toContain('output');
  });
});

describe('options', () => {
  it('skips checks the user switched off', () => {
    expect(ids('fix the login bug, same as before', { disabled: ['context', 'goal'] })).toEqual([
      'assumedMemory',
    ]);
  });
});
