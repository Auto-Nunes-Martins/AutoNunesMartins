import express, { type Response as ExpressResponse, type Request } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  lifecycle: vi.fn(),
  clerkUserDeletion: { findUnique: vi.fn() },
  getUser: vi.fn(),
  $transaction: vi.fn(),
  user: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
  task: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  customer: { findMany: vi.fn(), count: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock('../db.js', () => ({ prisma: mocks }));
vi.mock('../lib/server/userLifecycleSchema.js', async (original) => ({
  ...(await original<typeof import('../lib/server/userLifecycleSchema.js')>()),
  userLifecycleAvailable: mocks.lifecycle,
  lockClerkIdentity: vi.fn(),
}));
vi.mock('../logger.js', () => ({ logger: mocks.logger }));
vi.mock('../env.js', () => ({ getEnv: () => ({}) }));
vi.mock('@clerk/express', () => ({
  getAuth: mocks.auth,
  createClerkClient: () => ({ users: { getUser: mocks.getUser } }),
  clerkMiddleware: () => async () => {
    throw new Error('Clerk unavailable');
  },
}));
import { asyncHandler } from './asyncHandler.js';
import { clerkMiddleware, requireUser } from './clerk.js';
import { contactErrorHandler, errorHandler } from './errorHandler.js';
import tasksRouter from '../routes/tasks.js';
import customersRouter from '../routes/customers.js';
import usersRouter from '../routes/users.js';
import { cache } from '../lib/data/cache.js';
import { TaskNotFound, TaskValidationError } from '../lib/server/taskService.js';

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use('/contact', express.json({ limit: '16b' }));
  app.post(
    '/contact',
    asyncHandler(async () => {
      throw new Error('PRIVATE contact payload');
    }),
  );
  app.use('/contact', contactErrorHandler);
  app.use(express.json({ limit: '128b' }));
  app.get('/clerk', clerkMiddleware);
  app.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
  app.use('/tasks', tasksRouter);
  app.use('/customers', customersRouter);
  app.use('/users', usersRouter);
  app.get(
    '/sync',
    asyncHandler(() => {
      throw new Error('sync');
    }),
  );
  app.get(
    '/expected',
    asyncHandler(async () => {
      throw Object.assign(new Error('PRIVATE detail'), { statusCode: 403 });
    }),
  );
  app.get(
    '/invalid-status',
    asyncHandler(async () => {
      throw { status: 200 };
    }),
  );
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((done) => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((done, reject) => server.close((err) => (err ? reject(err) : done())));
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.lifecycle.mockResolvedValue(false);
  mocks.$transaction.mockImplementation(async (callback) => callback({ user: mocks.user }));
  cache.clearPrefix('');
  mocks.auth.mockReturnValue({ userId: 'clerk-1' });
  mocks.user.findUnique.mockResolvedValue({
    id: 'user-1',
    clerkId: 'clerk-1',
    email: 'user@example.org',
    name: 'User',
    role: 'ADMIN',
    imageUrl: 'photo',
  });
  mocks.task.deleteMany.mockResolvedValue({ count: 0 });
  mocks.task.findMany.mockResolvedValue([]);
  mocks.task.findFirst.mockResolvedValue(null);
});

