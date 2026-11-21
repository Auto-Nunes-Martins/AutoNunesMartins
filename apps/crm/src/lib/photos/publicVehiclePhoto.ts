/** Public showcase paths already include their immutable photo version. */
export function publicVehiclePhotoUrl(backend: string, photo: string, width: number): string {
  const [path, query = ''] = photo.split('?');
  const params = new URLSearchParams(query);
  params.set('w', String(width));
  return `${backend.replace(/\/+$/, '')}${path}?${params}`;
}
