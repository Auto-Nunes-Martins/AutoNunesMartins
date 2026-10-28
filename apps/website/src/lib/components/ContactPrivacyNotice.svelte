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
      <p><strong>Responsável:</strong> {controller??'identidade jurídica por confirmar'}. <strong>Contacto:</strong> {privacyContact??standContact.email}. {#if !privacyContact}Contacto de privacidade por confirmar; o email comercial permite encaminhar o pedido.{/if}</p>
      <p>Nome, email, assunto e mensagem servem para responder. O envio passa pelo Resend; a equipa recebe um aviso com nome e assunto no CRM. Fundamentos, destinatários e conservação constam da política, com as pendências assinaladas.</p>
      <p>Partilhe só o necessário. O pedido não confirma uma visita nem subscreve marketing.</p>
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
