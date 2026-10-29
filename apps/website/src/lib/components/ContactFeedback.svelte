<script lang="ts">
  import { tick } from 'svelte';
  import { CheckCircle2, X } from 'lucide-svelte';
  import type { createContactForm } from '$lib/contactForm.svelte';
  let { submission }: { submission: ReturnType<typeof createContactForm> } = $props();
  let dismissed = $state(false);
  let submitButton: HTMLButtonElement | null = null;
  const success = $derived(submission.state.phase === 'success');
  const title = $derived(success ? 'Pedido enviado.' : 'Erro no envio');
  const message = $derived(success ? 'Obrigado pelo contacto.' :
    submission.state.kind === 'limited' ? 'Há vários pedidos recentes. Tente mais tarde.' :
    submission.state.kind === 'conflict' ? 'Não repita o pedido. Contacte-nos por telefone.' :
    submission.state.kind === 'unavailable' ? 'Não foi possível enviar o pedido. Tente novamente.' :
    submission.state.kind === 'validation' ? 'Reveja os dados e tente novamente.' :
    'Não foi possível concluir o envio. Tente novamente.');
  $effect(() => {
    submission.state.phase; submission.state.kind; submission.state.error;
    dismissed = false;
  });
  function close(event: MouseEvent) {
    if (event.detail === 0) submitButton?.focus({preventScroll:true});
    dismissed = true;
  }
  function toast(node: HTMLElement) {
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    let remaining = 8000, deadline = 0;
    const pauses = new Set<string>();
    const dialog = node.closest('dialog');
    const originalParent = node.parentElement;
    submitButton = node.closest('form')?.querySelector<HTMLButtonElement>('[type="submit"]') ?? null;
    const start = () => {
      if (!success || pauses.size || timer) return;
      deadline = Date.now() + remaining;
      timer = setTimeout(() => { dismissed = true; }, remaining);
    };
    const pause = (reason: string) => {
      if (!pauses.size && timer) { remaining = Math.max(0,deadline-Date.now()); clearTimeout(timer); timer = undefined; }
      pauses.add(reason);
    };
    const resume = (reason: string) => { pauses.delete(reason); start(); };
    const otherToast = (event: Event) => { if ((event as CustomEvent).detail !== node) dismissed = true; };
    const closed = () => { dismissed = true; };
    const position = () => {
      const header = document.querySelector('.stand-header')?.getBoundingClientRect();
      node.classList.toggle('in-dialog', !!dialog?.open);
      node.style.setProperty('--contact-toast-top', dialog?.open ? '12px' : `${Math.max(12,Math.min(window.innerHeight-180,(header?.bottom ?? 0)+12))}px`);
      if (dialog?.open) {
        const notice = node.getBoundingClientRect();
        const close = dialog.querySelector('.dialog-close')?.getBoundingClientRect();
        if (close && notice.left < close.right && notice.right > close.left &&
            notice.top < close.bottom && notice.bottom > close.top) {
          node.style.setProperty('--contact-toast-top', `${close.bottom + 12}px`);
        }
      }
    };
    const entered = () => pause('pointer'), left = () => resume('pointer');
    const focused = () => pause('focus'), blurred = (event: FocusEvent) => { if (!node.contains(event.relatedTarget as Node | null)) resume('focus'); };
    window.dispatchEvent(new CustomEvent('anm-contact-toast',{detail:node}));
    window.addEventListener('anm-contact-toast',otherToast);
    window.addEventListener('scroll',position,{passive:true}); window.addEventListener('resize',position);
    dialog?.addEventListener('close',closed);
    node.addEventListener('pointerenter',entered); node.addEventListener('pointerleave',left);
    node.addEventListener('focusin',focused); node.addEventListener('focusout',blurred);
    position();
    void tick().then(() => {
      if (!alive) return;
      try { node.showPopover(); }
      catch {
        // Older browsers still get an out-of-flow notice above the page or native dialog.
        node.removeAttribute('popover');
        (dialog?.open ? dialog : document.body).append(node);
      }
      position();
      start();
    });
    return { destroy() {
      alive = false; clearTimeout(timer);
      window.removeEventListener('anm-contact-toast',otherToast);
      window.removeEventListener('scroll',position); window.removeEventListener('resize',position);
      dialog?.removeEventListener('close',closed);
      node.removeEventListener('pointerenter',entered); node.removeEventListener('pointerleave',left);
      node.removeEventListener('focusin',focused); node.removeEventListener('focusout',blurred);
      try { node.hidePopover(); } catch { /* Fallback or already closed. */ }
      if (node.parentElement !== originalParent) node.remove();
    } };
  }
