import type { Improvement } from '@askwell/improve';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleImprove, handleTokenCheck } from './api';
import { memoryDb, type Query } from './db';
import { createToken, revokeToken } from './tokens';

let db: Query;
let token: string;
let id: string;
const improvement: Improvement = { rewrite: 'Better prompt', changes: [] };
const rewrite = vi.fn(async () => improvement);
const env = { ANTHROPIC_API_KEY: 'sk-ant-server-side', GLOBAL_DAILY_LIMIT: '100' };

beforeEach(async () => {
  db = await memoryDb();
  ({ token, id } = await createToken(db, { label: 'Rahul', dailyLimit: 2 }));
  rewrite.mockClear();
});

const post = (body: unknown, auth = `Bearer ${token}`) =>
  new Request('https://portal.test/api/improve', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/improve', () => {
  it('rewrites for a valid token and counts the use', async () => {
    const res = await handleImprove(post({ prompt: 'fix the bug', gaps: [] }), { db, rewrite, env });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, improvement, model: 'claude-opus-5-5' });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const check = await handleTokenCheck(new Request('https://portal.test/api/token', { headers: { authorization: `Bearer ${token}` } }), { db });
    expect(await check.json()).toMatchObject({ ok: true, label: 'Rahul', dailyLimit: 2, usedToday: 1 });
  });

  it('refuses without a token, with a revoked one, and past the daily limit, without calling the provider', async () => {
    expect((await handleImprove(post({ prompt: 'x' }, ''), { db, rewrite, env })).status).toBe(401);
    await handleImprove(post({ prompt: 'one' }), { db, rewrite, env });
    await handleImprove(post({ prompt: 'two' }), { db, rewrite, env });
    const third = await handleImprove(post({ prompt: 'three' }), { db, rewrite, env });
    expect(third.status).toBe(429);
    expect(rewrite).toHaveBeenCalledTimes(2);

    await revokeToken(db, id);
    expect((await handleImprove(post({ prompt: 'x' }), { db, rewrite, env })).status).toBe(403);
    expect(rewrite).toHaveBeenCalledTimes(2);
  });

  it('rejects a malformed body and an oversized prompt', async () => {
    expect((await handleImprove(post({ nope: true }), { db, rewrite, env })).status).toBe(400);
    expect((await handleImprove(post({ prompt: 'x'.repeat(8001) }), { db, rewrite, env })).status).toBe(400);
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('says so when the portal has no provider key, before counting a use', async () => {
    const res = await handleImprove(post({ prompt: 'x' }), { db, env: {} });
    expect(res.status).toBe(503);
    const check = await handleTokenCheck(new Request('https://portal.test/api/token', { headers: { authorization: `Bearer ${token}` } }), { db });
    expect(await check.json()).toMatchObject({ usedToday: 0 });
  });

  it('never returns the server key in an error', async () => {
    const failing = vi.fn(async () => {
      throw new Error('boom sk-ant-server-side');
    });
    const res = await handleImprove(post({ prompt: 'x' }), { db, rewrite: failing, env });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('sk-ant');
  });
});
