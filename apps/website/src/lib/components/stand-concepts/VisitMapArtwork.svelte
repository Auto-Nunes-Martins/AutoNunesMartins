<script lang="ts">
  import original from '$lib/assets/images/orbit-location-map.svg?raw';
  let { id }: { id: string } = $props();
  // Trusted repository artwork: preserve every path, coordinate and red marker.
  // Only paint tokens change; the original file remains the fallback for V1/2.
  const artwork = $derived(
    original
      .replaceAll('neighbourhood', `${id}-neighbourhood`)
      .replaceAll('#dce2d8', 'var(--visit-map-canvas)')
      .replaceAll('#cbd2c7', 'var(--visit-map-block)')
      .replaceAll('#bfc8bc', 'var(--visit-map-edge)')
      .replaceAll('#bacbb5', 'var(--visit-map-park)')
      .replaceAll('#a9c7cc', 'var(--visit-map-water)')
      .replaceAll('#f9f8f1', 'var(--visit-map-street)')
      .replaceAll('#e9d6a5', 'var(--visit-map-route)'),
  );
</script>

<span aria-hidden="true">{@html artwork}</span>

<style>
  span,
  span :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
