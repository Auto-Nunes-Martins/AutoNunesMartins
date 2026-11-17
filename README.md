<p align="center">
  <img src="apps/website/static/images/social/auto-nunes-martins-v1.png" width="480" alt="Logótipo da Auto Nunes Martins">
</p>

# Auto Nunes Martins

Site público e plataforma de gestão de um stand de automóveis usados. O site apresenta o catálogo, as fichas das viaturas e as campanhas. O CRM gere o stock, os clientes, as vendas e o acompanhamento operacional e financeiro.

[Visitar o site](https://www.autonunesmartins.pt/) · [Instalação local](#desenvolvimento-local) · [Documentação](#documentação)

## Estrutura do projeto

| Área              | Pasta                        | Responsabilidade                                                                      |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| Site público      | [apps/website](apps/website) | Catálogo, fichas de viaturas, campanhas, favoritos, comparação e contactos            |
| CRM               | [apps/crm](apps/crm)         | Gestão de viaturas, clientes, vendas, tarefas, despesas e conteúdos do site           |
| Backend           | [backend](backend)           | API pública e autenticada, regras de negócio, persistência e processamento de imagens |
| Código partilhado | [shared](shared)             | Tipos, validação e código reutilizado pelas aplicações                                |

O site e o CRM usam SvelteKit, Svelte e TypeScript. A API usa Express e Prisma, com PostgreSQL e Storage no Supabase. O acesso ao CRM usa Clerk. O monorepo é gerido com Yarn Workspaces.

## Desenvolvimento local

É necessário ter Node.js 20 ou superior, Git e Yarn 4 via Corepack, além de projetos de desenvolvimento no Supabase e no Clerk.

```powershell
yarn install

Copy-Item backend\.env.example backend\.env
Copy-Item apps\crm\.env.example apps\crm\.env
Copy-Item apps\website\.env.example apps\website\.env
```

Preenche os ficheiros locais conforme os exemplos. Usa apenas serviços de desenvolvimento para aplicar migrações, carregar dados de exemplo e preparar o bucket. Guarda as credenciais nos ficheiros locais de configuração.

```powershell
yarn workspace @anm/backend prisma:migrate
yarn workspace @anm/backend prisma:seed
yarn workspace @anm/backend supabase:bucket
yarn dev
```

| Serviço      | Endereço local                           |
| ------------ | ---------------------------------------- |
| Site público | [localhost:5173](http://localhost:5173/) |
| CRM          | [localhost:5174](http://localhost:5174/) |
| API          | [localhost:4000](http://localhost:4000/) |

## Verificação

```powershell
yarn typecheck
yarn lint
yarn test
yarn build
```

Para testar a integração do site e do CRM com o gateway, usa `yarn test:service`. Para iniciar só uma das aplicações frontend, usa `yarn dev:website` ou `yarn dev:crm`, com o backend disponível.

## Documentação

- [Alojamento e configuração no Render](docs/render-single-service.md)
- [Checklist de publicação do site público](docs/publication-readiness.md)
- [Foto principal, variantes e política de entrega](docs/photo-delivery-experiment.md)
- [Pré-visualizações de partilha](docs/social-previews.md)
- [IVA documentado e resultado de gestão](docs/document-vat.md)
