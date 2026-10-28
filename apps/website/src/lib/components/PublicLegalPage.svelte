<script lang="ts">
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';
  import SocialMetadata from './SocialMetadata.svelte';
  import { publicLegalLinks } from '$lib/publicLegal';
  let {title,description,path,sections,children,note='Os campos assinalados estão por confirmar antes da publicação.'}:{title:string;description:string;path:string;sections:{id:string;label:string}[];children:Snippet;note?:string}=$props();
</script>

<SocialMetadata title={`${title} — Auto Nunes Martins`} {description} canonical={new URL(path,$page.url.origin).href}/>
<svelte:head><title>{title} — Auto Nunes Martins</title><meta name="description" content={description}/><meta name="robots" content="noindex, follow"/><link rel="canonical" href={new URL(path,$page.url.origin).href}/></svelte:head>
<main class="legal-page" id="inicio">
  <header><p class="eyebrow">INFORMAÇÃO AO VISITANTE</p><h1>{title}<span>.</span></h1><p class="intro">{description}</p><p class="updated">Atualizado em 28 de outubro de 2026</p></header>
  <nav class="legal-navigation" aria-label="Informação legal e privacidade">{#each publicLegalLinks as item}<a href={item.href} aria-current={path===item.href?'page':undefined}>{item.label}</a>{/each}</nav>
  <div class="legal-layout">
    <nav class="contents" aria-label="Nesta página">{#each sections as section,index}<a href={`#${section.id}`}><span>0{index+1}</span>{section.label}</a>{/each}</nav>
    <div class="legal-content"><aside class="review-note" aria-label="Informação por completar"><strong>Informação em revisão</strong><p>{note}</p></aside>{@render children()}</div>
  </div>
</main>
<style>
  .legal-page{width:var(--orbit-frame,90%);max-width:var(--orbit-frame-max,1640px);margin:auto;padding:56px 0 88px;color:var(--text);}
  header{max-width:850px;padding-bottom:32px;}.eyebrow{font-size:10px;letter-spacing:.14em;color:var(--muted);margin:0;}h1{font:600 clamp(38px,5vw,70px)/1.06 'Barlow',sans-serif;letter-spacing:-.04em;margin:20px 0;}h1 span{color:var(--red,#e30613);}.intro{color:var(--muted);font-size:16px;line-height:1.7;margin:0;}.updated{color:var(--muted);font-size:11px;margin:20px 0 0;}
  .legal-navigation{display:flex;flex-wrap:wrap;gap:0 24px;padding:12px 0;border-block:1px solid var(--line);}.legal-navigation a{font-size:12px;min-height:44px;display:flex;align-items:center;text-decoration:none;}.legal-navigation a[aria-current]{color:var(--text);box-shadow:inset 0 -2px var(--red);}
  .legal-layout{display:grid;grid-template-columns:210px minmax(0,760px);gap:clamp(32px,6vw,100px);padding-top:36px;}.contents{display:flex;flex-direction:column;align-self:start;position:sticky;top:110px;}.contents a{display:flex;gap:12px;align-items:baseline;min-height:44px;font-size:12px;text-decoration:none;line-height:1.6;padding:8px 0;}.contents span{font-size:10px;color:var(--muted);}
  .legal-content{min-width:0;font-size:15px;line-height:1.8;}.review-note{padding:16px 18px;background:var(--surface);border-left:2px solid var(--red);font-size:12px;}.review-note strong{font-weight:600;}.review-note p{margin:4px 0 0;color:var(--muted);}
  .legal-content :global(section){padding:28px 0;border-bottom:1px solid var(--line);scroll-margin-top:110px;}.legal-content :global(h2){font:500 clamp(22px,2.4vw,30px)/1.25 'Barlow',sans-serif;letter-spacing:-.02em;margin:0 0 16px;}.legal-content :global(h3){font-size:16px;line-height:1.5;font-weight:600;margin:24px 0 10px;}.legal-content :global(p){margin:12px 0;color:var(--muted);}.legal-content :global(li){margin:8px 0;color:var(--muted);}.legal-content :global(ul){padding-left:22px;}.legal-content :global(address){font-style:normal;white-space:pre-line;margin:12px 0;}.legal-content :global(code){font-size:12px;overflow-wrap:anywhere;}.legal-content :global(.table-scroll){overflow-x:auto;}.legal-content :global(table){width:100%;border-collapse:collapse;font-size:13px;}.legal-content :global(th),.legal-content :global(td){text-align:left;vertical-align:top;padding:14px 12px;border-bottom:1px solid var(--line);min-width:120px;}.legal-content :global(th){font-weight:600;}.legal-content :global(.pending){color:var(--muted);font-size:12px;}
  a,.legal-content :global(a){color:inherit;text-decoration:underline;text-underline-offset:4px;overflow-wrap:anywhere;}a:focus-visible,.legal-content :global(a:focus-visible){outline:2px solid var(--red);outline-offset:4px;}
  @media(max-width:800px){.legal-page{padding-top:32px;}.legal-layout{grid-template-columns:minmax(0,1fr);gap:20px;}.contents{position:static;display:flex;flex-flow:row wrap;gap:0 20px;border-bottom:1px solid var(--line);padding-bottom:16px;}.legal-navigation{gap:0 18px;}.legal-content{font-size:14px;}}
</style>
