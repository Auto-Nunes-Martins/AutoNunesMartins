import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {render} from 'svelte/server';
import * as svelte from 'svelte';
// @ts-expect-error Svelte compiler runtime.
import * as server from 'svelte/internal/server';
import {writable} from 'svelte/store';
import {describe,it,expect,vi,afterEach} from 'vitest';
const source=readFileSync(new URL('../components/shell/SessionRecovery.svelte',import.meta.url),'utf8');
const code=compile(source,{generate:'server'}).js.code
 .replace(/^import \* as \$ from 'svelte\/internal\/server';/m,'const $=imports.server;')
 .replace(/^import\s*\{\s*([^}]+)\s*\}\s*from '[^']+';/gm,(_line,names:string)=>`const {${names.replace(/\bas\b/g,':')}}=imports;`)
 .replace('export default function','return function');
afterEach(()=>vi.unstubAllGlobals());
function setup(state='ready'){
 vi.stubGlobal('window',undefined);let guard!:(navigation:any)=>void;const client={session:{id:'session-a'}};
 const refresh=vi.fn(async(_force:boolean)=>'valid-token'),go=vi.fn(async(_url:string,_options:unknown)=>{}),defer=vi.fn();
 const component=new Function('imports',code)({server,...svelte,page:writable({url:new URL('https://crm.test/dashboard')}),beforeNavigate:(callback:any)=>guard=callback,goto:go,invalidate:vi.fn(),invalidateAll:vi.fn(),useClerkContext:()=>client,crmPath:(p:string)=>p,crmRoute:(p:string)=>p,hasUnsavedForms:()=>false,crmSessionState:writable(state),deferSessionNavigation:defer,refreshCrmSession:refresh});
 render(component).body;
 return {guard,refresh,go,defer,client};
}
const navigation=(path='/viaturas')=>({willUnload:false,to:{url:new URL('https://crm.test'+path)},from:{url:new URL('https://crm.test/dashboard')},type:'link',cancel:vi.fn()});
const flush=()=>new Promise<void>(done=>setImmediate(done));
describe('CRM navigation session checks',()=>{
 it('reuses a valid SDK token after idle and does not invalidate the entire shell',async()=>{
  const test=setup();const nav=navigation();test.guard(nav);await flush();
  expect(nav.cancel).toHaveBeenCalledOnce();expect(test.refresh).toHaveBeenCalledWith(false);expect(test.go).toHaveBeenCalledWith('https://crm.test/viaturas',{replaceState:false,invalidateAll:false});
  const next=navigation('/vendas');test.guard(next);await flush();expect(next.cancel).not.toHaveBeenCalled();expect(test.refresh).toHaveBeenCalledTimes(1);
 });
 it('retains forced recovery and global revalidation after an actual expired session',async()=>{
  const test=setup('expired');test.guard(navigation());await flush();expect(test.refresh).toHaveBeenCalledWith(true);expect(test.go).toHaveBeenCalledWith('https://crm.test/viaturas',{replaceState:false,invalidateAll:true});
 });
 it('only resumes the most recent navigation when a token check is in flight',async()=>{
  const test=setup();let resolve!:(token:string)=>void;const pending=new Promise<string>(done=>resolve=done);test.refresh.mockImplementation(()=>pending);
  test.guard(navigation());test.guard(navigation('/vendas'));resolve('token');await flush();expect(test.go).toHaveBeenCalledTimes(1);expect(test.go.mock.calls[0]?.[0]).toBe('https://crm.test/vendas');
 });
 it('revalidates the shell when the SDK switches identity even within the recent-check window',async()=>{
  const test=setup();test.guard(navigation());await flush();test.client.session.id='session-b';test.guard(navigation('/vendas'));await flush();expect(test.refresh).toHaveBeenLastCalledWith(true);expect(test.go).toHaveBeenLastCalledWith('https://crm.test/vendas',{replaceState:false,invalidateAll:true});
 });
 it('leaves external unloads and the login route to normal navigation',async()=>{
  const test=setup();const external={...navigation(),willUnload:true};test.guard(external);test.guard(navigation('/'));await flush();expect(test.refresh).not.toHaveBeenCalled();expect(external.cancel).not.toHaveBeenCalled();
 });
});
