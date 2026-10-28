import { expect, it, vi } from 'vitest';
vi.mock('./appSettings.js',()=>({appSettings:{stockAgingDays:async()=>60}}));
import { listVehicles } from './vehicle';
it('selects the publication address, price and minimal sale identity required by list visibility',async()=>{
  const findMany=vi.fn(async(_args:unknown)=>[]),count=vi.fn(async()=>0);
  await listVehicles({vehicle:{findMany,count}} as never,{});
  expect(findMany.mock.calls[0]?.[0]).toEqual(expect.objectContaining({select:expect.objectContaining({webPublished:true,publicSlug:true,publicPrice:true,soldDate:true,sale:{select:{id:true}}})}));
});
