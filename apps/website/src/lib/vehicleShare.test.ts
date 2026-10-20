import { describe, expect, it, vi } from 'vitest';
import { shareVehicle, vehicleShareData } from './vehicleShare';

const vehicle = { slug: 'audi-a3-012345abcdef', brand: 'Audi', model: 'A3', year: 2019 };
const data = vehicleShareData(vehicle, 'https://stand.example/catalogo?private=1#tracking');
describe('vehicle sharing', () => {
  it('uses the clean canonical path and a title without private fields', () => {
    expect(data).toEqual({
      title: 'Audi A3 (2019)',
      url: 'https://stand.example/viaturas/audi-a3-012345abcdef',
    });
  });
  it('opens native sharing without copying as well', async () => {
    const share = vi.fn().mockResolvedValue(undefined),
      copy = vi.fn();
    expect(await shareVehicle(data, { share, copy })).toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
    expect(copy).not.toHaveBeenCalled();
  });
  it('treats cancellation quietly and does not copy after cancellation', async () => {
    const copy = vi.fn();
    expect(
      await shareVehicle(data, { share: vi.fn().mockRejectedValue({ name: 'AbortError' }), copy }),
    ).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });
  it('copies when native sharing is unavailable or fails', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    expect(await shareVehicle(data, { copy })).toBe('copied');
    expect(copy).toHaveBeenCalledWith(data.url);
    expect(
      await shareVehicle(data, {
        share: vi.fn().mockRejectedValue(new Error('unsupported')),
        copy,
      }),
    ).toBe('copied');
  });
  it('offers manual recovery when clipboard is unavailable or denied', async () => {
    expect(await shareVehicle(data, {})).toBe('manual');
    expect(await shareVehicle(data, { copy: vi.fn().mockRejectedValue(new Error('denied')) })).toBe(
      'manual',
    );
  });
});
