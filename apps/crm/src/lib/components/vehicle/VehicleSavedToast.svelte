<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Check, Car } from 'lucide-svelte';
  let { title, label, detail, imageUrl, ownedUrl = false }: {
    title: string; label: string; detail: string; imageUrl?: string; ownedUrl?: boolean;
  } = $props();
  let failed = $state(false);
  onDestroy(() => { if (ownedUrl && imageUrl) URL.revokeObjectURL(imageUrl); });
</script>

<div class="vehicle-success">
  <div class="vehicle-image">{#if imageUrl && !failed}<img src={imageUrl} alt="" onerror={() => failed = true} />{:else}<Car size={25} />{/if}<span><Check size={12} /></span></div>
  <div class="copy"><strong>{title}</strong><p>{label}</p><small>{detail}</small></div>
</div>

<style>
  .vehicle-success { display: flex; align-items: center; gap: 14px; width: min(390px, calc(100vw - 72px)); padding: 18px; padding-right: 36px; box-sizing: border-box; background: var(--color-bg-elevated); color: var(--color-text); border: 1px solid var(--color-border-strong); border-radius: 8px; box-shadow: 0 12px 32px #0003; }
  .vehicle-image { position: relative; flex-shrink: 0; display: grid; place-items: center; width: 76px; height: 58px; background: var(--color-bg-2); border-radius: 4px; color: var(--color-text-muted); }
  img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .vehicle-image > span { position: absolute; right: -5px; bottom: -5px; display: grid; place-items: center; width: 21px; height: 21px; background: #226c45; color: white; border: 2px solid var(--color-bg-elevated); border-radius: 50%; }
  .copy { min-width: 0; }
  strong { font-size: 14px; line-height: 1.35; font-weight: 600; }
  p { margin: 4px 0; font-size: 13px; overflow-wrap: anywhere; }
  small { display: block; font-size: 11px; line-height: 1.45; color: var(--color-text-muted); }
</style>
