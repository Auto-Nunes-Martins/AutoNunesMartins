# Normalização dos dados de demonstração

Em 20/10/2026, o proprietário autorizou normalizar as **39 viaturas de teste** da base Supabase remota configurada pelo backend. Não foi executado o seed geral: esse seed pode apagar dados.

O manifesto explícito em `backend/scripts/demo-catalog-data.mjs` separa marca/modelo/versão, define exemplos plausíveis de especificações e caixa, preenche preços públicos anteriormente vazios e identifica as descrições como dados fictícios. Os exemplos não são fichas técnicas verificadas nem anúncios comerciais oficiais. Os dois nomes sem sentido foram substituídos por exemplos Renault Clio e Toyota Yaris, mantendo os respetivos identificadores e endereços.

Só são atualizados seis campos: `brand`, `model`, `publicPrice`, `publicDescription`, `publicTransmission` e `publicSpecifications`. São preservados ano, combustível, quilometragem, IDs, slugs, fotos, aprovações, estados, notas internas, identificadores privados, preços internos, vendas e restantes registos operacionais. `updatedAt` acompanha a atualização normal. O campo de versão continua a pertencer aos detalhes públicos confirmados no CRM; não foi adicionada uma coluna de versão ao modelo de dados principal.

## Comandos a partir da raiz do projeto

Pré-visualização, sem escrita na base:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/normalize-demo-catalog.mjs
```

Aplicação com backup reversível dos campos alterados:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/normalize-demo-catalog.mjs --apply --backup .cache/demo-catalog-backup-20261020.json --report .cache/demo-catalog-applied-20261020.json
```

Reverter os campos de catálogo usando esse backup:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/normalize-demo-catalog.mjs --revert .cache/demo-catalog-backup-20261020.json --report .cache/demo-catalog-reverted-20261020.json
```

O backup é local e ignorado pelo Git; não contém credenciais, VIN, matrículas nem dados de clientes. Não é um backup integral da base. O script verifica a identidade da base, impede sobrescrever o backup, recusa alterações concorrentes e confirma os campos protegidos dentro da transação. A reversão recusa substituir dados de catálogo que tenham sido editados entretanto. Modelos sem correspondência explícita interrompem a preparação.

A aplicação atualizou 39 registos numa transação. A verificação seguinte devolveu **zero alterações**, demonstrando idempotência. IDs, slugs, fotografias, publicação, estados, valores financeiros e contagens de vendas/clientes/despesas/arquivo permaneceram inalterados. Esta normalização não confirma um deploy nem resolve as pendências de informação oficial para publicação.
