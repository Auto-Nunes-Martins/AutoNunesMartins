import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('$lib/auth/session', () => ({ sessionFetch: mocks.fetch }));
import { photoUpload, recordPreparation, getPreparationMetrics } from './photoDiagnostics';
beforeEach(() => {
  vi.restoreAllMocks();
  mocks.fetch.mockReset();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', { getItem: () => 'true' });
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
it('retains numeric preparation across opt-in changes and recovered File objects, marks old drafts absent', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const file = new File(['image'], 'private.jpg');
  recordPreparation(file, file, 0, 1, { originalWidth: 4000, originalHeight: 3000 });
  const metrics = getPreparationMetrics(file);
  expect(metrics?.originalWidth).toBe(4000);
  expect(console.info).not.toHaveBeenCalled();
  vi.stubGlobal('localStorage', { getItem: () => 'true' });
  mocks.fetch.mockImplementation(() => Promise.resolve(new Response('{}')));
  const recovered = new File(['image'], 'recovered.jpg');
  await photoUpload('/photos', { method: 'POST', body: recovered }, metrics);
  expect(
    JSON.parse(mocks.fetch.mock.calls[0]![1].headers.get('x-photo-metrics')).preparationCoverage,
  ).toBe(1);
  await photoUpload('/photos', { method: 'POST', body: new File(['old'], 'old.jpg') });
  expect(
    JSON.parse(mocks.fetch.mock.calls[1]![1].headers.get('x-photo-metrics')).preparationCoverage,
  ).toBe(0);
});
it('forwards bounded numeric preparation metrics with a fresh random correlation, then a small authenticated result', async () => {
  const file = new File(['image'], 'private-name.jpg', { type: 'image/jpeg' });
  recordPreparation(file, file, 0, 1, { originalWidth: 800, originalHeight: 1200 });
  mocks.fetch
    .mockResolvedValueOnce(
      new Response('{}', { status: 201, headers: { 'x-photo-diagnostics-enabled': 'true' } }),
    )
    .mockResolvedValue(new Response(null, { status: 204 }));
  await photoUpload('/viaturas/private-id/photos', { method: 'POST', body: file });
  const headers = mocks.fetch.mock.calls[0]![1].headers as Headers;
  expect(headers.get('x-photo-trace-id')).toMatch(/^[a-f0-9-]{36}$/);
  expect(headers.get('x-photo-metrics')).toContain('originalWidth');
  expect(headers.get('x-photo-metrics')).not.toContain(file.name);
  expect(mocks.fetch.mock.calls[1]![0]).toBe('/viaturas/private-id/photos/diagnostics');
  expect(mocks.fetch.mock.calls[1]![1].body).not.toContain('private');
});
it('does not change the request or emit client telemetry when off', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const init = { method: 'POST', body: 'unchanged' };
  mocks.fetch.mockResolvedValue(new Response('{}'));
  await photoUpload('/photos', init);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch).toHaveBeenCalledWith('/photos', init);
  expect(console.info).not.toHaveBeenCalled();
});
