import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { reviewInputSchema, reviewInitials } from '@anm/types';
import { normalizeReviewAvatar, MAX_REVIEW_AVATAR_BYTES } from './reviewAvatar.js';

describe('manual reviews', () => {
  it('validates trimmed text and exact half stars from 0.5 to 5, rejects injected fields', () => {
    expect(reviewInputSchema.parse({authorName:' Maria Silva ',rating:4,text:' Atendimento atento. '}).authorName).toBe('Maria Silva');
    for(const rating of [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5]) expect(reviewInputSchema.parse({authorName:'A',rating,text:'B'}).rating).toBe(rating);
    for(const rating of [0,0.3,0.6,4.3,5.5,6,NaN,Infinity,-Infinity,'5',null]) expect(reviewInputSchema.safeParse({authorName:'A',rating,text:'B'}).success).toBe(false);
    for(const value of [{authorName:' '},{text:''},{text:'x'.repeat(5001)},{avatarData:'untrusted'},{verified:true}])
      expect(reviewInputSchema.safeParse({authorName:'A',rating:5,text:'B',...value}).success).toBe(false);
    expect(reviewInitials('  Maria   Silva Costa  ')).toBe('MS');
    expect(reviewInitials('Érica')).toBe('É');
    expect(reviewInitials('')).toBe('');
  });
  it('normalizes raster photos, strips metadata and rejects SVG, animation and excessive bytes/pixels', async () => {
    const input=await sharp({create:{width:320,height:200,channels:3,background:'red'}}).jpeg().withMetadata().toBuffer();
    const avatar=await normalizeReviewAvatar(input), metadata=await sharp(avatar.avatarData).metadata();
    expect(metadata).toMatchObject({width:128,height:128,format:'webp'});
    expect(metadata.exif).toBeUndefined();
    expect(avatar.avatarVersion).toMatch(/^[a-f0-9]{64}$/);
    await expect(normalizeReviewAvatar(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'))).rejects.toThrow();
    await expect(normalizeReviewAvatar(Buffer.alloc(MAX_REVIEW_AVATAR_BYTES+1))).rejects.toThrow();
    await expect(normalizeReviewAvatar(Buffer.from('not a photo'))).rejects.toThrow();
    const excessive=await sharp({create:{width:5000,height:4000,channels:3,background:'white'}}).png().toBuffer();
    await expect(normalizeReviewAvatar(excessive)).rejects.toThrow();
  });
  it('applies the real additive migration in isolated PostgreSQL, empty by default, constrains data and removes avatar with row', async () => {
    const db=await PGlite.create();
    try {
      await db.exec('CREATE TABLE "ExistingData" (value text); INSERT INTO "ExistingData" VALUES (\'preserved\');');
      await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
      await db.exec(readFileSync('prisma/migrations/20261101120000_manual_web_reviews/migration.sql','utf8'));
      expect((await db.query('SELECT * FROM "WebReview"')).rows).toEqual([]);
      expect((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='WebReview'`)).rows).toEqual([{relrowsecurity:true}]);
      expect((await db.query(`SELECT has_table_privilege('anon','"WebReview"','SELECT') AS readable, has_table_privilege('authenticated','"WebReview"','INSERT') AS writable`)).rows).toEqual([{readable:false,writable:false}]);
      expect((await db.query('SELECT * FROM "ExistingData"')).rows).toEqual([{value:'preserved'}]);
      await db.query('INSERT INTO "WebReview" (id,"authorName",rating,text,"updatedAt") VALUES ($1,$2,$3,$4,now())',['review','Maria Silva',5,'Texto']);
      await db.exec(readFileSync('prisma/migrations/20261101150000_web_review_half_stars/migration.sql','utf8'));
      expect((await db.query('SELECT rating FROM "WebReview"')).rows).toEqual([{rating:5}]);
      expect((await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name='WebReview' AND column_name='rating'`)).rows).toEqual([{data_type:'double precision'}]);
      for(const rating of [0.5,1.5,4.5,5]) {
        await db.query('UPDATE "WebReview" SET rating=$1',[rating]);
        expect((await db.query('SELECT rating FROM "WebReview"')).rows).toEqual([{rating}]);
      }
      for(const rating of ['0','0.3','0.6','4.3','5.5','NaN','Infinity','-Infinity'])
        await expect(db.query('UPDATE "WebReview" SET rating=$1',[rating])).rejects.toThrow();
      await expect(db.query('UPDATE "WebReview" SET rating=6')).rejects.toThrow();
      await expect(db.query('UPDATE "WebReview" SET "authorName"=\' \'')).rejects.toThrow();
      await expect(db.query('UPDATE "WebReview" SET "avatarVersion"=$1',['a'.repeat(64)])).rejects.toThrow();
      await expect(db.query('UPDATE "WebReview" SET "avatarData"=$1',[new Uint8Array([1])])).rejects.toThrow();
      await db.query('UPDATE "WebReview" SET "avatarData"=$1,"avatarVersion"=$2',[new Uint8Array([1,2,3]),'a'.repeat(64)]);
      await db.exec('DELETE FROM "WebReview";');
      expect((await db.query('SELECT * FROM "WebReview"')).rows).toEqual([]);
    } finally { await db.close(); }
  });
});
