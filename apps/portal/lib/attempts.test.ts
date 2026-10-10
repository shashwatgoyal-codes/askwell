import { beforeEach, describe, expect, it } from 'vitest';
import { clearFailures, isLocked, recordFailure } from './attempts';
import { memoryDb, type Query } from './db';

let db: Query;
beforeEach(async () => {
  db = await memoryDb();
});
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 10, 12, 0) + minutes * 60_000);

describe('sign-in lockout', () => {
  it('locks one source after 5 failures in 15 minutes, and lets it go after', async () => {
    for (let i = 0; i < 4; i++) await recordFailure(db, 'ip-a', at(i));
    expect(await isLocked(db, 'ip-a', at(5))).toBe(false);
    await recordFailure(db, 'ip-a', at(5));
    expect(await isLocked(db, 'ip-a', at(6))).toBe(true);
    expect(await isLocked(db, 'ip-b', at(6))).toBe(false);
    expect(await isLocked(db, 'ip-a', at(21))).toBe(false);
  });

  it('locks everyone after 20 failures in an hour from many sources', async () => {
    for (let i = 0; i < 20; i++) await recordFailure(db, `ip-${i}`, at(i * 2));
    expect(await isLocked(db, 'ip-new', at(41))).toBe(true);
    expect(await isLocked(db, 'ip-new', at(101))).toBe(false);
  });

  it('clears a source’s failures on success', async () => {
    for (let i = 0; i < 5; i++) await recordFailure(db, 'ip-a', at(i));
    await clearFailures(db, 'ip-a');
    expect(await isLocked(db, 'ip-a', at(6))).toBe(false);
  });
});
