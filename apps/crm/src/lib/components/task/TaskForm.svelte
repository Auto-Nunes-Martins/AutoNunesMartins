<script lang="ts">
  import DateInput from '$lib/components/common/DateInput.svelte';
  import { crmPath } from '$lib/paths';
  import { enhance } from '$lib/auth/enhance';
  import { formFeedback, markFormSaved, showFormErrors } from '$lib/forms/formFeedback';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { untrack, type Snippet } from 'svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { Priority, Recurrence, TaskStatus } from '@anm/types';
  import type { TaskAssignee } from '$lib/server/tasks';

  type Initial = {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    assigneeId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    reminderDate?: string | null;
    recurrence?: Recurrence;
  };

  interface Props {
    initial?: Initial;
    users: TaskAssignee[];
    /** Current user's Prisma User.id — used as default assignee on create. */
    currentUserId?: string | null;
    submitLabel?: string;
    extraActions?: Snippet;
    redirectOnSuccess?: boolean;
  }

  let {
    initial = {},
    users,
    currentUserId = null,
    submitLabel = 'Guardar',
    extraActions,
    redirectOnSuccess = true,
  }: Props = $props();

  // When editing, use the task's current assignee. When creating fresh, default
  // to the logged-in user so the task lands on their own board.
  const defaultAssigneeId = untrack(() =>
    initial.assigneeId !== undefined ? (initial.assigneeId ?? '') : (currentUserId ?? ''),
  );

  let submitting = $state(false);

  // Track recurrence + dueDate locally so the hint below the recurrence
  // select can show the resulting day-of-month in real time.
  let recurrence = $state<Recurrence>(untrack(() => initial.recurrence ?? 'NONE'));
  let dueDate = $state<string>(untrack(() => initial.dueDate?.slice(0, 10) ?? ''));

  const recurrenceHint = $derived.by(() => {
    if (recurrence === 'NONE') return null;
    if (!dueDate) {
      return 'Define um prazo — a próxima ocorrência será agendada para esse dia, somado ao período da recorrência.';
    }
    const d = new Date(dueDate);
    if (recurrence === 'WEEKLY') {
      const weekday = d.toLocaleDateString('pt-PT', { weekday: 'long' });
      return `Após cada conclusão, a próxima ocorrência é agendada para a ${weekday} seguinte.`;
    }
    if (recurrence === 'MONTHLY') {
      return `Após cada conclusão, a próxima ocorrência é agendada para o dia ${d.getDate()} do mês seguinte.`;
    }
    if (recurrence === 'ANNUAL') {
      const day = d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
      return `Após cada conclusão, a próxima ocorrência é agendada para ${day} do ano seguinte.`;
    }
    return null;
  });

  const PRIORITIES: { value: Priority; label: string }[] = [
    { value: 'LOW', label: 'Baixa' },
    { value: 'MEDIUM', label: 'Média' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'URGENT', label: 'Urgente' },
  ];

  const STATUSES: { value: TaskStatus; label: string }[] = [
    { value: 'TODO', label: 'A Fazer' },
    { value: 'IN_PROGRESS', label: 'Em Curso' },
    { value: 'DONE', label: 'Concluído' },
  ];

  const RECURRENCES: { value: Recurrence; label: string }[] = [
    { value: 'NONE', label: 'Não recorrente' },
    { value: 'WEEKLY', label: 'Semanal' },
    { value: 'MONTHLY', label: 'Mensal' },
    { value: 'ANNUAL', label: 'Anual' },
  ];

  function label() {
    return 'font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5';
  }
  function input() {
    return 'h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors';
  }
</script>

<form
  method="POST"
  action="?/submit"
  use:formFeedback
  use:enhance={({ formElement, cancel }) => {
    if (submitting) {
      cancel();
      return;
    }
    submitting = true;
    return async ({ result, update }) => {
      submitting = false;
      if (result.type === 'success') {
        markFormSaved(formElement);
        toast.success('Tarefa guardada.');
        if (redirectOnSuccess) {
          await goto(crmPath('/tarefas'));
          return;
        }
      } else if (result.type === 'failure') {
        showFormErrors(formElement, result.data);

        toast.error((result.data as { error?: string } | undefined)?.error ?? 'Falha ao guardar.');
      }
      if (result.type === 'redirect') markFormSaved(formElement);
      await update({ reset: false, invalidateAll: result.type === 'success' });
    };
  }}
  class="crm-form-layout space-y-6"
