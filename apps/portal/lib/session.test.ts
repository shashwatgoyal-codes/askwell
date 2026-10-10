import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from './password';
import { credentialsMatch } from './session';

let expected: { email: string; passwordHash: string };
beforeAll(async () => {
  expected = { email: 'Owner@Example.com', passwordHash: await hashPassword('a long password indeed') };
});

describe('credentialsMatch', () => {
  it('needs both the email and the password', async () => {
    expect(await credentialsMatch('owner@example.com', 'a long password indeed', expected)).toBe(true);
    expect(await credentialsMatch('owner@example.com', 'wrong', expected)).toBe(false);
    expect(await credentialsMatch('someone@else.com', 'a long password indeed', expected)).toBe(false);
  });

  it('ignores case and spaces in the email, never in the password', async () => {
    expect(await credentialsMatch('  OWNER@example.COM ', 'a long password indeed', expected)).toBe(true);
    expect(await credentialsMatch('owner@example.com', 'A long password indeed', expected)).toBe(false);
  });

  it('refuses everything when sign-in isn’t configured, and never accepts a plain password', async () => {
    expect(await credentialsMatch('', '', { email: '', passwordHash: '' })).toBe(false);
    expect(await credentialsMatch('a@b.c', 'plain', { email: 'a@b.c', passwordHash: 'plain' })).toBe(false);
  });
});
