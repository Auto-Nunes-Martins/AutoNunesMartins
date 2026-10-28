import { expect, it, vi } from 'vitest';
vi.mock('lucide-svelte', () => Object.fromEntries(['Activity','Mail','ArrowRightLeft','Car','CheckCircle2','CircleDollarSign','ListPlus','PencilLine','Receipt','Trash2','UserCog','UserPlus','Wallet','Globe','Star'].map(name => [name, name])));
import { Globe, Star, PencilLine } from 'lucide-svelte';
import { activityStyle, activityContextText } from './activityPresentation';
import { activityHref } from './activityNavigation';
it('uses web, highlight and edit icons according to structured semantics', () => {
  expect(activityStyle('VEHICLE_UPDATED', 'website-enabled').icon).toBe(Globe);
  expect(activityStyle('VEHICLE_UPDATED', 'website-disabled').icon).toBe(Globe);
  expect(activityStyle('VEHICLE_UPDATED', 'homepage-highlights').icon).toBe(Star);
  expect(activityStyle('VEHICLE_UPDATED').icon).toBe(PencilLine);
});
it('distinguishes present identity from the historical record and avoids unavailable links', () => {
  expect(activityContextText({ entityContext: { source: 'current', label: 'BMW One · AA-00-AA' } })).toBe('Identificação atual: BMW One · AA-00-AA');
  expect(activityContextText({ entityContext: { source: 'unavailable', label: null } })).toContain('não registada');
  expect(activityHref({ type: 'VEHICLE_UPDATED', entityType: 'vehicle', entityId: 'car', entityAvailable: false })).toBeNull();
  expect(activityHref({ type: 'VEHICLE_UPDATED', entityType: 'vehicle', entityId: 'homepageHighlights', semanticAction: 'homepage-highlights' })).toBe('/site/destaques');
});
