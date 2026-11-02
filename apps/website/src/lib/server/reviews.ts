import { env } from '$env/dynamic/private';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
import { publicReviewSchema, type PublicReview } from '@anm/types';
import { z } from 'zod';

export async function loadReviews(): Promise<PublicReview[]> {
  try {
    const response = await fetch(
      new URL('/api/public/reviews', env.INTERNAL_BACKEND_URL || PUBLIC_BACKEND_URL),
      {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok) return [];
    return z.object({ items: z.array(publicReviewSchema) }).parse(await response.json()).items;
  } catch {
    return [];
  }
}
