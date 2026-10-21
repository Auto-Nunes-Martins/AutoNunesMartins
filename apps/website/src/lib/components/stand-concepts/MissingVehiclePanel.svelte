<script lang="ts">
  import { ArrowUpRight } from 'lucide-svelte';
  import OrbitBackLink from './OrbitBackLink.svelte';
  let { heading, message }: { heading: string; message: string } = $props();
</script>

<section class="missing-vehicle">
  <OrbitBackLink href="/" label="Página inicial" />
  <div class="missing-copy">
    <p class="eyebrow">VIATURA NÃO ENCONTRADA</p>
    <h1>{heading}</h1>
    <p class="message">{message}</p>
    <div class="actions">
      <a class="home" href="/">Página inicial</a>
      <a class="explore" href="/viaturas"
        >Explorar viaturas <ArrowUpRight size={18} aria-hidden="true" /></a
      >
    </div>
  </div>
</section>

<style>
  .missing-vehicle {
    max-width: 1120px;
  }
  .missing-copy {
    padding-block: clamp(40px, 5vw, 72px) 48px;
    max-width: 760px;
  }
  .eyebrow {
    margin: 0 0 20px;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: 0.14em;
    color: var(--muted);
  }
  h1 {
    margin: 0;
    font-size: clamp(36px, 4vw, 56px);
    font-weight: 500;
    line-height: 1.08;
    letter-spacing: -0.05em;
    color: var(--text);
  }
  .message {
    max-width: 54ch;
    margin: 24px 0 0;
    color: var(--muted);
    font-size: 16px;
    line-height: 1.8;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 32px;
  }
  .actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 46px;
    padding: 12px 20px;
    box-sizing: border-box;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition:
      background-color 160ms,
      transform 160ms;
  }
  .home {
    background: #fff;
    color: #171717;
  }
  .home:hover {
    background: #e9e9e5;
  }
  .explore {
    background: var(--red);
    color: #fff;
  }
  .explore:hover {
    background: color-mix(in oklab, var(--red) 85%, black);
    transform: translateY(-2px);
  }
  .actions a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  @media (prefers-reduced-motion: reduce) {
    .actions a {
      transition: none;
    }
    .explore:hover {
      transform: none;
    }
  }
</style>
