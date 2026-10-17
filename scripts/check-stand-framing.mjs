// After building apps/website. Local browser test, without a production backend.
// PowerShell: $env:PLAYWRIGHT_CHANNEL='chrome'; node scripts/check-stand-framing.mjs
// --baseline records the current geometry without checking the new desktop contract.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseline = process.argv.includes('--baseline');
const prefix = baseline ? 'before' : 'after';
const directory = '.cache/stand-framing';
await mkdir(directory, { recursive: true });
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const api = createServer((req, res) => {
  const data = req.url.includes('/homepage-highlights') ? { configured: true, items: [] }
    : req.url.includes('/brands') ? []
    : { items: [], total: 0, page: 1, pageSize: 30, totalPages: 0, facets: { brands: [], models: [], fuels: [], transmissions: [], year: { min: null, max: null }, mileage: { min: null, max: null }, price: { min: null, max: null } } };
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
});
api.listen(0, '127.0.0.1'); await once(api, 'listening');
const child = spawn(process.execPath, ['build/index.js'], { cwd: 'apps/website', stdio: 'pipe', env: {
  ...process.env, HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin,
  INTERNAL_BACKEND_URL: `http://127.0.0.1:${api.address().port}`, SITE_NOINDEX: 'true', CONTACT_ENABLED: 'false',
} });
let browser;
const rows = [];
const geometry = page => page.locator('.home-stand-backdrop').evaluateAll(layers => layers.map(layer => {
  const image = layer.querySelector('img'), box = layer.getBoundingClientRect(), bounds = image.getBoundingClientRect();
  return { width: bounds.width, height: bounds.height, left: bounds.left - box.left, top: bounds.top - box.top,
    pageLeft: bounds.left, pageTop: bounds.top, frameWidth: box.width, frameHeight: box.height,
    cropLeft: getComputedStyle(image).getPropertyValue('--photo-crop-left').trim(), cropRight: getComputedStyle(image).getPropertyValue('--photo-crop-right').trim(),
    mask: getComputedStyle(image).maskImage,
  };
}));
const near = (a, b, message, tolerance = .1) => assert(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await fetch(origin); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert(ready);
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  for (const [width, height] of [[2560, 1440], [1920, 1080], [1600, 900], [1434, 900], [1280, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(/\/_app\/immutable\/.*\.(?:js|woff2)(?:\?.*)?$/, async route => {
      // The classic startup runs in the head and is parser blocking. Hold only
      // hydration modules/fonts, so the SSR body can actually be parsed.
      if (!route.request().url().includes('/orbit-startup.')) await gate;
      await route.continue().catch(() => {});
    });
    await page.route('https://images.unsplash.com/**', route => route.abort());
    await page.addInitScript(() => {
      window.standShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.standShifts.push({ value: entry.value, sources: entry.sources?.map(s => ({ node: s.node?.className, before: s.previousRect.toJSON(), after: s.currentRect.toJSON() })) });
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(origin, { waitUntil: 'commit' });
    await page.waitForFunction(() => {
      const layer = document.querySelector('.home-stand-backdrop');
      return layer && getComputedStyle(layer).position === 'absolute' && getComputedStyle(layer).containerType === 'size';
    });
    const initial = await geometry(page);
    release();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.querySelector('[data-theme-command]')?.disabled);
    // Two frames allow the onMount/ResizeObserver measurement to settle.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const hydrated = await geometry(page);
    const shifts = await page.evaluate(() => window.standShifts);
    await page.screenshot({ path: `${directory}/${prefix}-${width}.png` });
    rows.push({ width, height, initial, hydrated, shifts, cls: shifts.reduce((sum, shift) => sum + shift.value, 0) });
    if (!baseline && width > 1000) {
      for (const [index, frame] of hydrated.entries()) {
        for (const key of ['width', 'height', 'left', 'top', 'pageLeft', 'pageTop']) near(initial[index][key], frame[key], `${width} image ${index + 1} initial/hydrated ${key}`);
        const zoom = index === 0 ? .65 : .84, x = index === 0 ? .5 : 1, y = index === 0 ? .72 : .63;
        const referenceWidth = 2560 * (index === 0 ? 1.04 : 1.02) * zoom;
        near(frame.width, Math.max(frame.frameWidth * zoom, frame.frameHeight * referenceWidth / 797.6), `${width} uniform reference scale`);
        const sourceX=index===0?.43:.5,sourceY=index===0?.42:.44;
        const referenceLayerWidth=2560*(index===0?1.04:1.02),referenceImageWidth=referenceLayerWidth*zoom;
        const anchorX=x+(sourceX-x)*zoom;
        near(frame.left,frame.frameWidth*anchorX-frame.width*sourceX,`${width} calibrated focal x`);
        near(frame.top,(frame.frameHeight-frame.height)*y,`${width} preserve approved vertical positioning`);
      }
    }
    // Cross the desktop/mobile breakpoint in one mounted page as well.
    if (!baseline && width === 390) {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const immediate = await geometry(page);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const settled = await geometry(page);
      for (let i = 0; i < 2; i++) near(immediate[i].width, settled[i].width, 'mobile pixel frame cannot override desktop CSS on resize');
    }
    await page.close();
  }
  if (!baseline) {
    const reference = rows.find(r => r.width === 2560);
    for (const row of rows.filter(r => r.width > 1000 && r.width < 2560)) {
      for (let i = 0; i < 2; i++) {
        const original = reference.hydrated[i], current = row.hydrated[i];
        const sourceY = i === 0 ? .42 : .44;
        const sourceX = i === 0 ? .43 : .5;
        near((original.left + original.width * sourceX) / original.frameWidth,
          (current.left + current.width * sourceX) / current.frameWidth,
          `${row.width} facade landmark retains its horizontal proportion`, .001);
        near((original.top + original.height * sourceY) / original.frameHeight,
          (current.top + current.height * sourceY) / current.frameHeight,
          `${row.width} facade landmark retains its vertical proportion`, .001);
      }
    }
    try {
      const before = JSON.parse(await readFile(`${directory}/before.json`, 'utf8'));
      for (const width of [2560, 390]) {
        const old = before.find(r => r.width === width), current = rows.find(r => r.width === width);
        for (let i = 0; i < 2; i++) for (const key of ['width', 'height', 'left', 'top', 'cropLeft', 'cropRight']) {
          if (typeof old.hydrated[i][key] === 'number') near(old.hydrated[i][key], current.hydrated[i][key], `preserve ${width} image ${i + 1} ${key}`);
          else near(parseFloat(old.hydrated[i][key]),parseFloat(current.hydrated[i][key]),`preserve ${width} image ${i + 1} ${key}`, .002);
        }
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeFile(`${directory}/${prefix}.json`, JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows.map(r => ({ viewport: `${r.width}x${r.height}`, cls: r.cls,
    initialWidth: r.initial[0].width, finalWidth: r.hydrated[0].width,
    initialTop: r.initial[0].top, finalTop: r.hydrated[0].top })), null, 2));
  console.log(`PASS ${prefix}: reference, intermediate desktops, mobile and hydration geometry`);
} finally { await browser?.close(); child.kill(); await new Promise(resolve => api.close(resolve)); }
