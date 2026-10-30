import { describe, expect, it } from 'vitest';
import { publicVehicleUrl, publishedVehicleUrl } from './publicVehicleUrl';
it('offers the online action only for a confirmed live publication and uses its slug',()=>{
  const vehicle={id:'internal-id',photos:[],status:'AVAILABLE',webPublished:true,publicSlug:'published-car-123456abcdef',publicPrice:null};
  expect(publishedVehicleUrl('https://public.test',vehicle)).toBe('https://public.test/viaturas/published-car-123456abcdef');
  for(const change of [{webPublished:false},{publicSlug:null},{status:'DRAFT'},{status:'SOLD'},{soldDate:'2026-10-30'},{sale:{id:'sale'}},{publicPrice:'0'}])expect(publishedVehicleUrl('https://public.test',{...vehicle,...change})).toBeUndefined();
});

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
