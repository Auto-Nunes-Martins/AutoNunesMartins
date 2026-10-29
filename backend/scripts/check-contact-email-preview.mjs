import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const directory = new URL('../../docs/previews/', import.meta.url);
const logoPixels = await sharp(
  fileURLToPath(new URL('../src/lib/server/contactEmailLogo.png', import.meta.url)),
)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let firstVisibleX = logoPixels.info.width;
for (let y = 0; y < logoPixels.info.height; y++)
  for (let x = 0; x < logoPixels.info.width; x++) {
    const offset = (y * logoPixels.info.width + x) * 4;
    if (
      logoPixels.data[offset + 3] &&
      [11, 12, 13].some((channel, index) => Math.abs(logoPixels.data[offset + index] - channel) > 8)
    )
      firstVisibleX = Math.min(firstVisibleX, x);
  }
assert.equal(firstVisibleX, 0, 'email logo has no transparent left inset');
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
});
let externalRequests = 0;
try {
  for (const width of [900, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      colorScheme: width === 375 ? 'dark' : 'light',
    });
    await context.route('**/*', (route) => {
      if (route.request().method() === 'GET' && route.request().url().startsWith('file:'))
        return route.continue();
      externalRequests++;
      return route.abort();
    });
    for (const name of [
      'contact-email',
      'contact-email-vehicle',
      'contact-email-long',
      'contact-email-wordmark',
    ]) {
      const page = await context.newPage();
      await page.goto(new URL(`${name}.html`, directory).href);
      assert.equal(
        await page.locator('meta[name="color-scheme"]').getAttribute('content'),
        'light only',
      );
      assert.equal(
        await page.locator('body').evaluate((n) => getComputedStyle(n).backgroundColor),
        'rgb(16, 17, 18)',
      );
      assert.equal(
        await page
          .locator('.email-pad')
          .first()
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        'rgb(11, 12, 13)',
      );
      assert.equal(
        await page.locator('h1').evaluate((n) => getComputedStyle(n).color),
        'rgb(241, 242, 239)',
      );
      const images = page.locator('img[alt="Auto Nunes Martins"]');
      const arrow = page.locator('a img');
      assert.equal(await arrow.count(), 1);
      assert.equal(await arrow.getAttribute('alt'), '');
      assert.ok(await arrow.evaluate((n) => n.complete && n.naturalWidth > 0));
      const arrowBox = await arrow.boundingBox();
      assert.equal(arrowBox.width, 14);
      assert.equal(arrowBox.height, 14);
      const cta = page.getByRole('link', { name: 'Responder ao contacto', exact: true });
      assert.equal(await cta.count(), 1);
      assert.equal(
        await cta.evaluate((n) => getComputedStyle(n.parentElement).backgroundColor),
        'rgb(227, 6, 19)',
      );
      assert.equal(await cta.evaluate((n) => getComputedStyle(n).color), 'rgb(255, 255, 255)');
      assert.equal(
        await cta.evaluate((n) => getComputedStyle(n).backgroundColor),
        'rgba(0, 0, 0, 0)',
      );
      await cta.screenshot({
        path: fileURLToPath(new URL(`contact-email-cta-${width}.png`, directory)),
      });
      if (name === 'contact-email-wordmark') {
        assert.equal(await images.count(), 0);
        await page.getByText('AUTO NUNES MARTINS.', { exact: true }).waitFor();
      } else {
        assert.equal(await images.count(), 1);
        assert.equal(await images.getAttribute('alt'), 'Auto Nunes Martins');
        assert.ok(
          await images.evaluate((n) => n.complete && n.naturalWidth > 0),
          'actual logo loads locally',
        );
        const axis = await images.evaluate((n) => {
          const heading = document.querySelector('h1').getBoundingClientRect();
          const label = document.querySelector('.email-pad p').getBoundingClientRect();
          const image = n.getBoundingClientRect();
          return {
            left: image.left,
            width: image.width,
            naturalWidth: n.naturalWidth,
            heading: heading.left,
            label: label.left,
          };
        });
        const visibleLeft = axis.left + (firstVisibleX * axis.width) / axis.naturalWidth;
        assert.ok(Math.abs(visibleLeft - axis.heading) < 1, 'visible logo aligns with heading');
        assert.ok(Math.abs(visibleLeft - axis.label) < 1, 'visible logo aligns with header text');
      }
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'no horizontal page overflow',
      );
      const message = page.locator('.message-pad');
      assert.ok(
        await message.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        'long and unbroken messages remain inside the panel',
      );
      const columns = await page.locator('.contact-column').evaluateAll((nodes) =>
        nodes.map((n) => ({
          top: n.getBoundingClientRect().top,
          left: n.getBoundingClientRect().left,
        })),
      );
      if (width < 600) {
        assert.equal(columns[0].left, columns[1].left);
        assert.ok(columns[1].top > columns[0].top, 'contact fields stack on mobile');
      } else assert.equal(columns[0].top, columns[1].top, 'desktop contact row stays aligned');
      const links = await page
        .locator('a')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')));
      assert.equal(links.length, 2);
      assert.ok(
        links.every((href) => href.startsWith('mailto:') && href.includes('?subject=')),
        'reply actions remain mailto',
      );
      // Verify actual computed contrast for readable text, including the response action.
      const contrasts = await page.locator('h1,h2,p,a,.message-pad').evaluateAll((nodes) => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const lum = (c) =>
          c
            .map((x) => {
              x /= 255;
              return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
        return nodes
          .filter((n) => getComputedStyle(n).display !== 'none')
          .map((n) => {
            let bg = n;
            while (bg && getComputedStyle(bg).backgroundColor === 'rgba(0, 0, 0, 0)')
              bg = bg.parentElement;
            const a = lum(rgb(getComputedStyle(n).color)),
              b = lum(rgb(getComputedStyle(bg).backgroundColor));
            return {
              text: n.textContent.slice(0, 30),
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
            };
          });
      });
      for (const item of contrasts)
        assert.ok(item.ratio >= 4.5, `${item.text} contrast ${item.ratio}`);
      const suffix = width === 900 ? 'desktop' : 'mobile';
      await page.screenshot({
        path: fileURLToPath(new URL(`${name}-${suffix}-gmail-dark.png`, directory)),
        fullPage: true,
      });
      if (name === 'contact-email-long')
        assert.ok(
          (await message.innerText()).includes('< > & "'),
          'visitor HTML-like text is shown literally',
        );
      if (name === 'contact-email' && width === 375) {
        // Deliberately simulate a client ignoring the opt-out and repainting the header.
        // This is a local resilience probe, not an emulation or test of the Gmail app.
        await page
          .locator('.email-pad')
          .first()
          .evaluate((n) => {
            n.style.backgroundColor = '#ffffff';
            n.setAttribute('bgcolor', '#ffffff');
            n.querySelectorAll('p').forEach((p) => (p.style.color = '#000000'));
          });
        const simulatedLogo = await images.screenshot();
        const { data, info } = await sharp(simulatedLogo)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        assert.deepEqual(
          [...data.subarray(0, 3)],
          [11, 12, 13],
          'embedded logo keeps its dark plate despite parent recolouring',
        );
        let whitePixels = 0;
        for (let i = 0; i < data.length; i += info.channels)
          if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) whitePixels++;
        assert.ok(whitePixels > 50, 'white lettering remains visible on the opaque plate');
        await page
          .locator('.email-pad')
          .first()
          .screenshot({
            path: fileURLToPath(new URL('contact-email-logo-simulated-recolour.png', directory)),
          });
      }
      await page.close();
      console.info(`PASS ${name} ${width}px; logo/fallback, wrapping, contrast, reply links`);
    }
    await context.close();
  }
  assert.equal(externalRequests, 0, 'no external request or email POST');
} finally {
  await browser.close();
}