describe('Express 4 async failures', () => {
  it.each(['user_invitedone', 'user_invitedtwo'])(
    'accepts authenticated invited account %s without an extra ID list',
    async (userId) => {
      mocks.auth.mockReturnValue({ userId });
      mocks.user.findUnique.mockResolvedValue({
        id: 'internal-user',
        clerkId: userId,
        email: 'invited@example.org',
        name: 'Invited',
        role: 'ADMIN',
        imageUrl: 'photo',
      });
      const response = await fetch(base + '/me');
      expect(response.status).toBe(200);
      expect((await response.json()).user.clerkId).toBe(userId);
    },
  );
  it('rejects a deactivated profile even after a previous permitted request, without Clerk backfill', async () => {
    expect((await fetch(base + '/me')).status).toBe(200);
    mocks.user.findUnique.mockResolvedValue({ id: 'user-1', deactivatedAt: new Date() });
    expect((await fetch(base + '/me')).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.user.upsert).not.toHaveBeenCalled();
  });
  it('rejects tombstoned unknown profiles before calling Clerk or provisioning', async () => {
    mocks.lifecycle.mockResolvedValue(true);
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.clerkUserDeletion.findUnique.mockResolvedValue({
      clerkId: 'clerk-1',
      deletedAt: new Date(),
    });
    expect((await fetch(base + '/me')).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.user.upsert).not.toHaveBeenCalled();
  });
  it('lists only active assignment candidates without a browser-stale list', async () => {
    mocks.lifecycle.mockResolvedValue(true);
    mocks.user.findMany.mockResolvedValue([]);
    const response = await fetch(base + '/users');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deactivatedAt: null } }),
    );
  });
  it('blocks anonymous requests before any private database access', async () => {
    mocks.auth.mockReturnValue({ userId: null });
    for (const route of ['/me', '/users', '/tasks'])
      expect((await fetch(base + route)).status).toBe(401);
    expect(mocks.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.user.findMany).not.toHaveBeenCalled();
  });
  it('can provision an authenticated invited user on first access without a webhook event', async () => {
    mocks.auth.mockReturnValue({ userId: 'user_invitednew' });
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({
      emailAddresses: [{ id: 'email', emailAddress: 'invited@example.org' }],
      firstName: 'Invited',
    });
    mocks.user.upsert.mockResolvedValue({
      id: 'internal-new',
      clerkId: 'user_invitednew',
      email: 'invited@example.org',
      name: 'Invited',
      role: 'ADMIN',
    });
    expect((await fetch(base + '/me')).status).toBe(200);
    expect(mocks.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ clerkId: 'user_invitednew', role: 'ADMIN' }),
      }),
    );
  });
  it('forwards failed authentication DB lookups, then continues serving requests', async () => {
    mocks.user.findUnique.mockRejectedValueOnce(new Error('PRIVATE DB connection'));
    const response = await fetch(`${base}/me`, { signal: AbortSignal.timeout(3000) });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(mocks.logger.error).toHaveBeenCalledTimes(1);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/me`)).status).toBe(200);
  });
  it('forwards provisioning and Clerk middleware failures', async () => {
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.getUser.mockRejectedValue(new Error('Provisioning failed'));
    expect((await fetch(`${base}/me`)).status).toBe(500);
    expect((await fetch(`${base}/clerk`)).status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalledTimes(2);
  });
  it('forwards failures while provisioning the database user', async () => {
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({
      emailAddresses: [{ id: 'email', emailAddress: 'user@example.org' }],
    });
    mocks.user.upsert.mockRejectedValue(new Error('Database write failed'));
    expect((await fetch(`${base}/me`)).status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalledOnce();
  });
  it.each([
    ['POST', '/tasks', { title: 'Task' }],
    ['PATCH', '/tasks/id', { title: 'Task' }],
    ['PATCH', '/tasks/id/status', { status: 'DONE' }],
    ['DELETE', '/tasks/id', undefined],
  ] as const)(
    'forwards transaction failures for %s %s, including local catch rethrows',
    async (method, path, body) => {
      mocks.task.findFirst.mockResolvedValue({ id: 'id' });
      mocks.$transaction.mockRejectedValue(new Error('PRIVATE transaction failure'));
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(3000),
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect((await fetch(`${base}/health`)).status).toBe(200);
    },
  );
  it('preserves service validation and not-found errors caught by the route', async () => {
    mocks.task.findFirst.mockResolvedValue({ id: 'id' });
    for (const [error, status] of [
      [new TaskValidationError('Prazo obrigatório'), 400],
      [new TaskNotFound('id'), 404],
    ] as const) {
      mocks.$transaction.mockRejectedValue(error);
      expect(
        (
          await fetch(`${base}/tasks/id`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: '{"title":"Task"}',
          })
        ).status,
      ).toBe(status);
    }
    expect(mocks.logger.error).not.toHaveBeenCalled();
  });
  it.each(['/tasks', '/customers', '/users'])(
    'contains route database failures at %s',
    async (path) => {
      mocks.task.findMany.mockRejectedValue(new Error('PRIVATE query'));
      mocks.customer.findMany.mockRejectedValue(new Error('PRIVATE query'));
      mocks.customer.count.mockResolvedValue(0);
      mocks.user.findMany.mockRejectedValue(new Error('PRIVATE query'));
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(3000) });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect((await fetch(`${base}/health`)).status).toBe(200);
    },
  );
  it('preserves expected auth, validation and missing-task responses', async () => {
    mocks.auth.mockReturnValueOnce({ userId: null });
    expect((await fetch(`${base}/me`)).status).toBe(401);
    expect((await fetch(`${base}/tasks?status=INVALID`)).status).toBe(400);
    expect((await fetch(`${base}/tasks/missing`)).status).toBe(404);
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({ emailAddresses: [] });
    expect((await fetch(`${base}/me`)).status).toBe(403);
    expect(mocks.logger.error).not.toHaveBeenCalled();
  });
  it('forwards synchronous throws and preserves valid HTTP error codes without disclosing errors', async () => {
    expect((await fetch(`${base}/sync`)).status).toBe(500);
    const response = await fetch(`${base}/expected`);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Invalid request' });
    expect((await fetch(`${base}/invalid-status`)).status).toBe(500);
  });
  it('returns 400 for malformed JSON and 413 for oversized bodies', async () => {
    for (const [body, status] of [
      ['{', 400],
      [JSON.stringify({ title: 'x'.repeat(200) }), 413],
    ] as const) {
      const response = await fetch(`${base}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: 'Invalid request' });
    }
    expect(mocks.logger.error).not.toHaveBeenCalled();
  });
  it('delegates errors after headers have already been sent', () => {
    const next = vi.fn();
    const status = vi.fn();
    const error = new Error('late');
    errorHandler(
      error,
      {} as Request,
      { headersSent: true, status } as unknown as ExpressResponse,
      next,
    );
    expect(next).toHaveBeenCalledWith(error);
    expect(status).not.toHaveBeenCalled();
  });
  it('contains private contact errors and parser failures without logging payloads', async () => {
    for (const [body, status] of [
      ['{}', 500],
      ['{', 400],
      [JSON.stringify({ private: 'x'.repeat(100) }), 413],
    ] as const) {
      const response = await fetch(`${base}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).not.toMatch(/PRIVATE|xxxx/);
    }
    expect(mocks.logger.error).not.toHaveBeenCalled();
    const next = vi.fn();
    const destroy = vi.fn();
    contactErrorHandler(
      new Error('PRIVATE'),
      {} as Request,
      { headersSent: true, destroy } as unknown as ExpressResponse,
      next,
    );
    expect(destroy).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    const entry = readFileSync(resolve('src/app.ts'), 'utf8');
    expect(entry.indexOf("app.use('/api/public/contact', contactErrorHandler)")).toBeLessThan(
      entry.indexOf('app.use(pinoHttp'),
    );
  });
  it('requires every registered async route callback to use asyncHandler', () => {
    function checkDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(file);
          continue;
        }
        if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
        const source = ts.createSourceFile(
          file,
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node: ts.Node) {
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.expression.getText(source) === 'router'
          ) {
            for (const argument of node.arguments) {
              const isBareAsync =
                (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) &&
                argument.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
              expect(isBareAsync, `${file}: unprotected async handler`).toBeFalsy();
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    checkDirectory(resolve('src/routes'));
  });
});
