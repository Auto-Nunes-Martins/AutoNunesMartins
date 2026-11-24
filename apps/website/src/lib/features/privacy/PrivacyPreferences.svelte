<script lang="ts">
  import ConsentControls from './ConsentControls.svelte';
</script>

<section id="preferencias"><span id="armazenamento" aria-hidden="true"></span><span id="escolhas" aria-hidden="true"></span>
<h2>Cookies e preferências</h2>
<p>Além de cookies, um site pode usar armazenamento local e de sessão. Esta versão usa essas tecnologias para as funções descritas abaixo. As preferências não criam uma conta pública nem são guardadas no backend como um perfil de escolhas.</p>
<p>Os Guardados e a Comparação ficam disponíveis neste navegador entre visitas, sem expiração automática. Pode limpar cada lista na respetiva página ou apagar os dados do site nas definições do navegador.</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll this table horizontally on small screens.) -->
      <div class="table-scroll" tabindex="0" role="region" aria-label="Armazenamento utilizado pelo site"><table><caption>Preferências e reposição da navegação</caption><thead><tr><th scope="col">Função e chave</th><th scope="col">Conteúdo e utilização</th><th scope="col">Duração atual</th></tr></thead><tbody>
        <tr><th scope="row">Escolhas de privacidade<br/><code>anm-site-consent-v1</code></th><td>Guarda no navegador as escolhas para a posição de leitura, o mapa, as estatísticas de visitas e a medição de publicidade. Também memoriza a recusa.</td><td>180 dias de validade.</td></tr>
        <tr><th scope="row">Tema<br/><code>anm-theme</code></th><td>Escolha claro/escuro em localStorage, aplicada ao abrir a página. Não é enviada ao servidor. Um cookie de tema legado, se existir, é eliminado pelo site.</td><td>Sem expiração automática.</td></tr>
        <tr><th scope="row">Guardados<br/><code>anm-favorites-v1</code></th><td>Identificadores das viaturas que guardou. Recupera também escolhas antigas de <code>anm-design-saved</code>.</td><td>Sem expiração automática.</td></tr>
        <tr><th scope="row">Comparação<br/><code>anm-comparison-v1</code></th><td>Identificadores de até três viaturas em localStorage. Pode recuperar uma seleção antiga do armazenamento de sessão.</td><td>Sem expiração automática no armazenamento local.</td></tr>
        <tr><th scope="row">Posição ao recarregar<br/><code>anm-reload-position</code></th><td>URL completo, coordenadas de scroll e hora no sessionStorage deste separador. Esta função só lê e grava a entrada com a opção «Retomar a leitura» ligada e elimina-a ao desligar a opção. O navegador continua a gerir a posição no histórico de navegação.</td><td>Registo de sessão. Pode ser usado para reposição durante 60 segundos.</td></tr>
      </tbody></table></div>
<h3 id="gerir">Gerir as suas escolhas</h3><p>Retire viaturas ou limpe as listas em <a href="/favoritos">Guardados</a> e <a href="/comparar">Comparar</a>. O botão da navegação altera o tema. Para apagar também as chaves antigas e outros dados do site, use as definições do navegador.</p><p>Limpar uma lista pode deixar a chave com uma lista vazia. As escolhas não se sincronizam entre dispositivos; ao abrir uma lista, o navegador pede os dados atuais das viaturas à API pública. A necessidade e duração desta memória persistente e os serviços de produção continuam em revisão.</p>
<ConsentControls />
</section>
