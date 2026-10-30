<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Check, Car } from 'lucide-svelte';
  let { title, label, detail, imageUrl, ownedUrl = false, onlineUrl }: {
    title: string; label: string; detail: string; imageUrl?: string; ownedUrl?: boolean; onlineUrl?:string;
  } = $props();
  let failed = $state(false);
  onDestroy(() => { if (ownedUrl && imageUrl) URL.revokeObjectURL(imageUrl); });
</script>

<div class="vehicle-success">
  <div class="vehicle-image">{#if imageUrl && !failed}<img src={imageUrl} alt="" onerror={() => failed = true} />{:else}<Car size={25} />{/if}<span><Check size={12} /></span></div>
  <div class="copy"><strong>{title}</strong><p>{label}</p><small>{detail}</small>{#if onlineUrl}<a href={onlineUrl} target="_blank" rel="noopener noreferrer">Ver online ↗</a>{/if}</div>
</div>

<style>
  .vehicle-success { display: flex; align-items: center; gap: 14px; width: min(390px, calc(100vw - 40px)); max-width:100%; min-width:0; padding: 18px; padding-right: 36px; box-sizing: border-box; overflow:hidden; background: var(--color-bg-elevated); color: var(--color-text); border: 1px solid var(--color-border-strong); border-radius: 8px; box-shadow: 0 12px 32px #0003; }
  .vehicle-image { position: relative; flex:0 0 76px; display: grid; place-items: center; width: 76px; height: 58px; overflow:hidden; background: var(--color-bg-2); border-radius: 4px; color: var(--color-text-muted); }
  img { position:absolute;inset:0;display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover; }
  .vehicle-image > span { position: absolute; right: 3px; bottom: 3px; display: grid; place-items: center; width: 21px; height: 21px; background: #226c45; color: white; border: 2px solid var(--color-bg-elevated); border-radius: 50%; }
  .copy { flex:1 1 0;min-width:0;overflow-wrap:anywhere; }
  strong { font-size: 14px; line-height: 1.35; font-weight: 600; }
  p { margin: 4px 0; font-size: 13px; overflow-wrap: anywhere; }
  small { display: block; font-size: 11px; line-height: 1.45; color: var(--color-text-muted); }
  a {display:inline-flex;align-items:center;min-height:36px;margin-top:6px;font-size:12px;font-weight:600;color:var(--color-red);text-decoration:underline;text-underline-offset:3px;}a:focus-visible{outline:2px solid var(--color-red);outline-offset:3px;border-radius:3px;}
  @media(max-width:480px) {.vehicle-success {gap:12px;padding:16px;}.vehicle-image {flex-basis:64px;width:64px;height:58px;}}
</style>
