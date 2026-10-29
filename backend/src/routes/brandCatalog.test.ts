import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
vi.mock('../logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../db.js', () => ({ prisma: {} }));
vi.mock('../env.js', () => ({ getEnv: () => ({ CLERK_SECRET_KEY: 'local-test-secret' }) }));
vi.mock('../middleware/clerk.js', () => ({
  requireUser: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'test', role: 'ADMIN', name: 'Tester' };
    next();
  },
}));
import vehicles from './vehicles.js';
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/vehicles', vehicles);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server?.close(() => r())));
it('rejects arbitrary brands at real authenticated vehicle create/edit endpoints before DB work', async () => {
  const valid = {
    brand: 'Injected brand',
    model: 'X',
    year: 2020,
    fuel: 'DIESEL',
    mileage: 10,
    licensePlate: 'AA12BB',
    purchasePrice: '100',
    salePrice: '200',
    acquisitionDate: '2026-10-20',
  };
  for (const [path, method, body] of [
    ['/vehicles', 'POST', valid],
    ['/vehicles/id', 'PATCH', { brand: 'Injected brand' }],
    [
      '/vehicles/id/edit',
      'PUT',
      {
        expectedUpdatedAt: '2026-10-20T10:00:00Z',
        data: { brand: 'Injected brand' },
        photos: [],
        publication: {
          published: false,
          price: null,
          description: '',
          transmission: null,
          specifications: {},
        },
      },
    ],
  ] as const) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.issues.some((i: any) => i.path.includes('brand'))).toBe(true);
  }
});
