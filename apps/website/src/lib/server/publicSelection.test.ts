import {afterEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('$lib/server/publicVehicles',()=>({publicRequest:mocks.request}));
import {GET} from '../../routes/comparar/dados/+server';
const id='audi-012345abcdef',vehicle={slug:id,brand:'Audi',model:'A3',year:2022,mileage:12,fuel:'GASOLINE',price:'20000.00',currency:'EUR',description:null,transmission:null,availability:'AVAILABLE',photos:[`/api/public/vehicles/${id}/photos/0`]};
const read=(query:string)=>GET({url:new URL('http://site.test/comparar/dados?'+query)} as Parameters<typeof GET>[0]);
afterEach(()=>vi.resetAllMocks());
describe('fresh comparison selection BFF',()=>{
 it('reuses only matching public unavailable detail data and its surviving photo',async()=>{
  const unavailableVehicle={slug:id,brand:'Audi',model:'A3',year:2022,photo:`/viaturas/${id}/indisponivel/foto`,vin:'SECRET',price:'SECRET'};
  mocks.request.mockResolvedValueOnce(Response.json({items:[{id,status:404,vehicle:null}]})).mockResolvedValueOnce(Response.json({unavailableVehicle},{status:404}));
  const item=(await(await read('id='+id)).json()).items[0];
  expect(item).toMatchObject({id,status:404,vehicle:null,unavailableVehicle:{brand:'Audi',photo:unavailableVehicle.photo}});
  expect(mocks.request).toHaveBeenNthCalledWith(2,'/'+id);expect(JSON.stringify(item)).not.toContain('SECRET');
 });
 it.each(['https://private.test/photo',`/viaturas/other-012345abcdef/indisponivel/foto`])('rejects substituted unavailable photo %s',async photo=>{
  mocks.request.mockResolvedValueOnce(Response.json({items:[{id,status:404,vehicle:null}]})).mockResolvedValueOnce(Response.json({unavailableVehicle:{slug:id,brand:'Audi',model:'A3',year:2022,photo}},{status:404}));
  expect((await(await read('id='+id)).json()).items[0]).toEqual({id,status:404,vehicle:null});
 });
 it('keeps missing records saved without inventing identification',async()=>{
  mocks.request.mockResolvedValueOnce(Response.json({items:[{id,status:404,vehicle:null}]})).mockResolvedValueOnce(Response.json({error:'Not found'},{status:404}));
  expect((await(await read('id='+id)).json()).items[0]).toEqual({id,status:404,vehicle:null});
 });
 it('requests one bounded public snapshot and allowlists values and identities',async()=>{
  mocks.request.mockResolvedValue(Response.json({items:[{id,status:200,vehicle:{...vehicle,vin:'SECRET'},photoVersions:['a'.repeat(64)]}]}));
  const response=await read('id='+id),data=await response.json();
  expect(response.headers.get('cache-control')).toBe('no-store');expect(mocks.request).toHaveBeenCalledTimes(1);expect(mocks.request).toHaveBeenCalledWith('/selection?id='+id);
  expect(data.items[0].photoVersions).toEqual(['a'.repeat(64)]);expect(JSON.stringify(data)).not.toContain('SECRET');
 });
 it('does not use a previous snapshot after failure, removal or unpublication',async()=>{
  mocks.request.mockResolvedValueOnce(Response.json({items:[{id,status:200,vehicle}]})).mockResolvedValueOnce(Response.json({items:[{id,status:404,vehicle:null}]})).mockRejectedValueOnce(new Error('unavailable'));
  expect((await(await read('id='+id)).json()).items[0].status).toBe(200);
  expect((await(await read('id='+id)).json()).items[0]).toEqual({id,status:404,vehicle:null});
  expect((await(await read('id='+id)).json()).items[0]).toEqual({id,status:503,vehicle:null});
 });
 it('rejects duplicate, excessive and malformed IDs without upstream access',async()=>{
  for(const query of ['id=bad',`id=${id}&id=${id}`,'unexpected=1',Array.from({length:4},(_,i)=>'id=car'+i+'-012345abcdef').join('&')])expect((await read(query)).status).toBe(400);
  expect(mocks.request).not.toHaveBeenCalled();
 });
});
