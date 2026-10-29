import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { vehicleBrands } from '@anm/types';
it('ships verified, decodable local assets matching catalogue and provenance hashes', async () => {
  const inventory = JSON.parse(
    readFileSync(resolve('../docs/brand-catalog/logo-inventory.json'), 'utf8'),
  );
  for (const brand of vehicleBrands) {
    const item = inventory.find((x: any) => x.name === brand.name);
    expect(item).toBeDefined();
    if (!brand.logo) {
      expect(item.pendingReason).toBeTruthy();
      continue;
    }
    const file = resolve('../apps/crm/src/lib/assets/brands', item.asset);
    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    const hashBytes = file.endsWith('.svg')
      ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
      : bytes;
    expect(createHash('sha256').update(hashBytes).digest('hex')).toBe(item.sha256);
    expect(item.source).toBeTruthy();
    expect(item.license).toBeTruthy();
    if (file.endsWith('.svg'))
      expect(bytes.toString()).not.toMatch(
        /<script|<foreignObject|\bon\w+=|(?:href|src)=["'](?:https?:|\/\/|data:)/i,
      );
    const metadata = await sharp(bytes).metadata();
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  }
}, 30000);
