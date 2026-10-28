<script lang="ts">
  import PublicLegalPage from './PublicLegalPage.svelte';
  import LegalFields from './LegalFields.svelte';
  import readiness from '$lib/publicationReadiness.json';
  import { standContact } from './stand-concepts/standContact';
  const sections=[{id:'operador',label:'Identificação do operador'},{id:'contactos',label:'Contactos comerciais'},{id:'site',label:'Sobre este website'}];
</script>
<PublicLegalPage title="Informação legal" description="Quem está por trás do site, como nos contactar e onde encontrar a informação que precisa." path="/informacao-legal" {sections}>
  <section id="operador"><h2>Identificação do operador</h2><p>Auto Nunes Martins é o nome comercial apresentado neste website. A identificação jurídica seguinte aguarda confirmação; as moradas comerciais não são apresentadas como sede legal.</p><LegalFields fields={readiness.operator}/></section>
  <section id="contactos"><h2>Contactos comerciais</h2><p>Para informações sobre uma viatura ou uma visita, use os contactos do stand.</p>{#if standContact.email}<p><a href={`mailto:${standContact.email}`}>{standContact.email}</a></p>{/if}{#if standContact.phone}<p><a href={`tel:${standContact.phone.international}`}>{standContact.phone.display}</a> · Chamada para a rede móvel nacional</p>{/if}<address>{standContact.address}</address>{#if standContact.additionalAddress}<address>{standContact.additionalAddress}</address>{/if}<a href="/#contactos">Ver horários e contactos</a></section>
  <section id="site"><h2>Sobre este website</h2><p>Esta é uma montra de viaturas usadas com pesquisa, favoritos, comparação e pedidos de contacto. Não permite comprar, pagar ou celebrar um contrato de compra de uma viatura online.</p><p>Consulte os <a href="/termos-de-utilizacao">termos de utilização</a>, a <a href="/politica-de-privacidade">privacidade</a> e a informação sobre <a href="/resolucao-de-litigios">resolução de litígios e reclamações</a>.</p></section>
</PublicLegalPage>
