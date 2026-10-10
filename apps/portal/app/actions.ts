'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { endSession, isAdmin, passwordMatches, startSession } from '@/lib/session';
import { createToken, revokeToken } from '@/lib/tokens';

export async function login(_: string | null, form: FormData): Promise<string | null> {
  // A short pause on every attempt makes guessing the password slow.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!passwordMatches(String(form.get('password') ?? ''))) return 'That password is not right.';
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
