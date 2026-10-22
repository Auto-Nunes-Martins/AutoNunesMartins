import { describe, it, expect, vi, afterEach } from 'vitest';
import {validatedReadCache} from './validatedReadCache';
afterEach(()=>vi.useRealTimers());
describe('database-validated read cache',()=>{
 it('validates every hit and rebuilds after revisions from any writer',async()=>{
  let revision='r1';const read=vi.fn(async()=>revision);const cache=validatedReadCache(read);const load=vi.fn(async()=>({items:[revision]}));
  expect(await cache.read('actor|role|filters|page',load)).toEqual({items:['r1']});
  expect(await cache.read('actor|role|filters|page',load)).toEqual({items:['r1']});expect(load).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledTimes(2);
  revision='r2';expect(await cache.read('actor|role|filters|page',load)).toEqual({items:['r2']});expect(load).toHaveBeenCalledTimes(2);
 });
 it('never uses an old entry if current-version validation fails',async()=>{
  const revision=vi.fn().mockResolvedValueOnce('r1').mockRejectedValueOnce(new Error('offline'));
  const cache=validatedReadCache(revision);const load=vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('fresh');
  expect(await cache.read('key',load)).toBe('old');expect(await cache.read('key',load)).toBe('fresh');
 });
 it('does not mix actors, roles, filters or pages and expires memory entries',async()=>{
  vi.useFakeTimers();const cache=validatedReadCache(async()=> 'same',1000);const load=vi.fn(async()=>load.mock.calls.length);
  for(const key of ['a|admin|all|1','b|admin|all|1','a|other|all|1','a|admin|brand|1','a|admin|all|2'])await cache.read(key,load);
  expect(load).toHaveBeenCalledTimes(5);await cache.read('a|admin|all|1',load);expect(load).toHaveBeenCalledTimes(5);
  vi.advanceTimersByTime(1001);await cache.read('a|admin|all|1',load);expect(load).toHaveBeenCalledTimes(6);
 });
 it('does not let a read finishing after a new revision overwrite that new entry',async()=>{
  let revision='old',resolve!:(value:string)=>void;const cache=validatedReadCache(async()=>revision);
  const first=cache.read('key',()=>new Promise<string>(done=>resolve=done));await Promise.resolve();await Promise.resolve();await Promise.resolve();
  revision='new';expect(await cache.read('key',async()=>'new result')).toBe('new result');resolve('old result');await first;
  const load=vi.fn(async()=>'wrong');expect(await cache.read('key',load)).toBe('new result');expect(load).not.toHaveBeenCalled();
 });
 it('shares an in-flight read for the same validated revision but does not cache failures',async()=>{
  const cache=validatedReadCache(async()=>'r1');const failed=vi.fn(async()=>{throw new Error('retry');});await expect(cache.read('x',failed)).rejects.toThrow('retry');await expect(cache.read('x',failed)).rejects.toThrow('retry');expect(failed).toHaveBeenCalledTimes(2);
  const load=vi.fn(async()=>42);expect(await Promise.all([cache.read('y',load),cache.read('y',load)])).toEqual([42,42]);expect(load).toHaveBeenCalledTimes(1);
 });
});