</script>

{#if !dismissed && (success || submission.state.phase === 'error' && submission.state.kind !== 'validation-local')}
  {#key submission.state.phase + submission.state.kind + submission.state.error}
    <aside class="contact-toast" class:success class:error={!success} popover="manual" use:toast data-contact-feedback role={success ? 'status' : 'alert'} aria-atomic="true">
      <span class="toast-icon" aria-hidden="true">{#if success}<CheckCircle2 size={20} strokeWidth={1.7}/>{:else}<X size={20} strokeWidth={1.8}/>{/if}</span>
      <div><p class="toast-title">{title}</p><p class="toast-message">{message}</p></div>
      <button type="button" class="toast-close" aria-label="Fechar aviso de envio" onclick={close}><X size={15} strokeWidth={1.6} aria-hidden="true"/></button>
    </aside>
  {/key}
{/if}

<style>
  .contact-toast { position: fixed; inset: auto; top: max(var(--contact-toast-top,100px),env(safe-area-inset-top)); left: 50vw; transform: translateX(-50%); z-index: 100; display: grid; grid-template-columns: 20px minmax(0,1fr) 44px; align-items: start; gap: 12px; width: min(480px,calc(100vw - 24px)); max-height: min(200px,calc(100dvh - 32px)); overflow: auto; box-sizing: border-box; margin: 0; padding: 16px 10px 16px 18px; border: 1px solid #71917b66; border-radius: 12px; color: #edf3ed; background: linear-gradient(125deg,#ffffff0a,transparent 65%),#1b2b20e6; backdrop-filter: blur(16px) saturate(115%); -webkit-backdrop-filter: blur(16px) saturate(115%); box-shadow: 0 10px 24px #00000024,0 2px 6px #00000014; font-family: 'Orbit Inter',Inter,Arial,sans-serif; }
  .contact-toast:popover-open { display: grid; }
  .contact-toast:global(.in-dialog) { width: min(480px,calc(100vw - 112px)); }
  .contact-toast[popover]:not(:popover-open) { display: none; }
  .toast-icon { display: flex; color: #a5cbb0; padding-top: 2px; }
  .error { color: #fff; border-color: var(--red,#e30613); background: linear-gradient(125deg,#ffffff08,transparent 65%),#321b1deb; }
  .error .toast-icon { color: var(--red,#e30613); }
  .toast-title { margin: 0 0 4px; font-size: 14px; line-height: 1.5; font-weight: 500; color: inherit; }
  .toast-message { margin: 0; font-size: 12px; font-weight: 400; line-height: 1.5; letter-spacing: 0; color: #cedbd1; overflow-wrap: anywhere; }
  .error .toast-message { color: #fff; }
  .toast-close { display: grid; place-items: center; min-width: 44px; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; margin: -7px 0 0; color: inherit; background: transparent; cursor: pointer; }
  .toast-close:focus-visible { outline: 2px solid #b2d5b9; outline-offset: -3px; }
  .toast-close:hover { background: #ffffff12; }
  .error .toast-close:focus-visible { outline-color: #fff; }
  :global(.public-contact-form .contact-field-shell) { position: relative; }
  :global(.public-contact-form .contact-field-error) { position: absolute; top: calc(100% + 1px); left: 0; right: 0; height: 14px; display: block; margin: 0; padding: 0; color: #ff626b; font-size: 11px; line-height: 14px; font-weight: 400; letter-spacing: 0; overflow-wrap: normal; }
  :global(html[data-theme='light'] .contact-dialog .contact-field-error) { color: #c70511; }
  :global(.public-contact-form .contact-field-error:empty) { visibility: hidden; }
  :global(.public-contact-form [aria-invalid='true']) { border-color: var(--red,#e30613) !important; }
  :global(.public-contact-form .contact-submit-spinner) { flex-shrink: 0; }
  @media (prefers-reduced-motion: no-preference) { .contact-toast { animation: contact-arrive 120ms ease-out; } :global(.public-contact-form .contact-submit-spinner) { animation: contact-spin 1s linear infinite; } @keyframes contact-spin { to { transform: rotate(360deg); } } @keyframes contact-arrive { from { opacity: 0; } to { opacity: 1; } } }
</style>
