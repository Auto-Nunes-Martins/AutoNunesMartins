// Read-only runtime check against the running public website/backend.
// node scripts/check-home-hero-isolation.mjs [http://localhost:5173]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const origin = process.argv[2] ?? 'http://localhost:5173';
const output = '.cache/hero-v2-isolation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const geometry = page => page.evaluate(() => Object.fromEntries(
  ['intro', 'stage', 'copy', 'hero-signature', 'title', 'title-note', 'object', 'main-photo', 'side'].map(name => {
    const node = document.querySelector(`.v2-orbit-${name}`), box = node.getBoundingClientRect();
    return [name, [box.x, box.y, box.width, box.height, getComputedStyle(node).font]];
  }),
));
try {
  for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('anm-orbit-theme', value), theme);
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelector('.card-favorite button')?.disabled === false);
    await page.getByRole('button', { name: 'Versão 2 do hero', exact: true }).click();
    await page.mouse.move(width / 2, 500);
    await page.waitForFunction(() => document.querySelector('#v2-orbit-featured img.v2-active')?.complete);
    assert.equal(await page.locator('.hero-v2 [data-scene], .hero-v2 [data-scroll-hero], .hero-v2 [data-hero-stage]').count(), 0);
    assert.equal(await page.locator('.hero-v2 .orbit-intro, .hero-v2 .orbit-title, .hero-v2 .orbit-main-photo').count(), 0);
    const count = await page.locator('#v2-orbit-featured img').count();
    assert(count >= 2, 'A populated public highlight selection is required.');
    const next = page.locator('.v2-orbit-side button').last();
    await next.focus(); await next.press('End');
    await page.waitForFunction(expected => document.querySelector('.v2-hero-slide-index span')?.textContent === String(expected).padStart(2, '0'), count);
    await next.press('Home');
    await page.waitForFunction(() => document.querySelector('.v2-hero-slide-index span')?.textContent === '01');
    await page.evaluate(() => scrollTo(0, 220));
    // Allow the independently damped pointer/scroll values to settle before comparing.
    await page.waitForTimeout(900);
    const before = await geometry(page);
    const oldStyles = await page.addStyleTag({ content: `
      .design.orbit { --intro-height: 120px !important; --mx: .4 !important; --my: .4 !important; --p: .99 !important; }
      .design.orbit .orbit-intro { height: 120px !important; padding-top: 0 !important; }
      .design.orbit .orbit-stage { perspective: 10px !important; }
      .design.orbit .orbit-title { font-size: 12px !important; color: lime !important; }
      .design.orbit .orbit-object { width: 10px !important; transform: none !important; }
      .design.orbit { --v1-height: 120px !important; --v1-bg: lime !important; }
      .design.orbit .hero-v1 { height: 120px !important; padding: 0 !important; }
      .design.orbit .v1-showcase { width: 10px !important; transform: none !important; }
    ` });
    await page.waitForTimeout(300);
    const after = await geometry(page);
    for (const [name, values] of Object.entries(before)) {
      for (let i = 0; i < 4; i++) assert(Math.abs(after[name][i] - values[i]) < .2, `${name} changed after V1-only edits`);
      assert.equal(after[name][4], values[4]);
    }
    assert.equal(await page.locator('.v2-orbit-intro').evaluate(node => node.style.getPropertyValue('--p')), '');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await oldStyles.evaluate(node => node.remove());
    await page.screenshot({ path: `${output}/${width}-${theme}.png` });
    await page.getByRole('button', { name: 'Versão 1 do hero', exact: true }).click();
    assert.equal(await page.locator('.hero-v2').count(), 0);
    assert.equal(await page.locator('.hero-v1').count(), 1);
    await page.getByRole('button', { name: 'Versão 2 do hero', exact: true }).click();
    assert.equal(await page.locator('.hero-v2').count(), 1);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, theme, independentMarkup: true, independentMotion: true, injectedV1Edits: 'no effect', keyboard: true, switches: true }));
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('.card-favorite button')?.disabled === false);
  await page.getByRole('button', { name: 'Versão 2 do hero', exact: true }).click();
  assert.equal(await page.locator('.hero-v2-motion').count(), 0);
  const logoBefore = await page.locator('.v2-orbit-hero-signature').getAttribute('src');
  await page.locator('.desktop-theme button').click();
  await page.waitForFunction(source => document.querySelector('.v2-orbit-hero-signature')?.getAttribute('src') !== source, logoBefore);
  assert.equal(await page.locator('.hero-v2-motion').count(), 0);
  console.log(JSON.stringify({ reducedMotion: true, liveThemeSwitch: true }));
} finally { await browser.close(); }
