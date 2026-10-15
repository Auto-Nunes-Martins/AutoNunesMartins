<script lang="ts">
  import { Sun, Moon } from 'lucide-svelte';
  let { dark, onchange }: { dark: boolean; onchange: () => void } = $props();
</script>

<button class="theme-command" data-theme-command type="button"
  aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
  title={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'} onclick={onchange}>
  <span class="theme-sun"><Sun size={19} strokeWidth={1.5} aria-hidden="true" /></span>
  <span class="theme-moon"><Moon size={19} strokeWidth={1.5} aria-hidden="true" /></span>
</button>

<style>
  .theme-sun { display:inline-flex; }
  .theme-moon { display:none; }
  :global(html[data-theme='light']) .theme-sun { display:none; }
  :global(html[data-theme='light']) .theme-moon { display:inline-flex; }
  .theme-command { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; min-width: 44px; min-height: 44px; padding: 0; background: color-mix(in srgb,var(--text) 5%,transparent); border: 0; border-radius: 50%; color: var(--text); cursor: pointer; flex-shrink: 0; }
  .theme-command:hover { background: color-mix(in srgb,var(--text) 9%,transparent); }
  .theme-command:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
  @media (prefers-reduced-motion: no-preference) { .theme-command { transition: background-color 180ms ease; } }
</style>
