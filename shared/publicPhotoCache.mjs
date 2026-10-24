// HTTP requests still check live access. Gallery revisits use retained local blobs,
// never this HTTP route; there is no timer that sends them back to the network.
export const REVALIDATE_PUBLIC_PHOTO = 'private, no-cache, max-age=0, must-revalidate';
export const isPublicPhotoVersion = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
