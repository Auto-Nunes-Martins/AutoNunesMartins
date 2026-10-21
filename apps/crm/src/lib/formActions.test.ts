import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the actual enhanced-form callbacks with simulated action results.
// This catches a toast-only callback that silently drops a server redirect.
const fixtures = [
  ['routes/(app)/viaturas/[id]/publicar/+page.svelte', 'submitting'],
  ['lib/components/vehicle/VehicleDeletePanel.svelte', 'busy'],
  ['routes/(app)/clientes/[id]/editar/+page.svelte', 'deleting'],
  ['routes/(app)/tarefas/[id]/editar/+page.svelte', 'deleting'],
  ['routes/(app)/financeiro/+page.svelte', 'submitting', 'savingId', null],
  ['routes/(app)/definicoes/+page.svelte', 'savingKey'],
  ['routes/(app)/vendas/[id]/+page.svelte', 'updatingDelivery'],
  ['lib/components/vehicle/WebPublicationPanel.svelte', 'pending'],
  ['routes/(app)/viaturas/[id]/vender/+page.svelte', 'submitting'],
] as const;

function callbacks(path: string) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const ast = parse(source, { modern: true });
  const found: string[] = [];
  const seen = new Set<object>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const node = value as { type?: string; async?: boolean; start: number; end: number };
    if (node.type === 'ArrowFunctionExpression' && node.async) {
      const code = source.slice(node.start, node.end);
      if (/^async\s*\(\{\s*result[,\s}]/.test(code)) found.push(code);
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(ast);
  return found;
}

for (const [path, ...states] of fixtures) {
  describe(path, () => {
    const handlers = callbacks(path);
    it('has the expected action callbacks', () => expect(handlers).toHaveLength(states.length));
    handlers.forEach((code, index) => {
      const state = states[index];
      for (const type of ['success', 'failure', 'redirect', 'error']) {
        it(`callback ${index + 1} applies ${type} and releases pending state`, async () => {
          const context: Record<string, unknown> = {
            crmPath: (path: string) => path,
            toast: { success: vi.fn(), error: vi.fn() },
            v: { id: 'vehicle-id', brand: 'Marca', model: 'Modelo' },
            wasFeatured: false,
            onredirect: vi.fn(),
            showAdd: true,
            editingId: 'expense-id',
            message: '',
            formElement: {},
            publicationForm: {},
            forms: () => ({}),
            markFormSaved: vi.fn(),
            showFormErrors: vi.fn(),
            tick: vi.fn(async () => {}),
            resetPublicationDraft: vi.fn(),
          };
          if (state) context[state] = true;
          context.publicationForm = context.formElement;
          const update = vi.fn(async (options) => {
            const guarded = path.includes('WebPublicationPanel') || path.includes('/vender/');
            expect(options).toEqual(
              guarded
                ? {
                    reset: false,
                    invalidateAll: path.includes('/vender/') ? false : type === 'success',
                  }
                : { reset: false },
            );
            if (state) expect(context[state]).toBe(true);
          });
          const goto = vi.fn(async (_url, options) => {
            expect(options).toEqual({ invalidateAll: true });
            if (state) expect(context[state]).toBe(true);
          });
          context.goto = goto;
          const js = ts.transpile(`const callback = ${code}; callback`, {
            target: ts.ScriptTarget.ES2022,
          });
          const callback = runInNewContext(js, context);
          await callback({
            result: { type, data: { error: 'Erro simulado' }, location: '/destino' },
            update,
          });
          if (path.includes('/vender/') && type === 'success') {
            expect(goto).toHaveBeenCalledWith('/viaturas/vehicle-id', { invalidateAll: true });
          } else expect(update).toHaveBeenCalledOnce();
          if (state)
            expect(context[state]).toBe(
              state === 'savingId' || state === 'savingKey' ? null : false,
            );
          if (path.includes('WebPublicationPanel') && type === 'success')
            expect(context.markFormSaved).toHaveBeenCalledOnce();
          if (
            (path.includes('WebPublicationPanel') || path.includes('/vender/')) &&
            type === 'failure'
          )
            expect(context.showFormErrors).toHaveBeenCalledOnce();
          if (type === 'failure')
            expect(
              (context.toast as { error: ReturnType<typeof vi.fn> }).error,
            ).toHaveBeenCalledWith('Erro simulado');
        });
      }
      if (state) {
        it(`callback ${index + 1} releases pending if updating throws`, async () => {
          const context: Record<string, unknown> = {
            [state]: true,
            toast: { success: vi.fn(), error: vi.fn() },
            tick: vi.fn(async () => {}),
            formElement: {},
            publicationForm: {},
          };
          const callback = runInNewContext(
            ts.transpile(`const callback = ${code}; callback`),
            context,
          );
          await expect(
            callback({
              result: { type: 'error' },
              update: vi.fn().mockRejectedValue(new Error('navigation')),
            }),
          ).rejects.toThrow('navigation');
          expect(context[state]).toBe(state === 'savingId' || state === 'savingKey' ? null : false);
        });
      }
    });
  });
}

for (const file of [
  'vehicle/VehicleForm.svelte',
  'customer/CustomerForm.svelte',
  'task/TaskForm.svelte',
]) {
  it(file + ' clears the unsaved guard before applying a successful redirect', async () => {
    const markFormSaved = vi.fn();
    const callback = runInNewContext(
      ts.transpile('const callback = ' + callbacks('lib/components/' + file)[0] + '; callback'),
      { formElement: {}, markFormSaved, submitting: true, tick: async () => {} },
    );
    const update = vi.fn(async () => {
      expect(markFormSaved).toHaveBeenCalledOnce();
    });
    await callback({ result: { type: 'redirect', location: '/saved' }, update });
    expect(update).toHaveBeenCalledWith({ reset: false, invalidateAll: false });
  });
}
