import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({token:vi.fn(),api:vi.fn(),fetch:vi.fn(),trace:{id:'12345678-1234-4234-8234-123456789abc',phase:vi.fn(),finish:vi.fn()},begin:vi.fn()}));
vi.mock('$lib/server/api',()=>({getApiToken:mocks.token,apiFetch:mocks.api}));
vi.mock('$lib/server/runtimeDiagnostics',()=>({getProcessDiagnostics:()=>({begin:mocks.begin}),clientMetrics:()=>({})}));
vi.mock('$env/static/public',()=>({PUBLIC_BACKEND_URL:'http://backend.fixture'}));
vi.mock('$env/dynamic/private',()=>({env:{}}));
import { POST as upload } from '../../routes/(app)/viaturas/[id]/photos/+server';
import { POST as transfer } from '../../routes/(app)/viaturas/[id]/photos/diagnostics/+server';
beforeEach(()=>{vi.clearAllMocks();mocks.token.mockResolvedValue('fixture-token');mocks.begin.mockReturnValue(mocks.trace);vi.stubGlobal('fetch',mocks.fetch);});
const event=(request:Request)=>({request,params:{id:'fixture'},locals:{}} as never);
it('streams unchanged photo body, shares correlation and finishes the CRM sampler',async()=>{
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({path:'fixture'}),{status:201,headers:{'x-photo-trace-id':mocks.trace.id,'x-photo-diagnostics-enabled':'true'}}));
  const request=new Request('http://crm.fixture/viaturas/fixture/photos',{method:'POST',body:new Blob(['image']),headers:{'content-type':'image/jpeg'}});
  const response=await upload(event(request));expect(response.status).toBe(201);expect(mocks.fetch.mock.calls[0]![1].body).toBe(request.body);expect(mocks.fetch.mock.calls[0]![1].headers['x-photo-trace-id']).toBe(mocks.trace.id);expect(response.headers.get('x-photo-diagnostics-enabled')).toBe('true');expect(mocks.trace.finish).toHaveBeenCalledWith('ok',{status:201});
});
it('requires a session before creating trace state and releases trace after network failure',async()=>{
  mocks.token.mockResolvedValueOnce(null);expect((await upload(event(new Request('http://crm.fixture',{method:'POST'})))).status).toBe(401);expect(mocks.begin).not.toHaveBeenCalled();
  mocks.fetch.mockRejectedValueOnce(Error('unavailable'));await expect(upload(event(new Request('http://crm.fixture',{method:'POST'})))).rejects.toThrow('unavailable');expect(mocks.trace.finish).toHaveBeenCalledWith('error',{status:502});
});
it('bounds telemetry while reading unknown-length streams and forwards small authenticated reports',async()=>{
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2048));controller.close();}});
  const request=new Request('http://crm.fixture',{method:'POST',body:stream,duplex:'half'} as RequestInit&{duplex:string});expect((await transfer(event(request))).status).toBe(413);expect(mocks.api).not.toHaveBeenCalled();
  mocks.api.mockResolvedValue(new Response(null,{status:204}));expect((await transfer(event(new Request('http://crm.fixture',{method:'POST',body:'{}'})))).status).toBe(204);expect(mocks.api.mock.calls[0]![1]).toBe('/api/vehicles/fixture/photos/diagnostics');
});
