<script lang="ts">
  import { enhance } from '$app/forms';
  import { crmPath } from '$lib/paths';
  import { Trash2 } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  let {
    id,
    brand,
    model,
    blocked = false,
    disabled = false,
    busy = $bindable(false),
    onredirect,
  }: {
    id: string;
    brand: string;
    model: string;
    blocked?: boolean;
    disabled?: boolean;
    busy?: boolean;
    onredirect?: () => void;
  } = $props();
</script>

<section class="vehicle-deletion" aria-label="Eliminar viatura">
  <div>
    <h2>Eliminar viatura</h2>
    <p>
      {blocked
        ? 'A eliminação está indisponível enquanto existir uma venda associada.'
        : 'Elimina permanentemente a ficha e as despesas associadas. Para a retirar apenas do website, desative a publicação.'}
    </p>
  </div>
  <form
    method="POST"
    action={crmPath(`/viaturas/${id}/editar?/delete`)}
    use:enhance={({ cancel }) => {
      if (
        blocked ||
        disabled ||
        busy ||
        !window.confirm(
          `Eliminar definitivamente ${brand} ${model}? A ficha e as despesas associadas serão eliminadas. Esta ação não pode ser desfeita.`,
        )
      ) {
        cancel();
        return;
      }
      busy = true;
      return async ({ result, update }) => {
        try {
          if (result.type === 'redirect') {
            onredirect?.();
            toast.success('Viatura eliminada.');
          } else if (result.type === 'failure')
            toast.error(
              (result.data as { error?: string } | undefined)?.error ??
                'Não foi possível eliminar a viatura.',
            );
          await update({ reset: false });
        } finally {
          busy = false;
        }
      };
    }}
  >
    <button type="submit" disabled={blocked || disabled || busy}
      ><Trash2 size={15} aria-hidden="true" />{busy ? 'A eliminar…' : 'Eliminar viatura'}</button
    >
  </form>
</section>

<style>
  .vehicle-deletion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 6px;
  }
  p {
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.7;
    max-width: 75ch;
    margin: 0;
  }
  form {
    flex-shrink: 0;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 10px 14px;
    border: 1px solid color-mix(in oklab, var(--color-red) 40%, var(--color-border));
    border-radius: var(--radius-btn);
    color: var(--color-red);
    background: transparent;
    font-size: 12px;
    transition: background-color 140ms;
  }
  button:hover:not(:disabled) {
    background: color-mix(in oklab, var(--color-red) 8%, transparent);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 4px;
  }
  @media (max-width: 600px) {
    .vehicle-deletion {
      flex-direction: column;
      align-items: start;
      gap: 14px;
    }
  }
</style>
