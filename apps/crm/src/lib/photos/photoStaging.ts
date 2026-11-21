import { sessionFetch } from '$lib/auth/session';

/** Renew only paths currently held by this editor; closing a tab relies on the
 * durable server expiry, never on an unreliable unload request. */
export function createPhotoStaging(options: {
  endpoint: () => string;
  paths: () => string[];
  missing: (paths: string[]) => void;
}) {
  let pending: Promise<void> | undefined;
  const discarded = new Set<string>();
  const controllers = new Set<AbortController>();
  async function send(action: 'retain' | 'discard', paths: string[]) {
    if (!paths.length) return;
    const controller = new AbortController();
    controllers.add(controller);
    let response: Response;
    try {
      response = await sessionFetch(options.endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, paths: [...new Set(paths)] }),
        signal: controller.signal,
      });
    } finally {
      controllers.delete(controller);
    }
    if (!response.ok)
      throw Error('Não foi possível confirmar as fotografias por guardar. Tente novamente.');
    const result = await response.json();
    if (action === 'retain' && Array.isArray(result.missingPaths) && result.missingPaths.length)
      options.missing(result.missingPaths);
  }
  function retain(): Promise<void> {
    return (pending ??= send(
      'retain',
      options.paths().filter((path) => !discarded.has(path)),
    ).finally(() => {
      pending = undefined;
    }));
  }
  async function discard(paths = options.paths()) {
    for (const path of paths) discarded.add(path);
    await pending?.catch(() => {});
    try {
      await send('discard', paths);
    } catch (error) {
      for (const path of paths) discarded.delete(path);
      throw error;
    }
  }
  function start() {
    const renew = () => {
      void retain().catch(() => {});
    };
    const visible = () => {
      if (document.visibilityState === 'visible') renew();
    };
    renew();
    const timer = setInterval(renew, 60_000);
    window.addEventListener('focus', renew);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      for (const controller of controllers) controller.abort();
      controllers.clear();
      window.removeEventListener('focus', renew);
      document.removeEventListener('visibilitychange', visible);
    };
  }
  return { retain, discard, start };
}
