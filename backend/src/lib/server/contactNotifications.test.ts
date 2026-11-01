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

it('keeps read receipts across fresh reads, concurrent repeats and new contacts for each user', async () => {
  const f = await setup();
  const accepted = await f.store().reserve('first', randomUUID(), 'fixture payload');
  if (accepted.kind !== 'send') throw Error('missing reservation');
  await f.store().finish(accepted.key, accepted.token, true, { name: 'Ana', subject: 'Primeiro' });
  const id = 'contact:' + accepted.key;
  expect(
    await Promise.all(
      Array.from({ length: 5 }, () => markContactNotificationRead(f.query, 'alice', id)),
    ),
  ).toEqual(Array(5).fill(true));
  for (let poll = 0; poll < 3; poll++) {
    const freshQuery = {
      query: async <T>(sql: string, values: unknown[] = []) =>
        (await f.db.query(sql, values)).rows as T[],
    };
    expect(await readContactNotifications(freshQuery, 'alice')).toEqual({ unread: 0, items: [] });
  }
  expect(
    (await f.db.query('SELECT count(*)::int AS n FROM "ContactNotificationRead"')).rows,
  ).toEqual([{ n: 1 }]);
  expect((await readContactNotifications(f.query, 'bob')).items.map((item) => item.id)).toEqual([
    id,
  ]);
  const next = await f.store().reserve('next', randomUUID(), 'next fixture');
  if (next.kind !== 'send') throw Error('missing reservation');
  await f.store().finish(next.key, next.token, true, { name: 'João', subject: 'Novo contacto' });
  const alice = await readContactNotifications(f.query, 'alice');
  expect(alice.unread).toBe(1);
  expect(alice.items.map((item) => item.id)).toEqual(['contact:' + next.key]);
  expect((await readContactNotifications(f.query, 'bob')).unread).toBe(2);
});

it('keeps badge and list in one snapshot when a read commits during notification loading', async () => {
  const f = await setup(),
    attempt = await f.store().reserve('first', randomUUID(), 'fixture');
  if (attempt.kind !== 'send') throw Error('missing reservation');
  await f
    .store()
    .finish(attempt.key, attempt.token, true, { name: 'Ana', subject: 'Concorrência' });
  let interleaved = false;
  const interleavedQuery = {
    query: async <T>(sql: string, values: unknown[] = []) => {
      const rows = await f.query.query<T>(sql, values);
      if (!interleaved && sql.includes('FROM "ActivityLog"')) {
        interleaved = true;
        await markContactNotificationRead(f.query, 'alice', 'contact:' + attempt.key);
      }
      return rows;
    },
  };
  const snapshot = await readContactNotifications(interleavedQuery, 'alice');
  expect(interleaved).toBe(true);
  expect(snapshot.unread).toBe(snapshot.items.length);
  expect(await readContactNotifications(f.query, 'alice')).toEqual({ unread: 0, items: [] });
});

it('counts all unread contacts while limiting the displayed previews to twenty', async () => {
  const f = await setup();
  await f.db.exec(`INSERT INTO "ActivityLog" (id,type,metadata,"createdAt")
    SELECT 'contact:'||lpad(i::text,64,'0'),'CONTACT_REQUEST_RECEIVED',
      jsonb_build_object('name','Fixture '||i,'subject','Test'),now()+i*interval '1 second'
    FROM generate_series(1,25) i`);
  const result = await readContactNotifications(f.query, 'alice');
  expect(result.unread).toBe(25);
  expect(result.items).toHaveLength(20);
});
