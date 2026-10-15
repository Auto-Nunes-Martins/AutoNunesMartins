import { describe, expect, it } from 'vitest';
import { publicVehicleUrl } from './publicVehicleUrl';

describe('publicVehicleUrl', () => {
  it.each(['https://example.test', 'https://example.test/', 'https://example.test///'])(
    'opens the current public vehicle route with base %s',
    (base) => {
      expect(publicVehicleUrl(base, 'bmw-320-2020')).toBe(
        'https://example.test/viaturas/bmw-320-2020',
      );
    },
  );

  it('keeps special characters within one encoded slug segment', () => {
    expect(publicVehicleUrl('http://localhost:5173/', 'citroën c3/a?b#c')).toBe(
      'http://localhost:5173/viaturas/citro%C3%ABn%20c3%2Fa%3Fb%23c',
    );
  });
});
