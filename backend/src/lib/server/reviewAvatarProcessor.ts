import { PhotoEncodingSession } from './photoEncodingSession.js';
import { normalizeReviewAvatar } from './reviewAvatar.js';
/** The caller owns photo admission until this process has closed and persistence has finished. */
export async function processReviewAvatar(input: Buffer) {
  if (process.env.NODE_ENV !== 'production' || process.env.PHOTO_PROCESSING_MODE === 'inline')
    return normalizeReviewAvatar(input);

  const session = new PhotoEncodingSession();
  try {
    return await session.avatar(input);
  } finally {
    // No fallback to a heavy parent decode on worker failure. Match vehicle-photo isolation.
    await session.close();
  }
}
