<script lang="ts">
  import { ArrowUpRight, Heart, Columns2 } from 'lucide-svelte';
  import { useFavorites } from '$lib/favorites';
  import { useComparison } from '$lib/comparison';
  const { ids: favoriteIds, ready: favoritesReady } = useFavorites();
  const { ids: comparisonIds, ready: comparisonReady } = useComparison();
  const savedCount = $derived($favoritesReady ? $favoriteIds.length : 0);
  const comparisonCount = $derived($comparisonReady ? $comparisonIds.length : 0);
</script>

<section class="choice-guide" id="escolher-com-criterio" aria-labelledby="choice-guide-title">
  <div class="guide-intro">
    <h2 id="choice-guide-title">As suas escolhas.</h2>
    <p>Guarde e compare as viaturas que lhe interessam.</p>
  </div>
  <a class="choice-action" href={savedCount ? '/favoritos' : '/viaturas'} data-choice="favorites">
    <Heart size={25} strokeWidth={1.4} aria-hidden="true" />
    <span class="action-copy"
      ><span class="action-title">Os seus favoritos</span><span class="action-detail"
        >{savedCount
          ? `${savedCount} ${savedCount === 1 ? 'viatura guardada' : 'viaturas guardadas'}.`
          : 'Use o coração nas viaturas para guardar.'}</span
      ><span class="action-label">{savedCount ? 'Ver favoritos' : 'Explorar e guardar'}</span></span
    >
    <ArrowUpRight class="action-arrow" size={17} aria-hidden="true" />
  </a>
  <a
    class="choice-action"
    href={comparisonCount >= 2 ? '/comparar' : '/viaturas'}
    data-choice="comparison"
  >
    <Columns2 size={25} strokeWidth={1.4} aria-hidden="true" />
    <span class="action-copy"
      ><span class="action-title">Lado a lado</span><span class="action-detail"
        >{comparisonCount >= 2
          ? `${comparisonCount} viaturas na comparação.`
          : comparisonCount === 1
            ? 'Falta escolher mais uma viatura.'
            : 'Escolha pelo menos duas viaturas.'}</span
      ><span class="action-label"
        >{comparisonCount >= 2 ? 'Ver comparação' : 'Escolher viaturas'}</span
      ></span
    >
    <ArrowUpRight class="action-arrow" size={17} aria-hidden="true" />
  </a>
</section>

<style>
  .choice-guide {
    width: var(--orbit-frame, 90%);
    max-width: var(--orbit-frame-max, 1320px);
    margin-inline: auto;
    display: grid;
    grid-template-columns: 0.85fr 1fr 1fr;
    gap: 30px;
    align-items: center;
    padding-bottom: 30px;
    border-bottom: 1px solid var(--line);
    scroll-margin-top: 120px;
  }
  * {
    box-sizing: border-box;
  }
  h2,
  p {
    margin: 0;
  }
  h2 {
    font-size: clamp(23px, 2.1vw, 30px);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.04em;
  }
  .guide-intro p {
    max-width: 245px;
    margin-top: 9px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.7;
  }
  .choice-action {
    display: flex;
    align-items: flex-start;
    gap: 15px;
    min-width: 0;
    padding-left: 28px;
    border-left: 1px solid var(--line);
    color: var(--text);
    text-decoration: none;
  }
  .choice-action > :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .action-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .action-title {
    font-size: 17px;
    font-weight: 500;
    letter-spacing: -0.025em;
    line-height: 1.3;
  }
  .action-detail {
    margin-top: 6px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.6;
  }
  .action-label {
    margin-top: 11px;
    font-size: 14px;
    line-height: 1.5;
  }
  .choice-action :global(.action-arrow) {
    color: var(--muted);
    width: 16px;
  }
  .choice-action:hover .action-label {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .choice-action:hover > :global(svg) {
    color: var(--red, #e30613);
  }
  .choice-action:focus-visible {
    outline: 2px solid var(--red, #e30613);
    outline-offset: 7px;
  }
  @media (max-width: 900px) {
    .choice-guide {
      gap: 20px;
    }
    .choice-action {
      padding-left: 20px;
      gap: 12px;
    }
  }
  @media (max-width: 700px) {
    .choice-guide {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
      padding-bottom: 8px;
    }
    .guide-intro {
      padding-bottom: 21px;
    }
    .guide-intro p {
      max-width: none;
    }
    .choice-action {
      padding: 20px 0;
      border-left: 0;
      border-top: 1px solid var(--line);
      gap: 15px;
    }
    .action-label {
      margin-top: 7px;
    }
  }
</style>
