import { beforeEach, describe, expect, it } from 'vitest';
import { memoryDb, type Query } from './db';
import { checkToken, createToken, listTokens, revokeToken, takeUse, TOKEN_PREFIX } from './tokens';

let db: Query;
beforeEach(async () => {
  db = await memoryDb();
});

describe('admin tokens', () => {
  it('stores only a hash and recognises the token it returned once', async () => {
    const { token } = await createToken(db, { label: 'Rahul', dailyLimit: 5 });
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    const rows = await db<{ token_hash: string }>('select token_hash from tokens');
    expect(rows[0]!.token_hash).not.toContain(token.slice(TOKEN_PREFIX.length));
    const check = await checkToken(db, token);
    expect(check.ok && check.token.label).toBe('Rahul');
  });

  it('refuses unknown, malformed, revoked and expired tokens', async () => {
    expect(await checkToken(db, null)).toMatchObject({ ok: false, status: 401 });
    expect(await checkToken(db, 'sk-ant-something')).toMatchObject({ ok: false, status: 401 });
    expect(await checkToken(db, `${TOKEN_PREFIX}nope`)).toMatchObject({ ok: false, status: 401 });

    const revoked = await createToken(db, { label: 'A', dailyLimit: 5 });
    await revokeToken(db, revoked.id);
    expect(await checkToken(db, revoked.token)).toMatchObject({ ok: false, status: 403, error: 'This admin token has been revoked.' });

    const start = new Date('2026-10-01T00:00:00Z');
    const expiring = await createToken(db, { label: 'B', dailyLimit: 5, expiresInDays: 7 }, start);
    expect((await checkToken(db, expiring.token, new Date('2026-10-07T00:00:00Z'))).ok).toBe(true);
    expect(await checkToken(db, expiring.token, new Date('2026-10-08T00:00:01Z'))).toMatchObject({ status: 403 });
  });

  it('enforces the daily limit, and resets the next day', async () => {
    const { id } = await createToken(db, { label: 'C', dailyLimit: 2 });
    const day1 = new Date('2026-10-10T10:00:00Z');
    expect(await takeUse(db, id, 2, 100, day1)).toBeNull();
    expect(await takeUse(db, id, 2, 100, day1)).toBeNull();
    expect(await takeUse(db, id, 2, 100, day1)).toMatchObject({ status: 429 });
    expect(await takeUse(db, id, 2, 100, new Date('2026-10-11T00:00:01Z'))).toBeNull();
  });

  it('never lets concurrent requests overshoot the limit', async () => {
    const { id } = await createToken(db, { label: 'D', dailyLimit: 3 });
    const results = await Promise.all(Array.from({ length: 10 }, () => takeUse(db, id, 3, 100)));
    expect(results.filter((r) => r === null)).toHaveLength(3);
  });

  it('stops every token at the global cap', async () => {
    const a = await createToken(db, { label: 'E', dailyLimit: 10 });
    const b = await createToken(db, { label: 'F', dailyLimit: 10 });
    expect(await takeUse(db, a.id, 10, 2)).toBeNull();
    expect(await takeUse(db, b.id, 10, 2)).toBeNull();
    expect(await takeUse(db, b.id, 10, 2)).toMatchObject({ status: 429, error: expect.stringContaining('portal') });
  });

  it('lists tokens with today’s use, revoked last', async () => {
    const first = await createToken(db, { label: 'First', dailyLimit: 5 });
    await createToken(db, { label: 'Second', dailyLimit: 5 });
    await takeUse(db, first.id, 5, 100);
    await revokeToken(db, first.id);
    const list = await listTokens(db);
    expect(list.map((t) => [t.label, t.used_today])).toEqual([
      ['Second', 0],
      ['First', 1],
    ]);
  });
});
