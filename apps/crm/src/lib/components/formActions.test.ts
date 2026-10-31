import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile, parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import * as svelte from 'svelte';
// The compiler-generated runtime has no public TypeScript declarations.
// @ts-expect-error Svelte's server compiler imports this internal runtime.
import * as server from 'svelte/internal/server';
import { isValidNIF } from '../../../../../shared/types/src/nif';

// Render the real components without needing a running SvelteKit app. Enhance
// and navigation are browser-only and are not invoked during server rendering.
function component(source: string, imports: Record<string, unknown> = {}) {
  const code = compile(source, { generate: 'server' })
    .js.code.replace(
      /^import \* as \$ from 'svelte\/internal\/server';/m,
      'const $ = imports.server;',
    )
    .replace(/^import \{ enhance \} from '\$lib\/auth\/enhance';/m, '')
    .replace(/^import \{ goto \} from '\$app\/navigation';/m, '')
    .replace(/^import \{ ([^}]+) \} from 'svelte';/m, 'const { $1 } = imports.svelte;')
    .replace(/^import \{ toast \} from 'svelte-sonner';/m, '')
    .replace(
      /^import \{ isValidNIF \} from '@anm\/types';/m,
      'const isValidNIF = imports.isValidNIF;',
    )
    .replace(/^import \{ ([^}]+) \} from 'lucide-svelte';/m, 'const { $1 } = imports;')
    .replace(/^import (\w+) from ['"][^'"]+['"];/gm, 'const $1 = imports.$1;')
    .replace(/^import\s+\{[^}]+\}\s+from '\$lib\/forms\/formFeedback';/m, '')
    .replace(/^import \{ crmPath \} from '\$lib\/paths';/m, 'const crmPath = (path) => path;')
    .replace('export default function', 'return function');
  return new Function('imports', code)({ server, svelte, isValidNIF, ...imports });
}

const source = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const Button = component(source('./common/Button.svelte'));
const CustomerForm = component(source('./customer/CustomerForm.svelte'), { Button });
const DateIcon = component('<svg></svg>');
const DateInput = component(source('./common/DateInput.svelte'), {
  CalendarDays: DateIcon,
  ChevronLeft: DateIcon,
  ChevronRight: DateIcon,
});
const VehicleForm = component(source('./vehicle/VehicleForm.svelte'), {
  BrandCombobox: component(
    '<script>let {value="",name="brand"}=$props();</script><input type="hidden" {name} {value}/>',
  ),
  Button,
  DateInput,
  VehicleSpecGlyph: DateIcon,
});

type Element = { name: string; attributes: any[]; ancestors: Element[] };

function elements(html: string): Element[] {
  const result: Element[] = [];
  function visit(node: any, ancestors: Element[]) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, ancestors);
      return;
    }
    if (node.type === 'RegularElement') {
      const element = { name: node.name, attributes: node.attributes, ancestors };
      result.push(element);
      visit(node.fragment, [...ancestors, element]);
    } else {
      for (const [key, child] of Object.entries(node)) {
        if (key !== 'attributes') visit(child, ancestors);
      }
    }
  }
  visit(parse(html, { modern: true }).fragment, []);
  return result;
}

function attribute(element: Element, name: string): string | undefined {
  const attr = element.attributes.find((attr) => attr.name === name);
  return attr?.value === true ? '' : attr?.value?.[0]?.data;
}

function owner(button: Element, nodes: Element[]): Element | undefined {
  const id = attribute(button, 'form');
  return id
    ? nodes.find((node) => node.name === 'form' && attribute(node, 'id') === id)
    : [...button.ancestors].reverse().find((node) => node.name === 'form');
}

