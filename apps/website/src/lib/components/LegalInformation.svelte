<script lang="ts">
  import PublicLegalPage from './PublicLegalPage.svelte';
  import LegalFields from './LegalFields.svelte';
  import readiness from '$lib/publicationReadiness.json';
  import {complaintsPortal,legalValue,officialLegalUrl} from '$lib/publicLegal';
  import {standContact} from './stand-concepts/standContact';
  const sections=[{id:'operador',label:'Identificação do operador'},{id:'litigios',label:'Resolução de litígios'},{id:'livro-de-reclamacoes',label:'Livro de Reclamações'}];
  const corporate=readiness.operator.filter(field=>['legalForm','registration','capital'].includes(field.id));
  const corporateKnown=corporate.some(field=>Boolean(field.value));
  const ralUrl=officialLegalUrl(legalValue('ralUrl'));
</script>
<PublicLegalPage title="Informação legal" description="Identificação do operador, resolução de litígios e acesso ao Livro de Reclamações." path="/informacao-legal" {sections}>
  <section id="operador"><h2>Identificação do operador</h2><p>Auto Nunes Martins é o nome comercial do site. A identificação jurídica está por confirmar; as moradas de visita não substituem a sede legal.</p><LegalFields fields={readiness.operator.filter(field=>['legalName','taxId','registeredAddress'].includes(field.id))}/>
    <details open={corporateKnown}><summary>Menções societárias, se aplicáveis</summary><LegalFields fields={corporate}/></details>
    {#if standContact.email}<p>Contacto: <a href={`mailto:${standContact.email}`}>{standContact.email}</a>. <a href="/#contactos">Horários e contactos do stand</a>.</p>{/if}
  </section>
  <section id="litigios"><span id="ral" aria-hidden="true"></span><span id="resolver" aria-hidden="true"></span><h2>Resolução de litígios</h2><p>A entidade de resolução alternativa de litígios aplicável e a natureza da vinculação do operador estão por confirmar. Não é declarada adesão a um centro sem confirmação.</p><LegalFields fields={readiness.disputes}/>{#if ralUrl}<p><a href={ralUrl}>Consultar a entidade RAL indicada</a></p>{/if}<p>Consulte a <a href="https://www.consumidor.gov.pt/upload/processos/i006589.pdf">lista oficial de entidades RAL (PDF)</a>. A lista geral não substitui a identificação da entidade aplicável ao operador.</p></section>
  <section id="livro-de-reclamacoes"><span id="reclamacoes" aria-hidden="true"></span><h2>Livro de Reclamações</h2><p><a href={complaintsPortal}>Aceder ao Livro de Reclamações Eletrónico</a></p><p>O registo e a ligação do operador estão por confirmar. A ligação disponível abre o portal geral oficial e não comprova o registo do stand.</p><p>O <a href="/#contactos">contacto com o stand</a> não substitui o Livro de Reclamações nem impede os meios legais ao dispor do consumidor.</p></section>
</PublicLegalPage>
<style>summary{cursor:pointer;min-height:44px;align-content:center;font-size:13px;}summary:focus-visible{outline:2px solid var(--red);outline-offset:4px;}</style>
