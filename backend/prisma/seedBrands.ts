import { vehicleBrands } from '@anm/types';
import type { PrismaClient } from '@prisma/client';
/** Add/update release catalogue only. Never deletes vehicles, receipts or legacy labels. */
export async function seedBrandCatalog(db: Pick<PrismaClient, 'vehicleBrand'>) {
  for (const brand of vehicleBrands)
    await db.vehicleBrand.upsert({
      where: { name: brand.name },
      create: { ...brand, active: true },
      update: { ...brand, active: true },
    });
}
