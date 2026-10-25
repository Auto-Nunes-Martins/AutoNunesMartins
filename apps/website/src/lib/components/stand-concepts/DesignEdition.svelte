<script lang="ts">
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';
  import type { Snippet } from 'svelte';
  import type { VehicleDetailRuntime } from '$lib/vehicleDetailRuntime';
  let galleryOpen = $state(false);
  let mainPhotoLoading = $state(true);
  import { vehiclePhoto } from '$lib/vehiclePhoto';
  import { publicPhotoVersions } from '$lib/publicVehicles';
  import UnavailableVehiclePanel from './UnavailableVehiclePanel.svelte';
  import MissingVehiclePanel from './MissingVehiclePanel.svelte';
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
  import HomeHeroDirections from './HomeHeroDirections.svelte';
  import './serviceTypography.css';
  import { homeVisualFamilies } from './homeVisualFamilies';
  import SocialMetadata from '$lib/components/SocialMetadata.svelte';
  import { submitContact } from '$lib/contactRequest';
  import ContactPrivacyNotice from '$lib/components/ContactPrivacyNotice.svelte';
  import orbitFont400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
  import orbitFont500 from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
  import orbitFont600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
  import orbitTitleFont from '@fontsource/barlow/files/barlow-latin-600-normal.woff2?url';
  import orbitTitleItalic from '@fontsource/barlow/files/barlow-latin-600-italic.woff2?url';
  import { onMount, tick, untrack } from 'svelte';
  import { usePublicTheme } from '$lib/publicTheme';
  import {
    emptyStock,
    publicPrice,
    type PublicStock,
    type PublicVehicle,
    type PublicCard,
  } from '$lib/publicVehicles';
  import { page } from '$app/stores';
  import { publicPhoto, publicHref, fuelLabels, transmissionLabels } from '$lib/publicVehicles';
  import DiscoverVehicles from './DiscoverVehicles.svelte';
  import { hybridNav } from './hybridNav';
  import { catalogNavigation } from './catalogNavigation';
  import './catalogNavigation.css';
  import { mobileNavigation } from './mobileNavigation';
  import { ringPhone } from './phoneAttention';
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
  } from 'lucide-svelte';
  import { cars, photo, eur, number } from './data';
  import { responsivePhoto, cardImageSizes, publicCardImageSizes } from './images';
  import { coverPhotoSizes } from '$lib/coverPhotoSizes';
  import { designMotion, entrance, conditionalEntrance } from './designMotion';
  import OrbitPerspective from './OrbitPerspective.svelte';
  import OrbitFaq from './OrbitFaq.svelte';
  import OrbitAccordion from './OrbitAccordion.svelte';
  import VehicleSpecIcon from '../VehicleSpecIcon.svelte';
  import CabinReveal from './CabinReveal.svelte';
  import ServiceBannerProposals from './ServiceBannerProposals.svelte';
  import OrbitStats from './OrbitStats.svelte';
  import PublicStockBrands from './PublicStockBrands.svelte';
  import type { PublicBrandDirectory } from '$lib/catalogBrandLinks';
  import HomeChoiceGuide from './HomeChoiceGuide.svelte';
  import HomeNextSteps from './HomeNextSteps.svelte';
  import OrbitEditorialPause from './OrbitEditorialPause.svelte';
  import OrbitRedDot from './OrbitRedDot.svelte';
  import VisitInvitation from './VisitInvitation.svelte';
  import './conversationButton.css';
  import OrbitPageEnding from './OrbitPageEnding.svelte';
  import FormSelectField from './FormSelectField.svelte';
  import OrbitReviews from './OrbitReviews.svelte';
  import { standContact } from './standContact';
  import OrbitSelect from './OrbitSelect.svelte';
  import FavoriteButton from '../FavoriteButton.svelte';
  import { useFavorites } from '$lib/favorites';
  const { ids: favoriteIds } = useFavorites();
  import CompareButton from '../CompareButton.svelte';
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
  import { catalogCars, transmissionFor } from './catalogDemo';
  import type { CatalogCar } from './catalog';
  import { sortOptions } from './catalog';
  import './orbitRhythm.css';
  import './orbitInitialLight.css';
  import './navAddress.css';
  import './orbitLightTheme.css';
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
    homeHighlights?: PublicHighlights;
    routeContent?: Snippet<[{ card: Snippet<[PublicCard | null, number]>; contact: (message?: string) => Promise<void> }]>;
    galleryRuntime?: VehicleDetailRuntime;
  } = $props();
  // Detail routes provide their runtime before SSR; the homepage never imports it.
  const GalleryContactSlide = $derived(galleryRuntime?.GalleryContactSlide!);
  const RelatedCarousel = $derived(galleryRuntime?.RelatedCarousel!);
  const RichDescription = $derived(galleryRuntime?.RichDescription!);
  const VehicleShareButton = $derived(galleryRuntime?.VehicleShareButton!);
  const PublicVehicleStory = $derived(galleryRuntime?.PublicVehicleStory!);
  const OrbitBackLink = $derived(galleryRuntime?.OrbitBackLink!);
  const publicVehicleCanonical = (...args: Parameters<VehicleDetailRuntime['publicVehicleCanonical']>) => galleryRuntime!.publicVehicleCanonical(...args);
  const vehicleJsonLdScript = (...args: Parameters<VehicleDetailRuntime['vehicleJsonLdScript']>) => galleryRuntime!.vehicleJsonLdScript(...args);
  const vehicleBreadcrumbItems = (...args: Parameters<VehicleDetailRuntime['vehicleBreadcrumbItems']>) => galleryRuntime!.vehicleBreadcrumbItems(...args);
  const vehicleBreadcrumbJsonLdScript = (...args: Parameters<VehicleDetailRuntime['vehicleBreadcrumbJsonLdScript']>) => galleryRuntime!.vehicleBreadcrumbJsonLdScript(...args);
  const descriptionText = (...args: Parameters<VehicleDetailRuntime['descriptionText']>) => galleryRuntime!.descriptionText(...args);
  const vehicleSeo = (...args: Parameters<VehicleDetailRuntime['vehicleSeo']>) => galleryRuntime!.vehicleSeo(...args);
  const vehicleShareData = (...args: Parameters<VehicleDetailRuntime['vehicleShareData']>) => galleryRuntime!.vehicleShareData(...args);
  const publicGalleryPhoto = (...args: Parameters<VehicleDetailRuntime['publicGalleryPhoto']>) => galleryRuntime!.publicGalleryPhoto(...args);
  const createPublicGallerySession = (...args: Parameters<VehicleDetailRuntime['createPublicGallerySession']>) => galleryRuntime!.createPublicGallerySession(...args);
  const followThumbnail = (...args: Parameters<VehicleDetailRuntime['followThumbnail']>) => galleryRuntime!.followThumbnail(...args);
  const dragThumbnailStrip = (...args: Parameters<VehicleDetailRuntime['dragThumbnailStrip']>) => galleryRuntime!.dragThumbnailStrip(...args);
  const thumbnailNavigation = (...args: Parameters<VehicleDetailRuntime['thumbnailNavigation']>) => galleryRuntime!.thumbnailNavigation(...args);
  const createThumbnailSession = (...args: Parameters<VehicleDetailRuntime['createThumbnailSession']>) => galleryRuntime!.createThumbnailSession(...args);
  const publicThumbnail = (...args: Parameters<VehicleDetailRuntime['publicThumbnail']>) => galleryRuntime!.publicThumbnail(...args);
  const thumbnailAttrs = (...args: Parameters<VehicleDetailRuntime['thumbnailAttrs']>) => galleryRuntime!.thumbnailAttrs(...args);
  const trapDialogTab = (...args: Parameters<VehicleDetailRuntime['trapDialogTab']>) => galleryRuntime!.trapDialogTab(...args);
  const galleryBackdrop = (...args: Parameters<VehicleDetailRuntime['galleryBackdrop']>) => galleryRuntime?.galleryBackdrop(...args);
  const thumbnailSession = $derived(
    publicVehicle ? createThumbnailSession(publicVehicle.slug, publicPhotoVersions(publicVehicle)) : undefined,
  );
  const viewerThumbnailSession = $derived(galleryOpen && publicVehicle
    ? createThumbnailSession(publicVehicle.slug, publicPhotoVersions(publicVehicle) ?? [], true) : undefined);
  const car = $derived(
    publicVehicle
      ? {
          id: publicVehicle.slug,
          brand: publicVehicle.brand,
          model: publicVehicle.model,
          year: publicVehicle.year,
          km: publicVehicle.mileage,
          fuel: fuelLabels[publicVehicle.fuel],
          line: publicVehicle.availability === 'RESERVED' ? 'Reservada' : '',
          power: publicVehicle.specifications?.powerHp ?? 0,
          category: publicVehicle.specifications?.category ?? '',
          price: publicVehicle.price === null ? Number.NaN : Number(publicVehicle.price),
          image: publicVehicle.photos.length
            ? publicPhoto(publicVehicle, 0)
            : catalogPlaceholder,
        }
      : catalogCars.find((item) => item.id === id),
  );
  const detailSpecs = $derived(
    car
      ? [
          ['Marca', car.brand],
          ['Modelo', car.model],
          ['Ano', car.year],
          ['Quilometragem', number(car.km) + ' km'],
          ...(car.power ? [['Potência', car.power + ' cv']] : []),
          ...(!publicVehicle
            ? [['Caixa', transmissionFor(car)]]
            : publicVehicle.transmission
              ? [['Caixa', transmissionLabels[publicVehicle.transmission]]]
              : []),
          ['Combustível', car.fuel],
          ...(car.category ? [['Categoria', car.category]] : []),
          ...(publicVehicle?.specifications?.engineCc
            ? [['Cilindrada', publicVehicle.specifications.engineCc + ' cm³']]
            : []),
          ...(publicVehicle?.specifications?.doors
            ? [['Portas', publicVehicle.specifications.doors]]
            : []),
          ...(publicVehicle?.specifications?.seats
            ? [['Lugares', publicVehicle.specifications.seats]]
            : []),
          ...(publicVehicle?.specifications?.color
            ? [['Cor', publicVehicle.specifications.color]]
            : []),
        ]
      : [],
  );
  const suggestions = $derived(
    publicVehicle
      ? (Array.isArray(relatedVehicles) ? relatedVehicles : []).map((item) => ({
          id: item.slug,
          brand: item.brand,
          model: item.model,
          year: item.year,
          price: item.price,
          image: item.photos.length ? publicPhoto(item, 0) : catalogPlaceholder,
        }))
      : car
        ? cars
            .filter(
              (item) =>
                item.id !== car.id &&
                Number.isFinite(item.price) &&
                item.price > 0 &&
                Number.isFinite(car.price) &&
                car.price > 0,
            )
            .toSorted(
              (a, b) =>
                Math.abs(a.price - car.price) - Math.abs(b.price - car.price) ||
                a.id.localeCompare(b.id),
            )
            .slice(0, 3)
        : [],
  );
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
  let saved = $state<string[]>([]);
  let navOpen = $state(false);
  let contactDialog: HTMLDialogElement;
  let contactName = $state<HTMLInputElement>();
  let confirmationHeading = $state<HTMLHeadingElement>();
  let galleryDialog: HTMLDialogElement;
  let preparingViewer = false;
  const preparedViewerThumbnails = new Set<number>();
  let finishViewerPreparation: (() => void) | undefined;
  function viewerThumbnailReady(index: number) {
    preparedViewerThumbnails.add(index);
    if (preparedViewerThumbnails.size >= galleryPhotoCount + 1) finishViewerPreparation?.();
  }
  async function openGallery() {
    if (preparingViewer || galleryOpen) return;
    preparingViewer = true;
    preparedViewerThumbnails.clear();
    const prepared = new Promise<void>(resolve => { finishViewerPreparation = resolve; });
    galleryOpen = true;
    await tick();
    // Prepare existing local thumbnails together while the dialog is still closed.
    if (publicVehicle?.photos.length) await prepared;
    preparingViewer = false;
    if (galleryOpen) galleryDialog.showModal();
  }
  const gallerySession = $derived(publicVehicle?.photos.length ? createPublicGallerySession(publicVehicle) : undefined);
  // SSR starts the first photo. Thereafter the action alone owns image sources,
  // so Svelte never assigns a network URL before a cache-only gallery revisit.
  const initialMainPhoto = untrack(() => ({
    src: publicVehicle?.photos.length
      ? sizedPhoto(publicPhoto(publicVehicle, 0), 1600)
      : car ? photo(car.image, 2000) : undefined,
    srcset: publicVehicle?.photos.length ? vehiclePhotoSet(publicPhoto(publicVehicle, 0)) : undefined,
  }));
  let sent = $state(false);
  let sending = $state(false);
  let contactError = $state('');
  let reason = $state('Gostava de saber mais.');
  let zoom = $state(0);
  const galleryPhotoCount = $derived(publicVehicle?.photos.length ?? 0);
  const galleryCount = $derived(
    publicVehicle ? (galleryPhotoCount ? galleryPhotoCount + 1 : 0) : car ? 1 : 0,
  );
  const isContactSlide = $derived(
    !!publicVehicle && galleryPhotoCount > 0 && zoom === galleryPhotoCount,
  );
  const galleryPhotoIndex = $derived(isContactSlide ? 0 : zoom);
  function galleryKeydown(event: KeyboardEvent) {
    trapDialogTab(event, galleryDialog);
    if (!publicVehicle || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const count = galleryCount;
    event.preventDefault();
    zoom = Math.max(0, Math.min(count - 1, zoom + (event.key === 'ArrowRight' ? 1 : -1)));
  }
  $effect(() => {
    if (publicVehicle && zoom > Math.max(0, galleryCount - 1)) zoom = 0;
  });
  const heroVersion = 5;
  const homeVisualFamily = homeVisualFamilies[5];
  const equipmentItems = [
    {
      question: 'Conforto',
      answer:
        'Climatização automática, volante multifunções e um interior pensado para os seus dias. Equipamento ilustrativo a confirmar.',
    },
    {
      question: 'Tecnologia',
      answer:
        'Conectividade, navegação e apoio ao estacionamento. Os detalhes de cada viatura devem ser confirmados com o stand.',
    },
    {
      question: 'Uma escolha informada',
      answer:
        'Na visita, peça informação sobre o histórico, a documentação, a manutenção e as condições de entrega.',
    },
  ];
  const selected = $derived.by(() => {
    const matches = homeCars.filter(
      (car) =>
        (!homeBrand || car.brand === homeBrand) && (!homeYear || car.year === Number(homeYear)),
    );
    matches.sort((a, b) =>
      homeOrder === 'preco_asc'
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : homeOrder === 'preco_desc'
          ? (b.price ?? -Infinity) - (a.price ?? -Infinity)
          : homeOrder === 'ano'
            ? b.year - a.year
            : homeOrder === 'km'
              ? a.km - b.km
              : 0,
    );
    return matches.slice(0, 5);
  });
  onMount(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('anm-design-saved') || '[]');
      if (Array.isArray(stored)) saved = stored.filter((item) => typeof item === 'string');
    } catch {}
  });
  $effect(() => {
    id;
    publicVehicle?.slug;
    navOpen = false;
    zoom = 0;
  });
  function toggleTheme() {
    theme.toggle();
  }
  function toggleSave(value: string) {
    saved = saved.includes(value) ? saved.filter((item) => item !== value) : [...saved, value];
    try {
      localStorage.setItem('anm-design-saved', JSON.stringify(saved));
    } catch {}
  }
  async function contact(message?: string) {
    reason =
      message ||
      (car ? `Gostava de conhecer o ${car.brand} ${car.model}.` : 'Gostava de saber mais.');
    sent = false;
    contactError = '';
    await tick();
    contactDialog.showModal();
    contactName?.focus({ preventScroll: true });
  }
  let contactPointerStartedOutside = false;
  function outsideContact(event: MouseEvent | PointerEvent) {
    const bounds = contactDialog.getBoundingClientRect();
    return (
      event.target === contactDialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
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
    if (event.shiftKey && document.activeElement === first) {
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
    image={publicVehicle.photos.length ? publicPhoto(publicVehicle, 0) : undefined}
    imageAlt={publicVehicle.photos.length
      ? `${publicVehicle.brand} ${publicVehicle.model} (${publicVehicle.year}) — fotografia publicada`
      : undefined}
    brandImage={!publicVehicle.photos.length}
  />
{:else if !favorites && !compare && !about && !catalog && !privacy && !errorStatus}
  <SocialMetadata
    title={car
      ? `${car.brand} ${car.model} — Auto Nunes Martins`
      : 'Auto Nunes Martins — Automóveis usados'}
    description="Conheça a Auto Nunes Martins e consulte as viaturas publicadas. Compare preço, ano e quilometragem e contacte-nos para saber mais."
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
      {#each publicVehicle.photos.slice(0, 9) as _, i}
        <link
          rel="preload"
          as="image"
          href={sizedPhoto(publicPhoto(publicVehicle, i), 320)}
          imagesrcset={vehiclePhotoSet(publicPhoto(publicVehicle, i))}
          imagesizes="(max-width:701px) 112px, 128px"
          fetchpriority="low"
        />
      {/each}
    {/if}
  {/if}
  {#if !favorites && !compare && !about && !id && !catalog && !privacy && !publicVehicle && !errorStatus}
    <link rel="canonical" href={new URL('/', $page.url.origin).href} />
  {/if}

  <link rel="preload" href={orbitFont400} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={orbitFont500} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={orbitFont600} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={orbitTitleFont} as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href={orbitTitleItalic} as="font" type="font/woff2" crossorigin="anonymous" />
  {#if !favorites && !compare && !about && !catalog && !privacy && !publicVehicle && !errorStatus}<title
      >{car
        ? `${car.brand} ${car.model} — Auto Nunes Martins`
        : 'Auto Nunes Martins — Automóveis usados'}</title
    ><meta
      name="description"
      content="Conheça a Auto Nunes Martins e consulte as viaturas publicadas. Compare preço, ano e quilometragem e contacte-nos para saber mais."
    />{/if}
  {#if id && !favorites && !compare && !about && !catalog && !privacy && !publicVehicle && !errorStatus}<meta
      name="robots"
      content="noindex, follow"
    />{/if}</svelte:head
>

<div
  id={!favorites && !compare && !about && !id && !catalog && !privacy && !publicVehicle
    ? 'inicio'
    : undefined}
  class="design orbit"
  class:orbit-home={!favorites &&
    !compare &&
    !about &&
    !id &&
    !catalog &&
    !privacy &&
    !publicVehicle}
  class:orbit-catalog={catalog}
  class:orbit-inner={!!(
    favorites ||
    compare ||
    about ||
    id ||
    catalog ||
    privacy ||
    publicVehicle ||
    errorStatus
  )}
  class:orbit-privacy={privacy || about || compare || favorites}
  class:orbit-company={about}
  class:orbit-detail={!!car || !!publicVehicle}
  class:public-detail={!!publicVehicle}
  class:dark={isDark}
  data-hero-version={heroVersion}
  class:has-address={!!standContact.address ||
    !!standContact.email ||
    standContact.hours.length > 0}
  use:designMotion
>
  <div class="read-line" aria-hidden="true"></div>
  {#if standContact.address || standContact.email || standContact.hours.length}
    <div class="nav-contact-strip">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll the contact strip.) -->
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
        sizes="(max-width: 700px) 96px, 145px"
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
      <span class="edition-label orbit-edition-label">{'seleção'} / 0{'1'}</span>
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
  {:else if car}
    <main class="vehicle-page">
      {#if publicVehicle}<div class="detail-top-actions">
          <OrbitBackLink useHistory /><VehicleShareButton
            {...vehicleShareData(publicVehicle, $page.url.origin)}
          />
        </div>{/if}
      <div class="breadcrumbs">
        {#if publicVehicle}<nav class="breadcrumb-trail" aria-label="Percurso de navegação">
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
          </nav>{:else}<a href="/viaturas"><ArrowLeft size={14} aria-hidden="true" /> Voltar</a
          ><span>{car.brand} / {car.model}</span>{/if}{#if !publicVehicle}<button
            onclick={() => toggleSave(car.id)}
            class:saved={saved.includes(car.id)}
            aria-pressed={saved.includes(car.id)}
            ><Heart
              size={16}
              fill={saved.includes(car.id) ? 'currentColor' : 'none'}
              aria-hidden="true"
            />{saved.includes(car.id) ? 'Guardada' : 'Guardar'}</button
          >{/if}
      </div>

      <section class="vehicle-layout" data-scene>
        <div class="vehicle-photography">
          <div class="vehicle-gallery">
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions (Arrow keys coordinate the gallery's focused buttons; explicit previous/next controls remain available.) -->
            <div
              class="vehicle-photo-stage"
              role="group"
              aria-label="Galeria de fotografias"
              onkeydown={galleryKeydown}
            >
              <button
                class="vehicle-photo"
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
                    : `${publicVehicle && !publicVehicle.photos.length ? '' : 'Ampliar fotografia: '}${car.brand} ${car.model} — ${publicVehicle ? (publicVehicle.photos.length ? 'fotografia ' + (zoom + 1) : 'imagem indisponível') : 'imagem ilustrativa'}`}
                  style={publicVehicle
                    ? '--zoom:1;object-position:center'
                    : `--zoom:${zoom === 0 ? 1 : 1.32};object-position:${zoom === 1 ? '25%' : zoom === 2 ? '75%' : '50%'} center`}
                /><span class="photo-counter" aria-hidden={isContactSlide}
                  >{publicVehicle
                    ? publicVehicle.photos.length
                      ? zoom + 1 + ' / ' + publicVehicle.photos.length
                      : 'SEM FOTOGRAFIA'
                    : '01 / 01'} <span>{publicVehicle ? '' : 'FOTOGRAFIA ILUSTRATIVA'}</span></span
                ></button
              >
              {#if mainPhotoLoading}<span
                  class="main-photo-loading"
                  role="status"
                  aria-label="A carregar fotografia"><span aria-hidden="true"></span></span
                >{/if}
              {#if isContactSlide}<GalleryContactSlide
                  onContact={() =>
                    contact(`Gostava de saber mais sobre o ${car.brand} ${car.model}.`)}
                />{/if}
              {#if publicVehicle && !isContactSlide}
                <div class="detail-photo-favorite">
                  <FavoriteButton
                    id={publicVehicle.slug}
                    name={`${publicVehicle.brand} ${publicVehicle.model}`}
                    onPhoto
                  />
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
            {#if publicVehicle}
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
                          {...thumbnailAttrs(
                            thumbnailSession!,
                            sizedPhoto(publicPhoto(publicVehicle, i), 320),
                            vehiclePhotoSet(publicPhoto(publicVehicle, i)),
                          )}
                          use:publicThumbnail={{
                            session: thumbnailSession!,
                            index: i,
                            src: sizedPhoto(publicPhoto(publicVehicle, i), 320),
                            srcset: vehiclePhotoSet(publicPhoto(publicVehicle, i)),
                            sizes: '(max-width:701px) 112px, 128px',
                          }}
                          sizes="(max-width:701px) 112px, 128px"
                          alt=""
                          loading={i < 9 ? 'eager' : 'lazy'}
                          fetchpriority={i < 9 ? 'auto' : 'low'}
                        /><span>{i + 1}</span></button
                      >{/each}
                    <button
                      type="button"
                      class="contact-thumbnail"
                      aria-label="Falar sobre esta viatura"
                      aria-pressed={isContactSlide}
                      onclick={() => (zoom = galleryPhotoCount)}
                      ><img
                        src={sizedPhoto(publicPhoto(publicVehicle, 0), 320)}
                        alt=""
                        loading="lazy"
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
            {:else}
              <div
                class="detail-thumbnails"
                role="group"
                aria-label="Vistas da fotografia ilustrativa"
              >
                {#each ['Completa', 'Pormenor I', 'Pormenor II'] as label, i}
                  <button
                    type="button"
                    aria-label={'Ver vista: ' + label}
                    aria-pressed={zoom === i}
                    onclick={() => (zoom = i)}
                  >
                    <img
                      use:vehiclePhoto={{ src: photo(car.image, 320) }}
                      src={photo(car.image, 320)}
                      alt=""
                      style:transform={'scale(' + (i === 0 ? 1 : 1.32) + ')'}
                      style:object-position={(i === 1 ? '25%' : i === 2 ? '75%' : '50%') +
                        ' center'}
                    />
                    <span>{label}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <div class="photo-controls">
            <span
              >{publicVehicle
                ? publicVehicle.photos.length +
                  (publicVehicle.photos.length === 1 ? ' fotografia' : ' fotografias')
                : 'Veja os detalhes.'}</span
            >
            {#if !publicVehicle}<div>
                {#each ['Completa', 'Pormenor I', 'Pormenor II'] as label, i}<button
                    class:active={zoom === i}
                    onclick={() => (zoom = i)}>{label}</button
                  >{/each}
              </div>{/if}
          </div>
        </div>
        <div class="purchase" role="group" aria-labelledby="vehicle-title" use:entrance>
          <p class="kicker"><OrbitRedDot /> UM NOVO PONTO DE PARTIDA</p>
          <h1 id="vehicle-title">{car.brand}<br /><span>{car.model}</span></h1>
          {#if car.line}<p class="model-line">{car.line.split(' · ')[0]}</p>{/if}
          <div class="purchase-price">
            <span>{publicVehicle ? 'Preço da viatura' : 'Preço de demonstração'}</span><strong
              >{publicVehicle ? publicPrice(publicVehicle.price) : eur(car.price)}</strong
            >
          </div>
          <div class="quick-specs">
            <span>{car.year}<small>Ano</small></span><span
              >{number(car.km)}<small>Quilómetros</small></span
            ><span>{car.fuel}<small>Combustível</small></span>
          </div>
          <button
            class="trade-in-contact"
            onclick={() => contact('Gostava de apresentar a minha viatura para retoma.')}
          >
            <span
              ><strong>Tem uma viatura para retoma?</strong><small
                >Conte-nos o que pretende trocar.</small
              ></span
            ><ArrowUpRight size={18} aria-hidden="true" />
          </button>
          <button class="pill primary" onclick={() => contact()}
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
            {#if publicVehicle}<div
                class="detail-compare"
                role="group"
                aria-label="Ações da viatura"
              >
                <CompareButton
                  id={publicVehicle.slug}
                  name={`${publicVehicle.brand} ${publicVehicle.model}`}
                /><FavoriteButton
                  id={publicVehicle.slug}
                  name={`${publicVehicle.brand} ${publicVehicle.model}`}
                  text
                /><VehicleShareButton {...vehicleShareData(publicVehicle, $page.url.origin)} />
              </div>{/if}
            <p class="fine-print">
              {publicVehicle
                ? 'Confirme disponibilidade, histórico e condições no stand.'
                : 'Fotografia, preço e características ilustrativos. Esta página é uma proposta visual.'}
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
          <section class="detail-band" data-scene>
            <img
              use:coverPhotoSizes
              use:vehiclePhoto={{
                src: publicVehicle
                  ? sizedPhoto(publicPhoto(publicVehicle, 0), 1600)
                  : photo(car.image, 1800),
                srcset: publicVehicle
                  ? vehiclePhotoSet(publicPhoto(publicVehicle, 0))
                  : undefined,
              }}
              src={publicVehicle
                ? sizedPhoto(publicPhoto(publicVehicle, 0), 1600)
                : photo(car.image, 1800)}
              srcset={publicVehicle
                ? vehiclePhotoSet(publicPhoto(publicVehicle, 0))
                : undefined}
              sizes="(max-width:700px) 100vw, (min-width:1920px) 1200px, 70vw"
              alt=""
              loading="lazy"
            />
            <div>
              <p class="kicker">A ESCOLHA É SUA.</p>
              <h2>O caminho<br />também.</h2>
              <button class="pill" onclick={() => contact()}
                >Vamos falar <ArrowUpRight size={18} aria-hidden="true" /></button
              >
            </div>
            <span class="band-index" aria-hidden="true">↗</span>
          </section>
        {/if}
        {#if publicVehicle}<PublicVehicleStory vehicle={publicVehicle} />{/if}
        {#if !publicVehicle}
          <section class="equipment" use:entrance>
            <h2>Bom por fora.<br />Melhor de perto.</h2>
            <div>
              {#key car.id}<OrbitAccordion
                  items={equipmentItems}
                  idPrefix={`equipment-${car.id}`}
                />{/key}
            </div>
          </section>
        {/if}
      </section>
      {#if publicVehicle}<section class="related">
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
      {:else if suggestions.length}<section class="related">
          <p class="kicker">
            {publicVehicle ? 'PREÇOS PRÓXIMOS DO SEU' : 'PREÇOS PRÓXIMOS · DEMONSTRAÇÃO'}
          </p>
          <h2>Continue a explorar.</h2>
          <div class="related-grid">
            {#each suggestions as item}<a href={publicVehicle ? publicHref(item.id) : '/viaturas'}
                ><div class="related-image">
                  <img
                    use:vehiclePhoto={{ src: photo(item.image, 900) }}
                    src={photo(item.image, 900)}
                    alt={`${item.brand} ${item.model}`}
                    loading="lazy"
                  /><span><ArrowUpRight size={20} aria-hidden="true" /></span>
                </div>
                <div class="related-body">
                  <span class="related-brand">{item.brand}</span>
                  <h3>{item.model}</h3>
                  <p>{item.year}</p>
                  <strong class="related-price">{publicPrice(item.price)}</strong>
                </div></a
              >{/each}
          </div>
        </section>{/if}
    </main>
  {:else}
    <main>
      <HomeHeroDirections {homeHighlights} />
      <OrbitStats />

      <section class="showroom" id="selecao">
        <div class="showroom-heading" use:entrance>
          <div>
            <h2>
              O próximo pode estar aqui<span class="heading-period">.</span>
            </h2>
          </div>
        </div>
        <div class="showroom-layout">
          <div class="catalog-controls" role="group" aria-label="Filtrar viaturas">
            <div class="home-basic-filters">
              <OrbitSelect
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
              <OrbitSelect
                id="home-year"
                label="Ano"
                value={homeYear}
                options={[
                  { value: '', label: 'Todos os anos' },
                  ...homeYears.map((year) => ({ value: String(year), label: String(year) })),
                ]}
                onChange={(value) => (homeYear = value)}
                subtle
              />
              <OrbitSelect
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
            <DiscoverVehicles background={homeVisualFamily?.catalog} />
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
          <button class="conversation-pill" onclick={() => contact()}
            >Vamos conhecer-nos <ArrowUpRight size={18} aria-hidden="true" /></button
          >
          <div class="about-signature">
            <span>AUTO NUNES MARTINS</span><span>COMÉRCIO DE AUTOMÓVEIS</span>
          </div>
        </div>
      </section>

      <CabinReveal />
      <ServiceBannerProposals onContact={contact} />
      <OrbitPerspective
        grouped
        lead="A escolha certa"
        middle="começa por"
        highlight="fazer sentido."
      />
      <div class="home-choice-group">
        <HomeNextSteps />
        <OrbitReviews />
      </div>
      <OrbitEditorialPause onContact={contact} background={homeVisualFamily?.pause} />
    </main>
  {/if}

  {#if $page.url.pathname !== '/' && !favorites && !compare && !about && !catalog && !privacy && !errorStatus}<section
      class="services"
      aria-labelledby="services-title"
    >
      <p class="kicker" id="services-title">O CARRO É SÓ O INÍCIO.</p>
      <div>
        {#each [['01', 'Dar o próximo passo.', 'Conheça a viatura ao seu ritmo. Combine uma visita e esclareça as suas dúvidas.', 'Quero combinar uma visita.'], ['02', 'Mudar de companhia.', 'Tem uma viatura para retoma? Conte-nos um pouco sobre ela e sobre os seus planos.', 'Gostava de falar sobre uma retoma.'], ['03', 'Saber os detalhes.', 'Equipamento, documentação e condições: reúna a informação antes de decidir.', 'Gostava de esclarecer algumas dúvidas.']] as service, index}<article
            use:conditionalEntrance={car || publicVehicle ? false : index * 90}
          >
            <span>{service[0]}<ArrowUpRight size={22} aria-hidden="true" /></span>
            <h3>{service[1]}</h3>
            <p>{service[2]}</p>
            <button onclick={() => contact(service[3])}
              ><span class="service-cta-label">Vamos conversar</span><ArrowUpRight
                size={15}
                aria-hidden="true"
              /></button
            >
          </article>{/each}
      </div>
    </section>{/if}
  {#if (catalog || privacy) && !errorStatus}
    <OrbitFaq />
  {:else if favorites || compare || about || catalog || privacy || publicVehicle || errorStatus}
    <!-- The shared contact/footer follows the content without duplicating the homepage FAQ. -->
  {:else if !id}
    <VisitInvitation onContact={contact} logoSrc={logoLight} />
    {#if $page.url.pathname === '/'}
      <div class="home-choice-after-visit"><HomeChoiceGuide /></div>
    {/if}
    <OrbitFaq />
  {:else}
    <OrbitFaq
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

  <OrbitPageEnding onContact={() => contact()} background={homeVisualFamily?.visit} />

  <dialog
    bind:this={contactDialog}
    class="contact-dialog"
    aria-labelledby="contact-heading"
    aria-describedby={sent ? 'contact-description' : undefined}
    onkeydown={contactKeydown}
    onpointerdown={(event) => {
      contactPointerStartedOutside = outsideContact(event);
    }}
    onpointercancel={() => {
      contactPointerStartedOutside = false;
    }}
    onclick={contactBackdropClick}
  >
    <button
      class="dialog-close icon-button"
      onclick={() => contactDialog.close()}
      aria-label="Fechar"><X size={22} aria-hidden="true" /></button
    >
    <p class="kicker">VAMOS CONVERSAR</p>
    {#if sent}<h2 id="contact-heading" tabindex="-1" bind:this={confirmationHeading}>
        Pedido<br />enviado.
      </h2>
      <p id="contact-description">
        O pedido foi aceite pelo serviço de email para envio ao stand. Responderemos para esclarecer
        as suas questões ou combinar a visita. O agendamento ainda não está confirmado.
      </p>
      <button class="pill primary" onclick={() => contactDialog.close()}
        >Continuar a descobrir <ArrowUpRight size={18} aria-hidden="true" /></button
      >{:else}<h2 id="contact-heading">O que tem<br />em mente?</h2>
      <form
        onsubmit={async (event) => {
          event.preventDefault();
          if (sending) return;
          sending = true;
          contactError = '';
          const form = event.currentTarget;
          try {
            await submitContact(form);
            sent = true;
            await tick();
            confirmationHeading?.focus({ preventScroll: true });
          } catch (error) {
            contactError =
              error instanceof Error ? error.message : 'Não foi possível enviar o pedido.';
          } finally {
            sending = false;
          }
        }}
      >
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
          >Mensagem<textarea name="message" required maxlength="5000" rows="3" bind:value={reason}
          ></textarea></label
        ><ContactPrivacyNotice />
        {#if contactError}<p role="alert">{contactError}</p>{/if}
        <button class="pill primary" type="submit" disabled={sending}
          >{sending ? 'A enviar…' : 'Enviar pedido'}
          <ArrowUpRight size={18} aria-hidden="true" /></button
        >
      </form>{/if}
  </dialog>
  <dialog
    bind:this={galleryDialog}
    use:galleryBackdrop
    onclose={() => { galleryOpen = false; finishViewerPreparation?.(); }}
    class="gallery-dialog"
    aria-labelledby="gallery-caption"
    onkeydown={galleryKeydown}
  >
    {#if car && galleryOpen}
      <div class="viewer-stage">
        {#if isContactSlide && publicVehicle}
          <div class="viewer-contact">
            <img
              use:publicGalleryPhoto={{ src: publicPhoto(publicVehicle, 0), session: gallerySession }}
              draggable={false}
              alt=""
            />
            <GalleryContactSlide
              onContact={() => {
                galleryDialog.close();
                contact(`Gostava de saber mais sobre o ${car.brand} ${car.model}.`);
              }}
            />
          </div>
        {:else}<img
            use:publicGalleryPhoto={{
              session: gallerySession,
              src: publicVehicle?.photos.length
                ? publicPhoto(publicVehicle, zoom)
                : photo(car.image, 2400),
            }}
            src={publicVehicle?.photos.length ? undefined : photo(car.image, 2400)}
            draggable={false}
            alt={`${car.brand} ${car.model}${publicVehicle ? '' : ' — fotografia ilustrativa'}`}
          />{/if}
        <div class="viewer-controls">
          <button
            class="dialog-close icon-button"
            onclick={() => galleryDialog.close()}
            aria-label="Fechar fotografia"><X size={25} aria-hidden="true" /></button
          >
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
      <p id="gallery-caption">
        {car.brand}
        {car.model}{isContactSlide
          ? ' · Fale connosco'
          : publicVehicle
            ? ' · ' + (zoom + 1) + ' / ' + galleryPhotoCount
            : ' / FOTOGRAFIA ILUSTRATIVA'}
      </p>
      {#if publicVehicle && galleryPhotoCount}
        <div
          class="viewer-thumbnails"
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
                {...thumbnailAttrs(viewerThumbnailSession!, sizedPhoto(publicPhoto(publicVehicle, i), 320))}
                use:publicThumbnail={{
                  session: viewerThumbnailSession!, index: i,
                  src: sizedPhoto(publicPhoto(publicVehicle, i), 320),
                  srcset: vehiclePhotoSet(publicPhoto(publicVehicle, i)),
                  sizes: '(max-width:600px) 64px, 80px',
                  onReady: () => viewerThumbnailReady(i),
                  minimumWidth: 80,
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
            <img {...thumbnailAttrs(viewerThumbnailSession!, sizedPhoto(publicPhoto(publicVehicle, 0), 320))}
              use:publicThumbnail={{ session: viewerThumbnailSession!, index: 0,
                src: sizedPhoto(publicPhoto(publicVehicle, 0), 320),
                sizes: '(max-width:600px) 64px, 80px',
                onReady: () => viewerThumbnailReady(galleryPhotoCount), minimumWidth: 80 }}
              draggable={false} alt="" loading="eager" />
            <span>Fale connosco</span>
          </button>
        </div>
      {/if}
    {/if}
  </dialog>
</div>

{#snippet vehicleCard(
  vehicle: CatalogCar | PublicCard | null,
  index: number,
  animate: boolean = true,
)}
  <article
    class="vehicle-card"
    class:public-card={!!vehicle && 'approved' in vehicle}
    class:pending-card={!vehicle}
    aria-hidden={!vehicle ? 'true' : undefined}
    use:conditionalEntrance={vehicle && animate ? (index % 2) * 110 : false}
  >
    {#if vehicle}
      <div class="card-photo">
        <a class="card-image" href={'href' in vehicle ? vehicle.href : '/viaturas'}
          data-photo-count={'photoCount' in vehicle ? vehicle.photoCount : undefined}
          ><img
            use:coverPhotoSizes
            use:vehiclePhoto={{
              src: photo(vehicle.image, 1100),
              srcset: responsivePhoto(vehicle.image, 1600),
            }}
            src={photo(vehicle.image, 1100)}
            srcset={responsivePhoto(vehicle.image, 1600)}
            sizes={'approved' in vehicle ? publicCardImageSizes(vehicle.photoDimensions, catalog) : cardImageSizes}
            alt={`${vehicle.brand} ${vehicle.model}${'approved' in vehicle ? (vehicle.image === catalogPlaceholder ? ' — imagem indisponível' : '') : ' — imagem ilustrativa'}`}
            loading="lazy"
          />{#if vehicle.category}<span class="image-category">{vehicle.category}</span>{/if}<span
            class="card-arrow"><ArrowUpRight size={23} aria-hidden="true" /></span
          ></a
        >
        {#if 'approved' in vehicle}<div class="card-compare">
            <CompareButton id={vehicle.id} name={`${vehicle.brand} ${vehicle.model}`} overlay />
          </div>{/if}
      </div>
      <div class="card-body">
        <div class="card-info">
          <a class="card-detail-link" href={'href' in vehicle ? vehicle.href : '/viaturas'}
            data-photo-count={'photoCount' in vehicle ? vehicle.photoCount : undefined}
            ><h3>{vehicle.brand} {vehicle.model}</h3>
            {#if 'version' in vehicle && vehicle.version}<span class="card-version"
                >{vehicle.version}</span
              >{/if}</a
          >
          <div class="card-favorite">
            {#if 'approved' in vehicle}<FavoriteButton
                id={vehicle.id}
                name={`${vehicle.brand} ${vehicle.model}`}
              />{:else}<button
                class="save"
                class:saved={saved.includes(vehicle.id)}
                onclick={() => toggleSave(vehicle.id)}
                aria-label={`${saved.includes(vehicle.id) ? 'Remover' : 'Guardar'} ${vehicle.brand} ${vehicle.model}`}
                aria-pressed={saved.includes(vehicle.id)}
                ><Heart
                  size={18}
                  fill={saved.includes(vehicle.id) ? 'currentColor' : 'none'}
                  aria-hidden="true"
                /></button
              >{/if}
          </div>
        </div>
        <div class="card-price">
          <strong>{'approved' in vehicle ? publicPrice(vehicle.price) : eur(vehicle.price)}</strong>
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
            >{number(vehicle.km)} km</span
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

<style>
  .design.orbit-home main :global(.home-services + .orbit-perspective) {
    margin-top: 0;
  }
  .home-choice-group {
    padding-top: var(--orbit-space-section, 86px);
  }
  .home-choice-group :global(.next-steps) {
    padding-top: 0;
    margin-top: calc(var(--orbit-space-half, 40px) * 1.5);
    margin-bottom: calc(var(--orbit-space-half, 40px) * 2.5);
  }
  .home-choice-group + :global(.editorial-pause) {
    margin-top: var(--orbit-space-section, 86px);
  }
  .home-choice-after-visit {
    padding-top: var(--orbit-space-half, 40px);
    padding-bottom: var(--orbit-space-section, 86px);
  }
  @media (min-width: 701px) {
    .home-choice-after-visit {
      /* Account for the invitation's trailing pad without making the pause too long. */
      padding-top: calc(clamp(16px, 2vw, 32px) + var(--orbit-space-section, 86px));
    }
  }
  .home-choice-group :global(.reviews) {
    padding-top: calc(var(--orbit-space-half, 40px) * 1.5);
    padding-bottom: 0;
  }
  .pending-line {
    display: block;
    min-width: 100px;
    color: transparent;
    background: var(--surface);
    border-radius: 3px;
  }
  .pending-card .card-image {
    background: var(--surface);
  }
  .vehicle-description {
    grid-column: 1;
    min-width: 0;
    padding-block: 28px 40px;
    border-top: 1px solid var(--line);
    color: var(--ink, var(--text));
  }
  .vehicle-description h2 {
    margin: 0 0 20px;
    font-size: clamp(22px, 2vw, 30px);
    font-weight: 500;
    letter-spacing: -0.03em;
  }
  .vehicle-photo-stage {
    position: relative;
  }
  .detail-photo-favorite,
  .detail-photo-compare {
    position: absolute;
    z-index: 3;
  }
  .detail-photo-favorite {
    top: 12px;
    right: 12px;
  }
  .detail-photo-compare {
    bottom: 12px;
    left: 12px;
  }
  .photo-step {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    border: 1px solid #ffffff60;
    border-radius: 50%;
    background: #111a;
    color: white;
    cursor: pointer;
  }
  .photo-previous {
    left: 12px;
  }
  .photo-next {
    right: 12px;
  }
  .photo-step[aria-disabled='true'] {
    opacity: 0.35;
    cursor: default;
  }
  .photo-step:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 3px;
  }
  @media (hover: hover) {
    .photo-step:not([aria-disabled='true']):hover {
      background: #3c3c38;
      color: #fff;
      transform: translateY(-50%) scale(1.06);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .photo-step {
      transition:
        background-color 180ms ease,
        color 180ms ease,
        border-color 180ms ease,
        transform 180ms ease;
    }
  }
  @media (max-width: 700px) {
    .photo-next {
      right: 12px;
    }
  }
  .home-brands {
    width: var(--orbit-frame);
    max-width: var(--orbit-frame-max);
    margin: var(--orbit-space-section) auto 0;
  }
  .nav-favorites {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    color: var(--text);
    border-radius: 50%;
  }
  .nav-favorites.filled {
    color: var(--red);
  }
  .nav-favorites[aria-current='page'] {
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }
  .favorite-heart {
    position: relative;
    display: inline-flex;
    flex: 0 0 19px;
    width: 19px;
    height: 19px;
  }
  .nav-favorites .favorite-count {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding-bottom: 2px;
    color: #fff;
    font-size: 7px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
  .nav-favorites .favorite-count.compact {
    font-size: 5.5px;
  }
  .nav-favorites .favorite-count.empty {
    visibility: hidden;
  }
  .favorite-label {
    display: none;
    color: var(--text);
  }
  @media (min-width: 1001px) {
    .design.orbit .header-actions {
      gap: 12px;
    }
    .nav-favorites {
      display: inline-flex;
      gap: 8px;
      width: auto;
      padding-inline: 14px;
      border-radius: 999px;
      font-size: 12px;
      text-decoration: none;
    }
    .favorite-label {
      display: inline;
    }
    .nav-favorites:hover {
      background: color-mix(in srgb, var(--text) 5%, transparent);
    }
  }
  .nav-favorites:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 3px;
  }
  .mobile-theme {
    display: none;
  }
  @media (max-width: 700px) {
    .desktop-theme {
      display: none;
    }
    .mobile-theme {
      display: block;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .mobile-theme :global(button) {
      min-height: 44px;
      gap: 9px;
    }
    .design.orbit .stand-header .logo {
      width: 96px;
      flex-basis: 96px;
      padding: 0;
    }
    .design.orbit .stand-header .logo img {
      width: 100%;
    }
    .design.orbit > header.stand-header {
      padding-inline: 16px;
      gap: 8px;
    }
  }
  .comparison-nav-content {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding-right: 29px;
  }
  .comparison-count {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    margin-block: auto;
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    border: 1px solid var(--line);
    border-radius: 50%;
    font-size: 10px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .has-comparison .comparison-count {
    background: var(--red);
    border-color: var(--red);
    color: white;
  }
  .nav-phone-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    line-height: 1.1;
  }
  .nav-phone-number {
    font-size: 10px;
    letter-spacing: 0.01em;
    font-weight: 400;
    white-space: nowrap;
  }
  @media (max-width: 1000px) {
    .nav-phone-number {
      display: none;
    }
  }
  .card-compare {
    margin-top: 4px;
  }
  .detail-compare {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .purchase-followup {
    display: grid;
    gap: 16px;
    margin-top: 16px;
  }
  .purchase-followup .detail-compare {
    margin-top: 0;
    align-items: center;
  }
  .purchase .trade-in-contact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    min-height: 68px;
    padding: 14px 16px;
    margin-bottom: 12px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: color-mix(in srgb, var(--text) 2%, transparent);
    color: var(--text);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .trade-in-contact > span {
    display: grid;
    gap: 4px;
  }
  .trade-in-contact strong {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }
  .trade-in-contact small {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .trade-in-contact :global(svg) {
    flex-shrink: 0;
  }
  .trade-in-contact:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 3px;
  }
  .purchase-followup .fine-print {
    margin: 0;
  }
  @media (hover: hover) {
    .purchase .trade-in-contact:hover {
      border-color: color-mix(in srgb, var(--text) 35%, transparent);
      background: color-mix(in srgb, var(--text) 5%, transparent);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .trade-in-contact {
      transition:
        background-color 180ms ease,
        border-color 180ms ease;
    }
  }
  @media (min-width: 701px) and (max-width: 1050px) {
    .design.orbit .stand-header nav {
      gap: 18px;
    }
  }
  @media (max-width: 380px) {
    .design.orbit > header.stand-header {
      padding-inline: 8px;
      gap: 4px;
    }
    .design.orbit .stand-header .logo {
      width: 78px;
      flex-basis: 78px;
      padding: 0;
    }
    .design.orbit .stand-header .logo img {
      width: 100%;
    }
    .design.orbit .nav-phone {
      gap: 6px;
      padding-inline: 8px;
    }
    .nav-phone-number {
      font-size: 9px;
    }
  }
  .design.orbit {
    font-family: 'Orbit Inter', Arial, sans-serif;
  }
  .home-basic-filters {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
  .home-clear {
    justify-self: start;
    color: var(--muted);
    min-height: 44px;
    font-size: 12px;
    padding: 0;
    text-decoration: underline;
  }
  .home-clear:disabled {
    opacity: 0.4;
  }
  @media (max-width: 700px) {
    .home-basic-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
  }
  .design.orbit-catalog,
  .design.orbit-privacy {
    --orbit-frame: min(96%, calc(100% - 48px));
  }
  .design.orbit.orbit-company {
    --company-nav-height: 94px;
  }
  .design.orbit.orbit-company header {
    position: sticky;
    top: 0;
    height: var(--company-nav-height);
    min-height: var(--company-nav-height);
    box-sizing: border-box;
    z-index: 60;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    transform: none;
  }
  .design.orbit.orbit-company :global(#contactos) {
    scroll-margin-top: calc(var(--company-nav-height) + 20px);
  }
  @media (max-width: 700px) {
    .design.orbit.orbit-company {
      --company-nav-height: 82px;
    }
  }
  .design.orbit-catalog header,
  .design.orbit-privacy header {
    padding-inline: max(24px, 2%, calc((100% - var(--orbit-frame-max)) / 2));
  }
  @media (max-width: 700px) {
    .design.orbit-catalog,
    .design.orbit-privacy {
      --orbit-frame: 90%;
    }
    .design.orbit-catalog header,
    .design.orbit-privacy header {
      padding-inline: 5%;
    }
  }
  .design {
    --bg: #f3f3ef;
    --surface: #fff;
    --text: #171719;
    --muted: #6b6b70;
    --line: #17171924;
    --red: #e30613;
    --mx: 0;
    --my: 0;
    --p: 0;
    --enter: 1;
    --through: 0;
    background: var(--bg);
    color: var(--text);
    font:
      400 14px/1.5 'Inter',
      sans-serif;
    overflow: clip;
    color-scheme: light;
  }
  :global(:where(html)[data-theme='light']) .design.orbit {
    --bg: #f5f5f1;
  }
  :global(:where(html)[data-theme='dark']) .design {
    --bg: #0c0c0e;
    --surface: #17171a;
    --text: #f5f5f1;
    --muted: #96969d;
    --line: #ffffff24;
    color-scheme: dark;
  }
  .design * {
    box-sizing: border-box;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  button,
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
  }
  button {
    background: none;
    border: 0;
    cursor: pointer;
  }
  button,
  a,
  input,
  select,
  textarea {
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 5px;
  }
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  h1,
  h2 {
    letter-spacing: -0.075em;
    line-height: 1.02;
    font-weight: 500;
  }
  h2 {
    font-size: clamp(40px, 4.3vw, 72px);
  }
  h3 {
    font-weight: 500;
  }
  button:disabled {
    cursor: default;
  }
  img {
    max-width: 100%;
  }
  .read-line {
    position: fixed;
    inset: 0 0 auto;
    height: 2px;
    background: var(--red);
    transform: scaleX(var(--reading, 0));
    transform-origin: left;
    z-index: 100;
    pointer-events: none;
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 9px;
    letter-spacing: 0.13em;
    font-weight: 500;
    line-height: 1.6;
  }
  .muted {
    color: var(--muted);
  }
  header {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 108px;
    padding: 0 4%;
    border-bottom: 1px solid var(--line);
    gap: 30px;
  }
  .logo {
    width: 156px;
    background: white;
    border-radius: 3px;
    padding: 4px 7px;
    flex-shrink: 0;
  }
  .logo img {
    width: 100%;
    height: auto;
    display: block;
  }
  .orbit .logo {
    background: transparent;
  }
  nav {
    display: flex;
    gap: 38px;
    align-items: center;
    font-size: 11px;
  }
  @media (min-width: 701px) {
    .design :global(.visit-invitation + .orbit-faq) {
      margin-top: clamp(32px, 4vw, 64px);
    }
    #stand-navigation > a {
      min-height: 44px;
      padding-inline: 6px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      letter-spacing: -0.015em;
      text-decoration: none;
      white-space: nowrap;
    }
    #stand-navigation > a::after {
      content: none;
    }
    #stand-navigation .nav-label {
      position: relative;
    }
    #stand-navigation .nav-label::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      width: 100%;
      height: 2px;
      bottom: -9px;
      background: var(--red);
      opacity: 1;
      transform: scaleX(0);
      transform-origin: left;
    }
    #stand-navigation > a[aria-current='page'] {
      color: var(--text);
    }
    #stand-navigation > a[aria-current='page'] .nav-label::after {
      opacity: 0.7;
      transform: scaleX(1);
    }
    #stand-navigation > a:focus-visible .nav-label::after {
      opacity: 1;
      transform: scaleX(1);
    }
    @media (hover: hover) {
      #stand-navigation > a:hover .nav-label::after {
        opacity: 1;
        transform: scaleX(1);
      }
    }
    @media (prefers-reduced-motion: no-preference) {
      #stand-navigation .nav-label::after {
        transition: transform 180ms ease-out;
      }
    }
    #stand-navigation > a:focus-visible {
      outline: 2px solid var(--text);
      outline-offset: 3px;
      border-radius: 2px;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .edition-label {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .icon-button {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1px solid var(--line);
    border-radius: 50%;
  }
  .mobile-menu {
    display: none;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    background: var(--text);
    color: var(--bg);
    padding: 17px 24px;
    border-radius: 50px;
    font-size: 11px;
    transition:
      transform 0.25s,
      background 0.25s;
  }
  .pill:hover {
    transform: translateY(-3px);
    background: var(--red);
    color: white;
  }
  .pill.primary {
    background: var(--red);
    color: white;
  }
  /* Orbit: a suspended photographic object in a scroll-controlled space. */
  /* Flux: broad typographic opening with an unfolding triptych. */

  .showroom {
    padding: 100px 4%;
    scroll-margin-top: 25px;
  }
  .showroom-heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    margin-bottom: 50px;
    gap: 25px;
  }

  .showroom-heading h2 {
    font-size: clamp(40px, 4.7vw, 72px);
  }
  .showroom-heading h2 > .heading-period {
    color: var(--red);
  }

  .showroom-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 60px;
  }
  .catalog-controls {
    position: sticky;
    top: 35px;
    align-self: start;
  }

  .catalog-note {
    font-size: 10px;
    line-height: 1.8;
    color: var(--muted);
    border-top: 1px solid var(--line);
    padding-top: 25px;
  }
  .car-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 55px 28px;
  }
  .vehicle-card {
    min-width: 0;
  }
  .vehicle-card,
  .related-grid > a {
    border-radius: 4px;
    outline: 1px solid color-mix(in srgb, var(--text) 22%, var(--bg));
    outline-offset: 0;
  }
  .related-grid > a:focus-visible {
    outline: 2px solid var(--red);
  }
  .card-image {
    display: block;
    position: relative;
    aspect-ratio: 1.5;
    overflow: hidden;
    background: var(--surface);
    border-radius: 4px;
  }
  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: translateZ(0) scale(1);
    transition: transform 650ms cubic-bezier(0.2, 0.75, 0.55, 1);
  }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    .vehicle-card:hover .card-image img {
      transform: translateZ(0) scale(1.035);
    }
  }
  .image-category {
    position: absolute;
    top: 16px;
    left: 16px;
    background: #ffffffeb;
    color: #171719;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 8px;
  }
  .card-arrow {
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: #fff;
    color: #171719;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    transition: rotate 0.3s;
  }
  .card-image:hover .card-arrow {
    rotate: 45deg;
  }
  .card-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 22px;
  }
  .card-info > a > span {
    color: var(--muted);
    font-size: 10px;
  }
  .card-info h3 {
    font-size: 27px;
    letter-spacing: -0.05em;
  }
  .save {
    color: var(--muted);
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
  }
  .save.saved {
    color: var(--red);
  }
  .card-specs {
    display: flex;
    gap: 0;
    font-size: 10px;
    color: var(--muted);
    margin-top: 13px;
  }
  .card-specs > span + span:before {
    content: '·';
    padding: 0 12px;
  }
  .card-price {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--line);
    padding-top: 18px;
    margin-top: 20px;
    gap: 15px;
  }
  .card-price strong {
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.04em;
  }
  .no-results {
    grid-column: 1/-1;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
    gap: 25px;
  }
  .no-results h3 {
    font-size: 35px;
    letter-spacing: -0.05em;
  }
  .no-results button {
    display: flex;
    align-items: center;
    gap: 25px;
    border-bottom: 1px solid;
    padding: 0 0 12px;
  }

  .about {
    padding: 140px 7%;
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 10%;
  }

  .about-head h2 {
    font-size: clamp(45px, 5.5vw, 85px);
  }
  .about-head h2 > span {
    color: var(--muted);
  }
  .about-content {
    padding-top: 47px;
  }
  .about-content > p {
    font-size: 19px;
    line-height: 1.65;
    letter-spacing: -0.025em;
    max-width: 460px;
  }
  .about-content > p.muted {
    font-size: 13px;
    margin-top: 25px;
    line-height: 1.8;
    letter-spacing: 0;
  }
  .about-content .conversation-pill {
    margin-top: 30px;
  }
  .about-signature {
    margin-top: 50px;
    border-top: 1px solid var(--line);
    padding-top: 20px;
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    gap: 20px;
  }
  .about-signature span:last-child {
    color: var(--muted);
  }
  .services {
    padding: 20px 4% 90px;
  }
  .services > .kicker {
    padding-bottom: 25px;
  }
  .services > div {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid var(--line);
  }
  .services article {
    padding: 32px 35px 20px 0;
  }
  .services article + article {
    border-left: 1px solid var(--line);
    padding-left: 35px;
  }
  .services article > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: var(--red);
  }
  .services h3 {
    font-size: 25px;
    letter-spacing: -0.04em;
    margin: 30px 0 20px;
  }
  .services p {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    max-width: 330px;
  }
  .services button {
    display: flex;
    gap: 30px;
    align-items: center;
    font-size: 10px;
    padding: 0;
    border: 0;
    margin-top: 30px;
  }

  /* Vehicle pages retain the visual language of their respective edition. */
  .breadcrumbs {
    padding: 30px 4%;
    display: flex;
    justify-content: space-between;
    gap: 25px;
    align-items: center;
    font-size: 10px;
    color: var(--muted);
  }
  .breadcrumbs a,
  .breadcrumbs button {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .breadcrumbs button.saved {
    color: var(--red);
  }
  .vehicle-layout {
    display: grid;
    grid-template-columns: 1.7fr 1fr;
    gap: 5%;
    padding: 20px 4% 80px;
  }
  .vehicle-photography {
    min-width: 0;
  }
  .vehicle-photo {
    position: relative;
    display: block;
    width: 100%;
    height: 650px;
    overflow: hidden;
    padding: 0;
    background: var(--surface);
    border-radius: 5px;
  }
  .vehicle-photo > img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(var(--zoom));
    transition:
      transform 0.7s,
      object-position 0.7s;
  }
  .photo-counter {
    position: absolute;
    left: 25px;
    bottom: 25px;
    display: flex;
    align-items: center;
    gap: 22px;
    font-size: 11px;
    color: white;
    text-shadow: 0 1px 5px #000;
  }
  .photo-counter > span {
    font-size: 8px;
    letter-spacing: 0.1em;
  }
  .expand {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #fff;
    color: #111;
  }
  .photo-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    gap: 15px;
    margin-top: 18px;
    color: var(--muted);
  }
  .photo-controls button {
    font-size: 9px;
    padding: 8px 10px;
    border-bottom: 1px solid transparent;
  }
  .photo-controls button.active {
    color: var(--text);
    border-color: var(--red);
  }
  .purchase {
    position: sticky;
    top: 40px;
    align-self: start;
    padding-top: 18px;
  }
  .purchase h1 {
    font-size: clamp(45px, 4.5vw, 75px);
    margin: 27px 0 18px;
  }
  .purchase h1 > span {
    color: var(--muted);
  }
  .model-line {
    font-size: 12px;
    color: var(--muted);
  }
  .purchase-price {
    margin-top: 40px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .purchase-price > span {
    font-size: 9px;
    color: var(--muted);
  }
  .purchase-price strong {
    font-size: 43px;
    letter-spacing: -0.06em;
    font-weight: 500;
  }
  .quick-specs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 22px 0;
    margin: 24px 0;
  }
  .quick-specs > span {
    font-size: 16px;
    letter-spacing: -0.03em;
  }
  .quick-specs small {
    display: block;
    color: var(--muted);
    font-size: 8px;
    letter-spacing: 0;
    margin-top: 5px;
  }
  .purchase .pill {
    width: 100%;
    margin-top: 5px;
  }
  .secondary-contact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    padding: 20px 0;
    width: 100%;
  }
  .fine-print {
    font-size: 9px;
    color: var(--muted);
    line-height: 1.8;
    max-width: 310px;
  }
  .detail-facts {
    display: grid;
    grid-template-columns: 1fr 1.3fr;
    gap: 8%;
    padding: 50px 7% 100px;
  }
  .detail-facts h2 {
    font-size: 50px;
  }
  .detail-facts h2 > span {
    color: var(--muted);
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 35px;
  }
  dl > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 0;
    border-top: 1px solid var(--line);
    gap: 15px;
  }
  dt {
    font-size: 10px;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-size: 12px;
    text-align: right;
  }
  .detail-band {
    height: 650px;
    position: relative;
    overflow: hidden;
    color: #fff;
    background: #111;
  }
  .detail-band > img {
    width: 100%;
    height: 115%;
    object-fit: cover;
    filter: brightness(0.45);
    margin-top: -5%;
  }
  .detail-band > div {
    position: absolute;
    left: 7%;
    top: 18%;
    z-index: 2;
  }
  .detail-band h2 {
    font-size: clamp(65px, 8vw, 125px);
    margin: 25px 0 35px;
  }
  .band-index {
    position: absolute;
    right: 6%;
    bottom: 8%;
    font-size: 200px;
    font-weight: 400;
    line-height: 1;
    color: #ffffff60;
  }
  :global(.motion-on) .detail-band > img {
    transform: translateY(calc((var(--through) - 0.5) * 65px));
  }
  :global(.motion-on) .band-index {
    transform: rotate(calc(var(--through) * 30deg));
  }
  .equipment {
    padding: 100px 7%;
    display: grid;
    grid-template-columns: 1fr 1.3fr;
    gap: 8%;
  }
  .equipment h2 {
    font-size: 50px;
  }

  .related {
    padding: 30px 4% 110px;
  }
  .related > .kicker {
    margin-bottom: 22px;
  }
  .related h2 {
    font-size: 50px;
  }
  .related-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 25px;
    margin-top: 40px;
  }
  .related-grid > a > .related-image {
    position: relative;
    overflow: hidden;
    aspect-ratio: 1.5;
    border-radius: 4px;
  }
  .related-grid img {
    height: 100%;
    width: 100%;
    object-fit: cover;
    transition: transform 0.8s;
  }
  .related-grid a:hover img {
    transform: scale(1.05);
  }
  .related-grid > a > .related-image > span {
    position: absolute;
    right: 15px;
    bottom: 15px;
    background: #fff;
    color: #111;
    width: 35px;
    height: 35px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .related-grid h3 {
    font-size: 22px;
    letter-spacing: -0.05em;
    margin-top: 17px;
  }
  .related-grid p {
    font-size: 10px;
    color: var(--muted);
    margin-top: 8px;
  }

  .not-found.known-unavailable {
    padding: var(--orbit-space-section) 0;
  }
  .not-found {
    padding: 80px 7%;
  }
  .error-description {
    max-width: 54ch;
    font-size: 17px;
    line-height: 1.7;
    color: var(--muted);
  }
  .error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 30px;
  }
  .error-actions a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  .not-found h1 {
    font-size: clamp(40px, 6vw, 85px);
    margin: 25px 0 40px;
  }
  dialog {
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 9px;
    padding: 45px;
    max-height: 90svh;
    overflow: auto;
  }
  dialog::backdrop {
    background: #000b;
    backdrop-filter: blur(12px);
  }
  .contact-dialog {
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(520px, calc(100vw - 32px));
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 32px);
    overscroll-behavior: contain;
    padding: 36px;
  }
  .dialog-close {
    position: absolute;
    top: 15px;
    right: 15px;
  }
  .contact-dialog > .kicker {
    margin-bottom: 22px;
    padding-right: 36px;
  }
  .contact-dialog h2 {
    font-size: 48px;
    margin-bottom: 22px;
  }
  .contact-dialog > p:not(.kicker) {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 22px;
  }
  .contact-dialog form {
    margin-top: 25px;
  }
  .contact-dialog label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 16px 0;
    font-size: 10px;
  }
  .contact-dialog input,
  .contact-dialog select,
  .contact-dialog textarea {
    background: var(--bg);
    border: 1px solid var(--line);
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    width: 100%;
  }
  .contact-dialog textarea {
    resize: vertical;
  }
  .contact-dialog input:focus-visible,
  .contact-dialog select:focus-visible,
  .contact-dialog textarea:focus-visible {
    outline: none;
  }
  .contact-dialog :is(input, select, textarea) {
    border-width: 1px;
  }
  .contact-dialog .dialog-close {
    width: 44px;
    height: 44px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
  }
  .contact-dialog .dialog-close:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 3px;
  }
  @media (hover: hover) {
    .contact-dialog :is(input, select, textarea):hover {
      background: color-mix(in srgb, var(--bg) 94%, var(--text));
      border-color: color-mix(in srgb, var(--line) 55%, var(--text));
      box-shadow: 0 0 12px color-mix(in srgb, var(--text) 3%, transparent);
    }
    .contact-dialog .dialog-close:hover {
      color: var(--red);
      border-color: var(--red);
      background: color-mix(in srgb, var(--text) 7%, transparent);
    }
  }
  .contact-dialog :is(input, select, textarea):focus {
    box-shadow: inset 0 0 0 0.35px var(--text);
    background: color-mix(in srgb, var(--bg) 92%, var(--text));
    border-color: var(--text);
    outline: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .contact-dialog .dialog-close {
      transition:
        color 160ms ease,
        background-color 160ms ease,
        border-color 160ms ease;
    }
    .contact-dialog :is(input, select, textarea) {
      transition:
        background-color 180ms ease,
        border-color 180ms ease,
        box-shadow 180ms ease;
    }
    .contact-dialog[open] {
      animation: contact-arrive 220ms ease-out;
    }
    @keyframes contact-arrive {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  }
  .contact-dialog .pill {
    width: 100%;
    margin-top: 10px;
  }
  .gallery-dialog {
    background: #111;
    color: white;
    padding: 45px 25px 20px;
    width: 95vw;
    max-width: 1800px;
  }
  .gallery-dialog img {
    width: 100%;
    height: 75svh;
    object-fit: contain;
  }
  .gallery-dialog p {
    font-size: 9px;
    letter-spacing: 0.1em;
    padding-top: 15px;
    text-align: center;
  }
  @media (min-width: 1800px) {
    .showroom,
    .about,
    .services,
    .detail-facts,
    .equipment,
    .related {
      padding-left: calc((100vw - 1650px) / 2);
      padding-right: calc((100vw - 1650px) / 2);
    }
  }
  @media (max-width: 1100px) {
    nav {
      gap: 25px;
    }
    .edition-label {
      display: none;
    }

    .showroom-layout {
      grid-template-columns: 160px 1fr;
      gap: 35px;
    }

    .car-grid {
      gap: 40px 22px;
    }
    .card-info h3 {
      font-size: 24px;
    }
    .card-specs {
      font-size: 9px;
    }
    .card-specs > span + span:before {
      padding: 0 8px;
    }
    .about {
      padding: 100px 4%;
      gap: 6%;
    }
    .services h3 {
      font-size: 22px;
    }
    .vehicle-layout {
      grid-template-columns: 1.3fr 1fr;
      gap: 4%;
    }
    .vehicle-photo {
      height: 570px;
    }

    .detail-facts,
    .equipment {
      padding-inline: 4%;
      gap: 5%;
    }
    .detail-facts h2,
    .equipment h2 {
      font-size: 40px;
    }
  }
  @media (max-width: 700px) {
    header {
      height: 86px;
      padding: 0 5%;
      gap: 20px;
    }
    .logo {
      width: 138px;
    }
    .header-actions {
      gap: 10px;
    }
    .mobile-menu {
      display: grid;
    }
    nav {
      display: none;
      position: absolute;
      top: 86px;
      left: 0;
      right: 0;
      padding: 25px 5%;
      background: var(--bg);
      border-bottom: 1px solid var(--line);
      font-size: 13px;
    }
    nav.open {
      display: flex;
      flex-direction: column;
      align-items: start;
    }
    .kicker {
      font-size: 8px;
    }
    .pill {
      padding: 15px 20px;
      font-size: 10px;
    }

    .showroom {
      padding: 60px 5%;
    }
    .showroom-heading {
      gap: 20px;
      margin-bottom: 30px;
    }
    .showroom-heading h2 {
      font-size: 42px;
    }

    .showroom-layout {
      display: block;
    }
    .catalog-controls {
      position: static;
      margin-bottom: 30px;
    }

    .catalog-note {
      display: none;
    }
    .car-grid {
      grid-template-columns: 1fr;
      gap: 35px;
    }

    .card-image {
      aspect-ratio: 1.45;
    }
    .card-info h3 {
      font-size: 27px;
    }
    .card-info {
      margin-top: 17px;
    }
    .card-specs {
      font-size: 10px;
    }
    .card-price {
      margin-top: 16px;
      padding-top: 15px;
    }
    .card-price strong {
      font-size: 22px;
    }

    .about {
      padding: 70px 5%;
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .about-head h2 {
      font-size: 49px;
    }
    .about-content {
      padding: 0;
    }
    .about-content > p {
      font-size: 17px;
    }
    .about-signature {
      margin-top: 35px;
      font-size: 7px;
    }
    .services {
      padding: 0 5% 55px;
    }
    .services > div {
      grid-template-columns: 1fr;
    }
    .services article,
    .services article + article {
      padding: 27px 0;
      border-left: 0;
      border-bottom: 1px solid var(--line);
    }
    .services h3 {
      font-size: 27px;
      margin: 22px 0 15px;
    }
    .services p {
      max-width: none;
    }

    .breadcrumbs {
      padding: 23px 5%;
      font-size: 9px;
      gap: 15px;
    }
    .breadcrumbs > span {
      display: none;
    }
    .vehicle-layout {
      display: flex;
      flex-direction: column;
      padding: 10px 5% 45px;
      gap: 30px;
    }
    .vehicle-photo {
      height: 380px;
    }
    .purchase {
      position: static;
      padding-top: 0;
      width: 100%;
    }
    .purchase h1 {
      font-size: 58px;
    }
    .purchase-price {
      margin-top: 25px;
    }
    .purchase-price strong {
      font-size: 40px;
    }
    .quick-specs {
      margin-top: 20px;
    }
    .fine-print {
      max-width: none;
    }
    .photo-controls {
      font-size: 9px;
      gap: 10px;
      flex-wrap: wrap;
    }
    .photo-controls button {
      font-size: 8px;
      padding: 8px;
    }
    .photo-counter {
      left: 18px;
      bottom: 22px;
      font-size: 10px;
      gap: 15px;
    }
    .photo-counter > span {
      font-size: 6px;
    }
    .detail-facts {
      padding: 30px 5% 55px;
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .detail-facts h2 {
      font-size: 42px;
    }
    dl {
      gap: 0 20px;
    }
    dl > div {
      gap: 10px;
      align-items: start;
    }
    dt {
      font-size: 9px;
    }
    dd {
      font-size: 10px;
    }
    .detail-band {
      height: 550px;
    }
    .detail-band h2 {
      font-size: 65px;
    }
    .detail-band > div {
      left: 6%;
      top: 17%;
    }
    .band-index {
      font-size: 110px;
      right: 5%;
      bottom: 10%;
    }
    .equipment {
      padding: 60px 5%;
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .equipment h2 {
      font-size: 42px;
    }
    .related {
      padding: 0 5% 60px;
    }
    .related h2 {
      font-size: 40px;
    }
    .related-grid {
      grid-template-columns: 1fr;
      gap: 32px;
      margin-top: 30px;
    }

    .contact-dialog {
      padding: 40px 25px 25px;
    }
    .contact-dialog h2 {
      font-size: 42px;
    }
    .gallery-dialog {
      padding: 50px 10px 20px;
    }
    .gallery-dialog img {
      height: 65svh;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .design * {
      animation: none !important;
      transition: none !important;
    }
    .read-line {
      display: none;
    }
    :global(.motion-on) .detail-band > img,
    :global(.motion-on) .band-index {
      transform: none;
    }
  }
  /* Compact choreography: complete each effect within a short scroll. */
  .design {
    --intro-height: clamp(560px, 76svh, 740px);
    --scene-height: clamp(520px, 72svh, 680px);
  }
  .design header {
    height: 94px;
    padding-inline: max(4%, calc((100vw - 1440px) / 2));
  }

  .showroom {
    max-width: 1440px;
    width: 92%;
    margin: auto;
    padding: 55px 0 65px;
  }
  .showroom-heading {
    margin-bottom: 32px;
  }
  .showroom-heading h2 {
    font-size: clamp(35px, 3.5vw, 53px);
  }

  .showroom-layout {
    grid-template-columns: 180px 1fr;
    gap: 40px;
  }
  .car-grid {
    gap: 36px 25px;
  }

  .card-info h3 {
    font-size: 25px;
  }
  .card-info {
    margin-top: 16px;
  }
  .card-price {
    margin-top: 14px;
    padding-top: 14px;
  }

  .about {
    max-width: 1440px;
    width: 92%;
    margin: auto;
    padding: 75px 0;
    gap: 8%;
  }
  .about-head h2 {
    font-size: clamp(40px, 4.1vw, 62px);
  }
  .about-content > p {
    font-size: 17px;
  }
  .services,
  .related,
  .detail-facts,
  .equipment {
    width: 92%;
    max-width: 1440px;
    margin-inline: auto;
    padding-inline: 0;
  }
  .services {
    padding-bottom: 55px;
  }

  .services h3 {
    font-size: 23px;
    margin: 22px 0 15px;
  }

  .vehicle-layout,
  .breadcrumbs {
    width: 92%;
    max-width: 1440px;
    margin-inline: auto;
    padding-inline: 0;
  }
  .vehicle-photo {
    height: clamp(440px, 64svh, 600px);
  }

  .purchase h1 {
    font-size: clamp(43px, 4vw, 59px);
  }
  .detail-band {
    height: 460px;
    max-width: 1480px;
    width: 94%;
    margin-inline: auto;
  }
  .detail-band h2 {
    font-size: clamp(58px, 6vw, 86px);
  }
  .band-index {
    font-size: 140px;
  }
  @media (min-width: 701px) and (max-width: 1050px) {
    .showroom-layout {
      grid-template-columns: 155px 1fr;
      gap: 25px;
    }
  }
  @media (max-width: 700px) {
    .design {
      --intro-height: max(640px, calc(100svh - 82px));
      --scene-height: 550px;
    }
    .design header {
      height: 82px;
      padding-inline: 5%;
    }
    nav {
      top: 82px;
    }

    .showroom {
      width: 90%;
      padding: 38px 0 45px;
    }
    .showroom-heading h2 {
      font-size: 35px;
    }
    .showroom-layout {
      display: block;
    }

    .car-grid {
      gap: 30px;
    }

    .about {
      width: 90%;
      padding: 50px 0;
    }
    .about-head h2 {
      font-size: 40px;
    }
    .services,
    .related,
    .detail-facts,
    .equipment {
      width: 90%;
    }

    .vehicle-layout,
    .breadcrumbs {
      width: 90%;
    }
    .vehicle-photo {
      height: 340px;
    }

    .detail-band {
      width: 100%;
      height: 420px;
    }
    .detail-band h2 {
      font-size: 59px;
    }
    .band-index {
      font-size: 95px;
    }
  }
  @media (min-width: 701px) {
    .design header {
      padding-inline: max(2.5%, calc((100vw - 1640px) / 2));
    }
    .showroom,
    .about,
    .services,
    .related,
    .detail-facts,
    .equipment,
    .vehicle-layout,
    .breadcrumbs {
      width: 95%;
      max-width: 1640px;
    }
    .detail-band {
      width: 97%;
      max-width: 1720px;
    }
  }
  /* Element-relative destinations remain aligned at every container width. */
  /* Shared scale: useful text stays readable; display type has explicit limits. */
  .design {
    --type-label: 11px;
    --type-small: 12px;
    --type-body: 14px;
    --type-section: clamp(32px, 3.2vw, 50px);
    font-size: var(--type-body);
    line-height: 1.65;
  }
  .design h1,
  .design h2 {
    line-height: 1.08;
    letter-spacing: -0.055em;
    text-wrap: balance;
  }
  .design h3 {
    line-height: 1.25;
    letter-spacing: -0.035em;
  }
  .design .kicker {
    font-size: var(--type-label);
    letter-spacing: 0.1em;
    line-height: 1.55;
  }
  .design .pill {
    min-height: 46px;
    font-size: 13px;
    padding: 13px 22px;
    gap: 20px;
  }
  .design .icon-button {
    width: 42px;
    height: 42px;
  }
  .design header {
    gap: 24px;
  }
  .design .logo {
    width: 150px;
  }
  .design nav {
    font-size: 13px;
    gap: 28px;
  }

  .edition-label {
    font-size: 10px;
  }

  .showroom-heading h2,
  .about-head h2,
  .detail-facts h2,
  .equipment h2,
  .related h2 {
    font-size: var(--type-section);
  }
  .showroom-heading {
    align-items: center;
    gap: 24px;
  }

  .showroom-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 32px;
  }

  .catalog-note {
    font-size: 12px;
    line-height: 1.75;
  }
  .car-grid {
    gap: 36px 24px;
    align-items: start;
  }
  .card-image {
    aspect-ratio: 1.55;
  }
  .card-image img {
    display: block;
  }

  .card-info {
    gap: 12px;
    margin-top: 16px;
  }
  .card-info > a {
    min-width: 0;
  }
  .card-info > a > span {
    font-size: 12px;
  }
  .card-info h3 {
    font-size: clamp(22px, 1.65vw, 27px);
    margin-top: 3px;
  }
  .save {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
  }
  .card-specs {
    flex-wrap: wrap;
    row-gap: 5px;
    font-size: 12px;
    margin-top: 12px;
  }
  .card-specs > span {
    white-space: nowrap;
  }
  .card-specs > span + span:before {
    padding: 0 9px;
  }
  .image-category {
    font-size: 11px;
    top: 13px;
    left: 13px;
    padding: 5px 10px;
  }
  .card-arrow {
    width: 38px;
    height: 38px;
    bottom: 13px;
    right: 13px;
  }
  .card-price {
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
    padding-top: 15px;
  }
  .card-price strong {
    font-size: 23px;
    line-height: 1.2;
  }

  .about {
    padding-block: 68px;
  }
  .about-content {
    padding-top: 38px;
  }
  .about-content > p {
    font-size: 18px;
    line-height: 1.7;
    max-width: 46ch;
  }
  .about-content > p.muted {
    font-size: 14px;
    line-height: 1.8;
    max-width: 54ch;
  }
  .about-signature {
    font-size: 10px;
    gap: 18px;
    flex-wrap: wrap;
  }
  .services article {
    min-width: 0;
  }
  .services article > span {
    font-size: 12px;
  }
  .services h3 {
    font-size: clamp(22px, 1.75vw, 28px);
  }
  .services p {
    font-size: 14px;
    line-height: 1.8;
    max-width: 40ch;
  }
  .services button {
    font-size: 12px;
    min-height: 42px;
    margin-top: 20px;
  }

  .breadcrumbs {
    font-size: 12px;
    padding-block: 24px;
  }
  .breadcrumbs button {
    min-height: 40px;
  }
  .vehicle-layout {
    grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr);
    gap: 36px;
    padding-bottom: 55px;
    align-items: start;
  }
  .vehicle-photo {
    aspect-ratio: 1.5;
    height: auto;
    max-height: 570px;
  }
  .vehicle-photo > img {
    display: block;
  }
  .photo-counter {
    font-size: 12px;
    gap: 15px;
  }
  .photo-counter > span {
    font-size: 10px;
  }
  .photo-controls {
    font-size: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .photo-controls button {
    font-size: 12px;
    min-height: 40px;
    padding: 9px 12px;
  }
  .purchase {
    min-width: 0;
    padding-top: 12px;
  }
  .purchase h1 {
    font-size: clamp(39px, 3.7vw, 56px);
    overflow-wrap: anywhere;
    margin: 22px 0 14px;
  }

  .model-line {
    font-size: 14px;
  }
  .purchase-price {
    margin-top: 26px;
  }
  .purchase-price > span {
    font-size: 12px;
  }
  .purchase-price strong {
    font-size: clamp(33px, 3vw, 43px);
  }
  .quick-specs {
    gap: 14px;
    margin-block: 20px;
    padding-block: 20px;
  }
  .quick-specs > span {
    font-size: clamp(15px, 1.2vw, 19px);
    overflow-wrap: anywhere;
  }
  .quick-specs small {
    font-size: 11px;
    line-height: 1.4;
  }
  .secondary-contact {
    font-size: 12px;
    gap: 15px;
    min-height: 46px;
    line-height: 1.5;
    text-align: left;
  }
  .fine-print {
    font-size: 11px;
    line-height: 1.75;
    max-width: 45ch;
  }
  .detail-facts,
  .equipment {
    gap: 48px;
    padding-block: 55px;
  }
  dl {
    min-width: 0;
    gap: 0 26px;
  }
  dt {
    font-size: 12px;
  }
  dd {
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  dl > div {
    gap: 16px;
    padding-block: 17px;
  }
  .detail-band {
    height: clamp(350px, 48svh, 460px);
  }
  .detail-band h2 {
    font-size: clamp(48px, 5.1vw, 75px);
    line-height: 1.08;
    margin: 20px 0 26px;
  }
  .related {
    padding-block: 30px 65px;
  }
  .related-grid {
    margin-top: 28px;
  }
  .related-grid > a > .related-image {
    aspect-ratio: 1.55;
  }
  .related-grid h3 {
    font-size: 22px;
  }
  .related-grid p {
    font-size: 12px;
  }
  .contact-dialog h2 {
    font-size: clamp(35px, 4vw, 44px);
  }
  .contact-dialog > p:not(.kicker) {
    font-size: 13px;
  }
  .contact-dialog label {
    font-size: 12px;
  }
  .contact-dialog input,
  .contact-dialog select,
  .contact-dialog textarea {
    font-size: 16px;
    min-height: 46px;
  }
  .gallery-dialog p {
    font-size: 11px;
  }
  @media (min-width: 1500px) {
    .car-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (min-width: 701px) and (max-width: 1100px) {
    .design nav {
      gap: 17px;
      font-size: 12px;
    }
    .design .logo {
      width: 142px;
    }
    .design header {
      gap: 18px;
    }
    .showroom-layout {
      display: block;
    }
    .catalog-controls {
      position: static;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px 24px;
      margin-bottom: 26px;
    }

    .catalog-note {
      display: none;
    }
    .vehicle-layout {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 0.9fr);
      gap: 24px;
    }

    .quick-specs {
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .quick-specs > span:last-child {
      grid-column: 1/-1;
    }
    .detail-facts,
    .equipment {
      grid-template-columns: 1fr 1.2fr;
      gap: 28px;
    }
    dl {
      grid-template-columns: 1fr;
    }
    .about {
      gap: 40px;
    }
  }
  @media (max-width: 700px) {
    .design {
      --type-label: 10px;
      --type-section: clamp(30px, 8.4vw, 39px);
    }
    .design h1,
    .design h2 {
      letter-spacing: -0.055em;
    }
    .design .logo {
      width: 135px;
    }
    .design nav {
      font-size: 14px;
    }
    .design .pill {
      font-size: 12px;
      min-height: 46px;
      padding: 12px 18px;
    }

    .showroom-heading {
      align-items: start;
    }
    .showroom-heading h2 {
      max-width: 13ch;
    }

    .car-grid {
      gap: 30px;
    }
    .card-image,
    .related-grid > a > .related-image {
      aspect-ratio: 1.45;
    }
    .card-info h3 {
      font-size: 24px;
    }
    .card-price strong {
      font-size: 23px;
    }

    .about {
      gap: 26px;
      padding-block: 48px;
    }
    .about-content {
      padding-top: 0;
    }
    .about-content > p {
      font-size: 17px;
    }
    .about-content > p.muted {
      font-size: 14px;
    }
    .about-signature {
      font-size: 10px;
    }
    .services h3 {
      font-size: 24px;
    }
    .services p {
      max-width: none;
    }

    .breadcrumbs {
      font-size: 11px;
      padding-block: 16px;
    }
    .vehicle-layout {
      display: flex;
      gap: 24px;
      padding-bottom: 32px;
    }
    .vehicle-photo {
      height: auto;
      aspect-ratio: 1.3;
      max-height: 400px;
    }
    .photo-counter {
      left: 15px;
      bottom: 20px;
      gap: 10px;
      font-size: 11px;
    }
    .photo-counter > span {
      font-size: 8px;
      max-width: 16ch;
      text-align: left;
    }
    .photo-controls {
      font-size: 12px;
    }
    .photo-controls button {
      font-size: 11px;
      padding-inline: 10px;
    }
    .purchase h1 {
      font-size: clamp(37px, 10vw, 48px);
    }

    .purchase-price strong {
      font-size: 36px;
    }
    .quick-specs {
      gap: 10px;
    }
    .quick-specs > span {
      font-size: 16px;
    }
    .quick-specs small {
      font-size: 11px;
    }
    .detail-facts,
    .equipment {
      gap: 28px;
      padding-block: 40px;
    }
    dl {
      grid-template-columns: 1fr;
      gap: 0;
    }
    dt {
      font-size: 12px;
    }
    dd {
      font-size: 13px;
    }
    .detail-band h2 {
      font-size: 49px;
    }
    .related-grid h3 {
      font-size: 23px;
    }
    .related-grid p {
      font-size: 13px;
    }
    .contact-dialog h2 {
      font-size: 36px;
    }
  }
  @media (max-width: 380px) {
    .card-specs {
      font-size: 11px;
    }
    .card-specs > span + span:before {
      padding-inline: 7px;
    }
  }
  /* Orbit's next chapter: a larger photograph, with a separate typographic focal point. */

  @media (prefers-reduced-motion: no-preference) {
    @keyframes orbit-title-arrival {
      from {
        opacity: 0.55;
        translate: 0 12px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }
  }
  /* Preserve the resting composition; the hero now follows natural document scroll. */
  @media (min-width: 701px) and (prefers-reduced-motion: no-preference) {
    /* Mirror heroScrollProgress at scroll zero, before parser-time initialization. */
  }
  @media (prefers-reduced-motion: no-preference) {
    /* Freeze the former initial sticky offset as padding, never as scroll pinning.
       Keep the total scene height so later sections and refresh restoration stay stable. */
  }
  @media (max-width: 700px) {
    .orbit {
      --intro-height: clamp(520px, calc(100svh - 204px), 640px);
    }
  }

  /* Photo stays edge-to-edge; only the information below it receives padding. */
  .design.orbit {
    --vehicle-card-photo-extra: 60px;
    --vehicle-card-hover-shadow: 0 8px 24px color-mix(in srgb, var(--text) 12%, transparent);
  }
  :global(:where(html)[data-theme='dark']) .design.orbit {
    --vehicle-card-hover-shadow: 0 0 22px color-mix(in srgb, var(--text) 12%, transparent);
  }
  .vehicle-card,
  .related-grid > a {
    background: var(--bg);
  }
  .vehicle-card .card-image,
  .related-grid > a > .related-image {
    border-radius: 4px 4px 0 0;
  }
  /* Keep the photo prominent while returning space to a balanced information panel. */
  .vehicle-card {
    container-type: inline-size;
    position: relative;
    isolation: isolate;
    --vehicle-card-title-size: clamp(21px, 1.6vw, 25px);
  }
  .vehicle-card:not(.public-card) {
    --vehicle-card-photo-extra: 32px;
  }
  .card-photo {
    position: relative;
    flex-shrink: 0;
  }
  .vehicle-card .card-compare {
    position: absolute;
    z-index: 2;
    bottom: 12px;
    left: 12px;
    margin: 0;
  }
  .card-favorite {
    position: absolute;
    z-index: 2;
    right: clamp(16px, 1.2vw, 20px);
    top: calc(
      100cqw / 1.4 + var(--vehicle-card-photo-extra) + clamp(16px, 1.2vw, 20px) + 2px +
        var(--vehicle-card-title-size) * 0.625 - 22px
    );
  }
  .card-favorite .save {
    min-width: 44px;
    min-height: 44px;
  }
  /* Native link covers the card; independent controls remain above its hit area. */
  .card-detail-link::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: 4px;
  }
  .card-detail-link:focus-visible::after {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  .vehicle-card .card-compare :global(button) {
    position: relative;
    z-index: 2;
  }
  .vehicle-card .card-image {
    aspect-ratio: auto;
    height: calc(100cqw / 1.4 + var(--vehicle-card-photo-extra));
  }
  .card-body,
  .related-body {
    padding: clamp(16px, 1.2vw, 20px);
  }
  .vehicle-card .card-body {
    padding-block: calc(clamp(16px, 1.2vw, 20px) + 2px);
  }
  .vehicle-card .card-info {
    margin-top: 0;
    align-items: flex-start;
    padding-right: 56px;
  }
  .vehicle-card .card-info h3,
  .related-grid .related-body h3 {
    font-size: clamp(21px, 1.6vw, 25px);
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.035em;
    margin-top: 0;
    overflow-wrap: anywhere;
  }
  .vehicle-card .card-info > a > span,
  .related-brand {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
  }
  .vehicle-card .card-info .card-version {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    font-weight: 400;
    overflow-wrap: anywhere;
  }
  @container (max-width: 360px) {
    .vehicle-card .card-info h3 {
      font-size: calc(var(--vehicle-card-title-size) - 1px);
      line-height: calc(var(--vehicle-card-title-size) * 1.25);
    }
  }
  .vehicle-card .card-specs {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    width: 100%;
    margin-top: 18px;
    gap: 6px 12px;
    font-size: 12px;
    line-height: 1.65;
  }
  .vehicle-card .card-specs > span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    white-space: nowrap;
  }
  .vehicle-card .card-specs > span :global(svg) {
    flex-shrink: 0;
  }
  .vehicle-card .card-specs > span + span:before {
    content: none;
  }
  .vehicle-card .card-price {
    margin-top: 18px;
    border-top: 0;
    padding-top: 0;
    gap: 12px 16px;
  }
  .vehicle-card .card-price::before {
    content: '';
    flex: 1;
    min-width: 12px;
    border-top: 1px solid var(--line);
  }
  .vehicle-card .card-price strong {
    text-align: right;
  }
  .vehicle-card .card-price strong,
  .related-price {
    font-size: clamp(21px, 1.6vw, 25px);
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.035em;
  }
  @media (min-width: 701px) {
    /* Different title lengths keep prices and actions aligned across a row. */
    .vehicle-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .vehicle-card .card-image {
      flex-shrink: 0;
    }
    .vehicle-card .card-body {
      display: flex;
      flex: 1;
      flex-direction: column;
    }
    .vehicle-card .card-specs {
      margin-bottom: 0;
    }
  }
  .related-grid .related-body p {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.65;
  }
  .related-price {
    display: block;
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }
  .vehicle-card:has(:focus-visible) {
    outline-color: color-mix(in srgb, var(--text) 50%, var(--bg));
  }
  .vehicle-card:has(:focus-visible),
  .related-grid > a:focus-visible {
    box-shadow: var(--vehicle-card-hover-shadow);
  }
  .vehicle-card:has(:focus-visible) .card-arrow,
  .related-grid > a:focus-visible > .related-image > span {
    color: #fff;
    background: var(--red);
    rotate: 45deg;
  }
  .card-arrow :global(svg),
  .related-image > span :global(svg) {
    color: inherit;
    stroke: currentColor;
    transition: none;
  }
  .vehicle-card .card-body :is(a, button):focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  @media (hover: hover) {
    .vehicle-card:hover .card-arrow,
    .related-grid > a:hover > .related-image > span {
      color: #fff;
      background: var(--red);
      rotate: 45deg;
    }
    .vehicle-card:hover,
    .related-grid > a:hover {
      outline-color: color-mix(in srgb, var(--text) 40%, var(--bg));
      box-shadow: var(--vehicle-card-hover-shadow);
    }
    .vehicle-card .card-info > a:hover h3 {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 4px;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .vehicle-card,
    .related-grid > a {
      transition:
        outline-color 180ms ease,
        box-shadow 240ms ease;
    }
    .vehicle-card .card-arrow,
    .related-grid > a > .related-image > span {
      transition: rotate 300ms ease;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .vehicle-card .card-arrow,
    .related-grid > a > .related-image > span {
      transition: none;
    }
  }

  .services button > .service-cta-label {
    position: relative;
  }
  .services button > .service-cta-label::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -3px;
    height: 1px;
    background: var(--red);
    transform: scaleX(0);
    transform-origin: left;
  }
  .services button:focus-visible > .service-cta-label::after {
    transform: scaleX(1);
  }
  .services button :global(svg) {
    color: var(--text);
  }
  .services button:focus-visible :global(svg) {
    rotate: 45deg;
  }
  @media (hover: hover) {
    .services button:hover > .service-cta-label::after {
      transform: scaleX(1);
    }
    .services button:hover :global(svg) {
      rotate: 45deg;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .services button > .service-cta-label::after {
      transition: transform 220ms ease;
    }
    .services button :global(svg) {
      transition: rotate 220ms ease;
    }
  }
</style>
