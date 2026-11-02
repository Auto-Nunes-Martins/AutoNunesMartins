import { z } from 'zod';

export const reviewInputSchema = z
  .object({
    authorName: z.string().trim().min(1).max(100),
    rating: z.number().finite().min(0.5).max(5).multipleOf(0.5),
    text: z.string().trim().min(1).max(5000),
  })
  .strict();
export const publicReviewSchema = reviewInputSchema.extend({
  id: z.string().min(1).max(100),
  avatarVersion: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

export function reviewInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase('pt-PT');
}
export function reviewAvatarUrl(
  origin: string,
  review: Pick<PublicReview, 'id' | 'avatarVersion'>,
): string | undefined {
  return review.avatarVersion
    ? `${origin.replace(/\/+$/, '')}/api/public/reviews/${encodeURIComponent(review.id)}/avatar/${review.avatarVersion}`
    : undefined;
}
