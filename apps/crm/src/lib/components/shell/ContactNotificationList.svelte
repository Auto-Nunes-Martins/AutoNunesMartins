<script lang="ts">
  import { Check, Mail } from 'lucide-svelte';
  interface Item {
    id: string;
    name: string;
    subject: string;
    createdAt: string;
    read: boolean;
  }
  let {
    items,
    onRead,
    readingId = '',
  }: { items: Item[]; onRead: (id: string) => void; readingId?: string } = $props();
  const timestamp = (value: string) =>
    new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
</script>

<section aria-label="Contactos do website" class="border-t border-[var(--color-border)]">
  <h4
    class="px-4 pt-3 pb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]"
  >
    Contactos do website
  </h4>
  <ul class="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
    {#each items as item (item.id)}
      <li class="px-4 py-3" class:opacity-70={item.read}>
        <div class="flex items-start gap-2">
          <Mail class="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-info)]" />
          <div class="min-w-0 flex-1">
            <p class="text-[12.5px] font-semibold text-[var(--color-text)] break-words">
              Novo contacto de {item.name}
            </p>
            <p class="text-[12px] text-[var(--color-text-muted)] break-words">{item.subject}</p>
            <time
              datetime={item.createdAt}
              class="block mt-1 text-[10px] text-[var(--color-text-faint)]"
              >{timestamp(item.createdAt)}</time
            >
            <p class="text-[10px] text-[var(--color-text-faint)] mt-1">
              Email aceite para envio. Consulte a caixa de correio.
            </p>
            {#if item.read}
              <span
                class="inline-flex gap-1 items-center mt-2 text-[10px] text-[var(--color-text-muted)]"
                ><Check class="h-3 w-3" />Lida por si</span
              >
            {:else}
              <button
                type="button"
                disabled={!!readingId}
                onclick={() => onRead(item.id)}
                aria-label={'Marcar contacto de ' + item.name + ' como lido'}
                class="mt-2 text-[11px] underline text-[var(--color-info)] disabled:opacity-50"
              >
                {readingId === item.id ? 'A guardar…' : 'Não lida · Marcar como lida'}
              </button>
            {/if}
          </div>
        </div>
      </li>
    {/each}
  </ul>
</section>
