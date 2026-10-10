import { improve, ImproveError, type Improvement } from '@askwell/improve';
import type { Gap } from '@askwell/rules';
import { z } from 'zod';
import type { Query } from './db';
import { checkToken, takeUse } from './tokens';

// The two endpoints the extension calls, as plain functions of a Request so
// they can be tested without a server. The route files only wire them up.

// Called from an extension's background worker, which sends the token in a
// header and no cookies, so any origin may call these.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

const Body = z.object({
  prompt: z.string().min(1).max(8000),
  gaps: z
    .array(z.object({ id: z.string(), message: z.string(), hint: z.string(), title: z.string().optional() }))
    .max(30)
    .default([]),
});

export interface Deps {
  db: Query;
  /** The rewrite itself; swapped out in tests so nothing is billed. */
  rewrite?: (prompt: string, gaps: Gap[]) => Promise<Improvement>;
  env?: Record<string, string | undefined>;
}

const model = (env: Deps['env']) => env?.PORTAL_MODEL || 'claude-opus-5-5';

export async function handleTokenCheck(request: Request, { db }: Deps): Promise<Response> {
  const check = await checkToken(db, bearer(request));
  if (!check.ok) return json({ ok: false, error: check.error }, check.status);
  const { label, daily_limit, used_today, expires_at } = check.token;
  return json({ ok: true, label, dailyLimit: daily_limit, usedToday: used_today, expiresAt: expires_at });
}

export async function handleImprove(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  const check = await checkToken(deps.db, bearer(request));
  if (!check.ok) return json({ ok: false, error: check.error }, check.status);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json({ ok: false, error: 'The request was not a prompt Preflight can rewrite.' }, 400);
  }

  const key = env.ANTHROPIC_API_KEY;
  const rewrite =
    deps.rewrite ??
    (key ? (prompt: string, gaps: Gap[]) => improve('anthropic', key, model(env), prompt, gaps) : undefined);
  if (!rewrite) return json({ ok: false, error: 'The portal has no provider key configured.' }, 503);

  const globalLimit = Number(env.GLOBAL_DAILY_LIMIT) || 200;
  const refused = await takeUse(deps.db, check.token.id, check.token.daily_limit, globalLimit);
  if (refused && !refused.ok) return json({ ok: false, error: refused.error }, refused.status);

  try {
    const improvement = await rewrite(body.prompt, body.gaps as Gap[]);
    return json({ ok: true, improvement, model: model(env) });
  } catch (error) {
    const message = error instanceof ImproveError ? error.message : 'The rewrite failed on the portal.';
    // The owner's key and its errors stay on the server; the person sees a summary.
    return json({ ok: false, error: message.replace(/this key/gi, 'the portal’s key') }, 502);
  }
}
