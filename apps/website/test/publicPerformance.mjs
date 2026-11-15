// Production build, synthetic stock, isolated Chrome; no writes to business data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function publicPerformance(browser, origin, slug) {
  const output = path.resolve(
    process.env.PERFORMANCE_OUTPUT || '../../.cache/performance-public.json',
  );
  const results = [];
  const routes = process.env.PERFORMANCE_ROUTES?.split(',') ?? [
    '/',
    '/viaturas',
    `/viaturas/${slug}`,
    '/quem-somos',
    '/favoritos',
    '/comparar',
    '/informacao-legal',
    '/politica-de-privacidade',
    '/termos-de-utilizacao',
  ];
  for (const width of [390, 1440]) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: width === 390 ? 2 : 1,
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      await context.route('**/*', (r) =>
        new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
      );
      await context.addInitScript(() => {
        window.__perf = { cls: 0, shifts: [], lcp: 0, longTasks: 0, longTaskMs: 0 };
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => {
            if (!e.hadRecentInput) {
              window.__perf.cls += e.value;
              window.__perf.shifts.push({
                value: e.value,
                sources: e.sources.map((s) => ({
                  tag: s.node?.tagName,
                  class: String(s.node?.className),
                  before: s.previousRect,
                  after: s.currentRect,
                })),
              });
            }
          }),
        ).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => (window.__perf.lcp = e.startTime)),
        ).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => {
            window.__perf.longTasks++;
            window.__perf.longTaskMs += e.duration;
          }),
        ).observe({ type: 'longtask', buffered: true });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: width === 390 ? 4 : 1 });
      const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await page.waitForTimeout(600);
      const initial = await page.evaluate(() => ({
        ...window.__perf,
        resources: performance.getEntriesByType('resource').reduce((out, e) => {
          const type = /\.js(?:\?|$)/.test(e.name)
            ? 'js'
            : /\.css(?:\?|$)/.test(e.name)
              ? 'css'
              : e.initiatorType;
          out[type] = (out[type] || 0) + e.decodedBodySize;
          return out;
        }, {}),
        nodes: document.querySelectorAll('*').length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      const metrics = async () =>
        Object.fromEntries(
          (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
        );
      const before = await metrics();
      await page.evaluate(async () => {
        const height = document.documentElement.scrollHeight - innerHeight;
        for (let i = 0; i <= 40; i++) {
          scrollTo(0, (height * i) / 40);
          await new Promise((resolve) => setTimeout(resolve, 35));
        }
      });
      await page.waitForTimeout(200);
      const after = await metrics();
      const scroll = Object.fromEntries(
        [
          'LayoutCount',
          'RecalcStyleCount',
          'LayoutDuration',
          'RecalcStyleDuration',
          'ScriptDuration',
          'TaskDuration',
        ].map((key) => [key, after[key] - before[key]]),
      );
      assert.deepEqual(errors, [], route);
      results.push({ width, route, initial, scroll });
      console.log(
        JSON.stringify({ width, route, cls: initial.cls, js: initial.resources.js, scroll }),
      );
      await context.close();
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        note: 'Synthetic data; CPU 4x mobile / 1x desktop; local unthrottled network; not Lighthouse or field measurements.',
        results,
      },
      null,
      2,
    ),
  );
}
