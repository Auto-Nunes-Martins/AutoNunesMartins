import { expect, it } from 'vitest';
import { prepareVehicleHighlight } from './highlightSelection';
const candidate = {id:'current',brand:'BMW',model:'One',year:2020,slug:'slug',photos:[{path:'photo-a',url:'url'},{path:'photo-b',url:'url'}]};
it('prepares a draft with the current vehicle while preserving existing order and revision',()=>{
  const editor={revision:'version',items:[{vehicleId:'other',photoPath:'other-photo'}],candidates:[candidate]};
  expect(prepareVehicleHighlight(editor,'current').items).toEqual([...editor.items,{vehicleId:'current',photoPath:'photo-a'}]);
  expect(editor.items).toHaveLength(1);
});
it('opens the existing selected photo without duplicating the vehicle',()=>{
  const result=prepareVehicleHighlight({revision:null,items:[{vehicleId:'current',photoPath:'photo-b'}],candidates:[candidate]},'current');
  expect(result.items).toEqual([{vehicleId:'current',photoPath:'photo-b'}]);expect(result.choosing).toBe('current');
});
it('does not replace another selection at the limit or add an ineligible vehicle',()=>{
  const items=Array.from({length:5},(_,i)=>({vehicleId:String(i),photoPath:String(i)}));
  expect(prepareVehicleHighlight({revision:null,items,candidates:[candidate]},'current').items).toEqual(items);
  expect(prepareVehicleHighlight({revision:null,items:[],candidates:[]},'current').items).toEqual([]);
});
