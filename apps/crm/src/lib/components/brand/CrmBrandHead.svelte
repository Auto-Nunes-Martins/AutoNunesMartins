<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { theme } from '$lib/stores/theme';
</script>

<svelte:head>
  <link
    rel="icon"
    type="image/png"
    href={$theme === 'dark' ? crmPath('/logo-transparent-white-v3.png') : crmPath('/logo-transparent.png')}
  />
  <meta name="application-name" content="Auto Nunes Martins" />
</svelte:head>
