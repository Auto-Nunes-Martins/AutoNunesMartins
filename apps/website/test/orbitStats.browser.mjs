// Isolated browser coverage: other homepage components assume IntersectionObserver.
// Compile the real component and its styles without changing the website build.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compile } from 'svelte/compiler';
import { chromium } from 'playwright';

// esbuild is a declared dependency of the existing Vite toolchain.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const component = path.join(root, 'src/lib/components/stand-concepts/OrbitStats.svelte');
const startup = await readFile(path.join(root, 'assets/orbit-startup.js'), 'utf8');
const bundle = await build({
  stdin: {
    contents:
      "import { mount } from 'svelte'; import Stats from './OrbitStats.svelte'; mount(Stats, { target: document.body });",
    resolveDir: path.dirname(component),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  plugins: [
    {
      name: 'real-stats-component',
      setup(builder) {
        builder.onLoad({ filter: /OrbitStats\.svelte$/ }, async ({ path: filename }) => ({
          contents: compile(await readFile(filename, 'utf8'), {
            filename,
            generate: 'client',
            css: 'injected',
          }).js.code,
          resolveDir: path.dirname(filename),
        }));
      },
    },
  ],
});
const output = path.join(root, '.svelte-kit', `stats-entry-${Date.now()}`);
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  headless: true,
});
try {
  for (const scenario of ['no-observer', 'reduced', 'normal', 'motion-change']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      reducedMotion: scenario === 'reduced' ? 'reduce' : 'no-preference',
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => route.abort());
      await page.setContent(
        '<!doctype html><html><head><style>:root{--line:#ffffff24;--red:#e30613;--muted:#ccc}body{margin:0}</style></head><body></body></html>',
      );
      if (scenario === 'no-observer')
        await page.evaluate(() => {
          window.IntersectionObserver = undefined;
        });
      await page.addScriptTag({ content: startup });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      if (scenario === 'motion-change') {
        await page.locator('.orbit-stats.animateEntrance').waitFor();
        await page.emulateMedia({ reducedMotion: 'reduce' });
      }
      await page.waitForFunction(() => {
        const values = [...document.querySelectorAll('.stat-value')].map((node) =>
          node.textContent.replace(/\s/g, ''),
        );
        return JSON.stringify(values) === JSON.stringify(['15', '500+', '2500+', '24h']);
      });
      if (scenario === 'motion-change') await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const final = await page.evaluate(() => {
        const stats = document.querySelector('.orbit-stats');
        const grid = stats.querySelector('.stats-grid');
        const stat = stats.querySelector('.stat');
        return {
          offset:
            stat.getBoundingClientRect().top -
            stats.getBoundingClientRect().top -
            parseFloat(getComputedStyle(stats).borderTopWidth) -
            parseFloat(getComputedStyle(grid).paddingTop),
          opacity: Number(getComputedStyle(stat).opacity),
          activeAnimations: stat
            .getAnimations()
            .filter((animation) => animation.playState === 'running').length,
          values: [...stats.querySelectorAll('.stat-value')].map((node) =>
            node.textContent.replace(/\s/g, ''),
          ),
        };
      });
      results.push({ scenario, errors, final });
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      assert.deepEqual(errors, [], `${scenario}: browser errors`);
      assert.ok(Math.abs(final.offset) < 0.1, `${scenario}: labels remained displaced`);
      assert.equal(final.opacity, 1, `${scenario}: labels remained translucent`);
      assert.equal(final.activeAnimations, 0, `${scenario}: entry kept running`);
      assert.deepEqual(final.values, ['15', '500+', '2500+', '24h']);
      console.log(`${scenario}: final values and geometry preserved`);
    } finally {
      await context.close();
    }
  }
  console.log(`4 statistic-entry profiles passed; evidence: ${output}`);
} finally {
  await browser.close();
}
