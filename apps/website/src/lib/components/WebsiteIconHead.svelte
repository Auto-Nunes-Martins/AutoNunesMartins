<script lang="ts">
  // Owner-selected option 26 (light), fixed in both themes. Preserve the prepared pixel-size artwork.
  import icon16 from '$lib/assets/favicon/anm-26-16.png?url&no-inline';
  import icon32 from '$lib/assets/favicon/anm-26-32.png?url&no-inline';
  import iconIco from '$lib/assets/favicon/anm-26.ico?url&no-inline';
  import touchIcon from '$lib/assets/favicon/anm-26-180.png?url&no-inline';
</script>

<svelte:head>
  <link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48 64x64" href={iconIco} />
  <link rel="icon" type="image/png" sizes="16x16" href={icon16} />
  <link rel="icon" type="image/png" sizes="32x32" href={icon32} />
  <link rel="apple-touch-icon" sizes="180x180" href={touchIcon} />
</svelte:head>
