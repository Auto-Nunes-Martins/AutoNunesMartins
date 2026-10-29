import { registeredBrand } from '@anm/types';

// One verified local asset set for both applications. Vite emits each URL into its own build.
const assets = import.meta.glob('../apps/crm/src/lib/assets/brands/*.{svg,png}', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
}) as Record<string, string>;

export function vehicleBrandAsset(slug: string | null): string | undefined {
  return slug
    ? (assets['../apps/crm/src/lib/assets/brands/' + slug + '.svg'] ??
        assets['../apps/crm/src/lib/assets/brands/' + slug + '.png'])
    : undefined;
}

/** Resolve legacy text as well as canonical names; never substitute a fuzzy match or parent brand. */
export function vehicleBrandLogo(name: string): string | undefined {
  if (/[\\/]/.test(name)) return undefined;
  return vehicleBrandAsset(registeredBrand(name)?.logo ?? null);
}
