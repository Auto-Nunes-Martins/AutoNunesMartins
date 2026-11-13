import { toast } from 'svelte-sonner';
import type { ComponentType } from 'svelte';
import SiteSavedToast from './SiteSavedToast.svelte';

export type SiteSaveSummary = {
  kind: 'campaign' | 'review' | 'highlight';
  title: string;
  label: string;
  detail: string;
  vehicleId?: string;
  imageUrl?: string;
  imagePosition?: string;
  rating?: number;
  excerpt?: string;
};

export function siteSavedFeedback(summary: SiteSaveSummary) {
  return toast.custom(SiteSavedToast as unknown as ComponentType, {
    componentProps: { summary },
    duration: 7500,
  });
}
