import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/server/publicVehicles', () => ({
  loadPublicVehicle: vi.fn(),
  loadRelatedVehicles: vi.fn(),
}));
import { loadPublicVehicle, loadRelatedVehicles } from '$lib/server/publicVehicles';
import { load } from './+page.server';
const event = () =>
  ({ params: { slug: 'dacia-jogger-abcdef123456' }, setHeaders: vi.fn() }) as unknown as Parameters<
    typeof load
  >[0];
beforeEach(() => vi.resetAllMocks());
describe('public vehicle critical path', () => {
  it('returns the current vehicle without waiting for slow suggestions', async () => {
    const vehicle = { slug: 'dacia-jogger-abcdef123456' };
    vi.mocked(loadPublicVehicle).mockResolvedValue({ status: 200, vehicle } as Awaited<
      ReturnType<typeof loadPublicVehicle>
    >);
    let resolve!: (vehicles: []) => void;
    const related = new Promise<[]>((done) => (resolve = done));
    vi.mocked(loadRelatedVehicles).mockReturnValue(related);
    const result = await load(event());
    expect(result).toMatchObject({ vehicle });
    expect(result?.relatedVehicles).toBe(related);
    resolve([]);
    expect(await result?.relatedVehicles).toEqual([]);
  });
  it.each([404, 503] as const)(
    'preserves %i instead of streaming a missing vehicle',
    async (status) => {
      vi.mocked(loadPublicVehicle).mockResolvedValue({ status, vehicle: null });
      vi.mocked(loadRelatedVehicles).mockResolvedValue([]);
      await expect(load(event())).rejects.toMatchObject({ status });
    },
  );
});
