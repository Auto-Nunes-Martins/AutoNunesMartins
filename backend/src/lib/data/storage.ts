import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv, getSupabaseServerKey } from '../../env.js';
import {
  preferredVariantPath,
  readVariantManifests,
  variantPath,
  manifestPath,
  forgetPhotoVariants,
} from '../server/photoVariants.js';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const env = getEnv();
  cached = createClient(env.SUPABASE_URL, getSupabaseServerKey(), {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }),
    },
  });
  return cached;
}

export function getBucketName(): string {
  return getEnv().SUPABASE_STORAGE_BUCKET;
}

export async function createSignedUploadUrl(path: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(getBucketName()).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

// ───────── Signed-URL cache ─────────
// Supabase signed URLs are stateless tokens valid for `expiresInSeconds` (we
// always pass 3600). We cache them for 40 min so subsequent reads of the same
// path inside a single backend process skip the Supabase API entirely.
// This is the dominant cost for the Viaturas list (one storage call per page
// load), the vehicle detail gallery, and the dashboard stock-aged thumbnails.

const SIGNED_URL_TTL_MS = 40 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function cacheGet(path: string): string | undefined {
  const hit = signedUrlCache.get(path);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    signedUrlCache.delete(path);
    return undefined;
  }
  return hit.url;
}

function cacheSet(path: string, url: string): void {
  signedUrlCache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
}

/** Bust the cached URL for a single path (call after deleting the underlying object). */
export function invalidateSignedReadUrl(path: string): void {
  signedUrlCache.delete(path);
}

export async function createSignedReadUrl(
  path: string,
  _expiresInSeconds = 3600,
  width?: number,
): Promise<string> {
  if (width) path = await preferredVariantPath(path, width);
  const hit = cacheGet(path);
  if (hit) return hit;
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(getBucketName()).createSignedUrl(path, 3600);
  if (error) throw error;
  cacheSet(path, data.signedUrl);
  return data.signedUrl;
}

/**
 * Batch-sign multiple read URLs in a single Supabase call. Paths already in
 * cache are served from memory; the rest are batched into one storage call.
 */
export async function createSignedReadUrls(
  paths: string[],
  _expiresInSeconds = 3600,
  width?: number,
): Promise<Map<string, string>> {
  if (width) {
    const selected = new Map<string, string>();
    const manifests = await readVariantManifests(paths);
    for (const path of paths) {
      const part = manifests.get(path)?.variants.find((v) => v.width >= width);
      selected.set(path, part ? variantPath(path, part.width) : path);
    }
    const signed = await createSignedReadUrls([...new Set(selected.values())]);
    return new Map(
      paths.flatMap((path) =>
        signed.has(selected.get(path)!) ? [[path, signed.get(selected.get(path)!)!]] : [],
      ),
    );
  }
  const out = new Map<string, string>();
  if (paths.length === 0) return out;

  const toSign: string[] = [];
  for (const p of new Set(paths)) {
    const cached = cacheGet(p);
    if (cached) out.set(p, cached);
    else toSign.push(p);
  }

  if (toSign.length === 0) return out;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(getBucketName())
    .createSignedUrls(toSign, 3600);
  if (error) throw error;
  for (const entry of data) {
    if (entry.signedUrl && entry.path) {
      out.set(entry.path, entry.signedUrl);
      cacheSet(entry.path, entry.signedUrl);
    }
  }
  return out;
}

/** Sign an entire gallery (or list of covers) in one storage roundtrip. */
export async function signedPhotos(paths: string[]) {
  const manifests = await readVariantManifests(paths);
  const urls = await createSignedReadUrls(
    paths.flatMap((path) => [
      path,
      ...(manifests.get(path)?.variants ?? []).map((v) => variantPath(path, v.width)),
    ]),
  );
  return paths.map((path) => {
    const manifest = manifests.get(path);
    const parts = manifest?.variants ?? [];
    return {
      path,
      url: urls.get(path)!,
      width: manifest?.width,
      height: manifest?.height,
      variants: parts
        .map((v) => ({
          width: v.width,
          height: v.height,
          url: urls.get(variantPath(path, v.width))!,
        }))
        .filter((v) => v.url),
    };
  });
}

export async function signedPhoto(path: string) {
  return (await signedPhotos([path]))[0]!;
}

/** Only sign the requested thumbnail plus its original fallback. */
export async function signedThumbnails(paths: string[], width = 320) {
  const manifests = await readVariantManifests(paths);
  const selected = new Map(
    paths.map((path) => {
      const part = manifests.get(path)?.variants.find((v) => v.width >= width);
      return [path, part ? variantPath(path, part.width) : path];
    }),
  );
  const urls = await createSignedReadUrls([...paths, ...selected.values()]);
  return {
    originals: urls,
    thumbnails: new Map(paths.map((path) => [path, urls.get(selected.get(path)!) ?? null])),
  };
}

export async function deleteObjects(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = getSupabase();
  const all = paths.flatMap((path) => {
    try {
      return [path, ...[320, 800, 1600, 2560].map((w) => variantPath(path, w)), manifestPath(path)];
    } catch {
      return [path];
    }
  });
  const { error } = await supabase.storage.from(getBucketName()).remove(all);
  if (error) throw error;
  // Drop cached URLs for deleted objects so we don't serve dead links.
  for (const p of all) invalidateSignedReadUrl(p);
  for (const p of paths) forgetPhotoVariants(p);
}
