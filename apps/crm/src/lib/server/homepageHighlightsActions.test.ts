import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('$lib/server/api', () => ({
  apiJson: mocks.api,
  rethrowAuthError: (err: unknown) => { if ((err as {status?:number})?.status === 401 || (err as {status?:number})?.status === 403) throw err; },
  ApiError: class extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super('API');
    }
  },
}));
import { actions, load } from '../../routes/(app)/site/destaques/+page.server';
import { ApiError } from './api';
const selection = { revision: null, items: [{ vehicleId: 'vehicle', photoPath: 'approved.jpg' }] };
function event(raw: string) {
  const data = new FormData();
  data.set('selection', raw);
  return {
    request: new Request('http://localhost/site/destaques', { method: 'POST', body: data }),
  } as any;
}
beforeEach(() => vi.clearAllMocks());
describe('CRM homepage highlight actions', () => {
  it('loads the authenticated editor rather than the public inventory projection', async () => {
    const editor = { revision: null, items: [], candidates: [] };
    mocks.api.mockResolvedValue(editor);
    const event = {url: new URL('http://localhost/site/destaques?viatura=selected')};
    expect(await load(event as any)).toEqual({ editor, selectedVehicleId: 'selected' });
    expect(mocks.api).toHaveBeenCalledWith(event, '/api/homepage-highlights');
  });
  it('sends the chosen order, photo and revision to the authenticated API', async () => {
    mocks.api.mockResolvedValue({ revision: 'new' });
    expect(await actions.default!(event(JSON.stringify(selection)))).toEqual({ saved: true });
    expect(mocks.api.mock.calls[0]![2]).toEqual({ method: 'PUT', body: JSON.stringify(selection) });
  });
  it('rejects malformed and excessively long submissions before calling the API', async () => {
    expect(((await actions.default!(event('{'))) as any).status).toBe(400);
    expect(((await actions.default!(event('x'.repeat(10001)))) as any).status).toBe(400);
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('preserves a useful concurrent-edit message', async () => {
    mocks.api.mockRejectedValue(
      new ApiError(409, { error: 'Outro administrador alterou os destaques.' }),
    );
    expect(await actions.default!(event(JSON.stringify(selection)))).toMatchObject({
      status: 409,
      data: { error: 'Outro administrador alterou os destaques.' },
    });
  });
  it('reports an outage without falsely confirming a save', async () => {
    mocks.api.mockRejectedValue(new Error('offline'));
    expect(await actions.default!(event(JSON.stringify(selection)))).toMatchObject({ status: 503 });
  });
});
