import {
  publicVehicleCanonical,
  vehicleJsonLdScript,
  vehicleBreadcrumbItems,
  vehicleBreadcrumbJsonLdScript,
} from './vehicleStructuredData';
import { vehicleShareData } from './vehicleShare';
import { vehicleSeo } from './vehicleSeo';
import { descriptionText } from '@anm/types/richDescription';
import OrbitBackLink from './components/stand-concepts/OrbitBackLink.svelte';
import PublicVehicleStory from './components/stand-concepts/PublicVehicleStory.svelte';
import VehicleShareButton from './components/VehicleShareButton.svelte';
import RichDescription from './components/VehicleDescription.svelte';
import RelatedCarousel from './components/stand-concepts/RelatedCarousel.svelte';
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
import { galleryBackdrop } from '../../../../shared/ui/galleryBackdrop';
import './components/stand-concepts/photoViewer.css';
import './components/stand-concepts/orbitDetail.css';

export const vehicleDetailRuntime = {
  GalleryContactSlide,
  RelatedCarousel,
  RichDescription,
  VehicleShareButton,
  PublicVehicleStory,
  OrbitBackLink,
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
