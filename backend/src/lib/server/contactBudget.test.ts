import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { contactBudgetFixture } from '../../../test/contactBudgetFixture.js';
import { createContactBudgetStore } from './contactBudget.js';

const fixtures: Awaited<ReturnType<typeof contactBudgetFixture>>[] = [];
async function setup(limits = { daily: 20, monthly: 1000 }) {
  const f = await contactBudgetFixture(limits);
  fixtures.push(f);
  return f;
}
afterEach(async () => {
  for (const f of fixtures.splice(0)) await f.db.close();
});
const request = () => randomUUID();

describe('durable contact reservations on isolated PostgreSQL', () => {
  it('shares atomic daily quotas across independently created stores and concurrent requests', async () => {
    const f = await setup();
    const results = await Promise.all(
      Array.from({ length: 35 }, (_, i) =>
        f.store().reserve('visitor-' + i, request(), 'private message'),
      ),
    );
    expect(results.filter((r) => r.kind === 'send')).toHaveLength(20);
    expect(results.filter((r) => r.kind === 'limited')).toHaveLength(15);
    expect(
      (await f.db.query('SELECT "count" FROM "ContactBudgetCounter" WHERE "key" LIKE \'day:%\''))
        .rows,
    ).toEqual([{ count: 20 }]);
    // Recreating the application store does not reset PostgreSQL counters.
    expect((await f.store().reserve('another', request(), 'payload')).kind).toBe('limited');
  }, 20_000);
  it('keeps the visitor window, then resets daily and monthly limits at UTC boundaries', async () => {
    const f = await setup({ daily: 6, monthly: 7 });
    for (let i = 0; i < 5; i++)
      expect((await f.store().reserve('same', request(), 'payload')).kind).toBe('send');
    expect((await f.store().reserve('same', request(), 'payload')).kind).toBe('limited');
    expect((await f.store().reserve('other', request(), 'payload')).kind).toBe('send');
    f.advance(600_000);
    expect((await f.store().reserve('same', request(), 'payload')).kind).toBe('limited');
    f.setTime('2026-10-28T00:00:00Z');
    expect((await f.store().reserve('same', request(), 'payload')).kind).toBe('send');
    expect((await f.store().reserve('different', request(), 'payload')).kind).toBe('limited');
    f.setTime('2026-11-01T00:00:00Z');
    expect((await f.store().reserve('different', request(), 'payload')).kind).toBe('send');
  });
  it('renews the same visitor after ten minutes when global budgets remain available', async () => {
    const f = await setup();
    for (let i = 0; i < 5; i++) await f.store().reserve('same', request(), 'payload');
    const denied = await f.store().reserve('same', request(), 'payload');
    expect(denied).toEqual({ kind: 'limited', retryAfter: 600 });
    f.advance(600_000);
    expect((await f.store().reserve('same', request(), 'payload')).kind).toBe('send');
  });
  it('deduplicates success, rejects payload changes and fences overlapping retry completions', async () => {
    const f = await setup();
    const id = request();
    const first = await f.store().reserve('visitor', id, 'private payload');
    expect(first.kind).toBe('send');
    if (first.kind !== 'send') throw Error('reservation missing');
    expect((await f.store().reserve('visitor', id, 'private payload')).kind).toBe('limited');
    expect((await f.store().reserve('visitor', id, 'different payload')).kind).toBe('conflict');
    f.advance(60_000);
    const second = await f.store().reserve('visitor', id, 'private payload');
    if (second.kind !== 'send') throw Error('retry missing');
    await f.store().finish(first.key, first.token, true, { name: 'Alice', subject: 'Visit' });
    expect((await f.store().reserve('visitor', id, 'private payload')).kind).toBe('limited');
    await f.store().finish(second.key, second.token, true, { name: 'Alice', subject: 'Visit' });
    expect(await f.store().reserve('visitor', id, 'private payload')).toEqual({ kind: 'sent' });
    expect(
      (await f.db.query('SELECT "count" FROM "ContactBudgetCounter" WHERE "key" LIKE \'day:%\''))
        .rows,
    ).toEqual([{ count: 2 }]);
  });
  it('charges failed attempts and stops uncertain retries before provider idempotency expires', async () => {
    const f = await setup();
    const id = request();
    const first = await f.store().reserve('visitor', id, 'payload');
    if (first.kind !== 'send') throw Error('reservation missing');
    await f.store().finish(first.key, first.token, false);
    const retry = await f.store().reserve('visitor', id, 'payload');
    expect(retry.kind).toBe('send');
    expect(
      (
        await f.db.query(
          'SELECT \"count\" FROM \"ContactBudgetCounter\" WHERE \"key\" LIKE \'day:%\'',
        )
      ).rows,
    ).toEqual([{ count: 2 }]);
    f.advance(23 * 3_600_000);
    expect((await f.store().reserve('visitor', id, 'payload')).kind).toBe('conflict');
  });
  it('stores only keyed metadata, bounds state and removes expired rows', async () => {
    const f = await setup();
    await f.store().reserve('192.0.2.1', request(), 'visitor@example.org private message');
    const stored = await f.db.query('SELECT * FROM "ContactSendAttempt"');
    expect(JSON.stringify(stored.rows)).not.toMatch(
      /192\.0\.2\.1|visitor@example.org|private message/,
    );
    await f.db
      .exec(`INSERT INTO "ContactSendAttempt" ("key","payloadHash","status","firstAt","leaseUntil","expiresAt","token")
      SELECT lpad(to_hex(i),64,'0'),repeat('a',64),'failed',NOW(),NOW(),NOW()+INTERVAL '100 days',1
      FROM generate_series(1,9999) AS i`);
    expect((await f.store().reserve('new', request(), 'payload')).kind).toBe('limited');
    await f.db.exec(`UPDATE "ContactSendAttempt" SET "expiresAt"='2026-01-01'`);
    expect((await f.store().reserve('new', request(), 'payload')).kind).toBe('send');
    expect(
      (await f.db.query('SELECT count(*)::int AS n FROM "ContactSendAttempt"')).rows[0],
    ).toEqual({ n: 9751 });
    const rls = await f.db.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname IN ('ContactSendAttempt','ContactBudgetCounter')`,
    );
    expect(rls.rows.every((r) => r.relrowsecurity === true)).toBe(true);
  });
  it('fails closed instead of falling back to a per-process counter', async () => {
    const store = createContactBudgetStore(
      {
        transaction: async () => {
          throw Error('db down');
        },
      },
      'fixture-secret',
      { daily: 20, monthly: 1000 },
    );
    await expect(store.reserve('visitor', request(), 'payload')).rejects.toThrow('db down');
  });
});
