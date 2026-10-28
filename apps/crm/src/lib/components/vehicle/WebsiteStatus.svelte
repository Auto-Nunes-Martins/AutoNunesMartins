<script lang="ts">
  import { Globe, EyeOff } from 'lucide-svelte';
  import { websiteVisibility, type WebsiteVehicle } from '$lib/websiteVisibility';
  let { vehicle, compact = false }: { vehicle: WebsiteVehicle; compact?: boolean } = $props();
  const status = $derived(websiteVisibility(vehicle));
</script>
<span class="website-status" class:live={status.visible} class:compact title={status.detail} aria-label={status.label + '. ' + status.detail}>
  {#if status.visible}<Globe size={16} aria-hidden="true" />{:else}<EyeOff size={16} aria-hidden="true" />{/if}
  <span>{compact ? (status.visible ? 'No website' : status.state === 'blocked' && vehicle.webPublished ? 'Site oculto' : 'Só CRM') : status.label}</span>
</span>
<style>
  .website-status {display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--color-border-strong);border-radius:var(--radius-btn);background:var(--color-bg-2);font-size:13px;font-weight:600;line-height:1.4;color:var(--color-text-muted);}
  .website-status.live {color:var(--color-success);border-color:color-mix(in srgb,var(--color-success) 45%,transparent);background:color-mix(in srgb,var(--color-success) 8%,var(--color-bg-1));}
  .compact {font-size:11px;padding:4px 7px;white-space:nowrap;}
</style>
