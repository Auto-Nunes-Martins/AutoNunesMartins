import { publicRequest } from './publicVehicles';
import { publicHighlightsSchema, type PublicHighlights } from '../homepageHighlights';

export async function loadHomepageHighlights(): Promise<PublicHighlights> {
  try {
    const response = await publicRequest('/homepage-highlights');
    if (!response.ok) return { configured: true, items: [] };
    return publicHighlightsSchema.parse(await response.json());
  } catch {
    return { configured: true, items: [] };
  }
}
