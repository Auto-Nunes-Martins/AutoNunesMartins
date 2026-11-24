<script lang="ts">
  import { ArrowRightLeft } from 'lucide-svelte';
  import '$lib/styles/vehicleStateTags.css';
</script>

<span class="vehicle-state-chip trade-in-badge" role="img" aria-label="Retoma" title="Retoma">
  <ArrowRightLeft size={14} aria-hidden="true" />
</span>

<style>
  .trade-in-badge {
    --state-tag-radius: var(--radius-btn);
    flex: none;
    justify-content: center;
    color: var(--color-warning);
    border: 1px solid color-mix(in oklab, var(--color-warning) 45%, transparent);
    background: color-mix(in oklab, var(--color-warning) 12%, transparent);
  }
</style>
