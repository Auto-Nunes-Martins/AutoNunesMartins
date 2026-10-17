import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
// @ts-expect-error Compiler-generated Svelte server runtime has no public declarations.
import * as server from 'svelte/internal/server';

function component(source: string, imports: Record<string, unknown> = {}) {
  const code = compile(source, { generate: 'server' })
    .js.code.replace(
      /^import \* as \$ from 'svelte\/internal\/server';/m,
      'const $ = imports.server;',
    )
    .replace(/^import (\w+) from '[^']+';/gm, 'const $1 = imports.$1;')
    .replace(
      /^import\s*\{\s*([^}]+)\s*\}\s*from '[^']+';/gm,
      (_line, names: string) => `const { ${names.replace(/\bas\b/g, ':')} } = imports;`,
    )
    .replace('export default function', 'return function');
  return new Function('imports', code)({ server, crmPath: (path: string) => path, ...imports });
}
const source = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const Button = component(source('./common/Button.svelte'));
const VehicleForm = component(source('./vehicle/VehicleForm.svelte'), { Button });
const Empty = component('<span></span>');
const Panel = component('<script>let {children} = $props();</script>{@render children?.()}');
const EditPage = component(source('../../routes/(app)/viaturas/[id]/editar/+page.svelte'), {
  VehicleForm,
  Panel,
  ItalicHero: Empty,
  PhotoGallery: Empty,
  WebPublicationPanel: component('<script>let {vehicleDetails}=$props();</script>{@render vehicleDetails?.()}'),
  Trash2: Empty,
  untrack: (fn: () => unknown) => fn(),
  onMount: () => {},
});

describe('post-sale vehicle editing UI', () => {
  it.each(['SOLD', 'DELIVERED'])(
    'renders an editable form for a %s vehicle, using the recorded sale price',
    (status) => {
      const vehicle = {
        id: 'vehicle',
        photos: [],
        brand: 'BMW',
        model: 'One',
        year: 2020,
        fuel: 'DIESEL',
        mileage: 10000,
        vin: 'WBA12345678912345',
        licensePlate: 'AA-00-AA',
        purchasePrice: '10000',
        salePrice: '19000',
        status,
        acquisitionDate: '2026-01-01',
        description: 'Notes',
        pendingDocFlags: { financing: true, imt: false, registration: false, docs: true },
        sale: { id: 'sale', salePrice: '15000' },
      };
      const html = render(EditPage, { props: { data: { vehicle, signedPhotos: [] } } }).body;
      expect(html).toContain('Preço registado da venda');
      expect(html).toContain('name="salePrice"');
      expect(html).toMatch(/name="salePrice"[^>]*value="15000"/);
      for (const name of [
        'purchasePrice',
        'salePrice',
        'licensePlate',
        'description',
        'pendingDocFlags.docs',
      ]) {
        const field = html.match(new RegExp(`<[^>]+name="${name}"[^>]*>`))?.[0];
        expect(field, name).toBeDefined();
        expect(field).not.toMatch(/\bdisabled\b|\breadonly\b/);
      }
      expect(html).toMatch(new RegExp(`type="hidden" name="status" value="${status}"`));
      expect(html).not.toMatch(/<select[^>]*name="status"/);
      expect(html).toContain('href="/vendas/sale"');
      expect(html).toContain('Guardar alterações');
      expect(html).toContain('O preço público do website é independente');
    },
  );
  it('keeps normal stock states and PVP available before a sale is recorded', () => {
    const html = render(VehicleForm, { props: { initial: { status: 'AVAILABLE' } } }).body;
    expect(html).toMatch(/<select[^>]*name="status"/);
    expect(html).toContain('value="RESERVED"');
    expect(html).not.toContain('value="SOLD"');
    expect(html).not.toContain('value="DELIVERED"');
    expect(html).toContain('Preço de venda previsto (€)');
    expect(html).not.toContain('Preço registado da venda');
  });
  it('keeps a returned trade-in editable while preserving its historical state outside stock', () => {
    const html = render(VehicleForm, {
      props: {
        initial: {
          status: 'RETURNED',
          licensePlate: 'AA-00-AA',
          purchasePrice: '3000',
          description: 'Histórico',
        },
      },
    }).body;
    expect(html).toMatch(/type="hidden" name="status" value="RETURNED"/);
    expect(html).not.toMatch(/<select[^>]*name="status"/);
    expect(html).toContain('Ficha histórica fora do stock');
    expect(html).toMatch(/name="licensePlate"[^>]*value="AA-00-AA"/);
    for (const name of ['purchasePrice', 'licensePlate', 'description', 'pendingDocFlags.docs']) {
      const field = html.match(new RegExp('<[^>]+name="' + name + '"[^>]*>'))?.[0];
      expect(field, name).toBeDefined();
      expect(field).not.toMatch(/\bdisabled\b|\breadonly\b/);
    }
  });
  it('keeps the sale detail link to vehicle and price editing available', () => {
    const detail = source('../../routes/(app)/vendas/[id]/+page.svelte');
    expect(detail).toContain('href={crmPath(`/viaturas/${v.id}/editar`)}');
    expect(detail).toContain('Editar viatura e preços');
  });
});
