'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clearFailures, isLocked, recordFailure } from '@/lib/attempts';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { credentialsMatch, endSession, isAdmin, startSession } from '@/lib/session';
import { createToken, revokeToken } from '@/lib/tokens';

/** Who is trying to sign in, for the lockout: the client IP as the host reports it. */
async function source(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

export type LoginState = { error: string; email: string } | null;

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  // A short pause on every attempt slows guessing even before the lockout.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const db = await getDb();
  const from = await source();
  const email = String(form.get('email') ?? '');
  // The email is handed back so the form keeps it; the password never is.
  if (await isLocked(db, from)) {
    return { error: 'Too many attempts. Sign-in is paused for a while; try again later.', email };
  }
  if (!credentialsMatch(email, String(form.get('password') ?? ''))) {
    await recordFailure(db, from);
    // Never say which of the two was wrong.
    return { error: 'Email or password is not right.', email };
  }
  await clearFailures(db, from);
  await startSession();
  redirect('/');
}

export async function logout(): Promise<void> {
  await endSession();
  redirect('/login');
}

const NewToken = z.object({
  label: z.string().trim().min(1).max(60),
  dailyLimit: z.coerce.number().int().min(1).max(500),
  expiresInDays: z.coerce.number().int().min(0).max(365),
});

export type CreateState = { token?: string; label?: string; error?: string } | null;

export async function create(_: CreateState, form: FormData): Promise<CreateState> {
  if (!(await isAdmin())) redirect('/login');
  const parsed = NewToken.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Give the token a name and a daily limit between 1 and 500.' };
  const { label, dailyLimit, expiresInDays } = parsed.data;
  const { token } = await createToken(await getDb(), { label, dailyLimit, expiresInDays: expiresInDays || null });
  // Refresh the token list beside the form.
  revalidatePath('/');
  return { token, label };
}

export async function revoke(form: FormData): Promise<void> {
  if (!(await isAdmin())) redirect('/login');
  await revokeToken(await getDb(), String(form.get('id')));
  redirect('/');
}
