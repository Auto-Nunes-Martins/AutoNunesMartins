<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { beforeNavigate, goto, invalidate, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { useClerkContext } from 'svelte-clerk';
  import { crmPath, crmRoute } from '$lib/paths';
  import { hasUnsavedForms } from '$lib/forms/formFeedback';
  import { bindCrmSession, crmSessionState, deferSessionNavigation, refreshCrmSession, currentCrmSessionIdentity, SessionUnavailable } from '$lib/auth/session';

  const clerk = useClerkContext();
  const privatePage = $derived(crmRoute($page.url.pathname) !== '/');
  const overviewRoutes = new Set(['/dashboard', '/viaturas', '/clientes', '/vendas', '/tarefas', '/financeiro', '/atividade']);
  let lastCheck = 0;
  let checking = $state(false);
  let disposed = false;
  let navigationAttempt = 0;
  let checkedSessionId: string | null | undefined;
  const identityChanged = () => checkedSessionId !== undefined && checkedSessionId !== (clerk.session?.id ?? null);

  $effect(() => {
    // Track SDK logout/account changes even when the current page stays open.
    if (clerk.isLoaded) currentCrmSessionIdentity();
  });

  if (typeof window !== 'undefined') {
    const unbind = bindCrmSession(async (options) => {
      // Hydration can precede Clerk's script. Wait for the SDK, not an assumed logout.
      const started = Date.now();
      while (!clerk.isLoaded && !disposed && Date.now() - started < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (disposed || !clerk.isLoaded) throw new SessionUnavailable(503);
      const session = clerk.session;
      const token = await session?.getToken(options) ?? null;
      if (session?.id !== clerk.session?.id) throw new SessionUnavailable(503);
      return token;
    }, () => clerk.session?.id);
    onDestroy(() => { disposed = true; deferSessionNavigation(false); unbind(); });
  }

  async function recover(force = true, reload = false) {
    if (checking || !privatePage) return;
    checking = true;
    try {
      const resetLayout = force || identityChanged();
      await refreshCrmSession(resetLayout);
      lastCheck = Date.now();
      checkedSessionId = clerk.session?.id ?? null;
      // Revalidate overview data after resume, but never reset an editor or form.
      if (reload && overviewRoutes.has(crmRoute($page.url.pathname)) && !hasUnsavedForms()) {
        if (resetLayout) await invalidateAll();
        else await invalidate('crm:overview');
      }
    } catch { /* The session banner supplies recovery without discarding page state. */ }
    finally { checking = false; }
  }

  beforeNavigate((navigation) => {
    deferSessionNavigation(false);
    const attempt = ++navigationAttempt;
    if (navigation.willUnload || !navigation.to || crmRoute(navigation.to.url.pathname) === '/') return;
    if (Date.now() - lastCheck < 45000 && $crmSessionState === 'ready' && !identityChanged()) return;
    navigation.cancel();
    // The app's unsaved-form guard runs next. Ask only on the resumed navigation,
    // after session renewal, rather than twice for a navigation already cancelled.
    deferSessionNavigation(true);
    const destination = navigation.to.url.href;
    // A normal idle check may reuse the SDK's still-valid token. Only recovery
    // after a rejected session needs to bypass that cache and reload the shell.
    const force = $crmSessionState !== 'ready' || identityChanged();
    void refreshCrmSession(force).then(async () => {
      if (disposed || attempt !== navigationAttempt) return;
      const resetLayout = force || identityChanged();
      lastCheck = Date.now();
      checkedSessionId = clerk.session?.id ?? null;
      if (navigation.type === 'popstate' && navigation.delta) history.go(navigation.delta);
      else await goto(destination, {
        replaceState: crmRoute(navigation.from?.url.pathname ?? '') === '/a-entrar',
        invalidateAll: resetLayout,
      });
    }).catch(() => { /* Stay on the current page; the banner offers recovery. */ });
  });

  onMount(() => {
    void recover(false);
    const resume = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 45000) void recover($crmSessionState !== 'ready', true);
    };
    const online = () => { lastCheck = 0; resume(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', online);
    };
  });
</script>

{#if privatePage && ($crmSessionState === 'expired' || $crmSessionState === 'unavailable')}
  <aside class="session-notice" role="alert">
    <p>{$crmSessionState === 'expired'
      ? 'A sessão precisa de ser validada. As alterações por guardar mantêm-se nesta página.'
      : 'Não foi possível validar a sessão. Verifique a ligação e tente novamente.'}</p>
    <div>
      <button type="button" disabled={checking} onclick={() => recover(true, true)}>Tentar novamente</button>
      <a href={crmPath('/')} target="_blank" rel="noopener noreferrer">Entrar noutra janela</a>
    </div>
  </aside>
{/if}

<style>
  .session-notice { position: fixed; z-index: 100; bottom: 84px; left: 50%; transform: translateX(-50%); width: min(600px, calc(100% - 32px)); padding: 16px; border: 1px solid var(--color-warning); border-radius: 6px; background: var(--color-bg-1); color: var(--color-text); box-shadow: 0 8px 24px #0003; }
  p { margin: 0 0 12px; font-size: 14px; }
  .session-notice div { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  button, a { font-size: 13px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--color-red); outline-offset: 3px; }
</style>
