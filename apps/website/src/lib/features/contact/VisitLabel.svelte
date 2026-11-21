<script lang="ts">
  import RedDot from '../ui/RedDot.svelte';
  let { spaceBelow = 0 }: { spaceBelow?: number } = $props();
</script>

<p class="visit-label" style:margin-bottom={`${spaceBelow}px`}><RedDot /> VISITAR O STAND</p>

<style>
  .visit-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: #ececef;
    font-family: 'ANM Inter', Arial, sans-serif;
    font-size: 10px;
    font-weight: 400;
    line-height: 1.65;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
</style>
