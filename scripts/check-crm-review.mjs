// Real route components + shell, isolated from Clerk, Supabase and business data.
// node scripts/check-crm-review.mjs [--serve | --screenshots | --tasks | --quick | --states]
// CRM_ROUTES limits screenshots; CRM_ALL_THEMES=1 crosses both widths and themes.
// PLAYWRIGHT_CHANNEL=chrome can use an installed Chrome.
import assert from 'node:assert/strict';
import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { dataFor, routes, initialTasks, user, activity, vehicle } from './crm-review-fixtures.mjs';
import { reviewDesign, reviewExpenses, reviewDashboardScope } from './crm-review-design.mjs';

const root = resolve('.cache/crm-review-browser'),
  output = resolve('.cache/crm-review');
await mkdir(root, { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(
  root + '/index.html',
  '<html lang="pt-PT" data-theme="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
);
await writeFile(
  root + '/fixture.css',
  `@import '../../apps/crm/src/app.css'; @source '../../apps/crm/src';`,
);
await writeFile(
  root + '/main.js',
  `import {mount} from 'svelte';import App from './App.svelte';const nativeFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await nativeFetch(...args);if(response.headers.get('x-fixture-network-error'))throw new TypeError('Simulated lost response');return response;};const initial=await fetch('/__fixture/state?url='+encodeURIComponent(location.href)).then(r=>r.json());mount(App,{target:document.getElementById('app'),props:{initial}});`,
);
await writeFile(
  root + '/App.svelte',
  `<script>
import Layout from '../../apps/crm/src/routes/(app)/+layout.svelte';
import {Toaster} from 'svelte-sonner';import {page} from './stores.js';import {theme} from '../../apps/crm/src/lib/stores/theme';import './fixture.css';
${[...new Set(Object.values(routes))].map((r, i) => `import Page${i} from '../../apps/crm/src/routes/(app)/${r}/+page.svelte';`).join('\n')}
const pages={${Object.entries(routes)
    .map(([p, r]) => `${JSON.stringify(p)}:Page${[...new Set(Object.values(routes))].indexOf(r)}`)
    .join(',')}};
let {initial}=$props();function start(){return initial}let data=$state(start());let current=$state(location.pathname);let form=$state(null);
window.__crmFixtureUpdate=(next)=>{data=next;current=location.pathname;page.set({url:new URL(location.href),data:next});};
window.__crmSetForm=next=>form=next;window.__crmFixtureUpdate(data);theme.hydrate();
let Component=$derived(pages[current]??pages['/tarefas']);
if(new URLSearchParams(location.search).get('__state')==='loading'){for(const key of ['list','expenses','dashboard'])if(key in data)data[key]=new Promise(()=>{});}
</script>
<Layout {data}>{#key current}<Component {data} {form}/>{/key}</Layout><Toaster/>`,
);
await writeFile(
  root + '/stores.js',
  `import {writable} from 'svelte/store';export const page=writable({url:new URL(location.href),data:{}});export const navigating=writable(null);`,
);
await writeFile(
  root + '/navigation.js',
  `
export async function invalidateAll(){if(window.__failRefresh){window.__failRefresh=false;throw new Error('Fixture refresh failed')}const data=await fetch('/__fixture/state?url='+encodeURIComponent(location.href)).then(r=>r.json());window.__crmFixtureUpdate(data);await new Promise(r=>setTimeout(r,0));}
export async function goto(url,options={}){window.__navigations=(window.__navigations??0)+1;window.__lastGoto=url;history[options.replaceState?'replaceState':'pushState']({},'',url);await invalidateAll();}
export function beforeNavigate(){}export function afterNavigate(fn){queueMicrotask(()=>fn({from:null,to:null}));}
`,
);
await writeFile(
  root + '/forms.js',
  `import {invalidateAll} from './navigation.js';
export function enhance(form,submit){const handler=async event=>{event.preventDefault();if(!form.reportValidity())return;const formData=new FormData(form);if(event.submitter?.name)formData.set(event.submitter.name,event.submitter.value);let cancelled=false;
const done=submit?.({formElement:form,formData,submitter:event.submitter,cancel(){cancelled=true}});if(cancelled)return;const result={type:'failure',status:422,data:{error:'Validação de teste: os dados preenchidos foram mantidos.'}};await done?.({result,update:async()=>window.__crmSetForm(result.data)});};form.addEventListener('submit',handler);return{destroy(){form.removeEventListener('submit',handler)}}}`,
);
await writeFile(root + '/environment.js', 'export const browser=true;export const dev=true;');
await writeFile(root + '/paths.js', `export const base='';export const assets='';`);
await writeFile(
  root + '/public-env.js',
  `export const PUBLIC_WEBSITE_URL='https://website.invalid';export const PUBLIC_BACKEND_URL='http://127.0.0.1:5192';`,
);
await writeFile(
  root + '/ClerkStub.svelte',
  `<script>let {children}=$props();</script>{@render children?.()}`,
);
await writeFile(
  root + '/clerk.js',
  `export {default as SignOutButton,default as UserProfile} from './ClerkStub.svelte';export function useClerkContext(){return {user:{username:'Demonstração',hasImage:false}}}`,
);
let tasks = structuredClone(initialTasks),
  operations = [],
  mode = 'success',
  latency = 0;
const fixture = {
  name: 'isolated-crm-review',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://fixture');
      const json = (value, status = 200) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(value));
      };
      if (url.pathname === '/__fixture/state') {
        json(dataFor(new URL(url.searchParams.get('url') ?? '/tarefas', 'http://fixture'), tasks));
        return;
      }
      if (url.pathname === '/__fixture/control') {
        let body = '';
        for await (const part of req) body += part;
        const control = JSON.parse(body || '{}');
        mode = control.mode ?? 'success';
        latency = control.latency ?? 0;
        if (control.reset) {
          tasks = structuredClone(initialTasks);
          operations = [];
        }
        if (control.tasks) tasks = control.tasks;
        json({ operations, tasks });
        return;
      }
      if (url.pathname === '/__fixture/photo') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect fill="#353a40" width="800" height="500"/><path d="M140 330H660L620 240H500L420 180H270L210 240H170Z" fill="#a9b0b7"/><circle cx="260" cy="330" r="45" fill="#17191d"/><circle cx="560" cy="330" r="45" fill="#17191d"/></svg>',
        );
        return;
      }
      if (url.pathname === '/api/notifications') {
        json({
          alerts: { stockAged: 1, tasksDueOrOverdue: 1, remindersToday: 0, draftVehicles: 0 },
          total: 2,
          recent: activity,
        });
        return;
      }
      if (url.pathname === '/api/users') {
        json({ items: [user] });
        return;
      }
      if (url.pathname === '/api/today-tasks') {
        json({ items: tasks.filter((t) => t.status !== 'DONE') });
        return;
      }
      if (url.pathname === '/api/search') {
        const q = url.searchParams.get('q') ?? '';
        json({
          q,
          vehicles: [],
          customers: [],
          tasks: tasks
            .filter((t) => t.title.toLowerCase().includes(q.toLowerCase()))
            .map((t) => ({
              id: t.id,
              primary: t.title,
              secondary: 'Tarefa de teste',
              href: '/tarefas/' + t.id + '/editar',
            })),
          total: 1,
        });
        return;
      }
      if (url.pathname === '/api/tasks' && req.method === 'GET') {
        json({ items: tasks.filter((t) => t.status === 'TODO') });
        return;
      }
      const statusMatch = url.pathname.match(/^\/tarefas\/([^/]+)\/(status|move)$/);
      if (statusMatch && req.method === 'PATCH') {
        let body = '';
        for await (const part of req) body += part;
        const move = JSON.parse(body);
        const { status } = move;
        operations.push({ id: statusMatch[1], ...move });
        const responseMode = mode;
        await new Promise((r) => setTimeout(r, latency));
        if (responseMode === 'reject') {
          json({ error: 'Alteração recusada pela fixture.' }, 422);
          return;
        }
        if (responseMode === 'offline') {
          res.setHeader('x-fixture-network-error', '1');
          json({});
          return;
        }
        const task = tasks.find((t) => t.id === statusMatch[1]);
        if (responseMode === 'conflict') task.boardVersion++;
        if (
          statusMatch[2] === 'move' &&
          (task.boardVersion !== move.expectedVersion ||
            [move.before, move.after].some(
              (anchor) =>
                anchor &&
                !tasks.some(
                  (t) =>
                    t.id === anchor.id && t.status === status && t.boardVersion === anchor.version,
                ),
            ))
        ) {
          json({ error: 'O quadro mudou entretanto.' }, 409);
          return;
        }
        tasks = tasks.filter((t) => t.id !== task.id);
        const moved = { ...task, status, boardVersion: task.boardVersion + 1 };
        const nextIndex = move.after ? tasks.findIndex((t) => t.id === move.after.id) : -1;
        const previousIndex = move.before ? tasks.findIndex((t) => t.id === move.before.id) : -1;
        tasks.splice(
          nextIndex >= 0 ? nextIndex : previousIndex >= 0 ? previousIndex + 1 : tasks.length,
          0,
          moved,
        );
        if (responseMode === 'uncertain') {
          res.setHeader('x-fixture-network-error', '1');
          json({});
          return;
        }
        json({ spawnedTaskId: null, nextOccurrenceDate: null, boardVersion: moved.boardVersion });
        return;
      }
      // Never forward writes or API calls beyond this in-memory fixture.
      if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
        json({ error: 'Unsupported fixture request' }, 405);
        return;
      }
      next();
    });
  },
};
const aliases = {
  $lib: resolve('apps/crm/src/lib'),
  '$app/navigation': root + '/navigation.js',
  '$app/forms': root + '/forms.js',
  '$app/stores': root + '/stores.js',
  '$app/paths': root + '/paths.js',
  '$app/environment': root + '/environment.js',
  '$env/static/public': root + '/public-env.js',
  'svelte-clerk': root + '/clerk.js',
};
const server = await createServer({
  root,
  configFile: false,
  plugins: [fixture, tailwindcss(), svelte()],
  resolve: { alias: aliases },
  server: {
    hmr: false,
    host: '127.0.0.1',
    port: 5192,
    strictPort: true,
    fs: { allow: [await realpath('.')] },
  },
});
await server.listen();
const origin = 'http://127.0.0.1:5192';
if (process.argv.includes('--serve')) {
  console.log(`CRM fixture: ${origin}/tarefas (fictional data; actual components)`);
} else {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      locale: 'pt-PT',
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    if (process.argv.includes('--dashboard-scope')) {
      await reviewDashboardScope(page, origin);
    } else if (process.argv.includes('--expenses')) {
      await reviewExpenses(page, origin, output, vehicle.id);
    } else if (process.argv.includes('--design')) {
      await reviewDesign(page, origin, output, process.argv.includes('--before'));
    } else if (process.argv.includes('--screenshots')) {
      const selected = process.env.CRM_ROUTES?.split(',') ?? Object.keys(routes);
      const results = [];
      for (const path of selected) {
        const name = (routes[path] ?? path)
          .replaceAll('/', '-')
          .replaceAll('[', '')
          .replaceAll(']', '');
        const variants = process.env.CRM_WIDTHS
          ? process.env.CRM_WIDTHS.split(',').flatMap((width) =>
              ['dark', 'light'].map((theme) => [Number(width), theme]),
            )
          : [
              [1440, 'dark'],
              [390, 'light'],
              ...(process.env.CRM_ALL_THEMES
                ? [
                    [1440, 'light'],
                    [390, 'dark'],
                  ]
                : []),
            ];
        for (const [width, theme] of variants) {
          console.log(`Review ${path} ${width}`);
          await page.setViewportSize({ width, height: 1050 });
          await page.goto(origin + path);
          await page.locator('main section').first().waitFor();
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);
          await page.waitForTimeout(150);
          await page.screenshot({
            path: output + `/${name}-${width}-${theme}.png`,
            fullPage: true,
          });
          const overflow = await page.evaluate(() =>
            [...document.querySelectorAll('main *')]
              .filter((el) => {
                const r = el.getBoundingClientRect(),
                  s = getComputedStyle(el);
                return (
                  r.width &&
                  r.right > innerWidth + 2 &&
                  s.position !== 'fixed' &&
                  s.visibility !== 'hidden'
                );
              })
              .slice(0, 8)
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent?.slice(0, 60),
              })),
          );
          results.push({ path, width, theme, overflow });
        }
      }
      await writeFile(output + '/visual-report.json', JSON.stringify({ results, errors }, null, 2));
      console.log(
        JSON.stringify(
          { routes: selected.length, errors, overflow: results.filter((r) => r.overflow.length) },
          null,
          2,
        ),
      );
    } else if (process.argv.includes('--states')) {
      for (const path of [
        '/viaturas',
        '/clientes',
        '/vendas',
        '/financeiro',
        '/tarefas',
        '/dashboard',
        '/definicoes',
      ]) {
        await page.goto(origin + path + '?__state=empty');
        await page.locator('main section').first().waitFor();
        await page.screenshot({
          path: output + `/empty-${path.replaceAll('/', '-')}.png`,
          fullPage: true,
        });
        if (!path.startsWith('/site/')) {
          await page.goto(origin + path + '?__state=error');
          await page
            .getByText('Não foi possível carregar os dados. Tente novamente.', { exact: true })
            .first()
            .waitFor();
        }
      }
      for (const path of ['/viaturas', '/clientes', '/vendas', '/financeiro', '/dashboard']) {
        await page.goto(origin + path + '?__state=loading');
        await page.locator('main section').first().waitFor();
        await page.screenshot({ path: output + `/loading-${path.slice(1)}.png` });
      }
      await page.goto(origin + '/viaturas?__state=empty&q=inexistente');
      await page.getByRole('link', { name: 'Limpar filtros', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Adicionar primeira viatura' }).count(), 0);
      await page.goto(origin + '/clientes?__state=empty&q=inexistente');
      await page.getByRole('button', { name: 'Limpar pesquisa', exact: true }).waitFor();
      await page.goto(origin + '/clientes');
      await page.locator('nav[aria-label="Paginação"]').waitFor();
      assert.equal(await page.locator('[aria-label="Página anterior"]').getAttribute('href'), null);
      assert.equal(
        await page.locator('[aria-label="Página seguinte"]').getAttribute('tabindex'),
        '-1',
      );
      await page.getByRole('button', { name: 'Exportar', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: /CSV/ }).waitFor();
      assert(
        await page
          .getByRole('menuitem', { name: /CSV/ })
          .evaluate((el) => el === document.activeElement),
      );
      await page.keyboard.press('ArrowDown');
      assert(
        await page
          .getByRole('menuitem', { name: /PDF/ })
          .evaluate((el) => el === document.activeElement),
      );
      await page.keyboard.press('Escape');
      assert(
        await page
          .getByRole('button', { name: 'Exportar', exact: true })
          .evaluate((el) => el === document.activeElement),
      );
      await page.goto(origin + '/vendas');
      await page.getByRole('button', { name: 'Ordenar vendas por lucro' }).focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(/sortBy=realProfit/);
      await page
        .locator('th[aria-sort="descending"]')
        .filter({ has: page.getByRole('button', { name: 'Ordenar vendas por lucro' }) })
        .waitFor();
      await page.goto(origin + '/tarefas/task-urgent/editar');
      await page.getByRole('link', { name: '← Voltar a tarefas' }).waitFor();
      assert.equal(
        await page.getByRole('link', { name: '← Voltar a tarefas' }).getAttribute('href'),
        '/tarefas',
      );
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [path, href] of [
        ['/tarefas', '/tarefas/nova'],
        ['/clientes', '/clientes/novo'],
      ]) {
        await page.goto(origin + path);
        await page.locator('main section').first().waitFor();
        assert.equal(
          await page.locator(`main a[href="${href}"]:visible`).count(),
          1,
          'One primary create action on mobile',
        );
      }
      for (const path of ['/vendas/fixture-sale', '/tarefas/task-urgent/editar']) {
        await page.goto(origin + path);
        await page.locator('main section').first().waitFor();
        const clipped = await page.locator('main').evaluate((main) =>
          [...main.querySelectorAll('a,button,input,select')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden')
                return false;
              return r.right > innerWidth + 2 || r.left < 0;
            })
            .map((el) => el.textContent?.trim() || el.getAttribute('name')),
        );
        assert.deepEqual(clipped, [], `No clipped actions: ${path}`);
        await page.screenshot({
          path: output + `/mobile-actions-${path.replaceAll('/', '-')}.png`,
          fullPage: true,
        });
      }
      await page.goto(origin + '/tarefas/nova');
      await page
        .getByRole('textbox', { name: 'Título', exact: true })
        .fill('Título mantido após falha');
      await page.getByRole('button', { name: /^Criar Tarefa$/i }).click();
      await page.locator('[data-form-error-summary]').waitFor();
      assert.equal(
        await page.getByRole('textbox', { name: 'Título', exact: true }).inputValue(),
        'Título mantido após falha',
      );
      console.log(
        'PASS empty/error/loading routes, contextual empty actions, non-actionable pagination boundaries, keyboard export/sort, task return URL, narrow-screen actions, and form error preservation.',
      );
    } else if (process.argv.includes('--tasks') || process.argv.includes('--quick')) {
      const control = async (data) =>
        page.request.post(origin + '/__fixture/control', { data }).then((r) => r.json());
      const card = (id) => page.locator(`[data-task-id="${id}"]`);
      const column = (status) => page.locator(`[data-task-column="${status}"]`);
      const waitSaved = () =>
        page.waitForFunction(() => !document.querySelector('.task-card[aria-busy="true"]'));
      const where = async (id) => card(id).evaluate((el) => el.parentElement.dataset.taskColumn);
      const reset = async () => {
        await control({ reset: true });
        await page.goto(origin + '/tarefas');
        await card('task-urgent').waitFor();
      };
      const drag = async (id, status) => {
        const a = await card(id).boundingBox(),
          b = await column(status).boundingBox();
        await page.mouse.move(a.x + a.width - 12, a.y + 24);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + 65, { steps: 24 });
        await page.waitForTimeout(230);
        await page.mouse.up();
        await page.waitForTimeout(250);
        await waitSaved();
      };
      if (!process.argv.includes('--quick')) {
        const order = () =>
          column('TODO')
            .locator('[data-task-id]')
            .evaluateAll((els) => els.map((el) => el.dataset.taskId));
        await reset();
        const a = await card('task-high').boundingBox(),
          b = await card('task-urgent').boundingBox();
        await page.mouse.move(a.x + a.width - 12, a.y + 24);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + 15, { steps: 24 });
        await page.waitForTimeout(230);
        await page.mouse.up();
        await page.waitForTimeout(250);
        await waitSaved();
        assert.deepEqual(
          await order(),
          ['task-high', 'task-urgent'],
          'Pointer rearranges a column',
        );
        await page.reload();
        await card('task-high').waitFor();
        assert.deepEqual(
          await order(),
          ['task-high', 'task-urgent'],
          'Saved order survives reload',
        );
        await card('task-high').focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowDown');
        assert.equal((await control({})).operations.length, 1, 'Keyboard order remains a draft');
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        await waitSaved();
        assert.deepEqual(
          await order(),
          ['task-urgent', 'task-high'],
          'Keyboard saves the new order',
        );
        await page.reload();
        await card('task-high').waitFor();
        assert.deepEqual(await order(), ['task-urgent', 'task-high']);
        await control({ mode: 'conflict' });
        await card('task-high').getByRole('combobox').selectOption('IN_PROGRESS');
        await waitSaved();
        assert.equal(await where('task-high'), 'TODO', 'A version conflict reloads server state');
        await page
          .getByText('O quadro mudou entretanto e foi atualizado. Volte a mover a tarefa.')
          .waitFor();
        await reset();
        assert.equal(await column('TODO').locator(':scope > *').count(), 2);
        await drag('task-urgent', 'IN_PROGRESS');
        assert.equal(await where('task-urgent'), 'IN_PROGRESS', 'Pointer drop moves into target');
        assert.equal((await control({})).operations.length, 1, 'One status write per gesture');
        await control({ mode: 'reject' });
        await drag('task-high', 'IN_PROGRESS');
        assert.equal(await where('task-high'), 'TODO', 'Rejected move restores source');
        assert.equal(await card('task-high').count(), 1, 'Rejected move leaves one copy');
        assert.equal(
          await where('task-urgent'),
          'IN_PROGRESS',
          'Previous successful move is preserved',
        );
        await reset();
        await control({ tasks: initialTasks.filter((t) => t.id !== 'task-low') });
        await page.reload();
        await card('task-urgent').waitFor();
        assert.equal(
          await column('DONE').locator(':scope > *').count(),
          0,
          'Empty message is outside the DnD items',
        );
        await drag('task-urgent', 'DONE');
        assert.equal(await where('task-urgent'), 'DONE', 'Drop into an empty column');
        await reset();
        await card('task-urgent').focus();
        await page.keyboard.press('Space');
        // Native keyboard navigation may pass the title link; moving across columns must not write until drop.
        for (let i = 0; i < 12 && (await where('task-urgent')) !== 'IN_PROGRESS'; i++)
          await page.keyboard.press('Tab');
        assert.equal(
          await where('task-urgent'),
          'IN_PROGRESS',
          'Keyboard drag reaches the next column',
        );
        assert.equal((await control({})).operations.length, 0, 'Keyboard traversal is a draft');
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        await waitSaved();
        assert.equal((await control({})).operations.length, 1, 'Keyboard drop commits only once');
        assert.equal(
          await card('task-urgent').evaluate((el) => el === document.activeElement),
          true,
          'Focus follows the moved task',
        );
        await reset();
        const initialBoardTop = (await column('TODO').boundingBox()).y;
        await card('task-urgent').focus();
        await page.keyboard.press('Space');
        assert.equal(
          (await column('TODO').boundingBox()).y,
          initialBoardTop,
          'Drag instructions do not shift the board',
        );
        for (let i = 0; i < 12 && (await where('task-urgent')) !== 'IN_PROGRESS'; i++)
          await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        assert.equal(await where('task-urgent'), 'TODO', 'Escape cancels the keyboard draft');
        assert.equal((await control({})).operations.length, 0, 'Cancelled drag never writes');
        assert(
          await card('task-urgent').evaluate((el) => el === document.activeElement),
          'Cancellation restores focus',
        );
        await reset();
        await control({ mode: 'success', latency: 350 });
        await card('task-high').getByRole('combobox').selectOption('IN_PROGRESS');
        assert(
          await card('task-urgent').getByRole('combobox').isDisabled(),
          'Another move is blocked while saving',
        );
        await waitSaved();
        assert.equal(await where('task-high'), 'IN_PROGRESS');
        await reset();
        await page.evaluate(() => (window.__failRefresh = true));
        await card('task-urgent').getByRole('combobox').selectOption('IN_PROGRESS');
        await waitSaved();
        assert.equal(
          await where('task-urgent'),
          'IN_PROGRESS',
          'Refresh failure cannot revert a saved move',
        );
        await page
          .getByText('Alteração guardada. Não foi possível atualizar o restante quadro.')
          .waitFor();
        await reset();
        await control({ mode: 'uncertain' });
        await card('task-urgent').getByRole('combobox').selectOption('IN_PROGRESS');
        await waitSaved();
        assert.equal(
          await where('task-urgent'),
          'IN_PROGRESS',
          'Lost response reconciles with the committed state',
        );
        assert.equal(
          (await control({})).operations.length,
          1,
          'Reconciliation does not retry the write',
        );
        await reset();
        await control({ mode: 'offline' });
        await page.evaluate(() => (window.__failRefresh = true));
        await card('task-high').getByRole('combobox').selectOption('IN_PROGRESS');
        await waitSaved();
        await page.getByRole('button', { name: 'Verificar estado guardado' }).waitFor();
        assert(
          await card('task-urgent').getByRole('combobox').isDisabled(),
          'Unconfirmed state stays locked',
        );
        await control({ mode: 'success' });
        await page.getByRole('button', { name: 'Verificar estado guardado' }).click();
        await page.waitForFunction(() => !document.querySelector('main select[disabled]'));
        assert.equal(
          await where('task-high'),
          'TODO',
          'Explicit verification shows the server state',
        );
        await reset();
        const search = page.getByRole('searchbox', { name: 'Pesquisar tarefas' });
        await search.pressSequentially('documentação', { delay: 15 });
        assert.equal(await page.evaluate(() => window.__navigations ?? 0), 0);
        await page.waitForTimeout(350);
        assert.equal(
          await page.evaluate(() => window.__navigations),
          1,
          'Fast typing triggers one navigation',
        );
        await search.fill('fotografias');
        await page.getByRole('button', { name: 'Alta', exact: true }).click();
        await page.waitForTimeout(350);
        assert.match(page.url(), /q=fotografias/);
        assert.match(page.url(), /priority=HIGH/);
        await page.getByRole('button', { name: 'Limpar', exact: true }).click();
        assert.equal(new URL(page.url()).search, '');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await reset();
        await card('task-urgent').getByRole('combobox').selectOption('IN_PROGRESS');
        await waitSaved();
        assert(await card('task-urgent').isVisible());
        assert.equal(
          await card('task-urgent')
            .getByRole('combobox')
            .evaluate((el) => el === document.activeElement),
          true,
          'Mobile state change restores focus in visible column',
        );
        await page.screenshot({ path: output + '/tasks-mobile-interaction.png', fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await reset();
      await page
        .getByRole('button', { name: /Tarefas rápidas/ })
        .first()
        .click();
      const quick = page.getByRole('dialog', { name: 'Tarefas rápidas' });
      await quick.getByRole('combobox', { name: 'Atribuir a' }).selectOption('');
      assert.equal(
        await quick.getByRole('combobox', { name: 'Atribuir a' }).inputValue(),
        '',
        'General assignment remains selected',
      );
      const quickAdvance = (id) =>
        quick.getByRole('button', {
          name: `Marcar em curso: ${initialTasks.find((task) => task.id === id).title}`,
          exact: true,
        });
      await control({ mode: 'success', latency: 350 });
      const firstRequest = page.waitForRequest((request) =>
        request.url().endsWith('/tarefas/task-urgent/status'),
      );
      await quickAdvance('task-urgent').click();
      await firstRequest;
      await control({ mode: 'reject', latency: 450 });
      const secondResponse = page.waitForResponse((response) =>
        response.url().endsWith('/tarefas/task-high/status'),
      );
      await quickAdvance('task-high').click();
      await secondResponse;
      try {
        await quickAdvance('task-high').waitFor({ timeout: 3000 });
      } catch (error) {
        console.error(JSON.stringify(await control({})));
        await page.screenshot({ path: output + '/quick-failure.png' });
        console.error('Quick panels:', await quick.count());
        if (await quick.count()) console.error(await quick.innerText());
        throw error;
      }
      assert.equal(
        await quickAdvance('task-urgent').count(),
        0,
        'A failed row does not restore a successful sibling',
      );
      await control({ mode: 'uncertain' });
      await quickAdvance('task-high').click();
      await page.waitForTimeout(450);
      assert.equal(
        await quickAdvance('task-high').count(),
        0,
        'Quick tasks reconcile a committed lost response',
      );
      assert.equal(
        (await control({})).operations.length,
        3,
        'Quick task reconciliation never retries the write',
      );
      await quick.getByRole('textbox', { name: 'Título da nova tarefa' }).focus();
      await page.keyboard.press('Escape');
      await quick.waitFor({ state: 'hidden' });
      assert.equal(await quick.count(), 0);
      assert(
        await page
          .getByRole('button', { name: /Tarefas rápidas/ })
          .first()
          .evaluate((el) => el === document.activeElement),
        'Closing quick tasks returns focus to the trigger',
      );
      await page.screenshot({ path: output + '/tasks-desktop-interaction.png', fullPage: true });
      console.log(
        process.argv.includes('--quick')
          ? 'PASS quick tasks: general assignment, panel stays open after advancing, concurrent rollback, lost-response reconciliation and closing focus.'
          : 'PASS task board: pointer/keyboard/empty-column moves, cancellation, one write per gesture, full rollback, lost-response reconciliation, refresh failure, pending lock, focus, mobile selector, reduced motion and debounced filters. Quick tasks: general assignment, concurrent rollback, lost response and closing focus.',
      );
    } else {
      await page.goto(origin + '/tarefas');
      await page.locator('.task-card').first().waitFor();
      console.log('CRM review fixture ready; route components mounted.');
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
  } finally {
    await browser.close();
    await server.close();
  }
}
