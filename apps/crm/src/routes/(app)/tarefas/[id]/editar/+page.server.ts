import { crmPath } from '$lib/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import { taskCreateSchema } from '@anm/types';
import { tasksApi, usersApi } from '$lib/server/tasks';
import { ApiError, rethrowAuthError } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    const [task, users] = await Promise.all([
      tasksApi.get(event, event.params.id),
      usersApi.list(event),
    ]);
    return { task, users: users.items };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, 'Tarefa não encontrada');
    }
    rethrowAuthError(err);
    throw err;
  }
};

function parseForm(fd: FormData) {
  const get = (k: string) => (fd.get(k) ?? '').toString().trim();
  const opt = (k: string) => {
    const v = get(k);
    return v === '' ? undefined : v;
  };
  return {
    title: get('title'),
    description: opt('description'),
    status: get('status') || 'TODO',
    priority: get('priority') || 'MEDIUM',
    assigneeId: opt('assigneeId'),
    startDate: opt('startDate'),
    dueDate: opt('dueDate'),
    reminderDate: opt('reminderDate'),
    recurrence: get('recurrence') || 'NONE',
  };
}

export const actions: Actions = {
  submit: async (event) => {
    const fd = await event.request.formData();
    const parsed = taskCreateSchema.safeParse(parseForm(fd));
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        issues: parsed.error.issues,
      });
    }
    try {
      // This form is a complete edit, so an empty field explicitly clears it.
      await tasksApi.update(event, event.params.id, {
        ...parsed.data,
        description: parsed.data.description ?? '',
        assigneeId: parsed.data.assigneeId ?? '',
        startDate: parsed.data.startDate ?? null,
        dueDate: parsed.data.dueDate ?? null,
        reminderDate: parsed.data.reminderDate ?? null,
      });
      return { id: event.params.id };
    } catch (err) {
      if (err instanceof ApiError) {
        const feedback = err.body as {
          field?: string;
          issues?: { path: (string | number)[]; message: string }[];
        } | null;
        return fail(err.status, {
          field: feedback?.field,
          issues: feedback?.issues,
          error: (err.body as { error?: string } | null)?.error ?? 'Falha.',
        });
      }
      throw err;
    }
  },
  delete: async (event) => {
    try {
      await tasksApi.delete(event, event.params.id);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.status, {
          error: (err.body as { error?: string } | null)?.error ?? 'Falha.',
        });
      }
      throw err;
    }
    throw redirect(302, crmPath('/tarefas'));
  },
};
