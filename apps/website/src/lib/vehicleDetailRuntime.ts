import {
  publicVehicleCanonical,
  vehicleJsonLdScript,
  vehicleBreadcrumbItems,
  vehicleBreadcrumbJsonLdScript,
} from './vehicleStructuredData';
import { vehicleShareData } from './vehicleShare';
import { vehicleSeo } from './vehicleSeo';
import { descriptionText } from '@anm/types/richDescription';
import BackLink from './features/ui/BackLink.svelte';
import PublicVehicleStory from './features/vehicles/PublicVehicleStory.svelte';
import VehicleShareButton from './components/VehicleShareButton.svelte';
import VehiclePhotoRail from './components/VehiclePhotoRail.svelte';
import RichDescription from './components/VehicleDescription.svelte';
import RelatedCarousel from './features/vehicles/RelatedCarousel.svelte';
import GalleryContactSlide from './components/GalleryContactSlide.svelte';
/** Route-owned gallery dependencies. SSR and hydration receive the same functions. */
import { publicGalleryPhoto } from './publicGalleryPhoto';
import { createPublicGallerySession } from './publicGallerySession';
import { followThumbnail } from './thumbnailFollow';
import { dragThumbnailStrip } from './dragThumbnailStrip';
import { photoSwipe } from './photoSwipe';
import { thumbnailNavigation } from './thumbnailNavigation';
import { createThumbnailSession, publicThumbnail, thumbnailAttrs } from './publicThumbnail';
import { trapDialogTab } from '../../../../shared/ui/dialogFocus';
import { fullscreenGallery as galleryBackdrop } from './fullscreenGallery';
import {
  captureOpeningPhoto,
  animateGalleryOpening,
  animateGalleryClosing,
} from './galleryOpening';
import './features/vehicles/photoViewer.css';
import './features/vehicles/vehicleDetail.css';

export const vehicleDetailRuntime = {
  captureOpeningPhoto,
  animateGalleryOpening,
  animateGalleryClosing,
  GalleryContactSlide,
  RelatedCarousel,
  RichDescription,
  VehicleShareButton,
  VehiclePhotoRail,
  PublicVehicleStory,
  BackLink,
  publicVehicleCanonical,
  vehicleJsonLdScript,
  vehicleBreadcrumbItems,
  vehicleBreadcrumbJsonLdScript,
  descriptionText,
  vehicleSeo,
  vehicleShareData,
  publicGalleryPhoto,
  createPublicGallerySession,
  followThumbnail,
  dragThumbnailStrip,
  photoSwipe,
  thumbnailNavigation,
  createThumbnailSession,
  publicThumbnail,
  thumbnailAttrs,
  trapDialogTab,
  galleryBackdrop,
};
export type VehicleDetailRuntime = typeof vehicleDetailRuntime;
