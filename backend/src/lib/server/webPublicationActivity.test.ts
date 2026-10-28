import { beforeEach, expect, it, vi } from 'vitest';
const emit = vi.hoisted(() => vi.fn());
vi.mock('../data/activity.js', () => ({ emitActivity: emit }));
vi.mock('./preparePhotoDimensions.js', () => ({ preparePhotoDimensions: vi.fn() }));
import { applyWebPublication } from './webPublicationService';
beforeEach(() => vi.clearAllMocks());
it.each([true, false])('persists a durable vehicle identity for publication=%s', async published => {
  const vehicle = { id: 'car', brand: 'BMW', model: 'One', year: 2020, licensePlate: 'AA-00-AA', status: 'AVAILABLE', soldDate: null, sale: null, photos: [], publicSlug: 'slug' };
  const tx = { vehicle: { findUnique: vi.fn().mockResolvedValue(vehicle), update: vi.fn().mockResolvedValue({ webPublished: published, publicSlug: 'slug' }) } };
  await applyWebPublication(tx as never, 'car', { published, price: null, description: 'Descrição pública', photoPaths: [], transmission: null } as never, 'actor');
  expect(emit.mock.calls[0]?.[1]).toMatchObject({ actorId: 'actor', entityId: 'car', message: `${published ? 'Publicação web aprovada' : 'Publicação web desativada'}: BMW One · AA-00-AA`, metadata: { webPublished: published, vehicle: { brand: 'BMW', model: 'One', year: 2020, licensePlate: 'AA-00-AA' } } });
});
