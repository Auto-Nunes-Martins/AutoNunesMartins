import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import sharp from 'sharp';
const db=vi.hoisted(()=>({findMany:vi.fn(),findUnique:vi.fn(),create:vi.fn(),update:vi.fn(),delete:vi.fn()}));
vi.mock('../db.js',()=>({prisma:{webReview:db}}));
vi.mock('../middleware/clerk.js',()=>({requireUser:(req:any,res:any,next:any)=>req.headers.authorization==='Bearer fixture' ? next() : res.status(401).json({error:'Unauthorized'})}));
vi.mock('../lib/server/photoOptimization.js',()=>({photoAdmission:{acquire:()=>()=>{}}}));
import router,{publicReviewsRouter} from './reviews.js';
let server:Server,origin:string;
const review={id:'fixture-id',authorName:'Maria Silva',rating:4.5,text:'Texto público',avatarVersion:null};
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/public',publicReviewsRouter);app.use('/private',router);server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(()=>new Promise<void>(r=>server.close(()=>r())));
beforeEach(()=>{vi.clearAllMocks();db.findMany.mockResolvedValue([review]);db.create.mockResolvedValue(review);db.update.mockResolvedValue(review);});
it('requires authentication for every private read/mutation/photo, public GET bypasses CRM auth',async()=>{
  for(const [path,method]of [['','GET'],['','POST'],['/fixture-id','PUT'],['/fixture-id','DELETE'],['/fixture-id/avatar','PUT'],['/fixture-id/avatar','DELETE']])
    expect((await fetch(origin+'/private'+path,{method})).status).toBe(401);
  expect(db.create).not.toHaveBeenCalled();expect(db.update).not.toHaveBeenCalled();expect(db.delete).not.toHaveBeenCalled();
  const response=await fetch(origin+'/public');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({items:[review]});
  expect(db.findMany.mock.calls[0]?.[0].select).toEqual({id:true,authorName:true,rating:true,text:true,avatarVersion:true});
});
it('validates writes, allows CRUD and only accepts normalized binary avatar uploads',async()=>{
  const headers={authorization:'Bearer fixture','content-type':'application/json'};
  expect((await fetch(origin+'/private',{method:'POST',headers,body:JSON.stringify({...review,rating:6})})).status).toBe(400);
  for(const rating of [0,0.3,4.3,5.5]) expect((await fetch(origin+'/private',{method:'POST',headers,body:JSON.stringify({authorName:'A',rating,text:'B'})})).status).toBe(400);
  const data={authorName:'Maria Silva',rating:4.5,text:'Texto público'};
  const created=await fetch(origin+'/private',{method:'POST',headers,body:JSON.stringify(data)});
  expect(created.status).toBe(201);expect((await created.json()).rating).toBe(4.5);
  expect(db.create.mock.calls[0]?.[0].data).toEqual(data);
  expect((await fetch(origin+'/private/fixture-id',{method:'PUT',headers,body:JSON.stringify(data)})).status).toBe(200);
  const image=await sharp({create:{width:10,height:10,channels:3,background:'blue'}}).png().toBuffer();
  expect((await fetch(origin+'/private/fixture-id/avatar',{method:'PUT',headers:{authorization:'Bearer fixture','content-type':'image/png'},body:image})).status).toBe(200);
  expect(db.update.mock.calls.at(-1)?.[0].data.avatarVersion).toMatch(/^[a-f0-9]{64}$/);
  expect((await fetch(origin+'/private/fixture-id/avatar',{method:'PUT',headers:{authorization:'Bearer fixture','content-type':'image/svg+xml'},body:'<svg/>'})).status).toBe(400);
  expect((await fetch(origin+'/private/fixture-id/avatar',{method:'DELETE',headers})).status).toBe(200);
  expect(db.update.mock.calls.at(-1)?.[0].data).toEqual({avatarData:null,avatarVersion:null});
  expect((await fetch(origin+'/private/fixture-id',{method:'DELETE',headers})).status).toBe(204);
});
it('serves only stored normalized photos at matching versions and removes access when missing',async()=>{
  const version='a'.repeat(64);db.findUnique.mockResolvedValue({avatarData:Buffer.from('webp-fixture'),avatarVersion:version});
  const photo=await fetch(origin+'/public/fixture-id/avatar/'+version);expect(photo.status).toBe(200);expect(photo.headers.get('content-type')).toMatch(/image\/webp/);expect(photo.headers.get('x-content-type-options')).toBe('nosniff');
  expect((await fetch(origin+'/public/fixture-id/avatar/'+'b'.repeat(64))).status).toBe(404);
  db.findUnique.mockResolvedValue(null);expect((await fetch(origin+'/public/fixture-id/avatar/'+version)).status).toBe(404);
});
it('reports unavailable public data without exposing database details or fabricating reviews',async()=>{
  db.findMany.mockRejectedValueOnce(new Error('private connection information'));
  const response=await fetch(origin+'/public');
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({error:'Reviews temporarily unavailable'});
});
