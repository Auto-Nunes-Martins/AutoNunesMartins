<script lang="ts">
  import PublicLegalPage from '../PublicLegalPage.svelte';
  import LegalFields from '../LegalFields.svelte';
  import PrivacyPreferences from '../PrivacyPreferences.svelte';
  import readiness from '$lib/publicationReadiness.json';
  import { legalValue } from '$lib/publicLegal';
  import { standContact } from './standContact';
  const controller = legalValue('controller'),
    privacyContact = legalValue('privacyContact');
  const sections = [
    { id: 'responsavel', label: 'Responsável e contacto' },
    { id: 'pedidos', label: 'Os seus pedidos' },
    { id: 'finalidades', label: 'Finalidades e fundamento' },
    { id: 'conservacao', label: 'Acesso e conservação' },
    { id: 'navegacao', label: 'Navegação e terceiros' },
    { id: 'preferencias', label: 'Cookies e preferências' },
    { id: 'direitos', label: 'Direitos e reclamação' },
  ];
</script>

<PublicLegalPage
  title="Privacidade e cookies"
  description="Os dados que partilha, o percurso dos seus pedidos e as escolhas que mantém no navegador."
  path="/politica-de-privacidade"
  {sections}
  note="A identidade jurídica, os fundamentos e as condições finais de tratamento assinaladas abaixo ainda precisam de confirmação. Esta informação descreve o funcionamento implementado; não confirma a configuração de produção."
>
  <section id="responsavel">
    <h2>Responsável e contacto</h2>
    <p>
      Responsável pelo tratamento: {controller ??
        'Auto Nunes Martins — identidade jurídica por confirmar'}. A identificação e a morada do
      operador estão centralizadas na <a href="/informacao-legal#operador">Informação legal</a>.
    </p>
    <p>
      Contacto de privacidade: {privacyContact ?? 'por confirmar'}. {#if !privacyContact && standContact.email}<a
          href={`mailto:${standContact.email}`}>Email comercial para encaminhamento</a
        >.{/if}
    </p>
  </section>
  <section id="pedidos">
    <h2>O que acontece ao seu pedido</h2>
    <p>
      O formulário recolhe nome, email, assunto e mensagem, juntamente com o caminho da página de
      origem, sem os parâmetros de pesquisa. Os campos indicados são necessários para compreender e
      responder ao pedido. Partilhe apenas o necessário.
    </p>
    <p>
      Quando o serviço está configurado e ativado, o servidor encaminha o pedido através do Resend
      para a caixa de email do stand. A confirmação verde significa que o serviço aceitou o envio;
      não prova entrega final nem confirma uma visita.
    </p>
    <p>
      O formulário não cria uma conta nem uma ficha de cliente. O corpo da mensagem e o seu email
      não são guardados no CRM por este fluxo. Após aceite do serviço, a equipa recebe na área de
      gestão um aviso partilhado com nome, assunto, data/hora e identificador.
    </p>
    <p>
      Existem identificadores técnicos protegidos por HMAC, contadores e estado de tentativa para
      limitar abusos e evitar duplicados. Estes metadados não guardam o IP original, email ou corpo
      da mensagem; são identificadores pseudonimizados, não uma garantia de anonimato. Isso não
      elimina eventuais registos de acesso do alojamento.
    </p>
  </section>
  <section id="finalidades">
    <h2>Finalidades e fundamento</h2>
    <p>
      Os pedidos destinam-se a responder às suas perguntas, preparar uma visita ou tratar de uma
      viatura por sua iniciativa. As diligências pré-contratuais solicitadas podem fundamentar esse
      tratamento. A proteção contra abuso e a gestão interna do atendimento exigem a identificação e
      avaliação do fundamento adequado.
    </p>
    <LegalFields fields={readiness.privacy.filter((field) => field.id === 'purposes')} />
    <p>
      Os dados dos pedidos não são utilizados para marketing. O envio não subscreve comunicações
      promocionais.
    </p>
  </section>
  <section id="conservacao">
    <h2>Quem acede e durante quanto tempo</h2>
    <p>
      Os pedidos são consultados pelos gerentes do stand para responder às perguntas recebidas e
      acompanhar os contactos sobre viaturas, retomas e visitas. O envio é encaminhado através do
      Resend. O alojamento, a caixa de correio e eventuais transferências internacionais precisam de
      confirmação para o serviço final.
    </p>
    <LegalFields
      fields={readiness.privacy.filter((field) => ['providers', 'retention'].includes(field.id))}
    />
    <p>
      O código prevê a expiração dos metadados técnicos de tentativa ao fim de 35 dias, com limpeza
      limitada executada nos pedidos seguintes; não é uma garantia de eliminação imediata nesse dia.
    </p>
    <p>
      O <a href="https://resend.com/legal/dpa">acordo de tratamento do Resend</a> descreve operações principais
      nos Estados Unidos e mecanismos contratuais de transferência. O operador precisa de confirmar a
      configuração da conta, os subcontratantes e as garantias aplicáveis ao seu serviço; não se presume
      que os dados permaneçam no Espaço Económico Europeu.
    </p>
  </section>
  <section id="navegacao">
    <span id="terceiros" aria-hidden="true"></span>
    <h2>Navegação, preferências e terceiros</h2>
    <p>
      Favoritos, comparação e tema usam o armazenamento deste navegador, sem criar uma conta
      pública. Os detalhes, durações e formas de gestão constam de <a href="#preferencias"
        >Cookies e preferências</a
      >.
    </p>
    <p>
      Algumas imagens podem ser pedidas diretamente ao Unsplash, comunicando a esse serviço os dados
      técnicos da ligação. As fontes e a ilustração da segunda morada são locais. A primeira morada
      apresenta um mapa incorporado do Google Maps, carregado de forma diferida pelo navegador
      quando está selecionado e próximo da área visível; esse carregamento comunica dados técnicos
      da ligação ao Google. A segunda morada mantém uma pré-visualização ilustrativa local. As
      ligações para WhatsApp, mapas e redes sociais abrem os serviços externos quando as escolhe,
      passando a aplicar-se também as condições desses serviços.
    </p>
    <p>
      A lista final de prestadores, logs, regiões e prazos do alojamento está por confirmar. Não
      foram identificados analytics ou pixels de publicidade integrados no código desta versão; isso
      não certifica os serviços do ambiente publicado.
    </p>
  </section>
  <PrivacyPreferences />
  <section id="direitos">
    <span id="contactar" aria-hidden="true"></span>
    <h2>Os seus direitos</h2>
    <p>
      Nos casos previstos no RGPD, pode pedir acesso, retificação, apagamento, limitação, oposição e
      portabilidade. Se um tratamento depender de consentimento, pode retirá-lo sem afetar o
      tratamento anterior. Estes direitos dependem das condições legais aplicáveis.
    </p>
    <p>
      Use o contacto de privacidade indicado acima. Identifique o pedido e forneça apenas a informação
      necessária. Em regra, a resposta é devida num mês, com as possibilidades de prorrogação
      fundamentada previstas na lei.
    </p>
    <p>
      Pode reclamar à <a href="https://www.cnpd.pt/cidadaos/participacoes/"
        >Comissão Nacional de Proteção de Dados</a
      >. A apresentação de uma questão ao stand não impede esse direito.
    </p>
  </section>
</PublicLegalPage>
