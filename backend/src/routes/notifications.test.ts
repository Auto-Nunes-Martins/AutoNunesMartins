import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
const fixtures = vi.hoisted(() => ({
  drafts: ['c' + 'a'.repeat(24), 'c' + 'b'.repeat(24)],
  contacts: 1,
}));
vi.mock('../db.js', () => ({
  prisma: {
    vehicle: {
      count: async ({ where }: any) =>
        where.status === 'DRAFT' ? fixtures.drafts.filter((id) => id !== where.id?.not).length : 2,
    },
    task: { count: async () => 0 },
    activityLog: { findMany: async () => [] },
  },
}));
vi.mock('../lib/data/appSettings.js', () => ({ appSettings: { stockAgingDays: async () => 60 } }));
vi.mock('../lib/server/contactNotifications.js', () => ({
  readContactNotifications: async () => ({ unread: fixtures.contacts, items: [] }),
  markContactNotificationRead: vi.fn(),
}));
vi.mock('../middleware/clerk.js', () => ({
  requireUser: (req: any, res: any, next: () => void) => {
    if (req.get('x-denied')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    req.user = { id: 'fixture' };
    next();
  },
}));
import router from './notifications.js';
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use('/notifications', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notifications`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it('scopes draft exclusion to each fresh request while retaining contacts and other drafts across cached overview data', async () => {
  const id = fixtures.drafts[0];
  const active = await fetch(base + '?activeCreationDraftId=' + id).then((r) => r.json());
  expect(active.alerts.draftVehicles).toBe(1);
  expect(active.contacts.unread).toBe(1);
  expect(active.total).toBe(4);
  const outside = await fetch(base).then((r) => r.json());
  expect(outside.alerts.draftVehicles).toBe(2);
  expect(outside.total).toBe(5);
  fixtures.drafts = [fixtures.drafts[1]];
  const deleted = await fetch(base).then((r) => r.json());
  expect(deleted.alerts.draftVehicles).toBe(1);
  expect(deleted.total).toBe(4);
});
it('rejects malformed contexts and unauthorized requests', async () => {
  expect((await fetch(base + '?activeCreationDraftId=bad')).status).toBe(400);
  expect((await fetch(base, { headers: { 'x-denied': 'true' } })).status).toBe(403);
});
