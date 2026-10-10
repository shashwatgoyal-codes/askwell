import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Query } from './db';

// Admin tokens let chosen people use Improve on the owner's key. Only a
// hash is stored: a token is shown once, at creation, and can't be read back.

export const TOKEN_PREFIX = 'pfa_';

export interface TokenRow {
  id: string;
  label: string;
  prefix: string;
  daily_limit: number;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  used_today: number;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** UTC day, the unit daily limits count in. */
export const today = (now = new Date()) => now.toISOString().slice(0, 10);

export async function createToken(
  db: Query,
  input: { label: string; dailyLimit: number; expiresInDays?: number | null },
  now = new Date(),
): Promise<{ id: string; token: string }> {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const id = randomUUID();
  const expires = input.expiresInDays ? new Date(now.getTime() + input.expiresInDays * 86_400_000) : null;
  await db(
    'insert into tokens (id, label, token_hash, prefix, daily_limit, expires_at) values ($1, $2, $3, $4, $5, $6)',
    [id, input.label, hash(token), token.slice(0, TOKEN_PREFIX.length + 6), input.dailyLimit, expires],
  );
  return { id, token };
}

export async function listTokens(db: Query, now = new Date()): Promise<TokenRow[]> {
  return db<TokenRow>(
    `select t.id, t.label, t.prefix, t.daily_limit, t.created_at, t.expires_at, t.revoked_at, t.last_used_at,
            coalesce(u.count, 0)::int as used_today
       from tokens t left join usage u on u.token_id = t.id and u.day = $1
      order by t.revoked_at is not null, t.created_at desc`,
    [today(now)],
  );
}

export async function revokeToken(db: Query, id: string, now = new Date()): Promise<void> {
  await db('update tokens set revoked_at = $2 where id = $1 and revoked_at is null', [id, now]);
}

export async function usedTodayAll(db: Query, now = new Date()): Promise<number> {
  const [row] = await db<{ total: number }>('select coalesce(sum(count), 0)::int as total from usage where day = $1', [today(now)]);
  return row?.total ?? 0;
}

export type Check =
  | { ok: true; token: TokenRow }
  | { ok: false; status: 401 | 403 | 429; error: string };

/** Who is this, and may they still use Improve today? Doesn't count a use. */
export async function checkToken(db: Query, token: string | null, now = new Date()): Promise<Check> {
  if (!token?.startsWith(TOKEN_PREFIX)) return { ok: false, status: 401, error: 'Missing or malformed admin token.' };
  const [row] = await db<TokenRow & { token_hash: string }>(
    `select t.*, coalesce(u.count, 0)::int as used_today
       from tokens t left join usage u on u.token_id = t.id and u.day = $2
      where t.token_hash = $1`,
    [hash(token), today(now)],
  );
  if (!row) return { ok: false, status: 401, error: 'This admin token is not recognised.' };
  if (row.revoked_at) return { ok: false, status: 403, error: 'This admin token has been revoked.' };
  if (row.expires_at && new Date(row.expires_at) <= now) return { ok: false, status: 403, error: 'This admin token has expired.' };
  return { ok: true, token: row };
}

/**
 * Count one use, atomically refusing it once the token's daily limit or the
 * all-tokens cap is reached. The increment and the limit check are one
 * statement, so two requests at once can't both take the last use.
 */
export async function takeUse(db: Query, tokenId: string, dailyLimit: number, globalLimit: number, now = new Date()): Promise<Check | null> {
  if ((await usedTodayAll(db, now)) >= globalLimit) {
    return { ok: false, status: 429, error: 'The portal has reached its daily limit. Try again tomorrow.' };
  }
  const rows = await db(
    `insert into usage (token_id, day, count) values ($1, $2, 1)
     on conflict (token_id, day) do update set count = usage.count + 1 where usage.count < $3
     returning count`,
    [tokenId, today(now), dailyLimit],
  );
  if (rows.length === 0) return { ok: false, status: 429, error: `This token has used its ${dailyLimit} rewrites for today.` };
  await db('update tokens set last_used_at = $2 where id = $1', [tokenId, now]);
  return null;
}
