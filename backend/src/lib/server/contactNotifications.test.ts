import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { contactBudgetFixture } from '../../../test/contactBudgetFixture.js';
import { readContactNotifications, markContactNotificationRead } from './contactNotifications.js';

const fixtures: Awaited<ReturnType<typeof contactBudgetFixture>>[] = [];
async function setup() {
  const f = await contactBudgetFixture();
  fixtures.push(f);
  await f.db.exec(
    `INSERT INTO "User" (id,"deactivatedAt") VALUES ('alice',NULL),('bob',NULL),('inactive',NOW())`,
  );
  const query = {
    query: async <T>(sql: string, values: unknown[] = []) =>
      (await f.db.query(sql, values)).rows as T[],
  };
  return { ...f, query };
}
afterEach(async () => {
  for (const f of fixtures.splice(0)) await f.db.close();
});

it('broadcasts accepted contacts distinctly with per-user durable read receipts and no body/email', async () => {
  const f = await setup();
  const store = f.store();
  const first = await store.reserve('visitor', randomUUID(), 'private@example.org private body');
  if (first.kind !== 'send') throw Error('missing reservation');
  await store.finish(first.key, first.token, true, {
    name: 'Conceição <script>',
    subject: 'Revisão ç & visita',
  });
  await store.finish(first.key, first.token, true, {
    name: 'Conceição <script>',
    subject: 'Revisão ç & visita',
  });
  const second = await store.reserve('other', randomUUID(), 'other body');
  if (second.kind !== 'send') throw Error('missing reservation');
  await store.finish(second.key, second.token, true, { name: 'João', subject: 'Outra visita' });
  const alice = await readContactNotifications(f.query, 'alice');
  const bob = await readContactNotifications(f.query, 'bob');
  expect(alice.unread).toBe(2);
  expect(bob.unread).toBe(2);
  expect(new Set(alice.items.map((n) => n.id)).size).toBe(2);
  expect(alice.items.find((n) => n.name.startsWith('Conceição'))?.subject).toBe(
    'Revisão ç & visita',
  );
  expect(await markContactNotificationRead(f.query, 'alice', 'contact:' + first.key)).toBe(true);
  const afterRead = await readContactNotifications(f.query, 'alice');
  expect(afterRead.unread).toBe(1);
  expect(afterRead.items.map((item) => item.id)).toEqual(['contact:' + second.key]);
  expect((await readContactNotifications(f.query, 'alice')).items).toEqual(afterRead.items);
  expect((await readContactNotifications(f.query, 'bob')).unread).toBe(2);
  expect((await readContactNotifications(f.query, 'bob')).items).toHaveLength(2);
  expect((await readContactNotifications(f.query, 'inactive')).items).toEqual([]);
  expect(await markContactNotificationRead(f.query, 'inactive', 'contact:' + first.key)).toBe(
    false,
  );
  expect(await markContactNotificationRead(f.query, 'alice', 'contact:' + first.key)).toBe(true);
  expect(
    (await f.db.query('SELECT count(*)::int AS n FROM "ContactNotificationRead"')).rows[0],
  ).toEqual({ n: 1 });
  const stored = await f.db.query('SELECT * FROM "ActivityLog"');
  expect(stored.rows).toHaveLength(2);
  expect(JSON.stringify(stored.rows)).not.toMatch(/private@example.org|private body|other body/);
  expect(await markContactNotificationRead(f.query, 'alice', 'contact:' + second.key)).toBe(true);
  expect(await readContactNotifications(f.query, 'alice')).toEqual({ unread: 0, items: [] });
  expect((await f.db.query('SELECT * FROM "ActivityLog"')).rows).toHaveLength(2);
});
it('does not create notifications for pending or failed sends and rolls acceptance back if event persistence fails', async () => {
  const f = await setup();
  const id = randomUUID();
  const store = f.store();
  const attempt = await store.reserve('visitor', id, 'payload');
  if (attempt.kind !== 'send') throw Error('missing reservation');
  expect((await readContactNotifications(f.query, 'alice')).unread).toBe(0);
  await store.finish(attempt.key, attempt.token, false);
  expect((await readContactNotifications(f.query, 'alice')).unread).toBe(0);
  await f.db.exec('ALTER TABLE "ActivityLog" RENAME TO "UnavailableActivityLog"');
  await expect(
    store.finish(attempt.key, attempt.token, true, { name: 'Ana', subject: 'Visita' }),
  ).rejects.toThrow();
  expect((await f.db.query('SELECT status FROM "ContactSendAttempt"')).rows).toEqual([
    { status: 'failed' },
  ]);
  await f.db.exec('ALTER TABLE "UnavailableActivityLog" RENAME TO "ActivityLog"');
  const retry = await store.reserve('visitor', id, 'payload');
  if (retry.kind !== 'send') throw Error('missing retry');
  await store.finish(retry.key, retry.token, true, { name: 'Ana', subject: 'Visita' });
  expect((await readContactNotifications(f.query, 'alice')).unread).toBe(1);
  expect(await store.reserve('visitor', id, 'payload')).toEqual({ kind: 'sent' });
});

it('retains accepted idempotency through the CRM event after expiring attempt metadata', async () => {
  const f = await setup();
  const id = randomUUID();
  const store = f.store();
  const attempt = await store.reserve('visitor', id, 'payload');
  if (attempt.kind !== 'send') throw Error('missing reservation');
  await Promise.all([
    store.finish(attempt.key, attempt.token, true, { name: 'Ana', subject: 'Visita' }),
    store.finish(attempt.key, attempt.token, true, { name: 'Ana', subject: 'Visita' }),
  ]);
  await f.db.exec('DELETE FROM "ContactSendAttempt"');
  expect(await store.reserve('visitor', id, 'payload')).toEqual({ kind: 'sent' });
  expect((await store.reserve('visitor', id, 'changed payload')).kind).toBe('conflict');
  expect((await readContactNotifications(f.query, 'alice')).unread).toBe(1);
});
