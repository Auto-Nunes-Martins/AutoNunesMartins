<script lang="ts">
  import { legalValue } from '$lib/publicLegal';
  import { standContact } from './stand-concepts/standContact';
  const controller=legalValue('controller');
  const privacyContact=legalValue('privacyContact');
</script>
<div class="contact-privacy">
  <p>A Auto Nunes Martins usa estes dados para responder ao seu pedido. <a href="/politica-de-privacidade#direitos" target="_blank" rel="noopener noreferrer" aria-label="Privacidade e direitos (abre num novo separador)">Privacidade e direitos</a>.</p>
  <details><summary>Sobre os seus dados {#if !controller}<small class="identity-pending">Responsável por confirmar</small>{/if}</summary>
    <div class="privacy-details">
      <p><strong>Responsável:</strong> {controller??'Identificação jurídica por confirmar'}. <strong>Contacto:</strong> {privacyContact??standContact.email} {#if !privacyContact}(contacto comercial para encaminhamento; contacto de privacidade por confirmar){/if}.</p>
      <p>Nome, email, assunto e mensagem são usados para responder. O pedido passa pelo serviço de envio Resend; a equipa recebe um aviso com nome e assunto no CRM. Não é criada uma ficha de cliente por este envio.</p>
      <p>Os fundamentos, os prazos de conservação e as condições finais dos prestadores estão <a href="/politica-de-privacidade#conservacao" target="_blank" rel="noopener noreferrer">por confirmar na política completa</a>. Pode consultar os seus direitos e como os exercer nessa página.</p>
      <p>Partilhe só o necessário, sem documentos de identificação ou dados bancários. O pedido não confirma uma visita nem subscreve marketing.</p>
      <a href="/politica-de-privacidade#pedidos" target="_blank" rel="noopener noreferrer">Ler a política de privacidade completa</a>
    </div>
  </details>
</div>
<div class="contact-trap" aria-hidden="true">
  <label>Website<input name="website" tabindex="-1" autocomplete="off" maxlength="200" /></label>
</div>
<style>
  .contact-privacy{font-size:12px;line-height:1.65;margin:16px 0;color:inherit;}.contact-privacy p{font:inherit;margin:0;line-height:inherit;color:inherit;}.identity-pending{font-size:10px;line-height:1.6;margin-left:10px;opacity:.8;}
  a{color:inherit;text-decoration:underline;text-underline-offset:3px;}summary{cursor:pointer;min-height:44px;display:list-item;align-content:center;width:fit-content;font-size:11px;color:inherit;}a:focus-visible,summary:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:2px;}.privacy-details{padding:4px 0 12px;border-bottom:1px solid currentColor;}.privacy-details p{margin:10px 0;}.privacy-details a{display:inline-block;min-height:30px;}strong{font-weight:600;}
  .contact-trap{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);}
</style>
