import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

process.env.PUBLIC_BACKEND_URL = 'http://127.0.0.1:1';
process.env.INTERNAL_BACKEND_URL = process.env.PUBLIC_BACKEND_URL;
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 360, height: 760 } });
  const page = await context.newPage();
  const thirdParty = [];
  const gtmRequests = () => thirdParty.filter((url) => url.includes('googletagmanager.com/gtm.js'));
  const analyticsRequests = () =>
    thirdParty.filter((url) => url.includes('googletagmanager.com/gtag/js?id=G-8R2S370Q2Z'));
  await context.route('https://**/*', (route) => {
    thirdParty.push(route.request().url());
    if (route.request().url().includes('googletagmanager.com/gtm.js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.consentTestGtm = true;',
      });
    }
    if (route.request().url().includes('googletagmanager.com/gtag/js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.consentTestAnalytics = true;',
      });
    }
    return route.abort();
  });

  const notice = page.getByRole('region', { name: 'Cookies e privacidade' });
  const dialog = page.getByRole('dialog', { name: 'Preferências de privacidade' });
  const map = page.locator('iframe[src*="google.com/maps/embed"]');
  await page.goto(origin);
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS('color-scheme', 'dark');
  await expect(notice.getByRole('button', { name: 'Aceitar tudo' })).toHaveCSS(
    'background-color',
    'rgb(197, 18, 36)',
  );
  // The bar fills the viewport, including the scrollbar gutter. Its contents
  // follow the same left and right edges as the navigation on the current page.
  for (const path of ['/', '/quem-somos']) {
    if (path !== '/') await page.goto(origin + path);
    await expect(notice).toBeVisible();
    for (const width of [320, 390, 1024, 1440, 1920, 2160]) {
      await page.setViewportSize({ width, height: 800 });
      const edges = await page.evaluate(() => {
        const header = document.querySelector('.stand-header');
        const nav = header.getBoundingClientRect();
        const style = getComputedStyle(header);
        return {
          navLeft: nav.left + parseFloat(style.paddingLeft),
          navRight: nav.right - parseFloat(style.paddingRight),
          bannerLeft: document.querySelector('.notice .brand').getBoundingClientRect().left,
          bannerRight: document.querySelector('.notice .customize').getBoundingClientRect().right,
        };
      });
      expect(edges.bannerLeft, path + ' at ' + width).toBeCloseTo(edges.navLeft, 0);
      expect(edges.bannerRight, path + ' at ' + width).toBeCloseTo(edges.navRight, 0);
    }
  }
  await page.goto(origin);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const bounds = await notice.boundingBox();
    expect(bounds.width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    await expect(notice.getByRole('img', { name: 'Auto Nunes Martins' })).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Recusar' })).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    if (width === 1440) {
      if (process.env.CONSENT_BANNER_SCREENSHOT)
        await notice.screenshot({ path: process.env.CONSENT_BANNER_SCREENSHOT });
      const logo = await notice.getByRole('img').boundingBox();
      const heading = await notice.getByRole('heading').boundingBox();
      expect(logo.x + logo.width).toBeLessThan(heading.x);
      const buttons = await notice.getByRole('button').all();
      const [accept, refuse, customize] = await Promise.all(buttons.map((b) => b.boundingBox()));
      expect(refuse.y).toBeGreaterThanOrEqual(accept.y + accept.height);
      expect(customize.y).toBeGreaterThanOrEqual(refuse.y + refuse.height);
    } else {
      const refuse = notice.getByRole('button', { name: 'Recusar', exact: true });
      const accept = notice.getByRole('button', { name: 'Aceitar tudo' });
      const customize = notice.getByRole('button', { name: 'Personalizar' });
      const [left, right, below] = await Promise.all(
        [refuse, accept, customize].map((button) => button.boundingBox()),
      );
      expect(left.x).toBeLessThan(right.x);
      expect(left.y).toBeCloseTo(right.y, 0);
      expect(below.y).toBeGreaterThanOrEqual(Math.max(left.y + left.height, right.y + right.height));
      await notice.getByRole('link', { name: 'Política de Privacidade' }).focus();
      for (const button of [refuse, accept, customize]) {
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
      }
    }
    await notice.getByRole('button', { name: 'Personalizar' }).click();
    await expect(dialog.getByRole('tab')).toHaveCount(3);
    await expect(dialog).toHaveCSS('color-scheme', 'dark');
    await expect(dialog.getByRole('button', { name: 'Guardar escolhas' })).toHaveCSS(
      'background-color',
      'rgb(197, 18, 36)',
    );
    expect((await dialog.boundingBox()).width).toBeGreaterThan(width === 1440 ? 800 : width - 32);
    await dialog.getByRole('switch', { name: /Medição de publicidade/ }).check();
    await dialog.getByRole('tab', { name: 'Detalhes' }).click();
    await expect(dialog.getByRole('tabpanel')).toContainText('Google Tag Manager');
    if (width === 320) {
      const scroller = dialog.locator('.content');
      await expect(scroller).toHaveAttribute('data-more-below', '');
      await expect(scroller).not.toHaveCSS('mask-image', 'none');
      await scroller.evaluate((node) => node.scrollTo(0, node.scrollHeight));
      await expect(scroller).toHaveCSS('mask-image', 'none');
      await scroller.evaluate((node) => node.scrollTo(0, 0));
      await expect(scroller).toHaveAttribute('data-more-below', '');
    }
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('tab', { name: 'Sobre' })).toBeFocused();
    await expect(dialog.getByRole('tabpanel')).toContainText('Auto Nunes Martins');
    await page.keyboard.press('Home');
    await expect(dialog.getByRole('switch', { name: /Medição de publicidade/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Fechar preferências' }).click();
    expect(gtmRequests()).toHaveLength(0);
  }
  await page.getByRole('button', { name: 'Mudar para tema claro' }).first().click();
  await expect(notice).toHaveCSS('background-color', 'rgb(251, 250, 247)');
  await page.reload();
  await expect(notice).toHaveCSS('color-scheme', 'light');
  await notice.getByRole('button', { name: 'Personalizar' }).click();
  await expect(dialog).toHaveCSS('color-scheme', 'light');
  await dialog.getByRole('button', { name: 'Fechar preferências' }).click();
  await page.getByRole('button', { name: 'Mudar para tema escuro' }).first().click();
  await expect(notice).toHaveCSS('color-scheme', 'dark');
  await page.setViewportSize({ width: 360, height: 760 });
  await expect(map).toHaveCount(0);
  await notice.getByRole('button', { name: 'Personalizar' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(4);
  await expect(dialog.getByText('Sempre disponível')).toHaveCount(0);
  if (process.env.CONSENT_SCREENSHOT)
    await page.screenshot({ path: process.env.CONSENT_SCREENSHOT });
  await expect(dialog.getByRole('switch', { name: /Retomar a leitura/ })).not.toBeChecked();
  await expect(dialog.getByRole('switch', { name: /Mapa incorporado/ })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(notice.getByRole('button', { name: 'Personalizar' })).toBeFocused();
  const favorites = JSON.stringify(['favorito-teste-123456789abc']);
  await page.evaluate((value) => localStorage.setItem('anm-favorites-v1', value), favorites);
  await notice.getByRole('button', { name: 'Recusar' }).click();
  await page.reload();
  await expect(notice).toBeHidden();
  await expect(map).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('anm-favorites-v1'))).toBe(favorites);

  const policy = origin + '/politica-de-privacidade#preferencias';
  const settings = page.locator('.settings', {
    has: page.getByRole('button', { name: 'Alterar preferências' }),
  });
  const change = settings.getByRole('button', { name: 'Alterar preferências' });
  async function reopenPreferences() {
    await change.click();
    await expect(notice.getByRole('heading')).toBeFocused();
    await expect(dialog).toBeHidden();
    await notice.getByRole('button', { name: 'Personalizar' }).click();
    await expect(dialog).toBeVisible();
  }
  await page.goto(policy);
  await expect(settings.getByRole('status')).toContainText('Consentimento inativo');
  await expect(
    settings.getByRole('button', { name: 'Sem consentimento para retirar' }),
  ).toBeDisabled();
  await reopenPreferences();
  await dialog.getByRole('switch', { name: /Mapa incorporado/ }).check();
  await dialog.getByRole('button', { name: 'Guardar escolhas' }).click();
  await expect(dialog).toBeHidden();
  await expect(change).toBeFocused();
  await expect(settings.getByRole('status')).toContainText('Mapa incorporado do Google');
  await page.goto(origin);
  await expect(map).toHaveCount(1);
  await map.scrollIntoViewIfNeeded();
  await expect
    .poll(() => thirdParty.some((url) => url.includes('google.com/maps/embed')))
    .toBe(true);

  const otherTab = await context.newPage();
  await otherTab.goto(policy);
  await expect(otherTab.getByText('Consentimento ativo', { exact: true })).toBeVisible();
  await otherTab.getByRole('button', { name: 'Retirar consentimento' }).click();
  await expect(otherTab.getByRole('button', { name: 'Consentimento retirado' })).toBeDisabled();
  await expect(otherTab.getByText('Consentimento inativo', { exact: true })).toBeVisible();
  await expect(map).toHaveCount(0);
  await otherTab.close();
  await page.reload();
  await expect(map).toHaveCount(0);

  await page.goto(policy);
  await expect(settings.getByRole('button', { name: 'Consentimento retirado' })).toBeDisabled();
  await reopenPreferences();
  await dialog.getByRole('switch', { name: /Retomar a leitura/ }).check();
  await dialog.getByRole('button', { name: 'Guardar escolhas' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('anm-reload-position')))
    .not.toBeNull();
  await page.getByRole('button', { name: 'Retirar consentimento' }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('anm-reload-position')))
    .toBeNull();
  await page.evaluate(() =>
    localStorage.setItem(
      'anm-site-consent-v1',
      JSON.stringify({
        preferences: true,
        maps: true,
        expires: Date.now() - 1000,
      }),
    ),
  );
  await page.reload();
  await expect(notice).toBeVisible();
  await expect(settings.getByRole('status')).toContainText('Sem escolha guardada');
  expect(gtmRequests()).toHaveLength(0);

  await page.evaluate(() =>
    localStorage.setItem(
      'anm-site-consent-v1',
      JSON.stringify({
        preferences: true,
        maps: false,
        expires: Date.now() + 60_000,
      }),
    ),
  );
  await page.reload();
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Personalizar' }).click();
  await expect(dialog.getByRole('switch', { name: /Retomar a leitura/ })).toBeChecked();
  await expect(dialog.getByRole('switch', { name: /Medição de publicidade/ })).not.toBeChecked();
  await dialog.getByRole('switch', { name: /Medição de publicidade/ }).check();
  await dialog.getByRole('button', { name: 'Guardar escolhas' }).click();
  await expect.poll(() => gtmRequests().length).toBe(1);
  await page.waitForFunction(() => window.consentTestGtm === true);
  expect(analyticsRequests()).toHaveLength(0);
  const consent = await page.evaluate(() =>
    window.dataLayer.map((entry) => (typeof entry.length === 'number' ? Array.from(entry) : entry)),
  );
  expect(consent.at(-2)).toEqual([
    'consent',
    'update',
    {
      analytics_storage: 'denied',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'denied',
    },
  ]);
  expect(consent.at(-1)).toMatchObject({ event: 'gtm.js' });
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Retirar consentimento' }).click(),
  ]);
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await expect(settings.getByRole('button', { name: 'Consentimento retirado' })).toBeDisabled();
  expect(gtmRequests()).toHaveLength(1);
  expect(thirdParty.filter((url) => /cookiebot|google-analytics/.test(url))).toEqual([]);

  await reopenPreferences();
  await dialog.getByRole('switch', { name: /Estatísticas/ }).check();
  await dialog.getByRole('button', { name: 'Guardar escolhas' }).click();
  await expect.poll(() => analyticsRequests().length).toBe(1);
  await page.waitForFunction(() => window.consentTestAnalytics === true);
  expect(gtmRequests()).toHaveLength(1);
  const analyticsCommands = await page.evaluate(() =>
    window.dataLayer.map((entry) => Array.from(entry)),
  );
  expect(analyticsCommands.at(-3)).toEqual([
    'consent',
    'update',
    {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    },
  ]);
  expect(analyticsCommands.at(-1)).toEqual([
    'config',
    'G-8R2S370Q2Z',
    { allow_google_signals: false, allow_ad_personalization_signals: false },
  ]);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Retirar consentimento' }).click(),
  ]);
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window['ga-disable-G-8R2S370Q2Z'])).toBe(true);
  expect(analyticsRequests()).toHaveLength(1);

  await page.evaluate(() => localStorage.removeItem('anm-site-consent-v1'));
  await page.reload();
  await notice.getByRole('button', { name: 'Aceitar tudo' }).click();
  await expect(settings.getByRole('status')).toContainText('Medição de publicidade');
  await reopenPreferences();
  await expect(dialog.getByRole('switch')).toHaveCount(4);
  for (const toggle of await dialog.getByRole('switch').all()) await expect(toggle).toBeChecked();
  await expect.poll(() => gtmRequests().length).toBe(2);
  await expect.poll(() => analyticsRequests().length).toBe(2);
  console.log(
    'Consent banner, keyboard, refusal, optional features, expiry and withdrawal passed.',
  );
} finally {
  await browser?.close();
  await server.close();
}
