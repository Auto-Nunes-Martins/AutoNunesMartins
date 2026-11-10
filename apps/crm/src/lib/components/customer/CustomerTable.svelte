<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { linkedRow } from '$lib/linkedRow';
  import { Phone, Mail, FileText, User as UserIcon } from 'lucide-svelte';
  import RowActions from '$lib/components/common/RowActions.svelte';
  import { formatDate } from '$lib/utils/format';
  import type { CustomerListItem } from '$lib/server/customers';

  interface Props {
    items: CustomerListItem[];
  }

  let { items }: Props = $props();

  function actionsFor(customer: CustomerListItem) {
    return [
      { label: 'Ver ficha', href: crmPath(`/clientes/${customer.id}`), icon: FileText },
      ...(customer.phone
        ? [{ label: 'Ligar', href: `tel:${customer.phone.replace(/\s/g, '')}`, icon: Phone }]
        : []),
      ...(customer.email
        ? [{ label: 'Enviar email', href: `mailto:${customer.email}`, icon: Mail }]
        : []),
    ];
  }
</script>

{#snippet rowActions(c: CustomerListItem, compact = false)}
  <RowActions
    label={c.name}
    editHref={crmPath(`/clientes/${c.id}/editar`)}
    actions={actionsFor(c)}
    {compact}
  />
{/snippet}

<div class="md:hidden divide-y divide-[var(--color-border)]">
  {#each items as c (c.id)}
    <article class="flex items-center gap-1 px-2">
      <a
        href={crmPath('/clientes/' + c.id)}
        class="flex flex-1 min-w-0 items-center gap-2 py-2.5 group"
      >
        <div
          class="h-9 w-9 flex items-center justify-center shrink-0 rounded-xs bg-[var(--color-bg-2)]"
        >
          <UserIcon class="h-4 w-4 text-[var(--color-red)]" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <span
              class="min-w-0 truncate font-semibold text-[14px] group-hover:text-[var(--color-red)]"
              title={c.name}>{c.name}</span
            >
            <span class="shrink-0 text-[11px] text-[var(--color-text-muted)]"
              >{c._count.sales} {c._count.sales === 1 ? 'compra' : 'compras'}</span
            >
          </div>
          <p class="truncate text-[11px] text-[var(--color-text-muted)]">
            {#if c.phone}{c.phone} ·
            {/if}NIF {c.nif}
          </p>
          {#if c.email}<p
              class="truncate text-[11px] text-[var(--color-text-muted)]"
              title={c.email}
            >
              {c.email}
            </p>{/if}
        </div>
      </a>
      {@render rowActions(c, true)}
    </article>
  {/each}
</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Native horizontal scrolling by keyboard.) -->
<div
  class="hidden md:block overflow-x-auto"
  tabindex="0"
  role="region"
  aria-label="Clientes — tabela com deslocamento horizontal"
>
  <table class="crm-table w-full text-[13px]">
    <thead>
      <tr class="border-b border-[var(--color-border)]">
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Cliente
        </th>
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          NIF
        </th>
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Contacto
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Compras
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Último contacto
        </th>
        <th
          class="w-36 px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
          >Ações</th
        >
      </tr>
    </thead>
    <tbody>
      {#each items as c (c.id)}
        <tr
          use:linkedRow
          class="linked-row border-b border-[var(--color-border)] hover:bg-[color-mix(in_oklab,var(--color-red)_5%,transparent)] transition-colors group"
        >
          <td class="px-4 py-3">
            <a href={crmPath(`/clientes/${c.id}`)} class="row-link flex items-center gap-3">
              <div
                class="h-11 w-11 flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] flex-shrink-0"
                style="border-radius: var(--radius-btn);"
              >
                <UserIcon class="h-5 w-5 text-[var(--color-red)]" />
              </div>
              <div class="min-w-0">
                <div
                  class="font-display font-bold italic text-[15px] truncate group-hover:text-[var(--color-red)] transition-colors"
                >
                  {c.name}
                </div>
                {#if c.address}
                  <div class="text-[11px] text-[var(--color-text-faint)] truncate max-w-[280px]">
                    {c.address}
                  </div>
                {/if}
              </div>
            </a>
          </td>
          <td class="px-4 py-3 num-value text-[12.5px]">{c.nif}</td>
          <td class="px-4 py-3">
            <div class="flex flex-col gap-0.5">
              <a
                href={`tel:${c.phone.replace(/\s/g, '')}`}
                class="contact-link flex items-center gap-1.5 text-[12px]"
                aria-label={`Ligar para ${c.name}: ${c.phone}`}
              >
                <Phone class="h-3 w-3 text-[var(--color-text-faint)]" />
                <span class="font-mono">{c.phone}</span>
              </a>
              {#if c.email}
                <a
                  href={`mailto:${c.email}`}
                  class="contact-link flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]"
                  aria-label={`Enviar email a ${c.name}: ${c.email}`}
                >
                  <Mail class="h-3 w-3 text-[var(--color-text-faint)]" />
                  {c.email}
                </a>
              {/if}
            </div>
          </td>
          <td class="px-4 py-3 text-right">
            <span class="num-value text-[14px]">
              {c._count.sales}
            </span>
          </td>
          <td class="px-4 py-3 font-mono text-[11px] text-right text-[var(--color-text-muted)]">
            {c.lastContactDate ? formatDate(c.lastContactDate) : '—'}
          </td>
          <td class="px-4 py-3 text-right">
            {@render rowActions(c)}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
