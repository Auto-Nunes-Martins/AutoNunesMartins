<script lang="ts">
  import { Check, Star, Tag, MessageSquare } from 'lucide-svelte';
  import CampaignVehiclePhoto from '../vehicle/CampaignVehiclePhoto.svelte';
  import type { SiteSaveSummary } from './siteSaveFeedback';
  let { summary }: { summary: SiteSaveSummary } = $props();
  let imageFailed = $state(false);
</script>

<div class="site-saved" data-site-save={summary.kind}>
  <div class="heading">
    <span class="success"><Check size={14} aria-hidden="true" /></span><strong
      >{summary.title}</strong
    >
  </div>
  <div class="content">
    <div class="visual" class:avatar={summary.kind === 'review'} aria-hidden="true">
      {#if summary.imageUrl && !imageFailed}
        <img
          src={summary.imageUrl}
          alt=""
          style:object-position={summary.imagePosition ?? '50% 50%'}
          onerror={() => (imageFailed = true)}
        />
      {:else if summary.vehicleId}
        <CampaignVehiclePhoto vehicleId={summary.vehicleId} compact />
      {:else if summary.kind === 'review'}<MessageSquare size={24} />
      {:else if summary.kind === 'highlight'}<Star size={24} />
      {:else}<Tag size={24} />{/if}
    </div>
    <div class="copy">
      <p class="label">{summary.label}</p>
      {#if summary.rating !== undefined}<div class="rating">
          <Star size={13} fill="currentColor" aria-hidden="true" /><span
            >{summary.rating.toLocaleString('pt-PT')} de 5 estrelas</span
          >
        </div>{/if}
      {#if summary.excerpt}<p class="excerpt">{summary.excerpt}</p>{/if}
      <p class="detail">{summary.detail}</p>
    </div>
  </div>
</div>

<style>
  .site-saved {
    width: min(420px, calc(100vw - 40px));
    max-width: 100%;
    box-sizing: border-box;
    padding: 17px 20px;
    border: 1px solid var(--color-border-strong);
    border-radius: 10px;
    background: var(--color-bg-elevated);
    color: var(--color-text);
    box-shadow: 0 12px 32px #0003;
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 9px;
    padding-right: 20px;
    margin-bottom: 13px;
  }
  .success {
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    border-radius: 50%;
    background: #226c45;
    color: white;
  }
  strong {
    font-size: 14px;
    line-height: 1.4;
    font-weight: 600;
  }
  .content {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .visual {
    position: relative;
    display: grid;
    place-items: center;
    flex: 0 0 66px;
    width: 66px;
    height: 50px;
    overflow: hidden;
    border-radius: 5px;
    background: var(--color-bg-2);
    color: var(--color-text-muted);
  }
  .avatar {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }
  .visual :global(.cover) {
    height: 100%;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .copy {
    min-width: 0;
    flex: 1;
    overflow-wrap: anywhere;
  }
  p {
    margin: 0;
  }
  .label {
    font-size: 13px;
    line-height: 1.45;
    font-weight: 550;
  }
  .detail,
  .excerpt {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-text-muted);
  }
  .excerpt {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .rating {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .rating :global(svg) {
    color: #b78a32;
  }
  @media (max-width: 480px) {
    .site-saved {
      padding: 15px;
    }
    .content {
      gap: 10px;
    }
  }
</style>
