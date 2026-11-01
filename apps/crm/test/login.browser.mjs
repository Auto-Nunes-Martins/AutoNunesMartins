// Real login page and CSS; Clerk resources are simulated. No credentials or email codes.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer as httpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
let vite, server, browser, origin;
const documentRequests = [];
before(async () => {
  await mkdir(path.join(appRoot, '.svelte-kit'), { recursive: true });
  const directory = await mkdtemp(path.join(appRoot, '.svelte-kit/login-review-'));
  const write = (name, value) => writeFile(path.join(directory, name), value);
  await write('package.json', '{"type":"module"}');
  await write('review.css', "@import '../../src/app.css';\n@source '../../src';");
  await write('client.js', `import './review.css';import {mount} from 'svelte';import Page from '$login';mount(Page,{target:document.querySelector('#app')});`);
  await write('clerk.svelte.js', `
    export {default as SignIn} from './SignIn.svelte';
    export {default as ClerkLoading} from './ClerkLoading.svelte';
    const context=$state({isLoaded:true,session:null,step:'identifier'});
    export const useClerkContext=()=>context;
    window.loginReview={activate(){context.session={id:'session-fixture'};},code(){context.step='code';},unload(){context.isLoaded=false;},shallow(){history.pushState({},'', '/crm/a-entrar');}};
  `);
  await write('ClerkLoading.svelte', '<script>let {children}=$props();</script>');
  await write('SignIn.svelte', `
    <script>import {useClerkContext} from './clerk.svelte.js';const fixture=useClerkContext();</script>
    <div class="cl-rootBox login-auth-root"><div class="cl-cardBox"><div class="cl-card login-auth-card">
      <div class="cl-main">
      {#if fixture.step==='code'}
      <p>Check your email</p>
      <div class="cl-otpCodeFieldInputs">{#each Array(6) as _,i}<input class="cl-otpCodeFieldInput" aria-label={'Digit '+(i+1)} maxlength="1" />{/each}</div>
      {:else}
      <button type="button" class="login-social-button">Continue with Google</button>
      <div class="fixture-divider">or</div>
      <div class="cl-formFieldLabelRow"><label class="login-field-label" for="identifier">Email address or username</label><span class="cl-badge">Last used</span></div>
      <input class="login-field-input" id="identifier" placeholder="Enter email or username" />
      {/if}
      <button type="button" class="login-primary-button">Continue <span aria-hidden="true">▸</span></button>
      <p class="fixture-footer">Secured by Clerk</p>
      </div>
    </div></div></div>
    <style>
      .cl-cardBox,.cl-card{overflow:hidden;border-radius:8px}
      .cl-rootBox{width:400px}.cl-card{padding:32px}
      button,input{display:flex;align-items:center;justify-content:center;width:100%;border-radius:6px}
      button{gap:8px}input{padding:12px}label{display:block}
      .cl-formFieldLabelRow{display:flex;justify-content:space-between;align-items:center}
      .cl-badge{overflow:hidden;height:14px;line-height:14px;border:1px solid var(--color-border);border-radius:16px;padding:0 5px;font-size:11px}
      .cl-otpCodeFieldInputs{display:flex;gap:8px}.cl-otpCodeFieldInput{width:44px;min-width:44px;flex-shrink:0}
      .fixture-divider{text-align:center;margin:24px 0;color:var(--color-text-muted)}
      .login-primary-button{margin-top:27px}.fixture-footer{text-align:center;margin-top:14px;color:var(--color-text-muted)}
    </style>
  `);
  await write('stores.js', "import {writable} from 'svelte/store';export const page=writable({url:new URL('http://fixture/crm/')});");
  await write('environment.js', 'export const browser=true;');
  await write('paths.js', "export const base='/crm';");
  server = httpServer(async (req, res) => {
    if (req.url === '/crm/a-entrar') {
      documentRequests.push(req.headers['sec-fetch-dest']);
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<h1>A preparar o seu painel.</h1>');
      return;
    }
    if (req.url === '/') {
      const html = await vite.transformIndexHtml('/', '<html><head></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
      return;
    }
    vite.middlewares(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  vite = await createServer({ configFile:false,root:directory,publicDir:path.join(appRoot,'static'),
    plugins:[tailwindcss(),svelte({configFile:false})],resolve:{alias:[
      {find:'$login',replacement:path.join(appRoot,'src/routes/+page.svelte')},
      {find:'svelte-clerk',replacement:path.join(directory,'clerk.svelte.js')},
      {find:'$app/stores',replacement:path.join(directory,'stores.js')},
      {find:'$app/environment',replacement:path.join(directory,'environment.js')},
      {find:'$app/paths',replacement:path.join(directory,'paths.js')},
      {find:'$lib',replacement:path.join(appRoot,'src/lib')},
    ]},server:{middlewareMode:true,hmr:false,fs:{allow:[path.resolve(appRoot,'../..')]}},
    optimizeDeps:{entries:['client.js']},logLevel:'error' });
  browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome'});
});
after(async () => {
  await browser?.close(); await vite?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  // Preserve generated fixtures: project policy prohibits automatic directory cleanup.
});

for (const width of [1440, 780, 390, 320]) test(`login controls and focus remain visible at ${width}px`, async () => {
  const page = await browser.newPage({viewport:{width,height:1100}});
  try {
    await page.goto(origin); await page.locator('.login-field-input').waitFor();
    const geometry = await page.locator('.auth-container').evaluate(container => {
      const bounds=container.getBoundingClientRect();
      return [...container.querySelectorAll('button,input')].map(el => {
        const r=el.getBoundingClientRect();
        const clipping=[];
        for(let p=el.parentElement;p && p!==document.body;p=p.parentElement){
          if(/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflow))clipping.push(p.className);
        }
        return {left:r.left,right:r.right,width:r.width,containerLeft:bounds.left,containerRight:bounds.right,clipping};
      });
    });
    for(const control of geometry){
      assert.ok(Math.abs(control.left-control.containerLeft)<1);
      assert.ok(Math.abs(control.right-control.containerRight)<1);
      assert.deepEqual(control.clipping,[]);
    }
    await page.locator('.login-field-input').focus();
    assert.ok(await page.locator('.login-field-input').evaluate(el=>parseFloat(getComputedStyle(el).outlineWidth)>0));
    const badge=await page.locator('.cl-badge').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
    assert.ok(badge.scroll<=badge.width && badge.scrollHeight<=badge.height);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.LOGIN_REVIEW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.LOGIN_REVIEW_SCREENSHOTS,`login-${width}.png`),fullPage:true});
    await page.evaluate(()=>window.loginReview.code());
    await page.locator('.cl-otpCodeFieldInput').first().waitFor();
    assert.ok(await page.locator('.auth-container').evaluate(el=>{
      const r=el.getBoundingClientRect();
      return [...el.querySelectorAll('input,button')].every(control=>{const c=control.getBoundingClientRect();return c.left>=r.left-1 && c.right<=r.right+1;});
    }));
    await page.locator('.cl-otpCodeFieldInput').last().focus();
    if(process.env.LOGIN_REVIEW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.LOGIN_REVIEW_SCREENSHOTS,`login-code-${width}.png`),fullPage:true});
  } finally { await page.close(); }
});

test('email-code session activation leaves a shallow-updated login by a document request', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(origin); await page.locator('.login-field-input').waitFor();
    await page.evaluate(()=>window.loginReview.shallow());
    assert.equal(await page.locator('.login-field-input').count(),1);
    await page.evaluate(()=>window.loginReview.activate());
    await page.waitForURL(origin+'/crm/a-entrar');
    await page.getByRole('heading',{name:'A preparar o seu painel.'}).waitFor();
    assert.equal(documentRequests.at(-1),'document');
  } finally { await page.close(); }
});

test('an unloaded SDK or absent session does not navigate away from login', async () => {
  const page=await browser.newPage();
  try {
    await page.goto(origin); await page.locator('.login-field-input').waitFor();
    await page.evaluate(()=>{window.loginReview.unload();window.loginReview.activate();});
    await page.waitForTimeout(100);
    assert.equal(page.url(),origin+'/');
  } finally { await page.close(); }
});
