import { describe, expect, it } from 'vitest';
import { credentialsMatch } from './session';

const expected = { email: 'Owner@Example.com', password: 'a long password indeed' };

describe('credentialsMatch', () => {
  it('needs both the email and the password', () => {
    expect(credentialsMatch('owner@example.com', 'a long password indeed', expected)).toBe(true);
    expect(credentialsMatch('owner@example.com', 'wrong', expected)).toBe(false);
    expect(credentialsMatch('someone@else.com', 'a long password indeed', expected)).toBe(false);
  });

  it('ignores case and spaces in the email, never in the password', () => {
    expect(credentialsMatch('  OWNER@example.COM ', 'a long password indeed', expected)).toBe(true);
    expect(credentialsMatch('owner@example.com', 'A long password indeed', expected)).toBe(false);
  });

  it('refuses everything when the portal has no credentials configured', () => {
    expect(credentialsMatch('', '', { email: '', password: '' })).toBe(false);
    expect(credentialsMatch('a@b.c', 'x', { email: 'a@b.c', password: '' })).toBe(false);
  });
});
