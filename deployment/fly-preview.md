# Preparação de teste no Fly.io

Preparado em 2 de novembro de 2026. Não foi criada aplicação, contratado recurso,
executado deploy, alterado DNS ou importada credencial. A Render permanece intacta.

## Configuração preparada

`fly.preview.toml` reutiliza o Dockerfile existente: website, CRM em `/crm` e backend
no mesmo contentor. O gateway escuta na porta10000 e os serviços internos ficam em
loopback. Proposta inicial: uma máquina, uma CPU partilhada e2GB de RAM, em Paris
(`cdg`), sempre ligada. A dimensão é provisória, a validar com memória, latência e
tráfego reais. Não há volume ou PostgreSQL Fly adicional nesta proposta.

Substituir `anm-preview-change-me` pelo nome disponível escolhido: app, duas origens,
argumento de build e cabeçalho Host do health check devem coincidir. Acrescentar a
chave pública Clerk ao build, sem chaves privadas nos argumentos ou no TOML.
O endereço `.fly.dev` é noindex, com envios de contacto desativados.

O gateway reconhece o ambiente Fly por `FLY_APP_NAME` e `FLY_MACHINE_ID`, fornecidos
pelo runtime, e usa apenas `Fly-Client-IP`. Não definir esses indicadores à mão num
servidor diretamente acessível. A configuração pressupõe acesso HTTP exclusivamente
pelo Fly Proxy, sem proxy/CDN adicional à frente. Não publicar portas de acesso direto
às Machines. Metadados ausentes/inválidos falham fechados para os formulários; não
há fallback para X-Forwarded-For. Um CDN adicional exige rever a cadeia de confiança.
A Render e o desenvolvimento local mantêm os comportamentos existentes.

## Antes de qualquer teste remoto

1. Usar inicialmente uma base de dados e bucket de teste isolados, contas/credenciais
   de teste e dados fictícios. O Dockerfile inicia `container-start.mjs`, que aplica
   migrações pendentes e arranca trabalhadores do backend. Desativar contactos não
   desativa esses trabalhadores. Não apontar a prévia à base/bucket reais sem rever
   migrações e efeitos de escrita. Não copiar segredos para este documento ou Git.
2. Configurar os segredos necessários no Fly: ligações PostgreSQL compatíveis,
   chaves Clerk/Supabase e segredo de relay; verificar `backend/src/env.ts` e a
   configuração do serviço conjunto. Não migrar a base ou as fotografias reais para
   outro fornecedor por causa deste teste.
3. Autorizar a origem de teste no Clerk e verificar login, sessões, caminhos e
   webhooks num ambiente de teste. O domínio público final continua na Render.
4. Só depois preparar o deploy da prévia, garantindo **uma máquina**; uma segunda
   máquina duplica o custo base. Confirmar o número efetivo no painel após criação.
5. Validar health check, website, CRM, autenticação, fotografias e formulários com
   prestador simulado. Verificar IP do visitante com dois clientes e cabeçalhos
   forjados sem expor endereços em logs. Não enviar emails reais neste ensaio.
6. A mudança do domínio exige validação e autorização posteriores. O domínio/origem
   final precisa de rebuild coerente com `PUBLIC_WEBSITE_URL`, atualização de origens
   e callbacks, certificados e DNS. Manter um caminho de retorno para a Render.

## Orçamento indicativo, USD, sem impostos

Consulta em 02/11/2026. O preço publicado de referência para2CPUs partilhadas/2GB é
13,39USD por30dias nas regiões mais baratas dos EUA; o preço varia por região.
Para a proposta europeia reservar **15–20USD/mês de máquina**, uma estimativa e não
uma cotação de Paris. Confirmar no calculador/painel antes de criar recursos.

| Componente                                  | Estimativa mensal     |
| ------------------------------------------- | --------------------- |
| Uma máquina europeia sempre ligada,1CPU/2GB | 15–20USD, a confirmar |
| Saída para Internet de100GB na Europa       | 2USD                  |
| Saída para Internet de500GB na Europa       | 10USD                 |
| Total com100GB                              | cerca de17–22USD      |
| Total com500GB                              | cerca de25–30USD      |

Tráfego é uma hipótese de orçamento, não uma medição do stand. Reenvio de fotografias
pelo gateway também pode gerar saída Fly, além da eventual faturação Supabase.
Supabase, Clerk, Resend, domínio, impostos e câmbio não estão incluídos. Não se
presume uma franquia gratuita. Usar IP partilhado/IPv6; IPv4 dedicado é opcional e
custa mais. Recursos extras e duas máquinas alteram estes valores. Comparar com
o preço efetivamente pago na Render, que não foi fornecido.

## Fontes e validação

- [Configuração Fly](https://fly.io/docs/reference/configuration/)
- [Cabeçalhos e cautelas de confiança](https://fly.io/docs/networking/request-headers/)
- [Preços e tráfego](https://fly.io/docs/about/pricing/)

Os testes locais de deployment verificam seleção do modo Fly, endereço único,
rejeição de fallback forjado e noindex da prévia. Não substituem o teste na plataforma.
O CLI Fly não está instalado nesta máquina; a validação oficial do TOML e o build
Linux do contentor ficam pendentes. Não foi feito build CRM para esta preparação.

Escolha revista com o proprietário: primeiro ensaio com uma CPU partilhada e2GB de RAM. A estimativa anterior de15–20USD para máquina era para duas CPUs; confirmar o preço de uma CPU/2GB na região escolhida antes de provisionar. Reduzir CPU mantendo a RAM não implica reduzir o custo para metade.

## Primeiro deploy da aplicação autonunesmartins

O proprietário forneceu a falha do painel: config save tentou recuperar configuração
antes de existir qualquer Machine. Essa operação não constrói o Dockerfile; a cadeia
parou antes de secrets sync e secrets deploy.

Foi acrescentado fly.toml na raiz para autonunesmartins, com origem temporária
https://autonunesmartins.fly.dev, porta10000 e o Dockerfile existente. Mantém noindex
e contactos desativados. Este ficheiro é a configuração específica dessa aplicação;
fly.preview.toml continua como modelo genérico. O ficheiro específico ainda precisa
de estar no commit/branch que o painel usa para o Fly o conseguir ler.

No painel, fazer o primeiro deploy do código/imagem a partir do repositório com este
ficheiro, não apenas a operação de aplicar segredos a uma release existente. Se o
painel continuar a executar config save antes de qualquer build, o fluxo do painel
precisa de inicialização/correção; adicionar o ficheiro ao Git não garante corrigir
uma operação interna que continue a exigir Machines existentes.

Antes do build, fornecer PUBLIC_CLERK_PUBLISHABLE_KEY como argumento público de
build. Segredos de runtime não são automaticamente argumentos de build Docker.
As credenciais necessárias ao arranque continuam obrigatórias. O erro enviado não
prova problemas no Dockerfile nem confirma que o contentor já tenha sido construído.
Não foi feito deploy, alteração DNS ou acesso à conta.

Fonte: https://fly.io/docs/apps/secrets/ explica que secrets deploy volta a publicar
a release atual, sem reconstruir a imagem. A configuração inicial deve existir antes
de tentar recuperá-la de Machines.
