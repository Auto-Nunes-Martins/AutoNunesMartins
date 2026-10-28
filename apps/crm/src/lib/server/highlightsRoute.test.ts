import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({api:vi.fn()}));
vi.mock('$lib/server/api',()=>({apiJson:mocks.api,ApiError:class extends Error{},rethrowAuthError:()=>{}}));
import { load, actions } from '../../routes/(app)/site/destaques/+page.server';
beforeEach(()=>mocks.api.mockReset());
it('passes the selected vehicle from the URL without saving a highlight',async()=>{
  const editor={revision:'v1',items:[],candidates:[]};mocks.api.mockResolvedValue(editor);
  const value=await load({url:new URL('http://fixture/site/destaques?viatura=current')} as never);
  expect(value).toEqual({editor,selectedVehicleId:'current'});expect(mocks.api).toHaveBeenCalledTimes(1);expect(mocks.api.mock.calls[0]?.[1]).toBe('/api/homepage-highlights');
});
it('persists the deliberate selection through the existing revision-checked endpoint',async()=>{
  const selection={revision:'v1',items:[{vehicleId:'current',photoPath:'chosen-photo'}]},form=new FormData();form.set('selection',JSON.stringify(selection));mocks.api.mockResolvedValue({ok:true});
  const value=await actions.default!({request:{formData:async()=>form}} as never);
  expect(value).toEqual({saved:true});expect(mocks.api.mock.calls[0]?.[2]).toEqual({method:'PUT',body:JSON.stringify(selection)});
});
