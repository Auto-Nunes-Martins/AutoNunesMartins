<script lang="ts">
  import { MapPin, ArrowUpRight } from 'lucide-svelte';
  import type { StandContact } from './standContact';
  let { contact, id, harmonized = false }: { contact: StandContact; id: string; harmonized?: boolean } = $props();
  const locations = $derived([contact.address, contact.additionalAddress].filter((address): address is string => !!address));
  const directions = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\n/g, ', '))}`;
</script>

<section class="visit-locations" class:harmonized aria-label="Onde nos encontrar">
  {#each locations as address, index}
    <article class="location" id={`${id}-location-${index + 1}`} aria-label={`Localização: ${address.replace(/\n/g, ', ')}`}>
      <div class="location-copy">
        <h3><MapPin size={15} aria-hidden="true" /> Encontre-nos</h3>
        <address>{address}</address>
        <a class="map-link" href={directions(address)} target="_blank" rel="noopener noreferrer" aria-label={`Como chegar: ${address.replace(/\n/g, ', ')} (abre num novo separador)`}>
          Como chegar <ArrowUpRight size={16} aria-hidden="true" /><span class="sr-only">(abre num novo separador)</span>
        </a>
      </div>
      <p class="map-placeholder">Mapa interativo<br />ainda não disponível.</p>
    </article>
  {:else}<p>Morada por confirmar.</p>{/each}
</section>

<style>
  .visit-locations {display:grid;gap:12px;margin-top:28px;color:var(--text,#f5f5f1);}
  /* The former location panel and neighbouring form share this neutral material. */
  .location {position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,30%);align-items:center;gap:16px;min-height:144px;padding:15px 18px;border:1px solid #ffffff30;border-radius:5px;background:var(--visit-form-panel,#101913c9);backdrop-filter:blur(12px);}
  h3 {display:flex;align-items:center;gap:8px;font:inherit;font-size:13px;color:inherit;line-height:1.5;font-weight:400;margin:0;}
  address {font-size:15px;font-style:normal;line-height:1.6;white-space:pre-line;margin-top:10px;max-width:250px;overflow-wrap:anywhere;}
  .map-link {display:inline-flex;align-items:center;gap:8px;font-size:12px;min-height:30px;margin-top:8px;color:inherit;text-decoration:none;}
  .map-link :global(svg) {color:#fff;}
  .map-link:focus-visible {outline:2px solid currentColor;outline-offset:4px;border-radius:2px;text-decoration:underline;text-underline-offset:4px;}
  .map-placeholder {margin:0;padding-left:16px;border-left:1px solid #ffffff20;font-size:10px;line-height:1.7;color:var(--muted,#c2cbc5);}
  .harmonized address {font-size:16px;}.harmonized .map-link {font-size:14px;}
  .sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;}
  @media(hover:hover) {.map-link:hover {text-decoration:underline;text-underline-offset:4px;}.map-link:hover :global(svg) {transform:translateX(3px);}}
  @media(prefers-reduced-motion:no-preference) {.map-link :global(svg) {transition:transform 220ms ease;}}
  @media(max-width:900px) {.map-link {min-height:44px;}}
  @media(max-width:520px) {.location {padding:15px 16px;gap:12px;grid-template-columns:minmax(0,1fr) 90px;}.map-placeholder {padding-left:12px;}}
</style>