>
  <label class="flex flex-col">
    <span class={label()}>Título</span>
    <input
      name="title"
      type="text"
      required
      maxlength="160"
      value={initial.title ?? ''}
      placeholder="Renovar seguro do stand"
      class={input()}
      style="border-radius: var(--radius-btn);"
    />
  </label>

  <label class="flex flex-col">
    <span class={label()}>Descrição</span>
    <textarea
      name="description"
      rows="3"
      maxlength="4000"
      placeholder="Detalhes, links, contactos…"
      class="px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
      style="border-radius: var(--radius-btn);"
      value={initial.description ?? ''}
    ></textarea>
  </label>

  <div class="crm-field-grid">
    <label class="flex flex-col crm-field-3">
      <span class={label()}>Estado</span>
      <select
        name="status"
        value={initial.status ?? 'TODO'}
        class={input()}
        style="border-radius: var(--radius-btn);"
      >
        {#each STATUSES as s (s.value)}
          <option value={s.value}>{s.label}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col crm-field-3">
      <span class={label()}>Prioridade</span>
      <select
        name="priority"
        value={initial.priority ?? 'MEDIUM'}
        class={input()}
        style="border-radius: var(--radius-btn);"
      >
        {#each PRIORITIES as p (p.value)}
          <option value={p.value}>{p.label}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col crm-field-6">
      <span class={label()}>Responsável</span>
      <select
        name="assigneeId"
        value={defaultAssigneeId}
        class={input()}
        style="border-radius: var(--radius-btn);"
      >
        <option value="">— Geral (visível a todos) —</option>
        {#each users as u (u.id)}
          <option value={u.id}>{u.name}</option>
        {/each}
      </select>
      <span class="mt-1 text-[11px] text-[var(--color-text-faint)]">
        Apenas o responsável vê a tarefa no seu quadro. As tarefas <strong>Gerais</strong>
        aparecem para todos.
      </span>
    </label>
  </div>

  <div class="crm-field-grid">
    <label class="flex flex-col crm-field-4">
      <span class={label()}>Data início</span>
      <DateInput
        name="startDate"

        value={initial.startDate?.slice(0, 10) ?? ''}
        class={input()}
        style="border-radius: var(--radius-btn);"
      />
    </label>
    <label class="flex flex-col crm-field-4">
      <span class={label()}>Prazo</span>
      <DateInput
        name="dueDate"

        bind:value={dueDate}
        required={recurrence !== 'NONE'}
        class={input()}
        style="border-radius: var(--radius-btn);"
      />
    </label>
    <label class="flex flex-col crm-field-4">
      <span class={label()}>Lembrete</span>
      <DateInput
        name="reminderDate"

        value={initial.reminderDate?.slice(0, 10) ?? ''}
        class={input()}
        style="border-radius: var(--radius-btn);"
      />
    </label>
  </div>

  <label class="flex flex-col max-w-sm">
    <span class={label()}>Recorrência</span>
    <select
      name="recurrence"
      bind:value={recurrence}
      class={input()}
      style="border-radius: var(--radius-btn);"
    >
      {#each RECURRENCES as r (r.value)}
        <option value={r.value}>{r.label}</option>
      {/each}
    </select>
    {#if recurrenceHint}
      <span class="mt-1.5 text-[11px] text-[var(--color-info)]">
        {recurrenceHint}
      </span>
    {:else}
      <span class="mt-1 text-[11px] text-[var(--color-text-faint)]">
        Tarefas recorrentes voltam a aparecer no quadro no próximo ciclo após cada conclusão.
      </span>
    {/if}
  </label>

  <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
    <div>
      {#if extraActions}{@render extraActions()}{/if}
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2 min-w-0">
      <Button variant="ghost" href={crmPath('/tarefas')}>Cancelar</Button>
      <Button variant="primary" type="submit" loading={submitting} disabled={submitting}>
        {submitLabel}
      </Button>
    </div>
  </div>
</form>
