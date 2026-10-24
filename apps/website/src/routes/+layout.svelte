<script lang="ts">
  import '../app.css';
  import NavigationProgress from '../../../../shared/ui/NavigationProgress.svelte';
  import WebsiteIconHead from '$lib/components/WebsiteIconHead.svelte';
  import WhatsAppContact from '$lib/components/WhatsAppContact.svelte';
  import { onMount, setContext, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { afterNavigate, beforeNavigate, goto, pushState } from '$app/navigation';
  import { page } from '$app/stores';
  import { installAnchorNavigation } from '$lib/anchorNavigation';
  import { slugPattern } from '$lib/publicVehicles';
  import { warmNavigationThumbnails, cancelNavigationThumbnails } from '$lib/publicThumbnail';
  let anchors: ReturnType<typeof installAnchorNavigation> | undefined;
  beforeNavigate(({ type, to }) => {
    anchors?.stop();
    cancelNavigationThumbnails();
    if (!browser || type !== 'link' || !to || to.url.origin !== location.origin) return;
    const match = /^\/viaturas\/([^/]+)$/.exec(to.url.pathname);
    if (match?.[1] && match[1].length <= 180 && slugPattern.test(match[1]))
      warmNavigationThumbnails(match[1], innerWidth, devicePixelRatio);
  });
  afterNavigate(({ type, to }) => { if (to) anchors?.afterNavigate(type, to.url); });
  import { comparisonContext, createComparison, COMPARISON_KEY } from '$lib/comparison';
  import { createFavorites, favoritesContext, FAVORITES_KEY } from '$lib/favorites';
  import { createNotifications, notificationContext } from '$lib/notifications';
  import { createPublicTheme, publicThemeContext } from '$lib/publicTheme';
  import NotificationHost from '$lib/components/NotificationHost.svelte';
  const notifications = createNotifications();
  setContext(notificationContext, notifications);
  const comparison = createComparison(notifications.push);
  setContext(comparisonContext, comparison);
  const favorites = createFavorites(notifications.push);
  setContext(favoritesContext, favorites);
  let { children }: { children: import('svelte').Snippet } = $props();
  const theme = createPublicTheme(browser ? document.documentElement.getAttribute('data-theme') !== 'light' : true, browser ? dark => {
    const value = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', value);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0b' : '#f5f5f1');
  } : undefined);
  // Restore before child components hydrate, rather than after the first painted frame.
  if (browser) theme.initialize(() => localStorage);
  setContext(publicThemeContext, theme);
  const { ids: comparisonIds } = comparison;
  $effect.pre(() => notifications.setCurrentPath($page.url.pathname));
  $effect(() => {
    if ($comparisonIds.length < 2) notifications.invalidateActions('comparison', { label: 'Ver seleção', href: '/comparar' });
  });
  onMount(() => {
    // Keep focus until the anchor arrives; Kit's hash focus fallback otherwise emits a synthetic popstate.
    anchors = installAnchorNavigation({ tick, push: url => pushState(url, $page.state), navigate: url => goto(url, { noScroll: true, keepFocus: true }) });
    comparison.initialize(() => localStorage, () => sessionStorage);
    favorites.initialize(() => localStorage);
    const sync = (event: StorageEvent) => {
      try { if (event.storageArea !== localStorage) return; } catch { return; }
      if (event.key === COMPARISON_KEY || event.key === null) comparison.sync(event.newValue);
      if (event.key === FAVORITES_KEY || event.key === null) favorites.sync(event.newValue);
    };
    window.addEventListener('storage', sync);
    return () => { cancelNavigationThumbnails(); anchors?.destroy(); window.removeEventListener('storage', sync); notifications.destroy(); };
  });
</script>

<WebsiteIconHead />
<NavigationProgress />
{@render children()}
<WhatsAppContact />
<NotificationHost />
