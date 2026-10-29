const assets = import.meta.glob('./assets/brands/*.{svg,png}', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
}) as Record<string, string>;
export function brandLogo(slug: string | null) {
  return slug
    ? (assets['./assets/brands/' + slug + '.svg'] ?? assets['./assets/brands/' + slug + '.png'])
    : undefined;
}
