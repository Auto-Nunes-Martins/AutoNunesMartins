<script lang="ts">
  import { faviconLight, faviconDark } from '$lib/localAssets';
  import { theme } from '$lib/stores/theme';
</script>

<svelte:head>
  <link
    rel="icon"
    type="image/png"
    href={$theme === 'dark' ? faviconDark : faviconLight}
  />
  <meta name="application-name" content="Auto Nunes Martins" />
</svelte:head>