describe.each([
  { name: 'CustomerForm', Form: CustomerForm, cancel: '/clientes', route: 'clientes' },
  { name: 'VehicleForm', Form: VehicleForm, cancel: '/viaturas', route: 'viaturas' },
])('$name independent actions', ({ Form, cancel, route }) => {
  it('keeps create fields and the external save button associated with the edit form', () => {
    const nodes = elements(render(Form, {}).body);
    const forms = nodes.filter((node) => node.name === 'form');
    expect(forms).toHaveLength(1);
    expect(attribute(forms[0]!, 'action')).toBe('?/submit');
    const save = nodes.find(
      (node) => node.name === 'button' && attribute(node, 'type') === 'submit',
    )!;
    expect(attribute(save, 'type')).toBe('submit');
    expect(save.ancestors).not.toContain(forms[0]);
    expect(owner(save, nodes)).toBe(forms[0]);
    for (const field of nodes.filter(
      (node) =>
        ['input', 'select', 'textarea'].includes(node.name) &&
        attribute(node, 'name') !== undefined,
    )) {
      expect(owner(field, nodes)).toBe(forms[0]);
    }
    expect(nodes.some((node) => node.name === 'a' && attribute(node, 'href') === cancel)).toBe(
      true,
    );
  });

  it('renders delete as a separate form with no edit fields or edit validation', () => {
    const page = source(`../../routes/(app)/${route}/[id]/editar/+page.svelte`);
    if (route === 'viaturas') {
      const Trash2 = component('<svg></svg>');
      const ConfirmDialog = component(source('./common/ConfirmDialog.svelte'), {
        Button,
        AlertTriangle: Trash2,
      });
      const VehicleDeleteDialog = component(source('./vehicle/VehicleDeleteDialog.svelte'), {
        ConfirmDialog,
      });
      const DeletePanel = component(source('./vehicle/VehicleDeletePanel.svelte'), {
        Trash2,
        VehicleDeleteDialog,
      });
      const Wrapper = component(
        '<script>import Form from "./Form.svelte"; import DeletePanel from "./DeletePanel.svelte";</script><Form /><DeletePanel id="vehicle" brand="Audi" model="Q5" />',
        { Form, DeletePanel },
      );
      const nodes = elements(render(Wrapper, {}).body);
      const forms = nodes.filter((node) => node.name === 'form');
      expect(forms).toHaveLength(2);
      const deletion = forms.find((form) => attribute(form, 'action')?.endsWith('?/delete'))!;
      expect(deletion).toBeDefined();
      expect(
        nodes
          .filter((node) => attribute(node, 'required') !== undefined)
          .every((node) => !node.ancestors.includes(deletion)),
      ).toBe(true);
      expect(forms.every((form) => !form.ancestors.some((node) => node.name === 'form'))).toBe(
        true,
      );
      return;
    }
    const deletionSnippet = page.match(/\{#snippet extraActions\(\)\}[\s\S]*?\{\/snippet\}/)?.[0];
    expect(deletionSnippet).toBeDefined();
    const Wrapper = component(
      `
      <script lang="ts">
        import Form from './Form.svelte';
        import Trash2 from './Trash2.svelte';
        let deleting = false;
        let saving = false;
        let needsReload = false;
      </script>
      <Form>
        ${deletionSnippet}
      </Form>`,
      { Form, Trash2: component('<svg aria-hidden="true"></svg>') },
    );
    const nodes = elements(render(Wrapper, {}).body);
    const forms = nodes.filter((node) => node.name === 'form');
    expect(forms).toHaveLength(2);
    for (const form of forms)
      expect(form.ancestors.some((node) => node.name === 'form')).toBe(false);
    const edit = forms.find((form) => attribute(form, 'action') === '?/submit')!;
    const deletion = forms.find((form) => attribute(form, 'action') === '?/delete')!;
    const buttons = nodes.filter(
      (node) => node.name === 'button' && attribute(node, 'type') === 'submit',
    );
    expect(buttons.filter((button) => owner(button, nodes) === edit)).toHaveLength(1);
    expect(buttons.filter((button) => owner(button, nodes) === deletion)).toHaveLength(1);
    expect(
      nodes.filter((node) => attribute(node, 'required') !== undefined).length,
    ).toBeGreaterThan(0);
    for (const field of nodes.filter(
      (node) =>
        ['input', 'select', 'textarea'].includes(node.name) &&
        attribute(node, 'name') !== undefined,
    )) {
      expect(owner(field, nodes)).toBe(edit);
    }
    expect(edit.ancestors.at(-1)).toBe(deletion.ancestors[0]);
  });

  it('uses distinct form IDs when two instances render together', () => {
    const Wrapper = component(
      `<script>import Form from './Form.svelte';</script><Form /><Form />`,
      { Form },
    );
    const nodes = elements(render(Wrapper, {}).body);
    const forms = nodes.filter((node) => node.name === 'form');
    expect(new Set(forms.map((form) => attribute(form, 'id'))).size).toBe(2);
    const buttons = nodes.filter(
      (node) => node.name === 'button' && attribute(node, 'type') === 'submit',
    );
    expect(buttons.map((button) => owner(button, nodes))).toEqual(forms);
  });
});

it('preserves a custom vehicle save action and customer NIF save validation', () => {
  const vehicle = elements(render(VehicleForm, { props: { action: '?/custom' } }).body);
  const save = vehicle.find(
    (node) => node.name === 'button' && attribute(node, 'type') === 'submit',
  )!;
  expect(attribute(owner(save, vehicle)!, 'action')).toBe('?/custom');
  const customer = elements(render(CustomerForm, { props: { initial: { nif: 'invalid' } } }).body);
  expect(
    attribute(
      customer.find((node) => node.name === 'button' && attribute(node, 'type') === 'submit')!,
      'disabled',
    ),
  ).toBe('');
});

it('renders a usable nine-digit phone pattern in the customer form', () => {
  // Parse rendered HTML as HTML: a Svelte AST would treat {9} as an expression again.
  const html = render(CustomerForm, {}).body;
  const phone = html.match(/<input\b[^>]*name="phone"[^>]*>/)![0];
  const pattern = new RegExp('^(?:' + phone.match(/\bpattern="([^"]*)"/)![1] + ')$');
  expect(pattern.test('900000000')).toBe(true);
  expect(pattern.test('90000000')).toBe(false);
  expect(pattern.test('90000000a')).toBe(false);
});
