import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { vehiclePrincipalPath, orderedPublicPhotos } from '../../../../shared/vehiclePhotoPrincipal.mjs';
import { approvedPaths, publicVehicleDto, publicPhotoVersion } from '../data/publicVehicle.js';
const id='c'+'1'.repeat(24),a=`${id}/12345678-1234-1234-1234-123456789abc.jpg`,b=`${id}/12345678-1234-1234-1234-123456789abd.webp`,privatePhoto=`${id}/12345678-1234-1234-1234-123456789abe.jpg`;
const row=()=>({id,brand:'Teste',model:'Sem destaque homepage',year:2022,fuel:'DIESEL' as const,mileage:20000,status:'AVAILABLE' as const,webPublished:true,publicSlug:'teste-abcdef123456',publicPrice:new Prisma.Decimal(20000),publicDescription:'Anúncio',publicTransmission:null,publicSpecifications:{},photos:[b,a,privatePhoto],publicPhotoPaths:[a,b]});
describe('one announcement principal',()=>{
 it('uses the first current image for CRM/dashboard and public DTO regardless of approval order or homepage selection',()=>{const vehicle=row();expect(vehiclePrincipalPath(vehicle)).toBe(b);expect(approvedPaths(vehicle)).toEqual(vehicle.photos);expect(publicVehicleDto(vehicle).photos[0]).toBe('/api/public/vehicles/teste-abcdef123456/photos/0?v='+publicPhotoVersion(b));expect(vehicle.photos).toEqual([b,a,privatePhoto]);});
 it('ignores legacy subsets without mutating persisted arrays',()=>{const vehicle={...row(),photos:[privatePhoto,b,a]};expect(vehiclePrincipalPath(vehicle)).toBe(privatePhoto);expect(approvedPaths(vehicle)).toEqual(vehicle.photos);expect(vehicle.publicPhotoPaths).toEqual([a,b]);expect(vehicle.photos[0]).toBe(privatePhoto);});
 it('uses the same principal before and after publication even with an empty legacy subset',()=>{expect(vehiclePrincipalPath({...row(),webPublished:false,photos:[privatePhoto,b]})).toBe(privatePhoto);expect(vehiclePrincipalPath({...row(),publicPhotoPaths:[]})).toBe(b);expect(orderedPublicPhotos([a,b],[])).toEqual([a,b]);});
});
