import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'http://backend.test' }));
vi.mock('./tasks', () => ({ tasksApi: { update: vi.fn() }, usersApi: {} }));
import { tasksApi } from './tasks';
import { actions } from '../../routes/(app)/tarefas/[id]/editar/+page.server';

function event(values: Record<string, string>) {
  return {
    params: { id: 'task-fixture' },
    request: new Request('http://crm.test/tarefas/task-fixture/editar?/submit', {
      method: 'POST',
      body: new URLSearchParams({
        title: 'Tarefa editada',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        recurrence: 'NONE',
        ...values,
      }),
    }),
  } as never;
}
beforeEach(() => vi.clearAllMocks());

it('sends explicit clear values and the chosen status from the complete edit form', async () => {
  await actions.submit!(
    event({ description: '', assigneeId: '', startDate: '', dueDate: '', reminderDate: '' }),
  );
  expect(tasksApi.update).toHaveBeenCalledWith(
    expect.anything(),
    'task-fixture',
    expect.objectContaining({
      status: 'IN_PROGRESS',
      description: '',
      assigneeId: '',
      startDate: null,
      dueDate: null,
      reminderDate: null,
    }),
  );
});

it('rejects a recurring edit without a deadline before writing', async () => {
  const result = await actions.submit!(event({ recurrence: 'WEEKLY', dueDate: '' }));
  expect(result).toHaveProperty('status', 400);
  expect(tasksApi.update).not.toHaveBeenCalled();
});
