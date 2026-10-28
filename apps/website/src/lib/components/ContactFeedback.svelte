<script lang="ts">
  import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-svelte';
  import type { createContactForm } from '$lib/contactForm.svelte';
  let { submission, headingId }: { submission:ReturnType<typeof createContactForm>;headingId?:string }=$props();
</script>

{#if submission.state.phase !== 'idle'}
  <section class="contact-feedback" class:success={submission.state.phase==='success'} class:error={submission.state.phase==='error'}
    data-contact-feedback tabindex="-1" role={submission.state.phase==='error'?'alert':'status'} aria-atomic="true">
    <span class="feedback-icon" aria-hidden="true">{#if submission.state.phase==='success'}<CheckCircle2 size={28}/>{:else if submission.state.phase==='sending'}<LoaderCircle class="spin" size={24}/>{:else}<CircleAlert size={24}/>{/if}</span>
    <div class="feedback-copy">
      <p class="feedback-label">{submission.state.phase==='success'?'ENVIO BEM-SUCEDIDO':submission.state.phase==='sending'?'ENVIO EM CURSO':'O PEDIDO PRECISA DE ATENÇÃO'}</p>
      <h3 id={headingId}>{submission.state.phase==='success'?'Pedido recebido.':submission.state.phase==='sending'?'Estamos a enviar o seu pedido.':submission.state.issues.length?'Falta rever alguns campos.':submission.state.kind==='uncertain'?'Envio por confirmar.':'Não foi possível enviar.'}</h3>
      {#if submission.state.phase==='success'}
        <p>O seu pedido foi aceite pelo serviço de envio para o stand.</p>
        <p>O próximo passo é a resposta do stand para esclarecer as suas questões ou combinar os detalhes. Uma visita só fica confirmada após contacto.</p>
        <button type="button" onclick={submission.reset}>Escrever outro pedido</button>
      {:else if submission.state.phase==='sending'}<p>Aguarde a confirmação. Não precisa de voltar a carregar em enviar.</p>
      {:else}<p>{submission.state.error}</p>
        {#if submission.state.issues.length}<ul>{#each submission.state.issues as issue}<li><button type="button" onclick={()=>submission.focus(issue.field)}>{issue.label}: {issue.message}</button></li>{/each}</ul>{/if}
      {/if}
    </div>
  </section>
{/if}

<style>
  .contact-feedback{display:flex;gap:14px;align-items:flex-start;margin:20px 0;padding:20px;border:1px solid currentColor;border-radius:7px;color:inherit;background:color-mix(in srgb,currentColor 5%,transparent);font-family:inherit;overflow-wrap:anywhere;}
  .contact-feedback.success{color:#124c32;background:#e5f4e9;border-color:#63a87c;padding:26px 22px;box-shadow:inset 4px 0 #23834d;}
  .contact-feedback.error{border-color:#cf7d74;box-shadow:inset 3px 0 #c14b40;}
  .contact-feedback:focus-visible{outline:2px solid currentColor;outline-offset:4px;}
  .feedback-icon{display:flex;flex-shrink:0;padding-top:2px;}
  .feedback-copy{min-width:0;}
  .contact-feedback .feedback-label{font-size:10px;font-weight:700;letter-spacing:.12em;line-height:1.5;margin:0 0 8px;}
  .contact-feedback h3{font:inherit;font-size:clamp(23px,3vw,30px);font-weight:600;line-height:1.15;letter-spacing:-.025em;margin:0 0 12px;color:inherit;}
  .contact-feedback p{font-size:14px;line-height:1.65;margin:8px 0 0;color:inherit;}
  .contact-feedback button{font:inherit;font-size:13px;line-height:1.5;color:inherit;background:transparent;border:1px solid currentColor;border-radius:3px;min-height:44px;padding:10px 13px;margin-top:18px;cursor:pointer;text-align:left;}
  .contact-feedback button:focus-visible{outline:2px solid currentColor;outline-offset:3px;}
  ul{padding-left:18px;margin:10px 0 0;}li button{border:0;text-decoration:underline;margin:0;padding:6px 0;}
  :global(.contact-field-error){display:block;color:inherit;font-size:12px;line-height:1.5;font-weight:600;}
  :global(.public-contact-form [aria-invalid='true']){outline:2px solid #cf7d74;outline-offset:2px;}
  @media(prefers-reduced-motion:no-preference){.feedback-icon :global(.spin){animation:contact-spin 1s linear infinite;}@keyframes contact-spin{to{transform:rotate(360deg);}}}
  @media(max-width:480px){.contact-feedback{padding:18px 14px;gap:10px;}.contact-feedback.success{padding:22px 16px;}}
</style>
