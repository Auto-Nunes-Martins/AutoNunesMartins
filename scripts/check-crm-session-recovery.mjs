import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
const root = resolve('.cache/session-recovery-review');
await mkdir(root, { recursive: true });
await writeFile(
  root + '/Entry.svelte',
  `<script>import SessionRecovery from '../../apps/crm/src/lib/components/shell/SessionRecovery.svelte';import UnsavedChangesGuard from '../../apps/crm/src/lib/components/common/UnsavedChangesGuard.svelte';import {formFeedback,markFormSaved} from '$lib/forms/formFeedback';import {page} from '$app/stores';import ErrorRecovery from '../../apps/crm/src/lib/components/common/ErrorRecovery.svelte';window.__setOverview=()=>page.set({url:new URL(location.origin+'/crm/viaturas'),data:{}});window.__saveBaseline=()=>markFormSaved(document.querySelector('form'));</script><SessionRecovery/><UnsavedChangesGuard/><main><form use:formFeedback><label>Modelo<input name="model" value="Original" /></label></form><ErrorRecovery status={401}/></main>`,
);
await writeFile(
  root + '/client.js',
  `import '../../apps/crm/src/app.css';import {mount}from'svelte';import Entry from'./Entry.svelte';mount(Entry,{target:document.getElementById('app')});`,
);
await writeFile(
  root + '/index.html',
  `<!doctype html><html lang="pt-PT" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>`,
);
await writeFile(root + '/paths.js', `export const base='/crm';`);
await writeFile(
  root + '/stores.js',
  `import{writable}from'svelte/store';export const page=writable({url:new URL(location.origin+'/crm/viaturas/car/editar'),data:{}});`,
);
await writeFile(
  root + '/navigation.js',
  `export function beforeNavigate(fn){(window.__beforeNavigate??=[]).push(fn)}
  export async function goto(url){let cancelled=false;const navigation={to:{url:new URL(url,location.origin)},from:{url:new URL(location.origin+'/crm/viaturas')},willUnload:false,type:'goto',cancel(){cancelled=true}};window.__beforeNavigate.forEach(fn=>fn(navigation));if(cancelled)throw Error('Navigation cancelled');(window.__gotoCalls??=[]).push(url)}
  export async function invalidateAll(){window.__invalidateCalls=(window.__invalidateCalls??0)+1}`,
);
await writeFile(
  root + '/clerk.js',
  `export function useClerkContext(){return{isLoaded:true,get session(){return{id:window.__sessionId??'demo',async getToken(options){(window.__tokenCalls??=[]).push(options);if(window.__authMode==='expired')return null;if(window.__authMode==='offline')throw Error('Simulated offline');return 'fake-session-token'}}}}}`,
);
const server = await createServer({
  root,
  configFile: false,
  plugins: [svelte(), tailwindcss()],
  resolve: {
    alias: {
      $lib: resolve('apps/crm/src/lib'),
      '$app/paths': root + '/paths.js',
      '$app/stores': root + '/stores.js',
      '$app/navigation': root + '/navigation.js',
      'svelte-clerk': root + '/clerk.js',
    },
  },
  server: { host: '127.0.0.1', port: 5197, strictPort: true, fs: { allow: [resolve('.')] } },
});
await server.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage({ viewport: { width: 390, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    const real = Date.now;
    window.__clockShift = 0;
    Date.now = () => real() + window.__clockShift;
    window.confirm = () => {
      window.__confirmCalls = (window.__confirmCalls ?? 0) + 1;
      return false;
    };
  });
  await p.goto('http://127.0.0.1:5197/');
  await p.locator('[name=model]').fill('Alteração por guardar');
  await p.waitForFunction(() => window.__tokenCalls?.length > 0);
  await p.evaluate(() => {
    window.__authMode = 'expired';
    window.__clockShift += 60000;
    window.dispatchEvent(new Event('focus'));
  });
  await p.getByRole('alert').waitFor();
  assert.equal(await p.locator('[name=model]').inputValue(), 'Alteração por guardar');
  assert.equal(await p.locator('.session-notice a').getAttribute('target'), '_blank');
  assert.equal(await p.evaluate(() => window.__gotoCalls?.length ?? 0), 0);
  await p.evaluate(() => {
    const nav = {
      to: { url: new URL(location.origin + '/crm/clientes') },
      from: { url: new URL(location.origin + '/crm/viaturas/car/editar') },
      willUnload: false,
      type: 'link',
      cancel() {
        window.__cancelCalls = (window.__cancelCalls ?? 0) + 1;
      },
    };
    window.__beforeNavigate.forEach((fn) => fn(nav));
  });
  await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => window.__gotoCalls?.length ?? 0), 0);
  assert.equal(await p.locator('[name=model]').inputValue(), 'Alteração por guardar');
  await p.evaluate(() => (window.__authMode = 'ready'));
  await p.locator('.session-notice').getByRole('button', { name: 'Tentar novamente' }).click();
  await p.waitForFunction(() => !document.querySelector('.session-notice'));
  assert.equal(await p.locator('[name=model]').inputValue(), 'Alteração por guardar');
  assert.equal(await p.evaluate(() => window.__invalidateCalls ?? 0), 0);
  await p.evaluate(() => {
    window.__setOverview();
    window.__clockShift += 60000;
    window.dispatchEvent(new Event('focus'));
  });
  await p.waitForTimeout(100);
  assert.equal(
    await p.evaluate(() => window.__invalidateCalls ?? 0),
    0,
    'dirty form must block automatic overview reload',
  );
  await p.evaluate(() => {
    window.__saveBaseline();
    window.__clockShift += 60000;
    window.dispatchEvent(new Event('focus'));
  });
  await p.waitForFunction(() => window.__invalidateCalls === 1);
  await p.locator('[name=model]').fill('Cancelar saída após recuperação');
  await p.evaluate(() => {
    window.__clockShift += 60000;
    window.__confirmCalls = 0;
    const navigation = {
      to: { url: new URL(location.origin + '/crm/clientes') },
      from: { url: new URL(location.origin + '/crm/viaturas') },
      willUnload: false,
      type: 'link',
      cancel() {},
    };
    window.__beforeNavigate.forEach((fn) => fn(navigation));
  });
  await p.waitForFunction(() => window.__confirmCalls === 1);
  assert.equal(await p.evaluate(() => window.__gotoCalls?.length ?? 0), 0);
  assert.equal(await p.locator('[name=model]').inputValue(), 'Cancelar saída após recuperação');
  await p.locator('.error-recovery').getByRole('button', { name: 'Tentar novamente' }).click();
  await p.getByText('A sessão foi validada. Guarde ou termine a edição antes de atualizar os dados.').waitFor();
  assert.equal(await p.evaluate(() => window.__invalidateCalls), 1);
  assert.equal(await p.locator('[name=model]').inputValue(), 'Cancelar saída após recuperação');
  assert.deepEqual(errors, []);
  console.log(
    'PASS idle expiry, retry preserves draft, clean overview refreshes, one unsaved confirmation and cancelled exit stays put',
  );
} finally {
  await b.close();
  await server.close();
}
