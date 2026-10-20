import { onDestroy } from 'svelte';
import { afterNavigate, goto } from '$app/navigation';

/** Coalesce typing; flush pending text with a chip change so neither filter is lost. */
export function filterNavigation(currentUrl: () => URL) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<string, string | undefined>();
  const ownNavigations = new Set<string>();
  function cancel() {
    clearTimeout(timer);
    pending.clear();
  }
  function flush(replaceState = false) {
    clearTimeout(timer);
    if (!pending.size) return;
    const url = currentUrl();
    const params = new URLSearchParams(url.searchParams);
    for (const [name, value] of pending) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    pending.clear();
    params.delete('page');
    const query = params.toString();
    if (query === url.searchParams.toString()) return;
    const target = new URL(query ? `?${query}` : '?', url).href;
    ownNavigations.add(target);
    void goto(target, { keepFocus: true, noScroll: true, replaceState }).finally(() => {
      ownNavigations.delete(target);
    });
  }
  afterNavigate(({ to, type }) => {
    // A completed search must not discard text typed while it was loading.
    if (type === 'goto' && to && ownNavigations.has(to.url.href)) return;
    cancel();
  });
  onDestroy(cancel);
  return {
    set(name: string, value: string | undefined, typing = false) {
      pending.set(name, value);
      clearTimeout(timer);
      if (typing && value) timer = setTimeout(() => flush(true), 250);
      else flush(typing);
    },
    clear() {
      cancel();
      void goto(currentUrl().pathname, { keepFocus: true, noScroll: true });
    },
    flush: () => flush(true),
  };
}
