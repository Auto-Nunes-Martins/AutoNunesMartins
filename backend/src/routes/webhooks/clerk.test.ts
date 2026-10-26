vi.mock('../../db.js', () => ({ prisma: {} }));
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Webhook } from 'svix';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { CLERK_WEBHOOK_SECRET: undefined as string | undefined },
  upsert: vi.fn(),
  deactivate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('../../env.js', () => ({ getEnv: () => mocks.env }));
vi.mock('../../lib/server/userLifecycle.js', () => ({
  syncLocalUser: mocks.upsert,
  deactivateLocalUser: mocks.deactivate,
}));
vi.mock('../../logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../users.js', () => ({ invalidateUsersCache: mocks.invalidate }));
import router from './clerk.js';

const secret = 'whsec_' + Buffer.from('local-signature-test-only-32-bytes').toString('base64');
const user = {
  type: 'user.created',
  data: {
    id: 'user_test',
    email_addresses: [{ id: 'email', email_address: 'test@example.org' }],
    primary_email_address_id: 'email',
    first_name: 'Test',
    last_name: 'User',
    has_image: false,
    image_url: null,
  },
};
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.raw({ type: 'application/json' }));
  app.use((req, _res, next) => {
    Object.assign(req, { rawBody: req.body });
    next();
  });
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.CLERK_WEBHOOK_SECRET = secret;
  mocks.upsert.mockResolvedValue({ id: 'internal-user' });
});
function signed(body: string) {
  const id = 'msg_local_test',
    now = new Date();
  return {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
    'svix-signature': new Webhook(secret).sign(id, now, body),
  };
}
it('fails closed before any user writes when no signing secret is configured', async () => {
  mocks.env.CLERK_WEBHOOK_SECRET = undefined;
  const body = JSON.stringify(user);
  for (const headers of [{ 'content-type': 'application/json' }, signed(body)]) {
    const response = await fetch(base, { method: 'POST', headers, body });
    expect(response.status).toBe(503);
  }
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
it('accepts and syncs a correctly signed event with the configured secret', async () => {
  const body = JSON.stringify(user);
  const response = await fetch(base, { method: 'POST', headers: signed(body), body });
  expect(response.status).toBe(200);
  expect(mocks.upsert).toHaveBeenCalledWith(
    'user_test',
    expect.objectContaining({ email: 'test@example.org' }),
  );
  expect(mocks.invalidate).toHaveBeenCalledOnce();
});
it('rejects missing signatures and tampered signed payloads without writes', async () => {
  const body = JSON.stringify(user);
  expect(
    (await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body }))
      .status,
  ).toBe(400);
  expect(
    (
      await fetch(base, {
        method: 'POST',
        headers: signed(body),
        body: body.replace('Test', 'Tampered'),
      })
    ).status,
  ).toBe(401);
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.invalidate).not.toHaveBeenCalled();
});

it('accepts a signed deletion with only an ID and never runs profile upsert', async () => {
  const body = JSON.stringify({
    type: 'user.deleted',
    data: { id: 'user_deleted', deleted: true },
  });
  expect((await fetch(base, { method: 'POST', headers: signed(body), body })).status).toBe(200);
  expect(mocks.deactivate).toHaveBeenCalledWith('user_deleted');
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it('does not acknowledge deletion until the migration and transaction succeed', async () => {
  const { UserLifecycleMigrationRequired } =
    await import('../../lib/server/userLifecycleSchema.js');
  const body = JSON.stringify({ type: 'user.deleted', data: { id: 'user_deleted' } });
  mocks.deactivate.mockRejectedValueOnce(new UserLifecycleMigrationRequired());
  expect((await fetch(base, { method: 'POST', headers: signed(body), body })).status).toBe(503);
  mocks.deactivate.mockRejectedValueOnce(new Error('transaction failed'));
  expect((await fetch(base, { method: 'POST', headers: signed(body), body })).status).toBe(500);
});
it('rejects a signed deletion without an ID', async () => {
  const body = JSON.stringify({ type: 'user.deleted', data: { deleted: true } });
  expect((await fetch(base, { method: 'POST', headers: signed(body), body })).status).toBe(400);
  expect(mocks.deactivate).not.toHaveBeenCalled();
});
