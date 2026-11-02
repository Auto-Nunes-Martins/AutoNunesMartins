import { beforeEach, expect, it, vi } from 'vitest';
const relay = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/api', () => ({ apiFetch: relay }));
import { POST } from '../../routes/(app)/viaturas/[id]/photos/staging/+server';
const event = (request: Request) => ({ request, params: { id: 'vehicle' }, locals: {} }) as any;
beforeEach(() => {
  relay.mockReset();
  relay.mockResolvedValue(Response.json({ ok: true }));
});
it('uses the authenticated API boundary and returns private uncached JSON', async () => {
  const request = new Request('https://crm.test/staging', {
    method: 'POST',
    body: JSON.stringify({ action: 'retain', paths: ['vehicle/file.webp'] }),
  });
  const response = await POST(event(request));
  expect(relay.mock.calls[0]?.[1]).toBe('/api/vehicles/vehicle/photos/staging');
  expect(relay.mock.calls[0]?.[2]).toEqual({
    method: 'POST',
    body: JSON.stringify({ action: 'retain', paths: ['vehicle/file.webp'] }),
  });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('rejects invalid JSON and bounds both declared and chunked bodies before API access', async () => {
  expect(
    (await POST(event(new Request('https://crm.test', { method: 'POST', body: '{' })))).status,
  ).toBe(400);
  expect(
    (
      await POST(
        event(
          new Request('https://crm.test', {
            method: 'POST',
            headers: { 'content-length': '9000' },
            body: '{}',
          }),
        ),
      )
    ).status,
  ).toBe(413);
  const cancelled = vi.fn();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(8193));
    },
    cancel: cancelled,
  });
  const request = new Request('https://crm.test', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: string });
  expect((await POST(event(request))).status).toBe(413);
  expect(cancelled).toHaveBeenCalledOnce();
  expect(relay).not.toHaveBeenCalled();
});
it('preserves an authentication failure without following a redirect or returning success', async () => {
  relay.mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
  const response = await POST(
    event(new Request('https://crm.test', { method: 'POST', body: '{}' })),
  );
  expect(response.status).toBe(401);
});
