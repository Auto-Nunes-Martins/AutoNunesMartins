import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const script = html.match(/<script id="anm-gtm-consent"[^>]*>([\s\S]+?)<\/script>/)?.[1];
if (!script) throw new Error('Missing GTM consent bootstrap');
const bootstrap = script;

function start(saved = false) {
  const handlers = new Map<string, () => void>();
  const tags: Array<{ src: string }> = [];
  const reload = vi.fn();
  const dataLayer: unknown[] = [{ event: 'earlier' }];
  const window = {
    dataLayer,
    addEventListener: (event: string, callback: () => void) => handlers.set(event, callback),
    location: { reload },
    Cookiebot: saved
      ? { hasResponse: true, consent: { method: 'explicit', statistics: true, marketing: true } }
      : undefined,
  };
  runInNewContext(bootstrap, {
    window,
    document: {
      createElement: () => ({ setAttribute: vi.fn() }),
      head: { appendChild: (tag: { src: string }) => tags.push(tag) },
    },
  });
  function choose(
    statistics: boolean,
    marketing: boolean,
    method = 'explicit',
    event = 'CookiebotOnAccept',
  ) {
    window.Cookiebot = { hasResponse: true, consent: { method, statistics, marketing } };
    handlers.get(event)?.();
  }
  const commands = () =>
    dataLayer
      .filter((value) => Object.prototype.toString.call(value) === '[object Arguments]')
      .map((value) => Array.from(value as ArrayLike<unknown>));
  return { dataLayer, tags, reload, choose, commands };
}

describe('public GTM consent', () => {
  it('blocks missing, partial and implied consent and loads the container once', () => {
    const view = start();
    view.choose(true, false);
    view.choose(false, true);
    view.choose(true, true, 'implied');
    expect(view.tags).toHaveLength(0);
    view.choose(true, true);
    view.choose(true, true, 'explicit', 'CookiebotOnConsentReady');
    expect(view.tags.map((tag) => tag.src)).toEqual([
      'https://www.googletagmanager.com/gtm.js?id=GTM-W83CLHNR',
    ]);
    expect(view.dataLayer[0]).toEqual({ event: 'earlier' });
    expect(view.dataLayer.at(-1)).toMatchObject({
      event: 'gtm.js',
      'gtm.start': expect.any(Number),
    });
    expect(view.commands().at(-1)).toEqual([
      'consent',
      'update',
      {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      },
    ]);
  });

  it('honors a saved choice and reloads after withdrawal', () => {
    const view = start(true);
    expect(view.tags).toHaveLength(1);
    view.choose(false, false, 'explicit', 'CookiebotOnDecline');
    view.choose(false, false, 'explicit', 'CookiebotOnConsentReady');
    expect(view.commands().at(-1)).toEqual([
      'consent',
      'update',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(view.reload).toHaveBeenCalledOnce();
  });
});
