import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv, getSupabaseServerKey } from '../../env.js';

let cached: SupabaseClient | null = null;
let cleanupCached: SupabaseClient | null = null;

/** Storage transport only; signing and photo variants live above this boundary. */
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

/** Bounded deletes while a cleanup worker owns the vehicle/job locks. */
export function getCleanupSupabase(): SupabaseClient {
  if (cleanupCached) return cleanupCached;
  const env = getEnv();
  cleanupCached = createClient(env.SUPABASE_URL, getSupabaseServerKey(), {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });
  return cleanupCached;
}
export function getBucketName(): string {
  return getEnv().SUPABASE_STORAGE_BUCKET;
}
