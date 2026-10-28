<script lang="ts">
  import { MapPin, ArrowUpRight, Check } from 'lucide-svelte';
  import type { StandContact } from './standContact';
  let {contact,id}:{contact:StandContact;id:string}=$props();
  let selected=$state(0);
  const locations=$derived([contact.address,contact.additionalAddress].filter((address):address is string=>!!address));
  const current=$derived(locations[selected]??locations[0]);
  const directions=(address:string)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\n/g,', '))}`;
</script>

<section class="visit-locations" aria-label="Onde nos encontrar">
  <div class="locations-heading"><h3>{locations.length>1?'Duas moradas. O mesmo stand.':'Encontre-nos.'}</h3><p>Escolha onde nos quer visitar.</p></div>
  <div class="location-options">
    {#each locations as address,index}
      <article class:chosen={current===address}>
        <button class="choose-location" type="button" aria-pressed={current===address} aria-controls={`${id}-location-panel`} aria-label={`Ver localização: ${address.replace(/\n/g,', ')}`} onclick={()=>selected=index}>
          <span class="location-number">0{index+1}</span><span class="location-address">{address}</span><span class="selection-mark" aria-hidden="true">{#if current===address}<Check size={16}/>{/if}</span>
        </button>
        <a href={directions(address)} target="_blank" rel="noopener noreferrer" aria-label={`Como chegar: ${address.replace(/\n/g,', ')} (abre num novo separador)`}>Como chegar <ArrowUpRight size={15} aria-hidden="true"/></a>
      </article>
    {/each}
  </div>
  <div class="location-panel" id={`${id}-location-panel`} role="region" aria-label="Localização selecionada" aria-live="polite" aria-atomic="true">
    <span class="location-pin" aria-hidden="true"><MapPin size={30} strokeWidth={1.4}/></span>
    <div><p class="location-label">LOCALIZAÇÃO SELECIONADA</p><address>{current??'Morada por confirmar.'}</address><p class="map-note">O mapa interativo ainda não está disponível. Consulte a morada no Google Maps.</p></div>
  </div>
</section>

<style>
  .visit-locations{margin-top:28px;color:var(--text,#f5f5f1);}
  .locations-heading{margin-bottom:14px;}h3{font:inherit;font-size:18px;font-weight:500;letter-spacing:-.025em;margin:0;}p{margin:6px 0 0;font-size:12px;line-height:1.6;color:var(--muted,#c2cbc5);}
  .location-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  article{min-width:0;border:1px solid var(--line,#ffffff30);border-radius:5px;background:color-mix(in srgb,var(--bg,#17231e) 78%,transparent);}
  article.chosen{border-color:var(--text,#f5f5f1);background:color-mix(in srgb,var(--text,#fff) 8%,var(--bg,#17231e));}
  .choose-location{display:flex;align-items:flex-start;gap:10px;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:16px 13px 8px;min-height:92px;font:inherit;cursor:pointer;}
  .location-number{font-size:10px;letter-spacing:.1em;color:var(--muted,#c2cbc5);padding-top:3px;}
  .location-address{white-space:pre-line;font-size:13px;line-height:1.6;flex:1;overflow-wrap:anywhere;}
  .selection-mark{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:18px;height:18px;border:1px solid var(--line,#ffffff30);border-radius:50%;margin-top:2px;}
  .chosen .selection-mark{background:var(--text,#f5f5f1);color:var(--bg,#17231e);border-color:transparent;}
  a{display:flex;align-items:center;gap:8px;min-height:44px;padding:7px 13px 12px 36px;color:inherit;font-size:12px;text-decoration:underline;text-underline-offset:4px;}
  button:focus-visible,a:focus-visible{outline:2px solid var(--text,#fff);outline-offset:3px;border-radius:4px;}
  .location-panel{display:flex;align-items:center;gap:18px;border:1px solid var(--line,#ffffff30);border-radius:5px;padding:22px;margin-top:12px;min-height:145px;background:radial-gradient(ellipse at top right,#ffffff0c,transparent 70%),var(--studio-soft,#22342b);}
  .location-pin{display:flex;align-items:center;justify-content:center;width:58px;height:58px;border:1px solid var(--line,#ffffff30);border-radius:50%;flex-shrink:0;}
  .location-label{margin:0 0 8px;font-size:9px;letter-spacing:.15em;}
  address{font-size:16px;font-style:normal;line-height:1.55;white-space:pre-line;}
  .map-note{max-width:42ch;font-size:11px;margin-top:10px;}
  @media(max-width:520px){.location-options{grid-template-columns:1fr;}.choose-location{min-height:76px;}.location-panel{padding:18px 14px;gap:12px;}.location-pin{width:44px;height:44px;}address{font-size:14px;}}
</style>
