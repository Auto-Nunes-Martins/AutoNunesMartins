<script lang="ts">
  import { logoLight, logoDark } from '$lib/localAssets';
  import { theme } from '$lib/stores/theme';
</script>

<svelte:head>
  <link
    rel="icon"
    type="image/png"
    href={$theme === 'dark' ? logoDark : logoLight}
  />
  <meta name="application-name" content="Auto Nunes Martins" />
</svelte:head>
