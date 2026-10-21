// Start `node scripts/check-crm-review.mjs --serve` first. All data is fictional.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { vehicle, customer, sale } from './crm-review-fixtures.mjs';

const origin = 'http://127.0.0.1:5192';
const output = '.cache/crm-row-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('**/*', (route) =>
  new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const cases = [
  ['/viaturas', `/viaturas/${vehicle.id}`, 2],
  ['/clientes', `/clientes/${customer.id}`, 1],
  ['/vendas', `/vendas/${sale.id}`, 3],
  ['/dashboard', `/viaturas/${vehicle.id}`, 2],
];
const results = [];
const open = async (path) => {
  await page.goto(origin + path);
  await page.locator('main').waitFor();
};
try {
  for (const [path, destination, column] of cases) {
    const row = () => page.locator('tr.linked-row').first();
    const cell = () => row().locator('td').nth(column);
    await open(path);
    await row().waitFor();
    assert.equal(await cell().evaluate((e) => getComputedStyle(e).cursor), 'pointer');
    await cell().click();
    await page.waitForURL(origin + destination);
    for (const options of [{ modifiers: ['Control'] }, { button: 'middle' }]) {
      await open(path);
      const popup = context.waitForEvent('page');
      await cell().click(options);
      const tab = await popup;
      await tab.waitForLoadState();
      assert.equal(new URL(tab.url()).pathname, destination);
      assert.equal(new URL(page.url()).pathname, path);
      await tab.close();
    }
    await open(path);
    await row().locator('.row-link').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await row().evaluate((e) => e.matches(':has(.row-link:focus-visible)')), true);
    await page.keyboard.press('Enter');
    await page.waitForURL(origin + destination);
    // Meta is forwarded to the real anchor; native new-tab behavior is OS-dependent.
    await open(path);
    await row()
      .locator('.row-link')
      .evaluate((link) => {
        link.addEventListener(
          'click',
          (e) => {
            window.__rowMeta = e.metaKey;
            e.preventDefault();
          },
          { once: true },
        );
      });
    await cell().click({ modifiers: ['Meta'] });
    assert.equal(await page.evaluate(() => window.__rowMeta), true);
    assert.equal(new URL(page.url()).pathname, path);
    results.push(`${path}: full row, Ctrl, middle, Meta forwarding, native keyboard`);
  }

  await open('/viaturas');
  const mileage = page.locator('tr.linked-row td').nth(2);
  const text = await mileage.evaluate((cell) => {
    const range = document.createRange();
    range.selectNodeContents(cell);
    const r = range.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.move(text.x - 2, text.y + text.height / 2);
  await page.mouse.down();
  await page.mouse.move(text.x + text.width + 2, text.y + text.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.match(await page.evaluate(() => getSelection().toString()), /42/);
  assert.equal(new URL(page.url()).pathname, '/viaturas');
  await page.evaluate(() => getSelection().removeAllRanges());

  for (const [path, id] of [
    ['/viaturas', vehicle.id],
    ['/clientes', customer.id],
  ]) {
    await open(path);
    await page.locator('tr.linked-row .edit-link').first().click();
    await page.waitForURL(origin + path + '/' + id + '/editar');
    await open(path);
    await page.locator('tr.linked-row .more-button').first().click();
    assert.equal(new URL(page.url()).pathname, path);
    await page.getByRole('menuitem', { name: 'Ver ficha' }).click();
    await page.waitForURL(origin + path + '/' + id);
  }
  await open('/vendas');
  await page.locator(`tr.linked-row a[href="/clientes/${customer.id}"]`).click();
  await page.waitForURL(origin + `/clientes/${customer.id}`);
  await open('/clientes');
  for (const protocol of ['tel:', 'mailto:']) {
    const contact = page.locator(`tr.linked-row a.contact-link[href^="${protocol}"]`).first();
    await contact.evaluate((link) =>
      link.addEventListener(
        'click',
        (e) => {
          window.__contact = link.getAttribute('href');
          e.preventDefault();
        },
        { once: true },
      ),
    );
    await contact.click();
    assert((await page.evaluate(() => window.__contact)).startsWith(protocol));
    assert.equal(new URL(page.url()).pathname, '/clientes');
  }
  results.push('Selection/copy preserved; Edit, menu, customer and contact actions independent');

  const showDraft = async () => {
    await open('/viaturas');
    await page.evaluate(async () => {
      const data = await fetch('/__fixture/state?url=' + encodeURIComponent(location.href)).then(
        (r) => r.json(),
      );
      data.drafts.items = [{ ...data.list.items[0], status: 'DRAFT' }];
      window.__crmFixtureUpdate(data);
    });
    await page.locator('li.linked-row').waitFor();
  };
  await showDraft();
  await page.locator('li.linked-row').click({ position: { x: 5, y: 5 } });
  await page.waitForURL(origin + `/viaturas/${vehicle.id}`);
  await showDraft();
  await page
    .locator('li.linked-row')
    .getByRole('link', { name: /Completar ficha/ })
    .click();
  await page.waitForURL(origin + `/viaturas/${vehicle.id}/publicar`);

  await open('/vendas');
  const sort = page.getByRole('button', { name: 'Ordenar vendas por valor' });
  const box = await sort.boundingBox();
  await sort.click({ position: { x: 2, y: box.height / 2 } });
  await page.waitForURL(/sortBy=salePrice/);
  await open('/financeiro');
  const expenseCell = page.locator('td[data-column="amount"]').first();
  assert.notEqual(await expenseCell.evaluate((e) => getComputedStyle(e).cursor), 'pointer');
  await expenseCell.click();
  assert.equal(new URL(page.url()).pathname, '/financeiro');

  await open('/atividade');
  await page.evaluate(async () => {
    const data = await fetch('/__fixture/state?url=' + encodeURIComponent(location.href)).then(
      (r) => r.json(),
    );
    data.result.items.push({
      ...data.result.items[0],
      id: 'deleted-event',
      type: 'VEHICLE_DELETED',
      message: 'Viatura eliminada — fixture',
      entityId: 'deleted',
    });
    window.__crmFixtureUpdate(data);
  });
  const deleted = page.locator('li').filter({ hasText: 'Viatura eliminada — fixture' });
  assert.equal(await deleted.locator('a').count(), 0);
  assert.notEqual(await deleted.evaluate((e) => getComputedStyle(e).cursor), 'pointer');
  await page.getByRole('button', { name: 'Alertas', exact: true }).click();
  const notification = page
    .getByRole('dialog', { name: 'Alertas', exact: true })
    .locator('a')
    .filter({ hasText: 'Renault Clio adicionado ao inventário.' });
  const popup = context.waitForEvent('page');
  await notification.click({ modifiers: ['Control'] });
  const tab = await popup;
  await tab.waitForLoadState();
  assert.equal(new URL(tab.url()).pathname, `/viaturas/${vehicle.id}`);
  await tab.close();
  assert.equal(
    await page.getByRole('button', { name: 'Alertas', exact: true }).getAttribute('aria-expanded'),
    'true',
  );
  await notification.click();
  await page.waitForURL(origin + `/viaturas/${vehicle.id}`);
  results.push(
    'Sort header whole target, non-navigable expenses/deleted activity, native notification links',
  );

  for (const width of [320, 390, 820, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const path of ['/financeiro', `/viaturas/${vehicle.id}`]) {
      await open(path);
      await page
        .getByRole('button', {
          name: path === '/financeiro' ? 'Nova despesa' : 'Adicionar',
          exact: true,
        })
        .click();
      const add = page.locator('form[action="?/addExpense"]');
      await add.waitFor();
      const measurements = await add.evaluate((form) => {
        const rect = form.getBoundingClientRect();
        return [...form.querySelectorAll('input:not([type="hidden"]),select,button')].map((e) => {
          const r = e.getBoundingClientRect();
          return {
            name: e.name,
            width: r.width,
            inside: r.left >= rect.left - 1 && r.right <= rect.right + 1,
          };
        });
      });
      assert(
        measurements.every((m) => m.inside),
        `${path} ${width}: form controls within panel`,
      );
      assert(
        measurements.find((m) => m.name === 'date').width >= 130,
        `${path} ${width}: date legible`,
      );
      assert(
        measurements.find((m) => m.name === 'amount').width <= 151,
        `${path} ${width}: bounded amount`,
      );
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const layout = await page.locator('.expense-table').evaluate((table) => ({
        panelWidth: table.closest('.expense-layout').getBoundingClientRect().width,
        rowDisplay: getComputedStyle(table.querySelector('tbody tr')).display,
        width: table.getBoundingClientRect().width,
        viewport: table.parentElement.getBoundingClientRect().width,
      }));
      assert.equal(layout.rowDisplay, layout.panelWidth < 680 ? 'grid' : 'table-row');
      assert(layout.width <= layout.viewport + 1, `${path} ${width}: all expense columns visible`);
      await page.screenshot({
        path: `${output}/${path === '/financeiro' ? 'finance' : 'vehicle'}-expense-${width}.png`,
        fullPage: true,
      });
      await add.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page
        .locator('td[data-column="actions"]')
        .first()
        .getByRole('button', { name: /Editar/ })
        .click();
      const edit = page.locator('form[action="?/updateExpense"]');
      await edit.waitFor();
      await edit.locator('input[name="description"]').fill('Texto de teste preservado');
      await edit.getByRole('button', { name: 'Guardar', exact: true }).click();
      await page.waitForTimeout(100);
      assert.equal(
        await edit.locator('input[name="description"]').inputValue(),
        'Texto de teste preservado',
      );
      const valid = await edit.evaluate((f) =>
        [...f.querySelectorAll('input:not([type="hidden"]),select,button')].every(
          (e) => e.getBoundingClientRect().right <= f.getBoundingClientRect().right + 1,
        ),
      );
      assert(valid, `${path} ${width}: edit form fits`);
      await edit.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
  }
  results.push('Expense add/edit/cancel and failed save retained values at 320/390/820/1440/2560');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, destination] of cases.slice(0, 3)) {
    await open(path);
    await page.locator(`main a[href="${destination}"]:visible`).first().click();
    await page.waitForURL(origin + destination);
  }
  await page.setViewportSize({ width: 820, height: 1080 });
  await open('/vendas');
  const region = page.getByRole('region', { name: 'Vendas — tabela com deslocamento horizontal' });
  await region.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  assert(await region.evaluate((el) => el.scrollLeft > 0));
  results.push(
    'Draft row/detail vs complete action; mobile card navigation; keyboard horizontal table scroll',
  );

  for (const width of [390, 820, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const path of ['/viaturas', '/clientes', '/vendas']) {
      await open(path);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
        if (width >= 820) await page.locator('tr.linked-row').first().hover();
        await page.waitForTimeout(200);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({
          path: `${output}/${path.slice(1)}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
