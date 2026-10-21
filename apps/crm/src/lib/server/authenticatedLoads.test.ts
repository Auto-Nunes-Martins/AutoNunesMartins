import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'https://api.example.test' }));
const mocks = vi.hoisted(() => ({ vehicles: vi.fn(), users: vi.fn(), activity: vi.fn(), dashboard: vi.fn(), highlights: vi.fn() }));
vi.mock('$lib/server/vehicles', () => ({ vehiclesApi: { list: mocks.vehicles } }));
vi.mock('$lib/server/tasks', () => ({ usersApi: { list: mocks.users } }));
vi.mock('$lib/server/activity', () => ({ activityApi: { list: mocks.activity } }));
vi.mock('$lib/server/dashboard', () => ({ dashboardApi: { get: mocks.dashboard, highlights: mocks.highlights } }));
import { ApiError } from './api';
import { load as vehiclesLoad } from '../../routes/(app)/viaturas/+page.server';
import { load as activityLoad } from '../../routes/(app)/atividade/+page.server';
import { load as dashboardLoad } from '../../routes/(app)/dashboard/+page.server';
const event = { url: new URL('https://crm.example.test/crm/viaturas') } as any;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.users.mockResolvedValue({ items: [] });
  mocks.dashboard.mockResolvedValue({});
  mocks.highlights.mockResolvedValue({ items: [] });
});
describe('authenticated load failures remain distinct from empty business data', () => {
  it.each([401, 403, 503])('marks inventory and draft failures with status%s and a safe message', async (status) => {
    mocks.vehicles.mockRejectedValue(new ApiError(status, null, 'PRIVATE upstream message'));
    const result = await vehiclesLoad(event) as any;
    for (const pending of [result.list, result.drafts]) {
      const list = await pending;
      expect(list._status).toBe(status);
      expect(list._error).toBeTruthy();
      expect(list._error).not.toContain('PRIVATE');
    }
  });
  it('retains successful inventory when only the draft request fails', async () => {
    mocks.vehicles.mockImplementation(async (_event: unknown, params: any) => {
      if (params.status === 'DRAFT') throw new ApiError(503, null);
      return { items: [{ id: 'car-1' }], total: 1, page: 1, pageSize: 25, totalPages: 1 };
    });
    const result = await vehiclesLoad(event) as any;
    expect(await result.list).toMatchObject({ total: 1, items: [{ id: 'car-1' }] });
    expect(await result.drafts).toMatchObject({ _status: 503 });
  });
  it.each([401, 403, 503])('does not return an empty activity feed for status%s', async (status) => {
    mocks.activity.mockRejectedValue(new ApiError(status, null));
    await expect(activityLoad(event)).rejects.toMatchObject({ status });
  });
  it.each([401, 403])('does not hide access failure in optional dashboard data (%s)', async (status) => {
    mocks.users.mockRejectedValue(new ApiError(status, null));
    await expect(dashboardLoad(event)).rejects.toMatchObject({ status });
  });
});
