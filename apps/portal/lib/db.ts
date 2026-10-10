import { neon } from '@neondatabase/serverless';

// A database is one function: run SQL with parameters, get rows back. Neon
// in production; PGlite, an in-memory Postgres, when DATABASE_URL is unset,
// so the portal runs and is tested without any account.

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export const SCHEMA = `
create table if not exists tokens (
  id text primary key,
  label text not null,
  token_hash text not null unique,
  prefix text not null,
  daily_limit integer not null check (daily_limit > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create table if not exists usage (
  token_id text not null references tokens(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (token_id, day)
);
`;

export async function memoryDb(): Promise<Query> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(SCHEMA);
  return async (text, params = []) => (await db.query(text, params)).rows as never[];
}

function neonDb(url: string): Query {
  const sql = neon(url);
  return async (text, params = []) => (await sql.query(text, params)) as never[];
}

// Next.js loads route handlers, pages and server actions as separate copies
// of this module, so a module-level variable would give each its own
// in-memory database. globalThis is shared by all of them.
const holder = globalThis as unknown as { __askwellDb?: Promise<Query> };

/** The process-wide database. The schema is created on first use, idempotently. */
export function getDb(): Promise<Query> {
  holder.__askwellDb ??= (async () => {
    const url = process.env.DATABASE_URL;
    // The in-memory database forgets everything on restart, and serverless
    // hosts restart constantly: tokens would vanish. Refuse rather than lose them.
    if (!url && process.env.VERCEL) throw new Error('DATABASE_URL must be set when the portal runs on Vercel.');
    if (!url) return memoryDb();
    const db = neonDb(url);
    for (const statement of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db(statement);
    return db;
  })();
  return holder.__askwellDb;
}
