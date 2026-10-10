import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

// One admin: whoever knows ADMIN_EMAIL and ADMIN_PASSWORD. The session is a signed cookie;
// nothing about it is stored.

const COOKIE = 'askwell_admin';
const WEEK = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.');
  return new TextEncoder().encode(value);
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Both must match. Constant-time, and compares hashes so lengths always
 * match; the email is compared case-insensitively. Both comparisons always
 * run, so timing doesn't reveal which one failed.
 */
export function credentialsMatch(
  email: string,
  password: string,
  expected = { email: process.env.ADMIN_EMAIL ?? '', password: process.env.ADMIN_PASSWORD ?? '' },
): boolean {
  if (!expected.email || !expected.password) return false;
  const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(expected.email.trim().toLowerCase()));
  const passwordOk = timingSafeEqual(digest(password), digest(expected.password));
  return emailOk && passwordOk;
}

export async function startSession(): Promise<void> {
  const jwt = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${WEEK}s`).sign(secret());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: WEEK });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return false;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}
