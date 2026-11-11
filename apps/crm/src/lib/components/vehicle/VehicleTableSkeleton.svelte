<script lang="ts">
  import Skeleton from '$lib/components/common/Skeleton.svelte';

  interface Props {
    rows?: number;
  }

  let { rows = 6 }: Props = $props();
</script>

<div class="md:hidden divide-y divide-[var(--color-border)]">
  {#each Array(rows) as _, i (i)}
    <div class="space-y-2 px-3 py-3">
      <div class="flex items-center gap-3">
        <Skeleton
          width="clamp(68px, 20vw, 84px)"
          height="clamp(51px, 15vw, 63px)"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <Skeleton width="75%" height="14px" />
          <Skeleton width="60%" height="11px" />
          <Skeleton width="50%" height="11px" />
        </div>
        <div class="w-11 shrink-0" aria-hidden="true"></div>
      </div>
      <Skeleton width="140px" height="22px" />
    </div>
  {/each}
</div>

<div class="hidden md:block overflow-x-auto">
  <table class="w-full text-[13px]">
    <thead>
      <tr class="border-b border-[var(--color-border)]">
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Viatura
        </th>
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Ano
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Km
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Aquisição
        </th>
        <th
          class="text-right px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          PVP
        </th>
        <th
          class="text-left px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
        >
          Estado
        </th>
        <th class="w-10"></th>
      </tr>
    </thead>
    <tbody>
      {#each Array(rows) as _, i (i)}
        <tr class="border-b border-[var(--color-border)]">
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <Skeleton width="96px" height="72px" class="shrink-0" />
              <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                <Skeleton width="60%" height="14px" />
                <Skeleton width="45%" height="10px" />
              </div>
            </div>
          </td>
          <td class="px-4 py-3"><Skeleton width="40px" height="12px" /></td>
          <td class="px-4 py-3 text-right"><Skeleton width="60px" height="12px" /></td>
          <td class="px-4 py-3 text-right"><Skeleton width="70px" height="12px" /></td>
          <td class="px-4 py-3 text-right"><Skeleton width="80px" height="14px" /></td>
          <td class="px-4 py-3"><Skeleton width="80px" height="20px" /></td>
          <td class="px-4 py-3"><Skeleton width="16px" height="16px" /></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
