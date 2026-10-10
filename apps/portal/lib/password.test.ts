import { describe, expect, it } from 'vitest';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

describe('admin password hashing', () => {
  it('verifies the right password and nothing else', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^scrypt:32768:8:1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain('correct');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash, so the same password never hashes the same twice', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('never matches a malformed or weakened hash', async () => {
    const hash = await hashPassword('pw');
    const parts = hash.split(':');
    for (const bad of [
      '',
      'plaintext-password',
      hash.replace('scrypt', 'md5'),
      [...parts.slice(0, 1), '2', ...parts.slice(2)].join(':'), // N weakened to 2
      [...parts.slice(0, 5), 'AAAA'].join(':'), // truncated key
      parts.slice(0, 5).join(':'),
    ]) {
      expect(await verifyPassword('pw', bad)).toBe(false);
    }
  });

  it('has a dummy hash that is well-formed and matches nothing', async () => {
    expect(await verifyPassword('', DUMMY_HASH)).toBe(false);
    expect(await verifyPassword('anything', DUMMY_HASH)).toBe(false);
  });
});
