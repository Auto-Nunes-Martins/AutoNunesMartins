<script lang="ts">
  import { onDestroy } from 'svelte';
  import ServiceBannerProposals from './ServiceBannerProposals.svelte';
  import { serviceBannerAlternatives } from '$lib/serviceBannerAlternatives';
  import { homeV5Images } from '$lib/homeV5Images';
  import { coverSourceWidth } from '$lib/coverImageSizes';
  let { onContact }: { onContact: (message?: string) => void } = $props();
  let selectedVersion = $state(0);
  let pendingVersion = $state<number | null>(null);
  let error = $state('');
  let controls: HTMLDivElement;
  let revision = 0;
  const preparations = new Set<HTMLPictureElement>();
  const versions = Array.from(
    { length: serviceBannerAlternatives.length + 1 },
    (_, index) => index,
  );
  const background = $derived(
    selectedVersion ? serviceBannerAlternatives[selectedVersion - 1] : undefined,
  );
  onDestroy(() => {
    revision += 1;
    preparations.forEach((picture) => picture.remove());
  });
  async function choose(index: number) {
    const request = ++revision;
    error = '';
    if (index === selectedVersion) {
      pendingVersion = null;
      return;
    }
    pendingVersion = index;
    const candidate = index ? serviceBannerAlternatives[index - 1]! : homeV5Images['service-wide'];
    const current = controls.parentElement?.querySelector<HTMLImageElement>('.banner-background');
    const bounds = current?.getBoundingClientRect();
    const sizes = `${bounds ? coverSourceWidth(bounds.width, bounds.height, candidate.width / candidate.height) : innerWidth}px`;
    const picture = document.createElement('picture');
    picture.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
    picture.setAttribute('aria-hidden', 'true');
    const source = document.createElement('source');
    source.type = 'image/avif';
    source.sizes = sizes;
    const image = new Image();
    image.alt = '';
    image.sizes = sizes;
    picture.append(source, image);
    document.body.append(picture);
    preparations.add(picture);
    source.srcset = candidate.avif;
    image.srcset = candidate.srcset;
    image.src = candidate.src;
    try {
      await image.decode();
      if (request === revision) selectedVersion = index;
    } catch {
      if (request === revision) error = 'Não foi possível carregar esta imagem. Tente novamente.';
    } finally {
      picture.remove();
      preparations.delete(picture);
      if (request === revision) pendingVersion = null;
    }
  }
</script>

<div class="home-services-comparison">
  <div
    class="service-versions"
    id="service-background-versions"
    class:expanded={versions.length > 4}
    class:nine={versions.length === 9}
    bind:this={controls}
    role="group"
    aria-label="Escolher imagem do banner de serviços"
    aria-busy={pendingVersion !== null}
  >
    {#each versions as version}
      <button
        type="button"
        class:selected={selectedVersion === version}
        class:loading={pendingVersion === version}
        aria-pressed={selectedVersion === version}
        onclick={() => choose(version)}>Versão {version + 1}</button
      >
    {/each}
  </div>
  <p class="status" role="status" aria-live="polite">
    {pendingVersion !== null ? `A carregar versão ${pendingVersion + 1}.` : ''}
  </p>
  {#if error}<p class="version-error" role="status">{error}</p>{/if}
  <ServiceBannerProposals {onContact} {background} />
</div>

<style>
  .home-services-comparison {
    display: contents;
  }
  .home-services-comparison :global(.home-services) {
    margin-top: 0;
  }
  .service-versions {
    position: relative;
    width: var(--orbit-frame, 95%);
    max-width: var(--orbit-frame-max, 1720px);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: max(0px, calc(var(--orbit-space-section, 86px) - 56px)) auto 12px;
    scroll-margin-top: 120px;
  }
  .service-versions button {
    min-height: 44px;
    padding: 10px 18px;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .service-versions button.selected {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .service-versions button.loading {
    opacity: 0.6;
  }
  .service-versions button:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 3px;
  }
  .status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .version-error {
    width: var(--orbit-frame, 95%);
    margin: 12px auto 0;
    text-align: center;
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 700px) {
    .service-versions {
      gap: 6px;
      margin-top: max(0px, calc(var(--orbit-space-section, 86px) - 52px));
      margin-bottom: 8px;
    }
    .service-versions button {
      flex: 1;
      padding-inline: 10px;
    }
  }
  @media (max-width: 700px) {
    .service-versions.expanded {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-top: max(0px, calc(var(--orbit-space-section, 86px) - 102px));
    }
  }
  @media (max-width: 700px) {
    .service-versions.nine {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: max(0px, calc(var(--orbit-space-section, 86px) - 152px));
    }
  }
</style>
