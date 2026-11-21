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
  await context.route('https://**/*', (route) => {
    thirdParty.push(route.request().url());
    if (route.request().url().includes('googletagmanager.com/gtm.js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.consentTestGtm = true;',
      });
    }
    return route.abort();
  });

  const notice = page.getByRole('region', { name: 'Cookies e privacidade' });
  const dialog = page.getByRole('dialog', { name: 'Preferências de privacidade' });
  const map = page.locator('iframe[src*="google.com/maps/embed"]');
  await page.goto(origin);
  await expect(notice).toBeVisible();
  await expect(map).toHaveCount(0);
  await notice.getByRole('button', { name: 'Personalizar' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(3);
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
  await notice.getByRole('button', { name: 'Rejeitar opcionais' }).click();
  await page.reload();
  await expect(notice).toBeHidden();
  await expect(map).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('anm-favorites-v1'))).toBe(favorites);

  const policy = origin + '/politica-de-privacidade#preferencias';
  await page.goto(policy);
  await page.getByRole('button', { name: 'Alterar preferências' }).click();
  await dialog.getByRole('switch', { name: /Mapa incorporado/ }).check();
  await dialog.getByRole('button', { name: 'Guardar escolhas' }).click();
  await expect(dialog).toBeHidden();
  await page.goto(origin);
  await expect(map).toHaveCount(1);
  await map.scrollIntoViewIfNeeded();
  await expect
    .poll(() => thirdParty.some((url) => url.includes('google.com/maps/embed')))
    .toBe(true);

  const otherTab = await context.newPage();
  await otherTab.goto(policy);
  await otherTab.getByRole('button', { name: 'Retirar consentimento' }).click();
  await expect(map).toHaveCount(0);
  await otherTab.close();
  await page.reload();
  await expect(map).toHaveCount(0);

  await page.goto(policy);
  await page.getByRole('button', { name: 'Alterar preferências' }).click();
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
  expect(gtmRequests()).toHaveLength(1);
  expect(thirdParty.filter((url) => /cookiebot|google-analytics/.test(url))).toEqual([]);
  console.log(
    'Consent banner, keyboard, refusal, optional features, expiry and withdrawal passed.',
  );
} finally {
  await browser?.close();
  await server.close();
}
