import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function reviewDesign(page, origin, output, before = false) {
  const results = [];
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto(origin + '/tarefas');
    await page.locator('.task-card').first().waitFor();
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    const samples = [
      ['filter', page.getByRole('button', { name: 'Alta', exact: true })],
      ['export', page.getByRole('button', { name: /Exportar/ }).first()],
      ['icon', page.getByRole('button', { name: 'Alertas', exact: true })],
      ['sidebar', page.locator('.nav-item').filter({ hasText: 'Financeiro' }).first()],
    ];
    for (const [name, locator] of samples) {
      const style = () =>
        locator.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            background: s.backgroundColor,
            shadow: s.boxShadow,
            color: s.color,
            border: s.borderColor,
            outline: s.outlineStyle,
          };
        });
      await page.mouse.move(2540, 5);
      await page.waitForTimeout(200);
      const resting = await style();
      await locator.hover();
      await page.waitForTimeout(200);
      const hovered = await style();
      await page.screenshot({
        path: `${output}/hover-${name}-${theme}${before ? '-before' : ''}.png`,
      });
      if (!before)
        assert(
          resting.background !== hovered.background || resting.shadow !== hovered.shadow,
          `${theme} ${name}: hover must visibly change the surface`,
        );
      await locator.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const focused = await style();
      if (!before) assert.notEqual(focused.outline, 'none', `${name}: keyboard focus`);
      results.push({ theme, name, resting, hovered, focused });
    }
    const contrast = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      const pixel = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      const lum = (rgb) =>
        rgb
          .slice(0, 3)
          .map((x) => x / 255)
          .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
          .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
      return [
        'success',
        'warning',
        'info',
        'danger',
        'priority-low',
        'priority-medium',
        'priority-high',
        'priority-urgent',
      ].map((token) => {
        const el = document.createElement('span');
        el.style.color = `var(--color-${token})`;
        el.style.background = `color-mix(in srgb, var(--color-${token}) 12%, var(--color-bg-1))`;
        document.body.append(el);
        const s = getComputedStyle(el),
          fg = pixel(s.color),
          bg = pixel(s.backgroundColor);
        const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
        el.remove();
        return { token, ratio: Number(ratio.toFixed(2)) };
      });
    });
    if (!before)
      for (const item of contrast)
        assert(item.ratio >= 4.5, `${theme} ${item.token}: ${item.ratio}`);
    results.push({ theme, contrast });
    if (!before) {
      await page.getByRole('button', { name: 'Exportar', exact: true }).click();
      const item = page.getByRole('menuitem').first();
      await page.mouse.move(2540, 5);
      const normal = await item.evaluate((el) => getComputedStyle(el).boxShadow);
      await item.hover();
      assert.notEqual(
        await item.evaluate((el) => getComputedStyle(el).boxShadow),
        normal,
        'Menu surface responds to hover',
      );
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole('button', { name: /Em Curso/i })
        .first()
        .hover();
      await page.screenshot({ path: `${output}/hover-mobile-tabs-${theme}.png` });
    }
  }
  if (!before) {
    await page.setViewportSize({ width:390,height:844 });
    await page.goto(origin+'/atividade');
    const types=page.locator('main details');
    assert.equal(await types.getAttribute('open'),null,'Advanced filters are collapsed initially');
    await types.locator('summary').click();
    await types.getByRole('button',{name:'Viatura adicionada',exact:true}).click();
    assert.equal(await types.getByRole('button',{name:'Viatura adicionada',exact:true}).getAttribute('aria-pressed'),'true');
    assert.match(page.url(),/VEHICLE_ADDED/);
    assert(await page.getByText('Por Equipa de teste',{exact:true}).first().isVisible(),'Mobile activity shows its actor');

    const touch=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await touch.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const touchPage=await touch.newPage();
    await touchPage.goto(origin+'/tarefas');
    const filter=touchPage.getByRole('button',{name:'Alta',exact:true});
    await filter.waitFor();
    assert.equal(await touchPage.evaluate(()=>matchMedia('(hover: hover)').matches),false);
    await filter.hover();
    assert.equal(await filter.evaluate(el=>getComputedStyle(el).boxShadow),'none','Touch does not retain desktop hover overlays');
    await filter.tap();
    await touchPage.waitForFunction(() => [...document.querySelectorAll('button')].some(
      button => button.textContent.trim() === 'Alta' && button.getAttribute('aria-pressed') === 'true',
    ));
    assert.equal(await filter.getAttribute('aria-pressed'),'true','Touch still selects the filter');
    await touch.close();
  }
  await writeFile(
    `${output}/design-${before ? 'before' : 'after'}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    `PASS design ${before ? 'baseline' : 'hover/focus/semantic contrast'}: ${results.length} samples`,
  );
}

export async function reviewExpenses(page, origin, output, vehicleId) {
  for (const width of [320, 390, 768, 1920, 2560]) {
    for (const [name, path] of [
      ['operacionais', '/financeiro'],
      ['viatura', `/viaturas/${vehicleId}`],
    ]) {
      await page.setViewportSize({ width, height: 1050 });
      await page.goto(origin + path);
      const table = page.locator('.expense-table');
      await table.waitFor();
      await table.scrollIntoViewIfNeeded();
      const size = await table.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        view: innerWidth,
        display: getComputedStyle(el.querySelector('tbody tr')).display,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.equal(size.display, width < 768 ? 'grid' : 'table-row');
      if (width < 768) {
        assert(size.width <= size.view, `${name}: expense cards fit mobile`);
        assert(size.scroll <= size.view, `${name}: no horizontal document overflow`);
        assert(await table.getByText('Editar', { exact: true }).isVisible());
        assert(await table.getByText('Eliminar', { exact: true }).isVisible());
      }
      const desc = await table.locator('[data-column=description]').first().textContent();
      await table.getByRole('button', { name: `Editar despesa: ${desc.trim()}` }).click();
      const form = table.locator('form').first();
      await form.locator('[name=description]').fill('Descrição editada de teste');
      await form.locator('[name=amount]').fill('123.45');
      await form.getByRole('button', { name: 'Guardar', exact: true }).click();
      await page
        .getByText('Validação de teste: os dados preenchidos foram mantidos.')
        .first()
        .waitFor();
      assert.equal(
        await form.locator('[name=description]').inputValue(),
        'Descrição editada de teste',
      );
      assert.equal(await form.locator('[name=amount]').inputValue(), '123.45');
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(
        (await table.locator('[data-column=description]').first().textContent()).trim(),
        desc.trim(),
      );
      let confirmed = false;
      page.once('dialog', async (dialog) => {
        confirmed = true;
        await dialog.dismiss();
      });
      await table.getByRole('button', { name: `Eliminar despesa: ${desc.trim()}` }).click();
      assert(confirmed, 'Deletion still requires its existing explicit confirmation');
      assert.equal(await table.locator('tbody tr').count(), 1);
      await table.screenshot({ path: `${output}/expenses-${name}-${width}.png` });
      if (path === '/financeiro' && width >= 1920)
        assert((await page.locator('.reading-frame').boundingBox()).width <= 1180);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + `/viaturas/${vehicleId}?__sold=1`);
  const table = page.locator('.expense-table');
  await table.getByRole('button', { name: /Editar despesa/ }).click();
  const confirmation = table.getByRole('checkbox', { name: /Viatura já vendida/ });
  assert(await confirmation.isVisible(), 'Sold vehicle keeps explicit confirmation');
  assert.equal(await confirmation.isChecked(), false);
  await confirmation.check();
  await table.getByRole('button', { name: 'Cancelar', exact: true }).click();
  let prompt = '';
  page.once('dialog', async (dialog) => {
    prompt = dialog.message();
    await dialog.dismiss();
  });
  await table.getByRole('button', { name: /Eliminar despesa/ }).click();
  assert.match(prompt, /recalcular o lucro/);
  console.log(
    'PASS expense cards: 320/390/768/1920/2560; desktop table, responsive cards, edit/cancel, failure preserves values, delete cancellation, no mobile overflow.',
  );
}

export async function reviewDashboardScope(page, origin) {
  await page.goto(origin + '/dashboard');
  const select = page.getByRole('combobox', { name: 'Filtrar tarefas por responsável' });
  await select.waitFor();
  await page.route('**/api/today-tasks?*', async (route) => {
    const scope = new URL(route.request().url()).searchParams.get('scope');
    await new Promise((resolve) => setTimeout(resolve, scope === 'general' ? 250 : 20));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: scope,
            title: scope === 'general' ? 'Resposta anterior' : 'Resposta atual',
            priority: 'HIGH',
            status: 'TODO',
            assignee: null,
            dueDate: null,
          },
        ],
      }),
    });
  });
  await select.selectOption('general');
  await select.selectOption('all');
  await page.getByText('Resposta atual', { exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.equal(await page.getByText('Resposta anterior', { exact: true }).count(), 0);
  assert.equal(await select.inputValue(), 'all');
  console.log(
    'PASS dashboard scope: latest selection wins and aborted responses cannot overwrite it.',
  );
}
