import { describe, expect, it } from 'vitest';
import { issueKey, serverEditIssues } from './vehicleEditErrors';
describe('guided vehicle edit error contract',()=>{
 it('maps nested backend publication/photo/specification errors to actual controls',()=>{expect(issueKey(['publication','photoPaths',0])).toBe('photoPrincipal');expect(issueKey(['publication','specifications','equipment',2])).toBe('equipment');expect(issueKey(['data','licensePlate'])).toBe('licensePlate');expect(issueKey(['uploadedPhotos',1])).toBe('photos');});
 it('keeps a specific principal resolution instead of a generic schema error',()=>{expect(serverEditIssues({issues:[{path:['publication','photoPaths'],message:'Escolha outra foto principal entre as selecionadas.'}]})).toEqual([{key:'photoPrincipal',message:'Foto principal: Escolha outra foto principal entre as selecionadas.'}]);});
 it('explains limits in Portuguese and supports duplicate-field feedback',()=>{expect(serverEditIssues({issues:[{path:['publication','description'],message:'String must contain at most 6000 character(s)'}]})[0]).toEqual({key:'publicDescription',message:'Descrição pública: Use até 6000 caracteres.'});expect(serverEditIssues({field:'vin',error:'Este VIN já existe.'})[0]?.key).toBe('vin');});
});
