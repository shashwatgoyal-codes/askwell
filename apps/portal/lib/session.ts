import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

// One admin: whoever knows ADMIN_PASSWORD. The session is a signed cookie;
// nothing about it is stored.

const COOKIE = 'askwell_admin';
const WEEK = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.');
  return new TextEncoder().encode(value);
}

/** Constant-time, and compares hashes so the lengths always match. */
export function passwordMatches(given: string, expected = process.env.ADMIN_PASSWORD ?? ''): boolean {
  if (!expected) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
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
