import type { Query } from './db';

// Brute-force protection for /login. Failures are counted per source (the
// client's IP) and across all sources, so one machine guessing fast and many
// machines guessing slowly are both stopped. While locked, even the right
// password is refused: otherwise a lockout would only slow guessing down.

export const PER_SOURCE = { failures: 5, windowMinutes: 15 };
export const OVERALL = { failures: 20, windowMinutes: 60 };

const since = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

export async function isLocked(db: Query, source: string, now = new Date()): Promise<boolean> {
  const [row] = await db<{ mine: number; all: number }>(
    `select count(*) filter (where source = $1 and at > $2)::int as mine,
            count(*) filter (where at > $3)::int as all
       from login_failures`,
    [source, since(now, PER_SOURCE.windowMinutes), since(now, OVERALL.windowMinutes)],
  );
  return (row?.mine ?? 0) >= PER_SOURCE.failures || (row?.all ?? 0) >= OVERALL.failures;
}

export async function recordFailure(db: Query, source: string, now = new Date()): Promise<void> {
  await db('insert into login_failures (source, at) values ($1, $2)', [source, now]);
  // Keep the table small: nothing older than the longest window matters.
  await db('delete from login_failures where at < $1', [since(now, OVERALL.windowMinutes)]);
}

/** A successful sign-in clears that source's failures. */
export async function clearFailures(db: Query, source: string): Promise<void> {
  await db('delete from login_failures where source = $1', [source]);
}
