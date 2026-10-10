import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { DUMMY_HASH, verifyPassword } from './password';

// One admin: whoever knows ADMIN_EMAIL and the password hashed in ADMIN_PASSWORD_HASH. The session is a signed cookie;
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
 * Both must match: the email (case-insensitive, constant-time) and the
 * password against ADMIN_PASSWORD_HASH. The password is always checked,
 * against a dummy hash if the email is wrong, so timing doesn't reveal
 * which one failed. A plain ADMIN_PASSWORD is not accepted.
 */
export async function credentialsMatch(
  email: string,
  password: string,
  expected = { email: process.env.ADMIN_EMAIL ?? '', passwordHash: process.env.ADMIN_PASSWORD_HASH ?? '' },
): Promise<boolean> {
  if (!expected.email || !expected.passwordHash) return false;
  const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(expected.email.trim().toLowerCase()));
  const passwordOk = await verifyPassword(password, emailOk ? expected.passwordHash : DUMMY_HASH);
  return emailOk && passwordOk;
}

/** Whether sign-in is set up at all, so the page can say what's missing instead of refusing everyone. */
export const signInConfigured = () => Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH);

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
