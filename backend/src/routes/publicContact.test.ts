import { contactBudgetFixture } from '../../test/contactBudgetFixture.js';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicContactRouter, type ContactConfig } from './publicContact.js';

const config: ContactConfig = {
  enabled: true,
  apiKey: 'test-key',
  from: 'website@example.org',
  to: 'stand@example.org',
  relaySecret: 'a'.repeat(32),
};
const data = () => ({
  name: 'Ana',
  email: 'ana@example.org',
  subject: 'Marcar uma visita',
  message: 'Quero visitar sábado.',
  page: '/viaturas/bmw',
  website: '',
  requestId: randomUUID(),
});
const servers: Server[] = [];
const budgets: Awaited<ReturnType<typeof contactBudgetFixture>>[] = [];
afterEach(async () => {
  await Promise.all(budgets.splice(0).map((f) => f.db.close()));
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});
async function setup(
  overrides: Partial<ContactConfig> = {},
  send = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ id: 'email-1' })),
) {
  const fixture = await contactBudgetFixture();
  budgets.push(fixture);
  const budget = fixture.store();
  const app = express();
  app.use(express.json());
  app.use('/contact', createPublicContactRouter({ ...config, ...overrides }, send, budget));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/contact`;
  return {
    send,
    budget,
    fixture,
    post: (body = data(), token: string | undefined = config.relaySecret) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-contact-relay': token } : {}),
        },
        body: JSON.stringify(body),
      }),
  };
}
describe('public contact email', () => {
  it('sends only to the configured stand, with customer reply-to and idempotency', async () => {
    const { post, send } = await setup();
    const body = data();
    const response = await post(body);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    const email = JSON.parse(options!.body as string);
    expect(email.to).toEqual(['stand@example.org']);
    expect(email.reply_to).toBe(body.email);
    expect(email.text).toContain(body.message);
    expect(email.html).toContain('AUTO NUNES MARTINS');
    expect(email.html).toContain(body.message);
    expect(email.html).toContain('mailto:');
    expect((options!.headers as Record<string, string>)['Idempotency-Key']).toContain(
      body.requestId,
    );
    expect((await post(body)).status).toBe(202);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('fails closed when disabled or missing credentials', async () => {
    for (const overrides of [
      { enabled: false },
      { apiKey: undefined },
      { relaySecret: undefined },
    ]) {
      const { post, send } = await setup(overrides);
      expect((await post()).status).toBe(503);
      expect(send).not.toHaveBeenCalled();
    }
  }, 15_000);
  it('rejects unauthorised callers, extra fields, header injection and bots', async () => {
    const { post, send } = await setup();
    expect((await post(data(), 'wrong')).status).toBe(403);
    expect(
      (await post({ ...data(), to: 'attacker@example.org' } as ReturnType<typeof data>)).status,
    ).toBe(400);
    expect((await post({ ...data(), subject: 'Hello\r\nBcc: attacker' })).status).toBe(400);
    expect((await post({ ...data(), message: 'x'.repeat(5001) })).status).toBe(400);
    expect((await post({ ...data(), page: '/?email=private' })).status).toBe(400);
    expect((await post({ ...data(), website: 'bot' })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('never reports success or leaks the provider response when sending fails', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret provider error', { status: 401 }));
    const { post } = await setup({}, send);
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret');
  });
  it('limits repeated requests without a sixth provider call', async () => {
    const { post, send } = await setup();
    for (let i = 0; i < 5; i++) expect((await post()).status).toBe(202);
    const response = await post();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('600');
    expect(send).toHaveBeenCalledTimes(5);
  });
});

it('does not contact the provider if durable reservations fail', async () => {
  const { post, send, budget } = await setup();
  vi.spyOn(budget, 'reserve').mockRejectedValue(new Error('private database failure'));
  const response = await post();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private database');
  expect(send).not.toHaveBeenCalled();
});
it('retries a failed provider call with the same idempotency key and charges each attempt', async () => {
  const send = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValue(Response.json({ id: 'accepted' }));
  const { post } = await setup({}, send);
  const body = data();
  expect((await post(body)).status).toBe(502);
  expect((await post(body)).status).toBe(202);
  expect(send.mock.calls[0]![1]!.headers).toEqual(send.mock.calls[1]![1]!.headers);
});

it('recovers an accepted provider response after a database failure without duplicate delivery or notification', async () => {
  const delivered = new Map<string, string>();
  const send = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const key = (init!.headers as Record<string, string>)['Idempotency-Key']!;
    if (!delivered.has(key)) delivered.set(key, 'provider-email');
    return Response.json({ id: delivered.get(key) });
  });
  const { post, budget, fixture } = await setup({}, send);
  const finish = budget.finish.bind(budget);
  vi.spyOn(budget, 'finish')
    .mockImplementationOnce(async () => {
      throw Error('database unavailable');
    })
    .mockImplementation(finish);
  const body = { ...data(), name: 'Concei\u00e7\u00e3o', subject: 'Revis\u00e3o e visita' };
  expect((await post(body)).status).toBe(502);
  expect((await post(body)).status).toBe(202);
  expect(delivered.size).toBe(1);
  expect((await fixture.db.query('SELECT count(*)::int AS n FROM "ActivityLog"')).rows).toEqual([
    { n: 1 },
  ]);
});
