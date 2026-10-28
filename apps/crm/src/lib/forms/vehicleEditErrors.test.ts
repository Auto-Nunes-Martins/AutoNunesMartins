import { describe, expect, it } from 'vitest';
import { issueKey, serverEditIssues, validateVehicleEdit } from './vehicleEditErrors';
import { publicDraftFromForm } from '$lib/components/vehicle/vehicleEditDraft';

it('does not require individual approval of the principal when publishing', () => {
  const form = new FormData();
  form.set('published', 'true');
  form.set('publicDescription', 'Descrição confirmada');
  const root = {querySelectorAll: () => []} as unknown as HTMLElement;
  const issues = validateVehicleEdit(root, {status:'AVAILABLE'}, publicDraftFromForm(form), ['first','second']);
  expect(issues.filter(issue => ['photos','photoPrincipal'].includes(issue.key))).toEqual([]);
});
describe('guided vehicle edit error contract',()=>{
 it('maps nested backend publication/photo/specification errors to actual controls',()=>{expect(issueKey(['publication','photoPaths',0])).toBe('photos');expect(issueKey(['publication','specifications','equipment',2])).toBe('equipment');expect(issueKey(['data','licensePlate'])).toBe('licensePlate');expect(issueKey(['uploadedPhotos',1])).toBe('photos');});
 it('maps old photo payload errors to the complete gallery',()=>{expect(serverEditIssues({issues:[{path:['publication','photoPaths'],message:'Fotografia indisponível.'}]})).toEqual([{key:'photos',message:'Fotografias: Fotografia indisponível.'}]);});
 it('explains limits in Portuguese and supports duplicate-field feedback',()=>{expect(serverEditIssues({issues:[{path:['publication','description'],message:'String must contain at most 6000 character(s)'}]})[0]).toEqual({key:'publicDescription',message:'Descrição pública: Use até 6000 caracteres.'});expect(serverEditIssues({field:'vin',error:'Este VIN já existe.'})[0]?.key).toBe('vin');});
});
