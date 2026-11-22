<script lang="ts">
  import fabric from './promotion-ribbon-fabric.webp?url&no-inline';
</script>

<!-- The adjacent SVG is the master. Its lighting and fabric grain are baked at 3×. -->
<img class="ribbon-fabric" src={fabric} alt="" aria-hidden="true" width="220" height="44" />

<style>
  .ribbon-fabric {
    position: absolute;
    inset: -4px 0;
    width: 100%;
    height: calc(100% + 8px);
    overflow: visible;
    filter: drop-shadow(0 2px 1px #3100083b) drop-shadow(0 5px 4px #00000024);
  }
</style>
