<script lang="ts">
  import { Facebook, Instagram } from 'lucide-svelte';
  import { standContact } from './standContact';
  import { footerSocialLinks } from './footerSocialLinks';
  const socials = footerSocialLinks(standContact);
</script>

{#snippet icon(name: string)}
  {#if name === 'Facebook'}<Facebook size={18} aria-hidden="true" />
  {:else if name === 'Instagram'}<Instagram size={18} aria-hidden="true" />
  {:else}
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z" />
      <path transform="translate(2.64 2.64) scale(.78)" d="m8.1 7.6 1.3-.3 1.1 2.3-.9 1.1a8 8 0 0 0 3.6 3.5l1-.9 2.2 1.1-.2 1.3c-.1.8-1 1.2-1.8 1-4.4-1-7.2-3.8-7.4-7.2 0-.8.4-1.6 1.1-1.9Z" />
    </svg>
  {/if}
{/snippet}

<div class="socials" role="group" aria-label="Redes sociais e WhatsApp">
  {#each socials as social}
    {#if social.href}
      <a href={social.href} target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label={`${social.name} da Auto Nunes Martins (abre num novo separador)`} title={social.name}>
        {@render icon(social.name)}
      </a>
    {:else}
      <span class="pending" role="img" aria-label={`${social.name} — ligação por confirmar`} title={`${social.name} — ligação por confirmar`}>
        {@render icon(social.name)}
      </span>
    {/if}
  {/each}
</div>

<style>
  .socials { display: flex; align-items: center; gap: 4px; color: #c1c1c7; }
  a, .pending { display: inline-flex; align-items: center; justify-content: center; width: 36px; min-height: 44px; text-decoration: none; color: inherit; }
  .pending { color: #a6a6ae; }
  .socials :global(svg) { flex-shrink: 0; }
  a:focus-visible { outline: 2px solid #f5f5f1; outline-offset: 5px; }
  @media (hover:hover) { a:hover { color: #fff; text-decoration: underline; text-decoration-color: var(--red, #e30613); text-underline-offset: 5px; } }
</style>
