<script lang="ts">
  import { homepageDescription, vehicleSocialImage } from '$lib/socialImages';
  import {
    sizedPhoto,
    vehiclePhotoSet,
    cardPhoto,
    cardPhotoSet,
    galleryPhotoSizes,
  } from '$lib/vehiclePhotoSources';
  import type { Snippet } from 'svelte';
  import type { VehicleDetailRuntime } from '$lib/vehicleDetailRuntime';
  let galleryOpen = $state(false);
  let galleryPointerFocus = $state(false);
  let mainPhotoLoading = $state(true);
  import { vehiclePhoto } from '$lib/vehiclePhoto';
  import { framingStyle, photoFraming } from '@anm/types';
  import { homePhotoPlaceholder, homePhotoPriority } from '$lib/homePhotoPriority';
  import { publicPhotoVersions } from '$lib/publicVehicles';
  import UnavailableVehiclePanel from '../vehicles/UnavailableVehiclePanel.svelte';
  import MissingVehiclePanel from '../vehicles/MissingVehiclePanel.svelte';
  import {
    logoLight,
    logoDark,
    logoLightSrcset,
    logoDarkSrcset,
    catalogPlaceholder,
  } from '$lib/localAssets';
  import { publicErrorCopy } from '$lib/publicError';
  import type { UnavailableVehicle } from '$lib/unavailableVehicle';
  import type { PublicHighlights } from '$lib/homepageHighlights';
  import { filterHomeStock } from '../home/filterHomeStock';
  import HomeHero from '../home/hero/HomeHero.svelte';
  import '../home/serviceTypography.css';
  import { homeScenes } from '../home/homeScenes';
  import SocialMetadata from '$lib/components/SocialMetadata.svelte';
  import { createContactForm } from '$lib/contactForm.svelte';
  import ContactFeedback from '$lib/components/ContactFeedback.svelte';
  import { LoaderCircle } from 'lucide-svelte';
  import ContactFormFooter from '$lib/components/ContactFormFooter.svelte';
  import { lockContactViewport } from '../contact/contactViewport';
  import siteFont400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
  import siteFont500 from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
  import siteFont600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
  import siteTitleFont from '@fontsource/barlow/files/barlow-latin-600-normal.woff2?url';
  import siteTitleItalic from '@fontsource/barlow/files/barlow-latin-600-italic.woff2?url';
  import { onDestroy, tick, untrack } from 'svelte';
  import { usePublicTheme } from '$lib/publicTheme';
  import {
    emptyStock,
    publicMileage,
    formatVehiclePrice,
    type PublicStock,
    type PublicVehicle,
    type PublicCard,
  } from '$lib/publicVehicles';
  import { page } from '$app/stores';
  import { publicPhoto } from '$lib/publicVehicles';
  import { vehicleDetails } from '../vehicles/vehicleDetails';
  import DiscoverVehicles from '../home/DiscoverVehicles.svelte';
  import PromotionTerms from '../campaigns/PromotionTerms.svelte';
  import CardPromotionPrice from '../campaigns/CardPromotionPrice.svelte';
  import CardPromotionOverlay from '../campaigns/CardPromotionOverlay.svelte';
  import StandSelection from '../home/StandSelection.svelte';
  import CampaignStrip from '../campaigns/CampaignStrip.svelte';
  import { hybridNav } from './hybridNav';
  import { catalogNavigation } from './catalogNavigation';
  import './catalogNavigation.css';
  import { mobileNavigation } from './mobileNavigation';
  import { ringPhone } from '../contact/phoneAttention';
  import './mobileNavigation.css';
  import ThemeToggle from './ThemeToggle.svelte';
  import {
    ArrowUpRight,
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    X,
    Heart,
    Menu,
    Phone,
    MapPin,
    Clock3,
    Mail,
    CalendarDays,
    Fuel,
    Maximize,
  } from 'lucide-svelte';
  import { photo } from '../catalog/responsiveImages';
  import { publicCardImageSizes, relatedCardImageSizes } from '../catalog/responsiveImages';
  import { coverPhotoSizes } from '$lib/coverPhotoSizes';
  import { designMotion, entrance, conditionalEntrance } from '../motion/designMotion';
  import Perspective from '../home/Perspective.svelte';
  import Faq from '../ui/Faq.svelte';
  import VehicleSpecIcon from '../../components/VehicleSpecIcon.svelte';
  import CabinReveal from '../home/CabinReveal.svelte';
  import ServiceBanner from '../home/ServiceBanner.svelte';
  import StandStats from '../home/StandStats.svelte';
  import PublicStockBrands from '../home/PublicStockBrands.svelte';
  import type { PublicBrandDirectory } from '$lib/catalogBrandLinks';
  import HomeChoiceGuide from '../home/HomeChoiceGuide.svelte';
  import HomeNextSteps from '../home/HomeNextSteps.svelte';
  import EditorialPause from '../home/EditorialPause.svelte';
  import RedDot from '../ui/RedDot.svelte';
  import VisitInvitation from '../contact/VisitInvitation.svelte';
  import '../contact/conversationButton.css';
  import PageEnding from './PageEnding.svelte';
  import FormSelectField from '../contact/FormSelectField.svelte';
  import Reviews from '../reviews/Reviews.svelte';
  import type { PublicReview } from '@anm/types';
  import { standContact } from '../contact/standContact';
  import Select from '../ui/Select.svelte';
  import FavoriteButton from '../../components/FavoriteButton.svelte';
  import { useFavorites } from '$lib/favorites';
  const { ids: favoriteIds } = useFavorites();
  import CompareButton from '../../components/CompareButton.svelte';
  import { useComparison } from '$lib/comparison';
  import { publicCard } from '$lib/publicVehicles';
  const { ids: comparisonIds, additions: comparisonAdditions } = useComparison();
  function comparisonAttention(node: HTMLElement, initial: number) {
    let previous = initial;
    let animation: Animation | undefined;
    return {
      update(value: number) {
        if (value > previous && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          animation?.cancel();
          animation = node
            .querySelector('.comparison-count')
            ?.animate(
              [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
              { duration: 420, easing: 'ease-out' },
            );
        }
        previous = value;
      },
      destroy() {
        animation?.cancel();
      },
    };
  }
  import { sortOptions } from '../catalog/catalog';
  import './siteSpacing.css';
  import './initialLightTheme.css';
  import './navAddress.css';
  import './lightTheme.css';
  import './mobileSpacing.css';
  let {
    id,
    catalog = false,
    privacy = false,
    legalInformation = false,
    about = false,
    compare = false,
    favorites = false,
    stock = emptyStock('unavailable'),
    brandDirectory = { status: 'unavailable', brands: [] },
    publicVehicle,
    relatedVehicles = [],
    errorStatus,
    unavailableVehicle,
    homeHighlights,
    campaigns = [],
    standSelection = [],
    reviews = [],
    routeContent,
    galleryRuntime,
  }: {
    id?: string;
    catalog?: boolean;
    privacy?: boolean;
    legalInformation?: boolean;
    about?: boolean;
    compare?: boolean;
    favorites?: boolean;
    stock?: PublicStock;
    brandDirectory?: PublicBrandDirectory;
    publicVehicle?: PublicVehicle;
    relatedVehicles?: PublicVehicle[] | Promise<PublicVehicle[]>;
    errorStatus?: number;
    unavailableVehicle?: UnavailableVehicle;
    homeHighlights?: PublicHighlights | Promise<PublicHighlights>;
    campaigns?: PublicVehicle[];
    standSelection?: PublicVehicle[];
    reviews?: PublicReview[];
    routeContent?: Snippet<
      [
        {
          card: Snippet<[PublicCard | null, number]>;
          contact: (message?: string, opener?: EventTarget | null) => Promise<void>;
        },
      ]
    >;
    galleryRuntime?: VehicleDetailRuntime;
  } = $props();
  // Detail routes provide their runtime before SSR; the homepage never imports it.
  const VehiclePhotoRail = $derived(galleryRuntime?.VehiclePhotoRail!);
  const RelatedCarousel = $derived(galleryRuntime?.RelatedCarousel!);
  const RichDescription = $derived(galleryRuntime?.RichDescription!);
  const VehicleShareButton = $derived(galleryRuntime?.VehicleShareButton!);
  const PublicVehicleStory = $derived(galleryRuntime?.PublicVehicleStory!);
  const BackLink = $derived(galleryRuntime?.BackLink!);
  const publicVehicleCanonical = (
    ...args: Parameters<VehicleDetailRuntime['publicVehicleCanonical']>
  ) => galleryRuntime!.publicVehicleCanonical(...args);
  const vehicleJsonLdScript = (...args: Parameters<VehicleDetailRuntime['vehicleJsonLdScript']>) =>
    galleryRuntime!.vehicleJsonLdScript(...args);
  const vehicleBreadcrumbItems = (
    ...args: Parameters<VehicleDetailRuntime['vehicleBreadcrumbItems']>
  ) => galleryRuntime!.vehicleBreadcrumbItems(...args);
  const vehicleBreadcrumbJsonLdScript = (
    ...args: Parameters<VehicleDetailRuntime['vehicleBreadcrumbJsonLdScript']>
  ) => galleryRuntime!.vehicleBreadcrumbJsonLdScript(...args);
  const descriptionText = (...args: Parameters<VehicleDetailRuntime['descriptionText']>) =>
    galleryRuntime!.descriptionText(...args);
  const vehicleSeo = (...args: Parameters<VehicleDetailRuntime['vehicleSeo']>) =>
    galleryRuntime!.vehicleSeo(...args);
  const vehicleShareData = (...args: Parameters<VehicleDetailRuntime['vehicleShareData']>) =>
    galleryRuntime!.vehicleShareData(...args);
  const publicGalleryPhoto = (...args: Parameters<VehicleDetailRuntime['publicGalleryPhoto']>) =>
    galleryRuntime!.publicGalleryPhoto(...args);
  const createPublicGallerySession = (
    ...args: Parameters<VehicleDetailRuntime['createPublicGallerySession']>
  ) => galleryRuntime!.createPublicGallerySession(...args);
  const followThumbnail = (...args: Parameters<VehicleDetailRuntime['followThumbnail']>) =>
    galleryRuntime!.followThumbnail(...args);
  const dragThumbnailStrip = (...args: Parameters<VehicleDetailRuntime['dragThumbnailStrip']>) =>
    galleryRuntime!.dragThumbnailStrip(...args);
  const photoSwipe = (...args: Parameters<VehicleDetailRuntime['photoSwipe']>) =>
    galleryRuntime?.photoSwipe(...args);
  const thumbnailNavigation = (...args: Parameters<VehicleDetailRuntime['thumbnailNavigation']>) =>
    galleryRuntime!.thumbnailNavigation(...args);
  const createThumbnailSession = (
    ...args: Parameters<VehicleDetailRuntime['createThumbnailSession']>
  ) => galleryRuntime!.createThumbnailSession(...args);
  const trapDialogTab = (...args: Parameters<VehicleDetailRuntime['trapDialogTab']>) =>
    galleryRuntime!.trapDialogTab(...args);
  const galleryBackdrop = (...args: Parameters<VehicleDetailRuntime['galleryBackdrop']>) =>
    galleryRuntime?.galleryBackdrop(...args);
  const thumbnailSession = $derived(
    publicVehicle
      ? createThumbnailSession(publicVehicle.slug, publicPhotoVersions(publicVehicle))
      : undefined,
  );
  const details = $derived(publicVehicle ? vehicleDetails(publicVehicle) : undefined);
  const car = $derived(details?.car);
  const detailSpecs = $derived(details?.specs ?? []);
  const theme = usePublicTheme();
  const { dark } = theme;
  let isDark = $derived($dark);
  let homeBrand = $state('');
  let homeYear = $state('');
  let homeOrder = $state('relevancia');
  const homeCars = $derived(stock.catalog.items.map(publicCard));
  const homeBrands = $derived([...new Set(homeCars.map((item) => item.brand))].sort());
  const homeYears = $derived([...new Set(homeCars.map((item) => item.year))].sort((a, b) => b - a));
  function clearHomeFilters() {
    homeBrand = '';
    homeYear = '';
    homeOrder = 'relevancia';
  }
  let navOpen = $state(false);
  let contactDialog: HTMLDialogElement;
  let contactFormMounted = $state(false);
  let contactPanel = $state<HTMLElement>();
  let contactName = $state<HTMLInputElement>();
  let contactHeading = $state<HTMLHeadingElement>();
  let contactOpener: HTMLElement | undefined;
  let unlockContact: (() => void) | undefined;
  onDestroy(() => unlockContact?.());
  let galleryDialog: HTMLDialogElement;
  let galleryOpener: HTMLElement | undefined;
  let preparingViewer = false;
  let closingViewer = $state(false);
  let galleryScroll = { x: 0, y: 0 };
  let stopOpening: (() => void) | undefined;
  onDestroy(() => stopOpening?.());
  async function openGallery() {
    if (preparingViewer || galleryOpen) return;
    galleryOpener =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    stopOpening?.();
    galleryScroll = { x: window.scrollX, y: window.scrollY };
    const source = inlineGalleryPhoto();
    const opening = galleryRuntime?.captureOpeningPhoto(source);
    preparingViewer = true;
    galleryOpen = true;
    await tick();
    preparingViewer = false;
    if (galleryOpen) {
      galleryDialog.showModal();
      window.scrollTo({ left: galleryScroll.x, top: galleryScroll.y, behavior: 'instant' });
      stopOpening = galleryRuntime?.animateGalleryOpening(galleryDialog, opening);
    }
  }
  function inlineGalleryPhoto() {
    return (
      galleryDialog
        ?.closest('.design')
        ?.querySelector<HTMLImageElement>(
          '.vehicle-photo .photo-rail-slide:not([inert]):not(.rail-contact) img, button.vehicle-photo > img',
        ) ?? null
    );
  }
  function closeGallery() {
    if (!galleryDialog.open || closingViewer) return;
    stopOpening?.();
    closingViewer = true;
    stopOpening = galleryRuntime?.animateGalleryClosing(galleryDialog, inlineGalleryPhoto(), () =>
      galleryDialog.close(),
    );
  }
  const gallerySession = $derived(
    publicVehicle?.photos.length ? createPublicGallerySession(publicVehicle) : undefined,
  );
  // SSR starts the first photo. Thereafter the action alone owns image sources,
  // so Svelte never assigns a network URL before a cache-only gallery revisit.
  const initialMainPhoto = untrack(() => ({
    src: publicVehicle?.photos.length
      ? sizedPhoto(publicPhoto(publicVehicle, 0), 1600)
      : car
        ? photo(car.image, 2000)
        : undefined,
    srcset: publicVehicle?.photos.length
      ? vehiclePhotoSet(publicPhoto(publicVehicle, 0))
      : undefined,
  }));
  const submission = createContactForm();
  const sending = $derived(submission.state.phase === 'sending');
  let reason = $state('Gostava de saber mais.');
  let zoom = $state(0);
  let mainPhotoDrag = $state<number>();
  let viewerPhotoDrag = $state<number>();
  const galleryPhotoCount = $derived(publicVehicle?.photos.length ?? 0);
  const galleryCount = $derived(
    publicVehicle ? (galleryPhotoCount ? galleryPhotoCount + 1 : 0) : car ? 1 : 0,
  );
  const isContactSlide = $derived(
    !!publicVehicle && galleryPhotoCount > 0 && zoom === galleryPhotoCount,
  );
  const galleryPhotoIndex = $derived(isContactSlide ? 0 : zoom);
  function stepGallery(direction: number) {
    if (publicVehicle) zoom = Math.max(0, Math.min(galleryCount - 1, zoom + direction));
  }
  function galleryKeydown(event: KeyboardEvent) {
    if (closingViewer) {
      event.preventDefault();
      return;
    }
    trapDialogTab(event, galleryDialog);
    if (!publicVehicle || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const count = galleryCount;
    event.preventDefault();
    zoom = Math.max(0, Math.min(count - 1, zoom + (event.key === 'ArrowRight' ? 1 : -1)));
  }
  $effect(() => {
    if (publicVehicle && zoom > Math.max(0, galleryCount - 1)) zoom = 0;
  });
  const selected = $derived(filterHomeStock(homeCars, homeBrand, homeYear, homeOrder));
  $effect(() => {
    id;
    publicVehicle?.slug;
    navOpen = false;
    zoom = 0;
  });
  function toggleTheme() {
    theme.toggle();
  }
  async function contact(message?: string, opener?: EventTarget | null) {
    if (contactDialog.open) return;
    contactFormMounted = true;
    contactOpener = opener instanceof HTMLElement ? opener : undefined;
    if (submission.state.phase === 'success') submission.reset();
    if (submission.state.phase === 'idle')
      reason =
        message ||
        (car ? `Gostava de conhecer o ${car.brand} ${car.model}.` : 'Gostava de saber mais.');
    const touchLayout = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    await tick();
    if (contactDialog.open || !contactPanel || !contactName || !contactHeading) return;
    // Native showModal focuses an autofocus target before returning.
    contactHeading.autofocus = touchLayout;
    contactName.autofocus = !touchLayout;
    unlockContact?.();
    unlockContact = lockContactViewport(contactDialog, contactPanel);
    contactDialog.showModal();
    if (touchLayout) contactPanel.scrollTop = 0;
    const initialFocus = touchLayout ? contactHeading : contactName;
    if (document.activeElement !== initialFocus) initialFocus.focus({ preventScroll: true });
  }
  function restoreContactFocus() {
    if (contactDialog.open) return;
    unlockContact?.();
    unlockContact = undefined;
    const opener = contactOpener;
    contactOpener = undefined;
    if (opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
  }
  function galleryReturnTarget() {
    if (
      galleryOpener?.isConnected &&
      galleryOpener !== document.body &&
      !galleryOpener.closest('[inert]')
    )
      return galleryOpener;
    const root = galleryDialog.closest('.design');
    return (
      root?.querySelector<HTMLElement>('.photo-expand') ??
      root?.querySelector<HTMLElement>('.vehicle-photo .photo-rail-slide:not([inert]) button')
    );
  }
  let contactPointerStartedOutside = false;
  function outsideContact(event: MouseEvent | PointerEvent) {
    return (
      event.target === contactDialog ||
      (event.target instanceof Element && event.target.classList.contains('contact-scrim'))
    );
  }
  function contactBackdropClick(event: MouseEvent) {
    if (contactPointerStartedOutside && outsideContact(event)) contactDialog.close();
    contactPointerStartedOutside = false;
  }
  function contactKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const controls = contactDialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (document.activeElement === contactHeading) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  function ringNavPhone(event: PointerEvent | FocusEvent) {
    ringPhone((event.currentTarget as HTMLAnchorElement).querySelector('svg'));
  }
</script>

{#if publicVehicle}
  <SocialMetadata
    title={vehicleSeo(publicVehicle).title}
    description={vehicleSeo(publicVehicle).description}
    canonical={publicVehicleCanonical(publicVehicle, $page.url.origin)}
    {...vehicleSocialImage(publicVehicle)}
  />
{:else if !favorites && !compare && !about && !catalog && !privacy && !errorStatus}
  <SocialMetadata
    title={car
      ? `${car.brand} ${car.model} — Auto Nunes Martins`
      : 'Auto Nunes Martins — Automóveis usados'}
    description={homepageDescription}
    canonical={new URL(id ? $page.url.pathname : '/', $page.url.origin).href}
  />
{/if}

<svelte:head>
  {#if publicVehicle}
    {@const seo = vehicleSeo(publicVehicle)}
    <title>{seo.title}</title>
    <meta name="description" content={seo.description} />
    <link rel="canonical" href={publicVehicleCanonical(publicVehicle, $page.url.origin)} />
    {@html vehicleJsonLdScript(publicVehicle, $page.url.origin)}
    {@html vehicleBreadcrumbJsonLdScript(publicVehicle, $page.url.origin)}
    {#if !thumbnailSession?.hasPixels()}
      {#each publicVehicle.photos as _, i}
        <link
          rel="preload"
          as="image"
          href={sizedPhoto(publicPhoto(publicVehicle, i), 1600)}
          imagesrcset={vehiclePhotoSet(publicPhoto(publicVehicle, i))}
          imagesizes={galleryPhotoSizes(publicVehicle, i)}
          fetchpriority="low"
        />
      {/each}
    {/if}
  {/if}
  {#if !favorites && !compare && !about && !id && !catalog && !privacy && !publicVehicle && !errorStatus}
    <link rel="canonical" href={new URL('/', $page.url.origin).href} />
  {/if}

  <link rel="preload" href={siteFont400} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={siteFont500} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={siteFont600} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={siteTitleFont} as="font" type="font/woff2" crossorigin="anonymous" />
  {#if favorites || compare || about || id || catalog || privacy || publicVehicle || errorStatus}
    <link
      rel="preload"
      href={siteTitleItalic}
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
  {/if}
  {#if !favorites && !compare && !about && !catalog && !privacy && !publicVehicle && !errorStatus}<title
      >{car
        ? `${car.brand} ${car.model} — Auto Nunes Martins`
        : 'Auto Nunes Martins — Automóveis usados'}</title
    ><meta name="description" content={homepageDescription} />{/if}
  {#if id && !favorites && !compare && !about && !catalog && !privacy && !publicVehicle && !errorStatus}<meta
      name="robots"
      content="noindex, follow"
    />{/if}</svelte:head
>

<svelte:window
  onpointerdown={() => (galleryPointerFocus = true)}
  onkeydown={(event) => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) galleryPointerFocus = false;
  }}
/>

<div
  id={!favorites && !compare && !about && !id && !catalog && !privacy && !publicVehicle
    ? 'inicio'
    : undefined}
  class="design site"
  class:gallery-pointer-focus={galleryPointerFocus}
  class:site-home={!favorites &&
    !compare &&
    !about &&
    !id &&
    !catalog &&
    !privacy &&
    !publicVehicle}
  class:site-catalog={catalog}
  class:site-inner={!!(
    favorites ||
    compare ||
    about ||
    id ||
    catalog ||
    privacy ||
    publicVehicle ||
    errorStatus
  )}
  class:site-privacy={privacy || about || compare || favorites}
  class:site-company={about}
  class:site-detail={!!car || !!publicVehicle}
  class:public-detail={!!publicVehicle}
  class:dark={isDark}
  class:has-address={!!standContact.address ||
    !!standContact.email ||
    standContact.hours.length > 0}
  use:designMotion
>
  <div class="read-line" aria-hidden="true"></div>
  {#if standContact.address || standContact.email || standContact.hours.length}
    <div class="nav-contact-strip">
      <!-- Keyboard users must be able to scroll the contact strip. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="nav-contact-inner"
        role="region"
        tabindex="0"
        aria-label="Contactos e horário — deslize para ver mais"
      >
        <div class="nav-contact-left">
          {#if standContact.address}<address class="nav-address">
              <MapPin size={13} strokeWidth={1.6} aria-hidden="true" /><span
                >{standContact.address.replace(/\n/g, ' · ')}</span
              >
            </address>{/if}
          {#if standContact.hours.length}<div class="nav-hours" role="group" aria-label="Horário">
              <Clock3 size={13} strokeWidth={1.6} aria-hidden="true" />
              {#each standContact.hours.filter((hours) => hours.days !== 'Domingo e feriados') as hours}<span
                  ><span>{hours.days}</span><span>{hours.time}</span></span
                >{/each}
            </div>{/if}
        </div>
        {#if standContact.email}<span class="nav-email"
            ><a href={`mailto:${standContact.email}`}
              ><Mail size={13} strokeWidth={1.6} aria-hidden="true" />{standContact.email}</a
            ></span
          >{/if}
      </div>
    </div>
  {/if}
  <div class="nav-reserve" aria-hidden="true"></div>
  <header
    class="stand-header"
    use:catalogNavigation={{
      enabled: !!(
        favorites ||
        compare ||
        about ||
        id ||
        catalog ||
        privacy ||
        publicVehicle ||
        errorStatus
      ),
      directional: catalog,
      open: navOpen,
    }}
    use:hybridNav={{
      enabled: !favorites && !compare && !about && !id && !catalog && !privacy && !publicVehicle,
      open: navOpen,
      close: () => (navOpen = false),
    }}
  >
    <a class="logo" href="/"
      ><img
        data-logo-light={logoLight}
        data-logo-dark={logoDark}
        data-logo-light-srcset={logoLightSrcset}
        data-logo-dark-srcset={logoDarkSrcset}
        data-theme-logo
        src={isDark ? logoDark : logoLight}
        srcset={isDark ? logoDarkSrcset : logoLightSrcset}
        sizes="(max-width: 380px) 108px, (max-width: 700px) 136px, 145px"
        alt="Auto Nunes Martins — início"
        width="180"
        height="80"
      /></a
    >
    <nav
      id="stand-navigation"
      class:open={navOpen}
      aria-label="Navegação"
      use:mobileNavigation={{ open: navOpen, close: () => (navOpen = false) }}
    >
      <a
        href="/"
        aria-current={!favorites &&
        !compare &&
        !id &&
        !catalog &&
        !privacy &&
        !about &&
        !publicVehicle &&
        !errorStatus
          ? 'page'
          : undefined}
        onclick={() => (navOpen = false)}><span class="nav-label">Início</span></a
      >
      <a
        href="/viaturas"
        aria-current={catalog ? 'page' : undefined}
        onclick={() => (navOpen = false)}
        ><span class="nav-label">Viaturas</span>
      </a><a
        href="/quem-somos"
        aria-current={about ? 'page' : undefined}
        onclick={() => (navOpen = false)}><span class="nav-label">Quem somos</span></a
      >
      <a
        href="/comparar"
        class:has-comparison={$comparisonIds.length > 0}
        use:comparisonAttention={$comparisonAdditions}
        aria-current={compare ? 'page' : undefined}
        aria-label={`Comparar${$comparisonIds.length ? `, ${$comparisonIds.length} viaturas selecionadas` : ''}`}
        onclick={() => (navOpen = false)}
        ><span class="comparison-nav-content"
          ><span class="nav-label">Comparar</span>{#if $comparisonIds.length > 0}<span
              class="comparison-count">{$comparisonIds.length}</span
            >{/if}</span
        ></a
      >
      <div class="mobile-theme"><ThemeToggle dark={isDark} onchange={toggleTheme} /></div>
    </nav>
    <div class="header-actions">
      <div class="desktop-theme"><ThemeToggle dark={isDark} onchange={toggleTheme} /></div>
      <a
        class="nav-favorites"
        class:filled={$favoriteIds.length > 0}
        href="/favoritos"
        aria-current={favorites ? 'page' : undefined}
        aria-label={`Guardados${$favoriteIds.length ? ` ${$favoriteIds.length > 99 ? '99+' : $favoriteIds.length}` : ''}, ${$favoriteIds.length} viaturas nos favoritos`}
        onclick={() => (navOpen = false)}
        ><span class="favorite-heart" aria-hidden="true"
          ><Heart
            size={19}
            strokeWidth={1.5}
            fill={$favoriteIds.length ? 'currentColor' : 'none'}
            aria-hidden="true"
          /><span
            class="favorite-count"
            class:empty={!$favoriteIds.length}
            class:compact={$favoriteIds.length > 99}
            >{$favoriteIds.length > 99 ? '99+' : $favoriteIds.length}</span
          ></span
        ><span class="favorite-label">Guardados</span></a
      >
      {#if standContact.phone}<a
          class="nav-phone"
          onpointerenter={ringNavPhone}
          onfocus={ringNavPhone}
          href={`tel:${standContact.phone.international}`}
          onclick={() => (navOpen = false)}
          ><Phone size={16} strokeWidth={1.7} aria-hidden="true" /><span class="nav-phone-copy"
            ><span>Ligar agora</span><span class="nav-phone-number"
              >{standContact.phone.display}</span
            ></span
          ></a
        >{/if}
      <button
        class="mobile-menu icon-button"
        aria-label={navOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-controls="stand-navigation"
        aria-expanded={navOpen}
        onclick={() => (navOpen = !navOpen)}
        >{#if navOpen}<X size={21} aria-hidden="true" />{:else}<Menu
            size={21}
            aria-hidden="true"
          />{/if}</button
      >
    </div>
  </header>

  {#if errorStatus}
    {@const content = publicErrorCopy(errorStatus, $page.url.pathname)}
    <main
      class="not-found"
      class:known-unavailable={errorStatus === 404 && !!unavailableVehicle}
      class:vehicle-error={errorStatus === 404 && $page.url.pathname.startsWith('/viaturas/')}
    >
      {#if errorStatus === 404 && unavailableVehicle}
        <UnavailableVehiclePanel vehicle={unavailableVehicle} />
      {:else if errorStatus === 404 && $page.url.pathname.startsWith('/viaturas/')}
        <MissingVehiclePanel heading={content.heading} message={content.message} />
      {:else}
        <p class="kicker">UM DESVIO DE PERCURSO · {errorStatus}</p>
        <h1>{content.heading}</h1>
        <p class="error-description">{content.message}</p>
      {/if}
      {#if !(errorStatus === 404 && (unavailableVehicle || $page.url.pathname.startsWith('/viaturas/')))}
        <div class="error-actions">
          <a class="pill primary" href="/viaturas"
            >Explorar viaturas <ArrowUpRight size={18} aria-hidden="true" /></a
          >
          <a class="pill" href="/">Página inicial <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
      {/if}
    </main>
  {:else if favorites || compare || catalog || privacy || about}
    {@render routeContent?.({ card: vehicleCard, contact })}
  {:else if id && !car}
    <main class="not-found">
      <p class="kicker">DESVIO DE PERCURSO</p>
      <h1>Esta viatura<br />não está por aqui.</h1>
      <div class="error-actions">
        <a class="pill primary" href="/viaturas"
          >Explorar viaturas <ArrowUpRight size={18} aria-hidden="true" /></a
        ><a class="pill" href="/">Página inicial <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
    </main>
  {:else if car && publicVehicle}
    {@const coverPosition = framingStyle(publicVehicle.galleryFraming?.[0] ?? undefined)}
    <main class="vehicle-page">
      <div class="detail-top-actions">
        <BackLink useHistory /><VehicleShareButton
          {...vehicleShareData(publicVehicle, $page.url.origin)}
        />
      </div>
      <div class="breadcrumbs">
        <nav class="breadcrumb-trail" aria-label="Percurso de navegação">
          <ol>
            {#each vehicleBreadcrumbItems(publicVehicle) as item, index}<li>
                {#if index > 0}<ChevronRight
                    size={12}
                    aria-hidden="true"
                  />{/if}{#if index === 3}<span aria-current="page">{item.name}</span>{:else}<a
                    href={item.href}>{item.name}</a
                  >{/if}
              </li>{/each}
          </ol>
        </nav>
      </div>

      <section class="vehicle-layout">
        <div class="vehicle-photography">
          <div class="vehicle-gallery">
            <!-- Arrow keys coordinate the gallery's focused buttons; explicit previous/next controls remain available. -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
              class="vehicle-photo-stage"
              use:photoSwipe={{
                mouse: true,
                commitDistance: 24,
                enabled: !!publicVehicle && galleryCount > 1,
                previous: () => stepGallery(-1),
                next: () => stepGallery(1),
                drag: (offset) => (mainPhotoDrag = offset),
              }}
              role="group"
              aria-label="Galeria de fotografias"
              onkeydown={galleryKeydown}
            >
              {#if publicVehicle?.photos.length}
                <div
                  class="vehicle-photo"
                  class:contact-slide={isContactSlide}
                  aria-busy={mainPhotoLoading}
                >
                  <VehiclePhotoRail
                    vehicle={publicVehicle}
                    session={gallerySession}
                    index={zoom}
                    drag={mainPhotoDrag}
                    instant={galleryOpen}
                    onOpen={openGallery}
                    onContact={(event) =>
                      contact(
                        `Gostava de saber mais sobre o ${car.brand} ${car.model}.`,
                        event.currentTarget,
                      )}
                    onLoading={(loading) => (mainPhotoLoading = loading)}
                  />
                  <span class="photo-counter" aria-hidden={isContactSlide}
                    >{zoom + 1} / {publicVehicle.photos.length}</span
                  >
                </div>
              {:else}<button
                  class="vehicle-photo"
                  data-swipe-surface
                  class:contact-slide={isContactSlide}
                  aria-busy={mainPhotoLoading}
                  type="button"
                  onclick={openGallery}
                  disabled={!!publicVehicle && (!publicVehicle.photos.length || isContactSlide)}
                  ><img
                    use:coverPhotoSizes
                    use:publicGalleryPhoto={{
                      session: gallerySession,
                      src: publicVehicle?.photos.length
                        ? sizedPhoto(publicPhoto(publicVehicle, galleryPhotoIndex), 1600)
                        : photo(car.image, 2000),
                      srcset: publicVehicle?.photos.length
                        ? vehiclePhotoSet(publicPhoto(publicVehicle, galleryPhotoIndex))
                        : undefined,
                      fade: true,
                      onLoading: (loading) => (mainPhotoLoading = loading),
                    }}
                    src={initialMainPhoto.src}
                    srcset={initialMainPhoto.srcset}
                    sizes="(max-width: 701px) 100vw, (max-width: 1050px) 60vw, (min-width: 1920px) 1050px, 66vw"
                    fetchpriority="high"
                    alt={isContactSlide
                      ? ''
                      : `${publicVehicle && !publicVehicle.photos.length ? '' : 'Ampliar fotografia: '}${car.brand} ${car.model} — ${publicVehicle.photos.length ? 'fotografia ' + (zoom + 1) : 'imagem indisponível'}`}
                    style={'--zoom:1;object-position:center'}
                  /><span class="photo-counter" aria-hidden={isContactSlide}
                    >{publicVehicle.photos.length
                      ? zoom + 1 + ' / ' + publicVehicle.photos.length
                      : 'SEM FOTOGRAFIA'}
                    <span>{''}</span></span
                  ></button
                >{/if}
              {#if mainPhotoLoading}<span
                  class="main-photo-loading"
                  role="status"
                  aria-label="A carregar fotografia"><span aria-hidden="true"></span></span
                >{/if}
              {#if publicVehicle && !isContactSlide}
                <div class="photo-image-actions">
                  {#if publicVehicle.photos.length}<button
                      type="button"
                      class="photo-expand"
                      aria-label="Abrir em ecrã inteiro"
                      title="Abrir em ecrã inteiro"
                      onclick={openGallery}
                      ><Maximize size={20} strokeWidth={1.6} aria-hidden="true" /></button
                    >{/if}
                  <div class="detail-photo-favorite">
                    <FavoriteButton
                      id={publicVehicle.slug}
                      name={`${publicVehicle.brand} ${publicVehicle.model}`}
                      onPhoto
                    />
                  </div>
                </div>
                <div class="detail-photo-compare">
                  <CompareButton
                    id={publicVehicle.slug}
                    name={`${publicVehicle.brand} ${publicVehicle.model}`}
                    overlay
                  />
                </div>
              {/if}
              {#if publicVehicle && galleryCount > 1}
                <button
                  type="button"
                  class="photo-step photo-previous"
                  aria-label="Fotografia anterior"
                  aria-disabled={zoom === 0}
                  onclick={() => {
                    if (zoom > 0) zoom -= 1;
                  }}><ArrowLeft size={20} aria-hidden="true" /></button
                >
                <button
                  type="button"
                  class="photo-step photo-next"
                  aria-label="Fotografia seguinte"
                  aria-disabled={zoom === galleryCount - 1}
                  onclick={() => {
                    if (zoom < galleryCount - 1) zoom += 1;
                  }}><ArrowRight size={20} aria-hidden="true" /></button
                >
              {/if}
            </div>

            {#if publicVehicle.photos.length > 0}<div
                class="detail-thumbnails-frame"
                use:thumbnailNavigation
              >
                <div
                  class="detail-thumbnails"
                  use:followThumbnail={zoom}
                  use:dragThumbnailStrip
                  role="group"
                  aria-label="Fotografias da viatura"
                >
                  {#each publicVehicle.photos as _, i}<button
                      type="button"
                      aria-label={'Ver fotografia ' + (i + 1)}
                      aria-pressed={zoom === i}
                      onclick={() => (zoom = i)}
                      ><img
                        {...gallerySession!.attrs(
                          sizedPhoto(publicPhoto(publicVehicle, i), 1600),
                          vehiclePhotoSet(publicPhoto(publicVehicle, i)),
                        )}
                        use:publicGalleryPhoto={{
                          session: gallerySession!,
                          src: sizedPhoto(publicPhoto(publicVehicle, i), 1600),
                        }}
                        sizes={galleryPhotoSizes(publicVehicle, i)}
                        alt=""
                        loading="eager"
                        fetchpriority="auto"
                      /></button
                    >{/each}
                  <button
                    type="button"
                    class="contact-thumbnail"
                    aria-label="Falar sobre esta viatura"
                    aria-pressed={isContactSlide}
                    onclick={() => (zoom = galleryPhotoCount)}
                    ><img
                      {...gallerySession!.attrs(
                        sizedPhoto(publicPhoto(publicVehicle, 0), 1600),
                        vehiclePhotoSet(publicPhoto(publicVehicle, 0)),
                      )}
                      use:publicGalleryPhoto={{
                        session: gallerySession,
                        src: sizedPhoto(publicPhoto(publicVehicle, 0), 1600),
                      }}
                      sizes={galleryPhotoSizes(publicVehicle, 0)}
                      style={coverPosition}
                      alt=""
                      loading="eager"
                    /><ArrowUpRight size={24} aria-hidden="true" /><span>Fale connosco</span
                    ></button
                  >
                </div>
                <button
                  type="button"
                  class="thumbnail-step thumbnail-previous"
                  aria-label="Recuar duas miniaturas"
                  ><ChevronLeft size={28} strokeWidth={1.5} aria-hidden="true" /></button
                ><button
                  type="button"
                  class="thumbnail-step thumbnail-next"
                  aria-label="Avançar duas miniaturas"
                  ><ChevronRight size={28} strokeWidth={1.5} aria-hidden="true" /></button
                >
              </div>{/if}
          </div>
          <div class="photo-controls">
            <span
              >{publicVehicle.photos.length +
                (publicVehicle.photos.length === 1 ? ' fotografia' : ' fotografias')}</span
            >
          </div>
        </div>
        <div class="purchase" role="group" aria-labelledby="vehicle-title" use:entrance>
          <p class="kicker"><RedDot /> UM NOVO PONTO DE PARTIDA</p>
          <h1 id="vehicle-title">{car.brand}<br /><span>{car.model}</span></h1>
          {#if car.line}<p class="model-line">{car.line.split(' · ')[0]}</p>{/if}
          <div class="purchase-price">
            <span>{publicVehicle?.promotion ? 'Preço promocional' : 'Preço da viatura'}</span
            ><strong>{formatVehiclePrice(publicVehicle.price)}</strong>
          </div>
          {#if publicVehicle?.promotion}<PromotionTerms promotion={publicVehicle.promotion} />{/if}
          <div class="quick-specs">
            <span>{car.year}<small>Ano</small></span><span
              >{publicMileage(car.km, '')}<small>Quilómetros</small></span
            ><span>{car.fuel}<small>Combustível</small></span>
          </div>
          <button
            class="trade-in-contact"
            onclick={(event) =>
              contact('Gostava de apresentar a minha viatura para retoma.', event.currentTarget)}
          >
            <span
              ><strong>Tem uma viatura para retoma?</strong><small
                >Conte-nos o que pretende trocar.</small
              ></span
            ><ArrowUpRight size={18} aria-hidden="true" />
          </button>
          <button class="pill primary" onclick={(event) => contact(undefined, event.currentTarget)}
            >Quero conhecer <ArrowUpRight size={18} aria-hidden="true" /></button
          >
          {#if standContact.phone}<div class="purchase-phone-alternative">
              <a
                class="purchase-call"
                href={`tel:${standContact.phone.international}`}
                aria-label={`Ligar para o stand: ${standContact.phone.display}`}
                ><Phone size={15} strokeWidth={1.7} aria-hidden="true" /><span
                  >Ligar para o stand</span
                ></a
              >
            </div>{/if}
          <div class="purchase-followup">
            <div class="detail-compare" role="group" aria-label="Ações da viatura">
              <CompareButton
                id={publicVehicle.slug}
                name={`${publicVehicle.brand} ${publicVehicle.model}`}
              /><FavoriteButton
                id={publicVehicle.slug}
                name={`${publicVehicle.brand} ${publicVehicle.model}`}
                text
              /><VehicleShareButton {...vehicleShareData(publicVehicle, $page.url.origin)} />
            </div>
            <p class="fine-print">
              {'Confirme disponibilidade, histórico e condições no stand.'}
            </p>
          </div>
        </div>
        <section class="detail-facts" use:entrance>
          <div>
            <h2>Todos os detalhes.<br /><span>Uma só escolha.</span></h2>
          </div>
          <dl>
            {#each detailSpecs as spec}<div>
                <dt>
                  <VehicleSpecIcon label={String(spec[0])} value={String(spec[1])} /><span
                    >{spec[0]}</span
                  >
                </dt>
                <dd>{spec[1]}</dd>
              </div>{/each}
          </dl>
        </section>
        {#if publicVehicle && descriptionText(publicVehicle.description)}
          <section class="vehicle-description" aria-labelledby="vehicle-description-title">
            <h2 id="vehicle-description-title">Descrição da viatura.</h2>
            <RichDescription value={publicVehicle.description} />
          </section>
        {/if}
        {#if !publicVehicle || publicVehicle.photos.length > 0}
          <section class="detail-band" data-scene="through">
            <img
              use:coverPhotoSizes
              use:vehiclePhoto={{
                src: sizedPhoto(publicPhoto(publicVehicle, 0), 1600),
                srcset: vehiclePhotoSet(publicPhoto(publicVehicle, 0)),
              }}
              src={sizedPhoto(publicPhoto(publicVehicle, 0), 1600)}
              srcset={vehiclePhotoSet(publicPhoto(publicVehicle, 0))}
              sizes="(max-width:700px) 100vw, (min-width:1920px) 1200px, 70vw"
              style={coverPosition}
              alt=""
              loading="lazy"
            />
            <div>
              <p class="kicker">A ESCOLHA É SUA.</p>
              <h2>O caminho<br />também.</h2>
              <button class="pill" onclick={(event) => contact(undefined, event.currentTarget)}
                >Vamos falar <ArrowUpRight size={18} aria-hidden="true" /></button
              >
            </div>
            <span class="band-index" aria-hidden="true"
              ><ArrowUpRight size="1em" strokeWidth={1} /></span
            >
          </section>
        {/if}
        <PublicVehicleStory vehicle={publicVehicle} />
      </section>
      <section class="related">
        <p class="kicker">PREÇOS PRÓXIMOS DO SEU</p>
        <h2>Continue a explorar.</h2>
        {#await relatedVehicles}
          <div class="related-grid" role="status" aria-label="A consultar sugestões atuais">
            {#each [0, 1, 2] as index}{@render vehicleCard(null, index, false)}{/each}
          </div>
        {:then vehicles}
          {#if vehicles.length}
            {#key publicVehicle.slug}<RelatedCarousel {vehicles} card={vehicleCard} />{/key}
          {:else}<p><a href="/viaturas">Explorar todas as viaturas</a></p>{/if}
        {:catch}<p><a href="/viaturas">Consultar sugestões no catálogo</a></p>{/await}
      </section>
    </main>
  {:else}
    <main>
      <HomeHero {homeHighlights} stockVehicles={stock?.catalog.items ?? []} />
      <StandStats />

      <CampaignStrip vehicles={campaigns} />
      <StandSelection vehicles={standSelection} />

      <section class="showroom" id="selecao">
        <div class="showroom-heading">
          <div>
            <h2>
              Novidades no stand<span class="heading-period">.</span>
            </h2>
          </div>
        </div>
        <div class="showroom-layout">
          <div class="catalog-controls" role="group" aria-label="Filtrar viaturas">
            <div class="home-basic-filters">
              <Select
                id="home-brand"
                showBrandLogos
                label="Marca"
                value={homeBrand}
                options={[
                  { value: '', label: 'Todas as marcas' },
                  ...homeBrands.map((value) => ({ value, label: value })),
                ]}
                onChange={(value) => (homeBrand = value)}
                subtle
              />
              <Select
                id="home-year"
                label="Ano mínimo"
                value={homeYear}
                options={[
                  { value: '', label: 'Todos os anos' },
                  ...homeYears.map((year) => ({ value: String(year), label: String(year) })),
                ]}
                onChange={(value) => (homeYear = value)}
                subtle
              />
              <Select
                id="home-sort"
                label="Ordenar por"
                value={homeOrder}
                options={Object.entries(sortOptions).map(([value, label]) => ({ value, label }))}
                onChange={(value) => (homeOrder = value)}
                subtle
              />
              <button
                class="home-clear"
                onclick={clearHomeFilters}
                disabled={!homeBrand && !homeYear && homeOrder === 'relevancia'}
                >Limpar filtros</button
              >
            </div>

            <p class="catalog-note">
              O primeiro passo é descobrir.<br />O próximo, conhecer de perto.
            </p>
          </div>
          <div class="car-grid" style={`--home-result-rows:${Math.max(1, selected.length)}`}>
            {#each selected as vehicle, index (vehicle.id)}{@render vehicleCard(
                vehicle,
                index,
              )}{/each}{#if selected.length === 0}<div class="no-results" aria-live="polite">
                <h3>A sua pesquisa<br />pede outro caminho.</h3>
                <button
                  onclick={() => {
                    clearHomeFilters();
                  }}>Limpar filtros <ArrowUpRight size={17} aria-hidden="true" /></button
                >
              </div>{/if}
            <DiscoverVehicles background={homeScenes.catalog} />
          </div>
        </div>
      </section>

      <div class="home-brands"><PublicStockBrands directory={brandDirectory} /></div>

      <section class="about" id="sobre">
        <div class="about-head" use:entrance>
          <h2>Não vendemos<br />a mesma escolha<br /><span>a toda a gente.</span></h2>
        </div>
        <div class="about-content" use:entrance={120}>
          <p>
            Os seus dias, os seus planos, o que espera de um carro. É por aí que começa a conversa.
          </p>
          <p class="muted">
            Acreditamos em informação clara e no tempo certo para decidir. Descubra a seleção,
            conheça os detalhes e fale connosco sobre aquilo que procura.
          </p>
          <button
            class="conversation-pill"
            onclick={(event) => contact(undefined, event.currentTarget)}
            >Vamos conhecer-nos <ArrowUpRight size={18} aria-hidden="true" /></button
          >
          <div class="about-signature">
            <span>AUTO NUNES MARTINS</span><span>COMÉRCIO DE AUTOMÓVEIS</span>
          </div>
        </div>
      </section>

      <CabinReveal />
      <ServiceBanner onContact={contact} />
      <Perspective grouped lead="A escolha certa" middle="começa por" highlight="fazer sentido." />
      <div class="home-choice-group">
        <HomeNextSteps />
        {#if reviews.length}<Reviews {reviews} />{/if}
      </div>
      <EditorialPause onContact={contact} background={homeScenes.pause} />
    </main>
  {/if}

  {#if $page.url.pathname !== '/' && !favorites && !compare && !about && !catalog && !privacy && !errorStatus}<section
      class="services"
      aria-label="Próximos passos"
    >
      <div>
        {#each [['01', 'Dar o próximo passo.', 'Conheça a viatura ao seu ritmo. Combine uma visita e esclareça as suas dúvidas.', 'Quero combinar uma visita.'], ['02', 'Mudar de companhia.', 'Tem uma viatura para retoma? Conte-nos um pouco sobre ela e sobre os seus planos.', 'Gostava de falar sobre uma retoma.'], ['03', 'Saber os detalhes.', 'Equipamento, documentação e condições: reúna a informação antes de decidir.', 'Gostava de esclarecer algumas dúvidas.']] as service, index}<article
            use:conditionalEntrance={car || publicVehicle ? false : index * 90}
          >
            <span>{service[0]}<ArrowUpRight size={22} aria-hidden="true" /></span>
            <h3>{service[1]}</h3>
            <p>{service[2]}</p>
            <button onclick={(event) => contact(service[3], event.currentTarget)}
              ><span class="service-cta-label">Vamos conversar</span><ArrowUpRight
                size={15}
                aria-hidden="true"
              /></button
            >
          </article>{/each}
      </div>
    </section>{/if}
  {#if (catalog || privacy) && !errorStatus}
    <Faq />
  {:else if favorites || compare || about || catalog || privacy || publicVehicle || errorStatus}
    <!-- The shared contact/footer follows the content without duplicating the homepage FAQ. -->
  {:else if !id}
    <VisitInvitation onContact={contact} logoSrc={logoLight} />
    {#if $page.url.pathname === '/'}
      <div class="home-choice-after-visit"><HomeChoiceGuide /></div>
    {/if}
    <Faq />
  {:else}
    <Faq
      heading="Perguntas com resposta"
      showIntro={false}
      questions={[
        {
          question: 'Como posso visitar o stand?',
          answer:
            'Indique a viatura e a sua disponibilidade no formulário. O pedido é enviado ao stand; a visita fica confirmada apenas depois de combinarmos o horário consigo.',
        },
        {
          question: 'Posso guardar uma viatura?',
          answer:
            'Sim. Use o coração junto de cada carro. A seleção fica guardada neste navegador e pode consultá-la no filtro Guardadas.',
        },
        {
          question: 'Os dados já são reais?',
          answer:
            'Não. Fotografias, preços e especificações são ilustrativos. As condições comerciais serão confirmadas antes da publicação.',
        },
      ]}
    />
  {/if}

  <PageEnding onContact={(event) => contact(undefined, event.currentTarget)} />

  <dialog
    bind:this={contactDialog}
    class="contact-dialog"
    aria-labelledby="contact-heading"
    onkeydown={contactKeydown}
    onclose={restoreContactFocus}
    onpointerdown={(event) => {
      contactPointerStartedOutside = outsideContact(event);
    }}
    onpointercancel={() => {
      contactPointerStartedOutside = false;
    }}
    onclick={contactBackdropClick}
  >
    {#if contactFormMounted}
      <div class="contact-scrim" aria-hidden="true"></div>
      <div class="contact-viewport">
        <div class="contact-panel-shell">
          <button
            class="dialog-close icon-button"
            onclick={() => contactDialog.close()}
            aria-label="Fechar"><X size={22} aria-hidden="true" /></button
          >
          <div class="contact-panel" bind:this={contactPanel}>
            <p class="kicker">VAMOS CONVERSAR</p>
            <h2 id="contact-heading" bind:this={contactHeading} tabindex="-1">
              O que tem<br />em mente?
            </h2>
            <form use:submission.enhance aria-busy={sending}>
              <ContactFeedback {submission} />
              <label
                >Nome<input
                  bind:this={contactName}
                  required
                  name="name"
                  maxlength="120"
                  autocomplete="name"
                  placeholder="O seu nome"
                /></label
              ><label
                >Email<input
                  required
                  type="email"
                  name="email"
                  maxlength="254"
                  autocomplete="email"
                  placeholder="nome@exemplo.pt"
                /></label
              ><label
                >Assunto<FormSelectField
                  ><select name="subject">
                    <option>Informações gerais</option>
                    <option>Conhecer uma viatura</option>
                    <option>Marcar uma visita</option>
                    <option>Falar sobre uma retoma</option>
                  </select></FormSelectField
                ></label
              ><label
                >Mensagem<textarea
                  name="message"
                  required
                  maxlength="5000"
                  rows="3"
                  bind:value={reason}
                ></textarea></label
              ><ContactFormFooter>
                <button
                  class="pill primary"
                  type="submit"
                  aria-busy={sending}
                  disabled={sending || submission.state.kind === 'conflict'}
                  >{sending ? 'A enviar…' : 'Enviar pedido'}
                  {#if sending}<LoaderCircle
                      class="contact-submit-spinner"
                      size={18}
                      aria-hidden="true"
                    />{:else}<ArrowUpRight size={18} aria-hidden="true" />{/if}</button
                >
              </ContactFormFooter>
            </form>
          </div>
        </div>
      </div>
    {/if}
  </dialog>
  <dialog
    bind:this={galleryDialog}
    use:galleryBackdrop={{ close: closeGallery }}
    data-closing={closingViewer || undefined}
    oncancel={(event) => {
      event.preventDefault();
      closeGallery();
    }}
    onclose={() => {
      stopOpening?.();
      galleryOpen = false;
      closingViewer = false;
      window.scrollTo({ left: galleryScroll.x, top: galleryScroll.y, behavior: 'instant' });
      // Visiting the contact slide can replace the original inline opener.
      if (!document.querySelector('dialog[open]')) {
        galleryReturnTarget()?.focus({ preventScroll: true });
      }
    }}
    class="gallery-dialog"
    aria-labelledby="gallery-caption"
    onkeydown={galleryKeydown}
  >
    {#if car && publicVehicle && galleryOpen}
      <div class="viewer-heading">
        <p id="gallery-caption">
          <span class="viewer-vehicle-name" title={car.brand + ' ' + car.model}
            >{car.brand} {car.model}</span
          >
          <span class="viewer-photo-position"
            >{isContactSlide ? 'Fale connosco' : zoom + 1 + ' / ' + galleryPhotoCount}</span
          >
        </p>
        <div class="viewer-controls">
          <button
            class="dialog-close icon-button"
            onclick={closeGallery}
            aria-label="Fechar fotografia"><X size={25} aria-hidden="true" /></button
          >
        </div>
      </div>
      <div
        class="viewer-stage"
        role="group"
        aria-label="Fotografias em ecrã inteiro"
        use:photoSwipe={{
          mouse: true,
          commitDistance: 24,
          enabled: !!publicVehicle && galleryCount > 1,
          previous: () => stepGallery(-1),
          next: () => stepGallery(1),
          drag: (offset) => (viewerPhotoDrag = offset),
        }}
      >
        {#if publicVehicle?.photos.length}
          <VehiclePhotoRail
            vehicle={publicVehicle}
            session={gallerySession}
            index={zoom}
            drag={viewerPhotoDrag}
            fullscreen
            onContact={() => {
              const opener = galleryReturnTarget();
              galleryDialog.close();
              contact(`Gostava de saber mais sobre o ${car.brand} ${car.model}.`, opener);
            }}
          />
        {:else}<img
            use:publicGalleryPhoto={{
              session: gallerySession,
              src: publicVehicle?.photos.length
                ? publicPhoto(publicVehicle, zoom)
                : photo(car.image, 2400),
            }}
            src={publicVehicle?.photos.length ? undefined : photo(car.image, 2400)}
            draggable={false}
            alt={`${car.brand} ${car.model}${''}`}
          />{/if}
        <div class="viewer-controls">
          {#if publicVehicle && galleryCount > 1}
            <button
              type="button"
              class="viewer-step viewer-previous"
              aria-label="Fotografia anterior"
              aria-disabled={zoom === 0}
              onclick={() => {
                if (zoom > 0) zoom -= 1;
              }}><ArrowLeft size={22} aria-hidden="true" /></button
            >
            <button
              type="button"
              class="viewer-step viewer-next"
              aria-label="Fotografia seguinte"
              aria-disabled={zoom === galleryCount - 1}
              onclick={() => {
                if (zoom < galleryCount - 1) zoom += 1;
              }}><ArrowRight size={22} aria-hidden="true" /></button
            >
          {/if}
        </div>
      </div>

      {#if publicVehicle && galleryPhotoCount}
        <div
          class="viewer-thumbnails"
          tabindex="-1"
          use:followThumbnail={zoom}
          role="group"
          aria-label="Fotografias da viatura"
        >
          {#each publicVehicle.photos as _, i}
            <button
              type="button"
              aria-label={`Ver fotografia ${i + 1}`}
              aria-pressed={zoom === i}
              onclick={() => (zoom = i)}
            >
              <img
                use:publicGalleryPhoto={{
                  session: gallerySession!,
                  src: sizedPhoto(publicPhoto(publicVehicle, i), 1600),
                }}
                draggable={false}
                alt=""
                loading="eager"
              />
            </button>
          {/each}
          <button
            type="button"
            class="viewer-contact-thumbnail"
            aria-label="Fale connosco"
            aria-pressed={isContactSlide}
            onclick={() => (zoom = galleryPhotoCount)}
          >
            <img
              use:publicGalleryPhoto={{
                session: gallerySession!,
                src: sizedPhoto(publicPhoto(publicVehicle, 0), 1600),
              }}
              draggable={false}
              alt=""
              loading="eager"
            />
            <span>Fale connosco</span>
          </button>
        </div>
      {/if}
    {/if}
  </dialog>
</div>

{#snippet vehicleCard(
  vehicle: PublicCard | null,
  index: number,
  animate: boolean = true,
  relatedCount: number = 0,
)}
  <article
    class="vehicle-card"
    class:public-card={!!vehicle}
    class:pending-card={!vehicle}
    aria-hidden={!vehicle ? 'true' : undefined}
    use:conditionalEntrance={vehicle && animate ? (index % 2) * 110 : false}
  >
    {#if vehicle}
      {@const framing = vehicle.cardFraming}
      {@const waitingPhoto =
        !favorites &&
        !compare &&
        !about &&
        !id &&
        !catalog &&
        !privacy &&
        !publicVehicle &&
        !errorStatus
          ? homePhotoPlaceholder(vehicle.photoDimensions)
          : undefined}
      <div class="card-photo">
        <a class="card-image" href={vehicle.href} data-photo-count={vehicle.photoCount}
          ><picture use:homePhotoPriority>
            {#if waitingPhoto}<source
                data-home-photo-priority
                media="(max-width: 700px) and (scripting: enabled)"
                srcset={waitingPhoto}
              />{/if}
            <img
              use:coverPhotoSizes={vehicle.photoDimensions
                ? { source: vehicle.image, dimensions: vehicle.photoDimensions }
                : undefined}
              use:vehiclePhoto={{
                hideUntilLoaded: true,
                src: cardPhoto(vehicle.image),
                srcset: cardPhotoSet(vehicle.image),
              }}
              style:--photo-desktop={framing
                ? `${framing.desktop.x}% ${framing.desktop.y}%`
                : undefined}
              style:--photo-mobile={framing
                ? `${framing.mobile.x}% ${framing.mobile.y}%`
                : undefined}
              use:photoFraming={{
                framing,
                enabled: true,
              }}
              src={cardPhoto(vehicle.image)}
              srcset={cardPhotoSet(vehicle.image)}
              sizes={relatedCount
                ? relatedCardImageSizes(vehicle.photoDimensions, relatedCount)
                : publicCardImageSizes(vehicle.photoDimensions, catalog, favorites)}
              fetchpriority={catalog || favorites ? undefined : 'low'}
              alt={`${vehicle.brand} ${vehicle.model}${vehicle.image === catalogPlaceholder ? ' — imagem indisponível' : ''}`}
              loading="lazy"
            /></picture
          >{#if vehicle.category}<span
              class="image-category"
              class:reserved-status={vehicle.category === 'Reservada'}>{vehicle.category}</span
            >{/if}
          {#if vehicle.promotion}
            <CardPromotionOverlay
              price={vehicle.price}
              promotion={vehicle.promotion}
              belowCategory={!!vehicle.category}
            />
          {/if}
          <span class="card-arrow"><ArrowUpRight size={23} aria-hidden="true" /></span></a
        >
        <div class="card-compare">
          <CompareButton id={vehicle.id} name={`${vehicle.brand} ${vehicle.model}`} overlay />
        </div>
      </div>
      <div class="card-body">
        <div class="card-info">
          <a class="card-detail-link" href={vehicle.href} data-photo-count={vehicle.photoCount}
            ><h3>{vehicle.brand} {vehicle.model}</h3>
            {#if 'version' in vehicle && vehicle.version}<span class="card-version"
                >{vehicle.version}</span
              >{/if}</a
          >
          <div class="card-favorite">
            <FavoriteButton id={vehicle.id} name={`${vehicle.brand} ${vehicle.model}`} />
          </div>
        </div>
        <div class="card-price" class:has-promotion={!!vehicle.promotion}>
          {#if vehicle.promotion}
            <CardPromotionPrice price={vehicle.price} promotion={vehicle.promotion} />
          {:else}
            <strong>{formatVehiclePrice(vehicle.price)}</strong>
          {/if}
        </div>
        <div class="card-specs">
          <span><CalendarDays size={22} strokeWidth={1.7} aria-hidden="true" />{vehicle.year}</span
          ><span
            ><svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"><path d="M4 19 8 5m8 0 4 14M12 6v2m0 3v2m0 3v2" /></svg
            >{publicMileage(vehicle.km)}</span
          ><span><Fuel size={22} strokeWidth={1.7} aria-hidden="true" />{vehicle.fuel}</span>
        </div>
      </div>
    {:else}
      <div class="card-photo"><div class="card-image"></div></div>
      <div class="card-body">
        <div class="card-info">
          <div>
            <h3 class="pending-line">A carregar viatura</h3>
            <span class="card-version pending-line">&nbsp;</span>
          </div>
        </div>
        <div class="card-price"><strong class="pending-line">&nbsp;</strong></div>
        <div class="card-specs"><span class="pending-line">&nbsp;</span></div>
      </div>
    {/if}
  </article>
{/snippet}

<style lang="postcss">
  @import './pageShell.css';
  @import '../home/homeSections.css';
  @import '../vehicles/detailSections.css';
  @import './pageDialogs.css';
  @import './responsivePage.css';
  @import '../catalog/vehicleCard.css';

  .contact-thumbnail > img,
  .detail-band > img {
    object-position: var(--photo-desktop, 50% 50%);
  }
  @media (max-width: 700px) {
    .contact-thumbnail > img,
    .detail-band > img {
      object-position: var(--photo-mobile, 50% 50%);
    }
  }
</style>
