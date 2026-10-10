import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// The admin password is never stored: only a salted scrypt hash, in
// ADMIN_PASSWORD_HASH. scrypt is deliberately slow and memory-hungry, so a
// leaked hash can't feasibly be turned back into the password.
//
// Format: scrypt:<N>:<r>:<p>:<salt, base64>:<hash, base64>. Colons, not dollar
// signs, because .env files expand $NAME and would mangle the hash.

const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number }): Promise<Buffer> {
  // scrypt needs about 128 · N · r bytes; allow twice that.
  const options: ScryptOptions = { ...params, maxmem: 256 * params.N * params.r };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join(':');
}

/** True only for the password this hash was made from. Malformed hashes never match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  // Refuse silly parameters rather than let a tampered hash weaken or hang the check.
  if (![N, r, p].every(Number.isInteger) || N < 2 ** 14 || N > 2 ** 20 || r < 8 || r > 32 || p < 1 || p > 4) return false;
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, salt, { N, r, p });
  return timingSafeEqual(actual, expected);
}

/** A real-format hash of nothing in particular, verified against when the email is wrong so timing doesn't tell. */
export const DUMMY_HASH = 'scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA==:' + Buffer.alloc(KEY_LENGTH).toString('base64');
