<script lang="ts">
  import '$lib/styles/vehicleStateTags.css';
  import { Globe, EyeOff } from 'lucide-svelte';
  import { websiteVisibility, type WebsiteVehicle } from '$lib/websiteVisibility';
  let { vehicle, compact = false, liveOnly = false }: { vehicle: WebsiteVehicle; compact?: boolean; liveOnly?: boolean } = $props();
  const status = $derived(websiteVisibility(vehicle));
</script>
{#if !liveOnly || status.visible}
<span class="website-status vehicle-state-chip" class:live={status.visible} class:blocked={status.state === 'blocked' && !!vehicle.webPublished} class:compact title={status.detail} aria-label={status.label + '. ' + status.detail}>
  {#if status.visible}<Globe size={16} aria-hidden="true" />{:else}<EyeOff size={16} aria-hidden="true" />{/if}
  <span>{compact ? (status.visible ? 'No website' : status.state === 'blocked' && vehicle.webPublished ? 'Site oculto' : 'Só CRM') : status.label}</span>
</span>
{/if}
<style>
  .website-status {--state-tag-height:36px;--state-tag-padding:8px 11px;--state-tag-size:13px;--state-tag-font:var(--font-sans);--state-tag-spacing:normal;--state-tag-transform:none;--state-tag-radius:var(--radius-btn);border:1px solid var(--color-border-strong);background:var(--color-bg-2);color:var(--color-text-muted);}
  .website-status.live {color:var(--color-website);border-color:color-mix(in srgb,var(--color-website) 55%,transparent);background:color-mix(in srgb,var(--color-website) 12%,var(--color-bg-1));}
  .website-status.blocked {color:var(--color-warning);border-color:color-mix(in srgb,var(--color-warning) 45%,transparent);background:color-mix(in srgb,var(--color-warning) 8%,var(--color-bg-1));}
  .compact {--state-tag-height:28px;--state-tag-padding:5px 8px;--state-tag-size:11px;--state-tag-font:var(--font-mono);--state-tag-spacing:0.06em;--state-tag-transform:uppercase;--state-tag-radius:3px;}
  .website-status > :global(svg) {flex:none;}
  .compact > :global(svg) {width:14px;height:14px;}
</style>
