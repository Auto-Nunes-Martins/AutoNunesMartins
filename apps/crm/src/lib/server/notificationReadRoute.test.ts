import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('$lib/server/api', () => ({ apiFetch }));
import { POST } from '../../routes/(app)/api/notifications/contacts/[id]/read/+server';
import { DELETE } from '../../routes/(app)/api/notifications/contacts/[id]/+server';

const id = 'contact:' + 'a'.repeat(64);
const event = (value = id) =>
  ({ params: { id: value }, locals: { user: { id: 'current-user' } } }) as unknown as RequestEvent;
beforeEach(() => apiFetch.mockReset());

describe('shared contact notification deletion proxy', () => {
  it('forwards the authenticated event and encoded identifier without accepting a user override', async () => {
    const request = event();
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const response = await DELETE(request);
    expect(apiFetch).toHaveBeenCalledWith(
      request,
      '/api/notifications/contacts/' + encodeURIComponent(id),
      { method: 'DELETE' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each([401, 403, 404, 500])('preserves backend rejection status %s', async (status) => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'Rejected' }), { status }));
    const response = await DELETE(event());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: 'Rejected' });
  });
  it.each(['', 'vehicle-id', 'contact:' + 'a'.repeat(63), '../other', 'contact:' + 'A'.repeat(64)])(
    'rejects malformed identifiers without forwarding %s',
    async (value) => {
      expect((await DELETE(event(value))).status).toBe(400);
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );
  it('does not reinterpret an old tab marking a notice read as permission to delete it', async () => {
    expect((await POST(event())).status).toBe(410);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
