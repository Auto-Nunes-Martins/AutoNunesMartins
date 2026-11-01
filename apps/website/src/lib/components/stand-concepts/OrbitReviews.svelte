<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { reviewExcerpt } from './reviewExcerpt';
  import { reviewExpansion } from './reviewExpansion';
  import { reviewRevealOffset } from './reviewPosition';
  import { brandMarquee } from '$lib/brandMarquee';
  import { reviewInitials, reviewAvatarUrl, type PublicReview } from '@anm/types';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  export let reviews: PublicReview[] = [];
  let failedAvatars: string[] = [];

  let section: HTMLElement;
  let visible = false;
  let pageVisible = true;
  let expandedReviews: number[] = [];
  let compactReviews = false;
  let activeCopies: number[] = [];
  let track: HTMLDivElement;
  let viewport: HTMLDivElement;
  let interaction = 0;
  let readingCard: HTMLElement | null = null;

  function revealCard(card: HTMLElement) {
    const bounds = viewport.getBoundingClientRect();
    const selected = card.getBoundingClientRect();
    const inset = Math.max(20, Math.min(52, innerWidth * 0.05));
    const shift = reviewRevealOffset(
      selected.left,
      selected.right,
      bounds.left,
      bounds.right,
      inset,
    );
    if (matchMedia('(max-width: 700px)').matches) {
      viewport.scrollBy({
        left: -shift,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      return;
    }
    const current = parseFloat(getComputedStyle(track).translate) || 0;
    track.style.translate = `${current + shift}px`;
  }

  async function toggleReview(index: number, duplicate: boolean, event: MouseEvent) {
    const card = (event.currentTarget as HTMLElement).closest('article')!;
    const opening = !expandedReviews.includes(index);
    activeCopies = duplicate
      ? [...activeCopies.filter((value) => value !== index), index]
      : activeCopies.filter((value) => value !== index);
    expandedReviews = expandedReviews.includes(index)
      ? expandedReviews.filter((value) => value !== index)
      : [...expandedReviews, index];
    const version = ++interaction;
    await tick();
    if (version !== interaction || !matchMedia('(max-width: 1100px)').matches) return;
    if (!expandedReviews.length) {
      readingCard = null;
      track.style.translate = '0px';
      return;
    }
    if (!opening) return;
    readingCard = card;
    revealCard(card);
  }

  onMount(() => {
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(section);
    const updateVisibility = () => {
      pageVisible = !document.hidden;
    };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    compactReviews = innerWidth <= 700;
    const resize = () => {
      compactReviews = innerWidth <= 700;
      ++interaction;
      if (innerWidth > 1100 || innerWidth <= 700) {
        track.style.translate = '0px';
        activeCopies = [];
        readingCard = null;
      } else if (readingCard && expandedReviews.length) revealCard(readingCard);
      else track.style.translate = '0px';
    };
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('resize', resize);
    };
  });

</script>

{#if reviews.length}
<section class="reviews" bind:this={section} aria-labelledby="reviews-heading">
  <div class="heading"><h2 id="reviews-heading">Quem veio, conta.</h2></div>
  <div
    class="review-viewport"
    bind:this={viewport}
    use:brandMarquee={{ paused: expandedReviews.length > 0 }}
  >
    <div
      id="reviews-track"
      class="review-track"
      bind:this={track}
      use:reviewExpansion
      class:paused={!visible || !pageVisible || expandedReviews.length > 0}
    >
      {#each [false, true] as duplicate}
        <div class="review-grid" class:duplicate data-brand-primary={!duplicate ? true : undefined}>
          {#each reviews as review, index}
            {@const preview = reviewExcerpt(review.text, compactReviews ? 64 : undefined)}
            {@const expanded = expandedReviews.includes(index)}
            {@const text = expanded ? review.text : preview.text}
            {@const lastSpace = text.lastIndexOf(' ')}
            {@const previewSpace = preview.text.lastIndexOf(' ')}
            <article
              data-review-card
              aria-hidden={duplicate !== activeCopies.includes(index) ? 'true' : undefined}
            >
              <div class="review-content">
                <div class="review-header">
                  <div class="review-top">
                    <span
                      class="stars"
                      role="img"
                      aria-label={`${review.rating} de 5 estrelas`}
                      >{'★'.repeat(Math.floor(review.rating))}{#if review.rating % 1}<span class="half-star" aria-hidden="true">☆</span>{/if}<span class="empty"
                        >{'☆'.repeat(5 - Math.ceil(review.rating))}</span
                      ></span
                    >
                    <span class="quote" aria-hidden="true">“</span>
                  </div>
                  <div class="review-person">
                    <span class="avatar" aria-hidden="true">
                      {#if review.avatarVersion && !failedAvatars.includes(review.id)}
                        <img src={reviewAvatarUrl(PUBLIC_BACKEND_URL, review)} alt="" width="44" height="44" loading="lazy" on:error={() => failedAvatars = [...failedAvatars, review.id]} />
                      {:else}{reviewInitials(review.authorName)}{/if}
                    </span
                    >
                    <div class="person-meta">
                      <h3>{review.authorName}</h3>
                      <span
                        class="verification"
                        title="Review de origem Google inserida manualmente pelo stand; sem sincronização ou verificação automática."
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><text x="1" y="10" fill="currentColor" font-size="11" font-weight="700">G</text></svg>
                        Google
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  class="review-copy"
                  id={`review-text-${duplicate ? 'copy' : 'original'}-${index}`}
                >
                  <p>
                    {#if preview.truncated}{text.slice(0, lastSpace + 1)}<span class="review-ending"
                        >{text.slice(lastSpace + 1)}{' '}
                        <button
                          type="button"
                          class="review-more"
                          aria-expanded={expanded}
                          aria-controls={`review-text-${duplicate ? 'copy' : 'original'}-${index}`}
                          aria-label={`${expanded ? 'Ver menos' : 'Ver mais'} da avaliação de ${review.authorName}`}
                          tabindex={duplicate !== activeCopies.includes(index) ? -1 : 0}
                          on:click={(event) => toggleReview(index, duplicate, event)}
                          >{expanded ? 'Ver menos' : 'Ver mais'}</button
                        >
                      </span>{:else}{text}{/if}
                  </p>
                </div>
                <div class="review-copy review-baseline" aria-hidden="true">
                  <p>
                    {#if preview.truncated}{preview.text.slice(0, previewSpace + 1)}<span
                        class="review-ending"
                        >{preview.text.slice(previewSpace + 1)}{' '}<span class="review-more"
                          >Ver mais</span
                        ></span
                      >{:else}{preview.text}{/if}
                  </p>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</section>
{/if}

<style>
  .reviews {
    width: var(--orbit-frame);
    max-width: var(--orbit-frame-max);
    margin: auto;
    padding-block: var(--orbit-space-section);
  }
  .heading {
    margin-bottom: var(--orbit-space-heading, 36px);
  }
  p,
  h2,
  h3 {
    margin: 0;
  }
  h2 {
    max-width: 21ch;
    font-size: max(32px, calc(var(--orbit-title-section, 48px) * 0.9));
    line-height: 1.12;
    letter-spacing: -0.05em;
    font-weight: 500;
    text-wrap: balance;
  }
  .review-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    align-items: start;
  }
  .duplicate {
    display: none;
  }
  article {
    min-width: 0;
    box-sizing: border-box;
    padding: clamp(26px, 2.3vw, 34px) clamp(20px, 1.7vw, 26px);
    background: var(--orbit-panel-bg);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  article {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .review-content {
    position: relative;
    display: flow-root;
    flex-shrink: 0;
    width: 100%;
  }
  .review-baseline {
    position: absolute;
    inset: 0 0 auto;
    visibility: hidden;
    pointer-events: none;
  }
  .stars {
    display: block;
    color: #b8860b;
    font-size: 15px;
    letter-spacing: 0.15em;
    margin-bottom: 20px;
  }
  :global(:where(html)[data-theme='dark']) .stars {
    color: #e8b94f;
  }
  .empty {
    color: inherit;
  }
  .half-star { position: relative; display: inline-block; }
  .half-star::after { content: '★'; position: absolute; left: 0; top: 0; width: 50%; overflow: hidden; }
  .review-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .review-header {
    display: contents;
  }
  .review-top .stars {
    margin-bottom: 0;
  }
  .quote {
    color: var(--muted);
    opacity: 0.35;
    font-family: Georgia, serif;
    font-size: 42px;
    line-height: 0.7;
  }
  .review-person {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 16px;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text) 6%, transparent);
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.02em;
  }
  .review-person h3 {
    margin-bottom: 0;
  }
  .verification {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    color: #637b6d;
    font-size: 10px;
  }
  .verification svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  :global(:where(html)[data-theme='dark']) .verification {
    color: #899e91;
  }
  h3 {
    font-size: 16px;
    letter-spacing: -0.02em;
    font-weight: 500;
    margin-bottom: 10px;
  }
  .review-copy {
    font-size: var(--orbit-type-body);
    line-height: 1.8;
    color: var(--muted);
  }
  .review-ending {
    white-space: nowrap;
  }
  .review-more {
    display: inline;
    margin: 0;
    padding: 0;
    background: none;
    border: 0;
    color: var(--text);
    font: inherit;
    font-size: 0.9em;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }
  .review-more:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .review-more:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 4px;
    border-radius: 2px;
  }
  @media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
    article {
      --tilt: -1deg;
      transition:
        transform 320ms ease,
        box-shadow 320ms ease,
        border-color 320ms ease;
    }
    article:nth-child(2) {
      --tilt: 0.7deg;
    }
    article:nth-child(3) {
      --tilt: -0.5deg;
    }
    article:hover {
      transform: perspective(1000px) translateY(-5px) rotateZ(var(--tilt)) rotateX(1deg);
      box-shadow: 0 16px 30px #00000012;
      border-color: color-mix(in srgb, var(--text) 22%, var(--line));
    }
  }
  .review-header {
    position: relative;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    grid-template-areas: 'avatar person stars';
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;
  }
  .review-top,
  .review-person {
    display: contents;
  }
  .person-meta {
    grid-area: person;
    min-width: 0;
  }
  .avatar {
    grid-area: avatar;
  }
  .avatar img {width:100%;height:100%;object-fit:cover;border-radius:inherit;}
  .quote {
    display: none;
  }
  .stars {
    grid-area: stars;
    justify-self: end;
    font-size: 14px;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  @media (max-width: 700px) {
    .review-header {
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: 8px;
    }
    .avatar {
      width: 36px;
      height: 36px;
    }
    .review-person h3 {
      font-size: 15px;
    }
    .stars {
      font-size: 12px;
      letter-spacing: 0;
    }
  }
  @keyframes reviews-pass {
    to {
      transform: translateX(-50%);
    }
  }
  @media (max-width: 1100px) {
    .reviews {
      width: 100%;
      max-width: none;
    }
    .heading {
      width: var(--orbit-frame);
      max-width: var(--orbit-frame-max);
      margin-inline: auto;
    }
    .review-viewport {
      --edge-fade: clamp(20px, 5vw, 52px);
      overflow: hidden;
      padding-block: 7px 12px;
      mask-image: linear-gradient(
        to right,
        transparent,
        #000 var(--edge-fade),
        #000 calc(100% - var(--edge-fade)),
        transparent
      );
      -webkit-mask-image: linear-gradient(
        to right,
        transparent,
        #000 var(--edge-fade),
        #000 calc(100% - var(--edge-fade)),
        transparent
      );
    }
    .review-track {
      display: flex;
      width: max-content;
      animation: reviews-pass 42s linear infinite;
    }
    .review-track.paused,
    .review-viewport:active .review-track,
    .review-viewport:has(:focus-visible) .review-track {
      animation-play-state: paused;
    }
    .review-grid,
    .duplicate {
      display: flex;
      flex: none;
      gap: 16px;
      padding-right: 16px;
    }
    article {
      flex: 0 0 auto;
      width: clamp(270px, 42vw, 360px);
      box-sizing: border-box;
    }
  }
  @media (max-width: 1100px) and (prefers-reduced-motion: no-preference) {
    .review-track {
      transition: translate 320ms cubic-bezier(0.215, 0.61, 0.355, 1);
    }
  }
  @media (max-width: 1100px) and (hover: hover) {
    .review-viewport:hover .review-track {
      animation-play-state: paused;
    }
  }
  @media (max-width: 700px) {
    .review-viewport {
      overflow-x: auto;
      scroll-padding-inline: var(--edge-fade);
      scrollbar-width: none;
    }
    .review-viewport::-webkit-scrollbar {
      display: none;
    }
    .review-track {
      animation: none;
      transition: none;
    }
    .duplicate {
      display: none;
    }
    .review-viewport:global([data-brand-loop='true']) .duplicate {
      display: flex;
    }
    article {
      width: min(78vw, 316px);
      padding: 16px 18px;
    }
    .review-header {
      margin-bottom: 10px;
    }
    .review-copy {
      font-size: 14px;
      line-height: 1.6;
    }
    .review-ending {
      white-space: normal;
    }
    .review-more {
      display: block;
      width: max-content;
      min-height: 44px;
      margin-top: 4px;
      text-align: left;
    }
  }
  @media (max-width: 1100px) and (prefers-reduced-motion: reduce) {
    .review-track {
      animation: none;
    }
    .duplicate {
      display: none;
    }
    .review-viewport {
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      mask-image: none;
      -webkit-mask-image: none;
    }
    .review-grid {
      padding-right: 0;
    }
    article {
      scroll-snap-align: start;
    }
  }
</style>
