import { expect, it } from 'vitest';
import { homepageHighlightStatus } from './highlightStatus';
it('distinguishes the persisted live carousel, hidden selection and no membership', () => {
  expect(homepageHighlightStatus({ configuredVehicleIds: ['live', 'hidden'], items: [{ id: 'live' }] }, 'live')).toBe('live');
  expect(homepageHighlightStatus({ configuredVehicleIds: ['live', 'hidden'], items: [{ id: 'live' }] }, 'hidden')).toBe('hidden');
  expect(homepageHighlightStatus({ configuredVehicleIds: ['live'], items: [{ id: 'live' }] }, 'other')).toBe('none');
});
