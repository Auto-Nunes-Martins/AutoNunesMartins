import {describe,it,expect,vi,afterEach} from 'vitest';
import {singleFlight,attemptWindow} from './singleFlight';
afterEach(()=>vi.useRealTimers());
describe('concurrent authentication work',()=>{
 it('shares only concurrent reads for one verified identity and reads permissions again afterwards',async()=>{
  const read=singleFlight();let resolve!:(value:string)=>void;const load=vi.fn(()=>new Promise<string>(done=>resolve=done));
  const a=read('actor-a',load),b=read('actor-a',load);await Promise.resolve();expect(load).toHaveBeenCalledTimes(1);resolve('admin');expect(await Promise.all([a,b])).toEqual(['admin','admin']);
  expect(await read('actor-a',async()=>'changed-permissions')).toBe('changed-permissions');expect(await read('actor-b',async()=>'other-user')).toBe('other-user');
 });
 it('retries errors and prevents repeated missing-avatar network requests within the window',async()=>{
  const read=singleFlight();await expect(read('a',async()=>{throw new Error('fail');})).rejects.toThrow('fail');expect(await read('a',async()=>1)).toBe(1);
  vi.useFakeTimers();const begin=attemptWindow(300000);expect(begin('a')).toBe(true);expect(begin('a')).toBe(false);expect(begin('b')).toBe(true);vi.advanceTimersByTime(300001);expect(begin('a')).toBe(true);
 });
});
