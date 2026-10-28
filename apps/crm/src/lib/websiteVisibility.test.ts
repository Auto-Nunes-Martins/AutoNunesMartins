import { describe, expect, it } from 'vitest';
import { websiteVisibility } from './websiteVisibility';
const vehicle = { id:'c000000000000000000000001',webPublished:true,publicSlug:'vehicle-aaaaaaaaaaaa',publicPrice:null,status:'AVAILABLE',soldDate:null,sale:null,photos:['c000000000000000000000001/00000000-0000-4000-8000-000000000001.webp'] };
describe('public visibility follows the public endpoint contract',()=>{
  it('shows available/reserved published vehicles with an address',()=>{
    expect(websiteVisibility(vehicle).visible).toBe(true);
    expect(websiteVisibility({...vehicle,status:'RESERVED'}).visible).toBe(true);
  });
  it.each([{webPublished:false},{publicSlug:null},{status:'DRAFT'},{status:'SOLD'},{soldDate:'2026-10-28'},{sale:{id:'sale'}},{publicPrice:'0'},{publicPrice:'-1'}])('does not claim live for %j',change=>expect(websiteVisibility({...vehicle,...change}).visible).toBe(false));
  it('does not invent a photo requirement: the listing may show image unavailable',()=>{
    expect(websiteVisibility({...vehicle,photos:[]}).visible).toBe(true);
    expect(websiteVisibility({...vehicle,photos:[]}).label).toContain('sem fotografias');
    expect(websiteVisibility({...vehicle,photos:['foreign/path.webp']}).label).toContain('sem fotografias');
  });
});
