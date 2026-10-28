import { toast } from 'svelte-sonner';
import type { ComponentType } from 'svelte';
import VehicleSavedToast from './VehicleSavedToast.svelte';

export function vehicleSavedFeedback(value: {
  title: string; brand: string; model: string; year: number | string;
  detail: string; photo?: { url?: string; file?: File; preparedFile?: File };
}) {
  const localFile = value.photo?.preparedFile ?? value.photo?.file;
  const ownedUrl = !!localFile;
  const imageUrl = localFile ? URL.createObjectURL(localFile) : value.photo?.url;
  return toast.custom(VehicleSavedToast as unknown as ComponentType, {
    componentProps: { title: value.title, label: `${value.brand} ${value.model} · ${value.year}`,
      detail: value.detail, imageUrl, ownedUrl },
    duration: 6500,
  });
}
