import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContactRequestError, submitContact } from './contactRequest';
let values: Record<string,string>;
const form={} as HTMLFormElement;
beforeEach(()=>{
  values={name:'Pessoa de teste',email:'teste@example.test',subject:'Informações gerais',message:'Mensagem fictícia',website:''};
  vi.stubGlobal('window',{location:{pathname:'/viaturas/test-aaaaaaaaaaaa'}});
  vi.stubGlobal('FormData',class{get(key:string){return values[key];}});
});
afterEach(()=>vi.unstubAllGlobals());
it('keeps the same idempotency key after an uncertain response and creates a new one only for changed data or a new accepted request',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(new TypeError('private technical data')).mockResolvedValue({ok:true,status:202,json:async()=>({ok:true})});vi.stubGlobal('fetch',fetch);
  await expect(submitContact(form)).rejects.toMatchObject({kind:'uncertain'});await submitContact(form);
  const sent=fetch.mock.calls.map(call=>JSON.parse(call[1].body));expect(sent[0].requestId).toBe(sent[1].requestId);expect(sent[1].page).toBe('/viaturas/test-aaaaaaaaaaaa');expect(sent[1].website).toBe('');
  await submitContact(form);expect(JSON.parse(fetch.mock.calls[2]![1].body).requestId).not.toBe(sent[1].requestId);
});
it.each([[400,'validation'],[422,'validation'],[429,'limited'],[409,'conflict'],[503,'unavailable'],[502,'uncertain'],[500,'uncertain']])('handles HTTP %s without leaking technical/provider messages',async(status,kind)=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status,json:async()=>({error:'SECRET customer@example.test'})}));
  try{await submitContact(form);throw new Error('Expected failure');}catch(error){expect(error).toBeInstanceOf(ContactRequestError);expect((error as ContactRequestError).kind).toBe(kind);expect((error as Error).message).not.toMatch(/SECRET|customer@/);}
});
it('requires authoritative ok and handles timeout, offline and malformed responses as unconfirmed',async()=>{
  for(const response of [()=>Promise.reject(new DOMException('timeout','TimeoutError')),()=>Promise.reject(new TypeError('offline')),()=>Promise.resolve({ok:true,status:200,json:async()=>({})}),()=>Promise.resolve({ok:true,status:202,json:async()=>{throw new SyntaxError('technical');}})]){
    vi.stubGlobal('fetch',vi.fn(response));await expect(submitContact(form)).rejects.toMatchObject({kind:'uncertain'});
  }
});
