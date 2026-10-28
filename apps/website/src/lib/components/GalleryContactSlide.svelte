<script lang="ts">
  import { ArrowUpRight, Phone } from 'lucide-svelte';
  import { standContact } from './stand-concepts/standContact';
  let { onContact }: { onContact: () => void } = $props();
</script>

<div class="gallery-contact-slide">
  <div class="contact-content">
    <span class="eyebrow"><span aria-hidden="true"></span> DA FOTOGRAFIA À ESTRADA</span>
    <h3>O próximo passo<br />é conhecê-la.</h3>
    <p>Esclareça as suas dúvidas, fale-nos da sua retoma ou combine uma visita ao stand.</p>
    <div class="contact-actions">
      <button type="button" onclick={onContact}
        >Falar connosco <ArrowUpRight size={18} aria-hidden="true" /></button
      >
      {#if standContact.phone}<a
          href={`tel:${standContact.phone.international}`}
          aria-label={`Ligar para o stand: ${standContact.phone.display}`}
          ><Phone size={15} strokeWidth={1.7} aria-hidden="true" />Prefere ligar?</a
        >{/if}
    </div>
  </div>
</div>

<style>
  .gallery-contact-slide {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 24px 52px;
    box-sizing: border-box;
    background: #0c100cb3;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: white;
    text-align: center;
  }
  .contact-content {
    width: 100%;
    max-width: 440px;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: #ffffffb3;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.16em;
  }
  .eyebrow > span {
    width: 16px;
    height: 2px;
    background: var(--red);
  }
  h3 {
    margin: 0;
    font-size: clamp(24px, 2.8vw, 40px);
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.035em;
  }
  p {
    max-width: 36ch;
    margin: 14px auto 24px;
    color: #ffffffce;
    font-size: 14px;
    line-height: 1.6;
  }
  .contact-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 24px;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    min-height: 44px;
    padding: 11px 20px;
    border: 0;
    border-radius: 999px;
    background: white;
    color: #151815;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  @media (hover: hover) {
    button:hover { background:#dfe3e1; color:#151815; box-shadow:0 0 0 3px #ffffff30; }
  }
  button:active { background:#c5cbc7; color:#151815; box-shadow:inset 0 0 0 2px #15181530; }
  button:focus-visible {
    outline: 2px solid white;
    outline-offset: 4px;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    color: #ffffffc9;
    font-size: 12px;
    text-decoration: none;
  }
  a:hover {
    color: white;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  a:focus-visible {
    outline: 2px solid white;
    outline-offset: 4px;
    border-radius: 3px;
  }
  @media (prefers-reduced-motion: no-preference) {
    button,
    a {
      transition:
        color 180ms ease,
        background-color 180ms ease,
        transform 220ms ease;
    }
  }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    button:hover {
      transform: translateY(-1px);
    }
  }
  @media (max-width: 700px) {
    .gallery-contact-slide {
      padding: 16px 32px;
    }
    .eyebrow {
      margin-bottom: 10px;
      font-size: 8px;
      letter-spacing: 0.1em;
    }
    p {
      margin-block: 10px 14px;
      font-size: 12px;
    }
    .contact-actions {
      gap: 0 16px;
    }
    button {
      padding: 9px 15px;
      font-size: 12px;
      gap: 12px;
    }
    a {
      font-size: 11px;
    }
  }
  @media (max-width: 360px) {
    .eyebrow {
      display: none;
    }
    h3 {
      font-size: 22px;
    }
    p {
      font-size: 11px;
      line-height: 1.4;
      margin-block: 8px 10px;
    }
    .contact-actions {
      gap: 0 12px;
    }
    button {
      font-size: 11px;
      padding-inline: 10px;
      gap: 8px;
    }
    a {
      font-size: 10px;
      gap: 5px;
    }
  }
</style>
