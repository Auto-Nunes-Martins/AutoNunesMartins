import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import * as svelte from 'svelte';
// @ts-expect-error Compiler-generated server components use this runtime.
import * as runtime from 'svelte/internal/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as format from '$lib/utils/format';
import * as taskPresentation from '$lib/components/task/presentation';
import { linkedRow } from '$lib/linkedRow';
import { activityHref } from '$lib/activityNavigation';

// Render the actual overview components. Icons are decorative; panel snippets
// and all operational text/links are rendered by their real components.
const cache = new Map<string, any>();
function fromSource(source: string, file: string): any {
  let code = compile(source, { generate: 'server', filename: file }).js.code;
  const imports: unknown[] = [];
  const ast = ts.createSourceFile(file + '.js', code, ts.ScriptTarget.Latest, true);
  const replacements: { start: number; end: number; code: string }[] = [];
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    let value: any;
    if (specifier === 'svelte/internal/server') value = runtime;
    else if (specifier === 'svelte') value = svelte;
    else if (specifier === 'lucide-svelte') value = new Proxy({}, { get: () => icon });
    else if (specifier === '$lib/paths') value = { crmPath: (path: string) => path };
    else if (specifier === '$app/navigation') value = { invalidateAll: async () => {} };
    else if (specifier === '$lib/auth/session') value = { sessionFetch: () => { throw new Error('Unexpected SSR fetch'); } };
    else if (specifier === '$lib/utils/format') value = format;
    else if (specifier === '$lib/components/task/presentation') value = taskPresentation;
    else if (specifier === '$lib/linkedRow') value = { linkedRow };
    else if (specifier === '$lib/activityNavigation') value = { activityHref };
    // This text/navigation test stubs decorative event icons as above.
    else if (specifier === '$lib/activityPresentation')
      value = {
        activityStyle: () => ({ icon, color: 'var(--color-info)', label: 'Evento' }),
      };
    else if (specifier === '$lib/vehicleImage') value = { photoFallback: () => ({}) };
    else if (specifier.endsWith('.svelte'))
      value = {
        default: load(
          specifier.startsWith('$lib/')
            ? resolve(lib, specifier.slice(5))
            : resolve(dirname(file), specifier),
        ),
      };
    else throw new Error('Unexpected overview dependency: ' + specifier);
    const index = imports.push(value) - 1;
    const declarations: string[] = [];
    if (node.importClause?.name)
      declarations.push(`const ${node.importClause.name.text} = imports[${index}].default;`);
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings))
      declarations.push(`const ${bindings.name.text} = imports[${index}];`);
    if (bindings && ts.isNamedImports(bindings))
      for (const binding of bindings.elements)
        declarations.push(
          `const ${binding.name.text} = imports[${index}][${JSON.stringify(binding.propertyName?.text ?? binding.name.text)}];`,
        );
    replacements.push({ start: node.getStart(ast), end: node.end, code: declarations.join('\n') });
  }
  for (const replacement of replacements.reverse())
    code = code.slice(0, replacement.start) + replacement.code + code.slice(replacement.end);
  code = code.replace('export default function', 'return function');
  return new Function('imports', code)(imports);
}
const lib = fileURLToPath(new URL('../', import.meta.url));
const icon = fromSource('<svg aria-hidden="true"></svg>', 'OverviewIcon.svelte');
function load(file: string): any {
  if (!cache.has(file)) cache.set(file, fromSource(readFileSync(file, 'utf8'), file));
  return cache.get(file);
}
const component = (name: string) => load(resolve(lib, 'components/dashboard', name + '.svelte'));
const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('dashboard operational overview', () => {
  it('shows urgency, overdue status, due dates and general/assigned tasks before opening a task', () => {
    const html = render(component('TodayTasks'), {
      props: {
        currentUserId: 'test-user',
        items: [
          {
            id: 'task-general',
            title: 'Confirmar documentação da entrega',
            priority: 'URGENT',
            status: 'PENDING',
            dueDate: '2026-10-14T12:00:00Z',
            assignee: null,
            isOverdue: true,
          },
          {
            id: 'task-assigned',
            title: 'Preparar visita e proposta comercial',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            dueDate: '2026-10-15T14:00:00Z',
            assignee: { id: 'test-user', name: 'Utilizador de teste' },
            isOverdue: false,
          },
        ],
      },
    }).body;
    const content = text(html);
    for (const expected of [
      'Confirmar documentação da entrega',
      'Urgente',
      '14/10',
      'Geral',
      '15/10',
      'Utilizador de teste',
    ])
      expect(content).toContain(expected);
    expect(content).toMatch(/atras/i);
    expect(html).toContain('/tarefas/task-general/editar');
    expect(html).toContain('/tarefas/task-assigned/editar');
  });
  it('orders overdue work first and limits completion to own or general tasks', () => {
    const base = { priority: 'LOW', status: 'TODO', dueDate: null, isOverdue: false };
    const html = render(component('TodayTasks'), { props: { currentUserId: 'me', items: [
      { ...base, id: 'other', title: 'Outra pessoa', priority: 'URGENT', assignee: { id: 'other-user', name: 'Outra pessoa' } },
      { ...base, id: 'late', title: 'Prazo ultrapassado', isOverdue: true, assignee: null },
      { ...base, id: 'mine', title: 'Tarefa própria', assignee: { id: 'me', name: 'Eu' } },
    ] } }).body;
    expect(html.indexOf('/tarefas/late/editar')).toBeLessThan(html.indexOf('/tarefas/other/editar'));
    expect(html).toContain('Concluir tarefa: Prazo ultrapassado');
    expect(html).toContain('Concluir tarefa: Tarefa própria');
    expect(html).not.toContain('Concluir tarefa: Outra pessoa');
    expect(html).toContain('/tarefas');
  });
  it('uses a task skeleton during streaming without presenting old task data as current', () => {
    const html = render(component('TodayTasks'), { props: { pending: true, items: [
      { id: 'old', title: 'Dado antigo', priority: 'LOW', status: 'TODO', dueDate: null, isOverdue: false, assignee: null },
    ] } }).body;
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('A carregar tarefas');
    expect(html).not.toContain('Dado antigo');
    expect(html).not.toContain('Sem tarefas a pedir atenção');
  });
  it('limits the compact preview to four actionable tasks while keeping full management available', () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      id: `task-${index}`, title: `Trabalho ${index}`, priority: 'MEDIUM',
      status: index === 0 ? 'DONE' : 'TODO', dueDate: null, isOverdue: false, assignee: null,
    }));
    const html = render(component('TodayTasks'), { props: { currentUserId: 'me', items } }).body;
    expect(html.match(/aria-label="Concluir tarefa:/g)).toHaveLength(4);
    expect(html).not.toContain('/tarefas/task-0/editar');
    expect(html).not.toContain('/tarefas/task-5/editar');
    expect(html).toContain('Ver todas');
    expect(html).toContain('Atualizar tarefas');
  });
  it('keeps vehicle identity, age, mileage and price visible in the stock overview', () => {
    const html = render(component('StockAgingTable'), {
      props: {
        items: [
          {
            id: 'stock-car',
            brand: 'Porsche',
            model: '911 Carrera',
            year: 2021,
            vin: 'EXEMPLO',
            licensePlate: 'AB-12-CD',
            mileage: 18900,
            salePrice: '112900',
            thumbnailUrl: null,
            daysInStock: 82,
          },
        ],
      },
    }).body;
    const content = text(html);
    for (const expected of [
      'Porsche',
      '911 Carrera',
      'AB-12-CD',
      '2021',
      '18 900',
      '112 900,00',
      '82',
    ])
      expect(content).toContain(expected);
    expect(html).toContain('/viaturas/stock-car');
  });
  it('keeps activity text, actor and navigation in the recent activity overview', () => {
    const html = render(component('RecentActivityFeed'), {
      props: {
        items: [
          {
            id: 'event',
            type: 'VEHICLE_UPDATED',
            entityType: 'vehicle',
            entityId: 'stock-car',
            message: 'Fotografias e anúncio atualizados',
            createdAt: new Date(Date.now() - 300000).toISOString(),
            actor: { id: 'test-user', name: 'Utilizador de teste' },
          },
        ],
      },
    }).body;
    const content = text(html);
    expect(content).toContain('Fotografias e anúncio atualizados');
    expect(content).toContain('Utilizador de teste');
    expect(content).toMatch(/5\s?min/i);
    expect(html).toContain('/viaturas/stock-car');
  });
});
