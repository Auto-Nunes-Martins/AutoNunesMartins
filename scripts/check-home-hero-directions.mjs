// Read-only browser QA with existing public highlights. Requires website + backend.
// node scripts/check-home-hero-directions.mjs http://localhost:5173
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.argv[2] ?? 'http://localhost:5173';
const output = '.cache/hero-directions';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
try {
  for (const width of [1440, 1024, 768, 390, 320])
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((value) => localStorage.setItem('anm-orbit-theme', value), theme);
      await page.goto(origin);
      await page.waitForFunction(
        () => document.querySelector('.card-favorite button')?.disabled === false,
      );
      assert.equal(await page.locator('.hero-versions button').count(), 7);
      for (const version of [1, 2, 3, 4, 5, 6, 7]) {
        await page.getByRole('button', { name: `Versão ${version} do hero`, exact: true }).click();
        const root = page.locator(version === 2 ? '.hero-v2' : `[data-photo-variant="${version}"]`);
        // V2 deliberately uses display:contents; its photograph is the visible target.
        await root.waitFor({ state: 'attached' });
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(2200);
        assert(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${version}: page overflows`,
        );
        const selector = await page.locator('.hero-versions').boundingBox();
        assert(selector.x >= 0 && selector.x + selector.width <= width, 'Switcher must fit');
        const image = root.locator(
          version === 2 ? '.v2-orbit-main-photo img.v2-active' : '.hd-photo img',
        );
        await image.waitFor();
        await image.evaluate((img) => img.decode());
        assert(
          await image.evaluate((img) => img.naturalWidth > 0),
          'Live featured photograph required',
        );
        const link = root.locator(version === 2 ? '#v2-orbit-featured' : '.hd-photo');
        const firstHref = await link.getAttribute('href');
        assert.match(firstHref, /^\/viaturas\/[a-z0-9-]+$/);
        if (version !== 2) {
          const model = await root.locator('.hd-identity h2 a').getAttribute('href');
          assert.equal(model, firstHref, 'Photo and identity must link to the same car');
          const next = root.getByRole('button', { name: 'Destaque seguinte', exact: true });
          if (await next.count()) {
            await next.click();
            assert.notEqual(await link.getAttribute('href'), firstHref);
            await next.press('Home');
            assert.equal(await link.getAttribute('href'), firstHref);
            await next.press('End');
            assert.notEqual(await link.getAttribute('href'), firstHref);
            await next.press('Home');
          }
          // Ensure visible text does not collide with the photo/caption in inset layouts.
          const boxes = await root.evaluate((node) => {
            const names = ['.hd-copy', '.hd-photo', '.hd-caption', '.hd-controls', '.hd-scroll'];
            return Object.fromEntries(
              names.map((name) => {
                const r = node.querySelector(name)?.getBoundingClientRect();
                return [
                  name,
                  r
                    ? {
                        x: r.x,
                        y: r.y,
                        right: r.right,
                        bottom: r.bottom,
                        width: r.width,
                        height: r.height,
                      }
                    : null,
                ];
              }),
            );
          });
          if (width <= 700)
            assert(
              boxes['.hd-photo'].width >= width * 0.72,
              'Mobile photo must use the full composition width',
            );
          assert(
            boxes['.hd-copy'].bottom <= boxes['.hd-photo'].y + 2 ||
              boxes['.hd-copy'].right <= boxes['.hd-photo'].x + 3,
            'Copy must not overlap inset car photo',
          );
          assert(
            boxes['.hd-caption'].bottom <= boxes['.hd-scroll'].y + 2,
            'Vehicle information must clear scroll cue',
          );
        }
        if ([1440, 390, 320].includes(width))
          await page.screenshot({ path: `${output}/${version}-${width}-${theme}.png` });
        const backdropTop = version !== 2
          ? await root.locator('.hd-landscape').evaluate((node) => node.getBoundingClientRect().top)
          : 0;
        await page.evaluate(() => scrollTo(0, 260));
        await page.waitForTimeout(200);
        if (version !== 2) {
          const backdrop = await root
            .locator('.hd-landscape')
            .evaluate((node) => ({position: getComputedStyle(node).position, top: node.getBoundingClientRect().top}));
          assert.equal(backdrop.position, 'fixed');
          assert(Math.abs(backdrop.top - backdropTop) < 1, 'Wallpaper must keep its viewport origin');
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForTimeout(100);
          assert.equal(
            await root
              .locator('.hd-landscape')
              .evaluate((node) => getComputedStyle(node).position),
            'absolute',
          );
          assert.equal(
            await root.locator('.hd-copy').evaluate((node) => getComputedStyle(node).animationName),
            'none',
          );
          await page.emulateMedia({ reducedMotion: 'no-preference' });
        }
        report.push({
          width,
          theme,
          version,
          livePhoto: true,
          links: true,
          overflow: false,
          keyboard: true,
          scroll: true,
        });
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${width}px / ${theme}: all seven versions passed`);
    }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await page.goto(`${origin}/?hero=7`);
  await page.locator('[data-photo-variant="7"]').waitFor();
  await page.route('**/viaturas/*/photos/*', (route) => route.abort());
  await page.getByRole('button', { name: 'Versão 3 do hero', exact: true }).click();
  await page.locator('.hd-photo-failed').waitFor();
  assert(await page.locator('.hd-photo-note').isVisible());
  assert(await page.locator('.hd-identity h2 a').isVisible());
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ cases: report, imageFailure: true, directPreviewUrl: true }, null, 2),
  );
  console.log(
    `Passed ${report.length} viewport/theme/version cases; image failure and direct URL passed.`,
  );
} finally {
  await browser.close();
}
