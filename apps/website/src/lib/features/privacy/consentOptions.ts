export const consentOptions = [
  {
    key: 'preferences',
    label: 'Retomar a leitura',
    summary: 'Voltar ao mesmo ponto ao recarregar a página.',
    detail:
      'Com esta opção ativa, o site guarda o endereço da página, a posição e a hora neste separador. Ao recarregar, pode repor essa posição durante 60 segundos.',
  },
  {
    key: 'maps',
    label: 'Mapa incorporado do Google',
    summary: 'Ver o mapa da primeira morada do stand.',
    detail:
      'Ao carregar o mapa, o navegador comunica com o Google Maps. A Google recebe dados da ligação e pode utilizar cookies. A morada continua disponível se recusar.',
  },
  {
    key: 'ads',
    label: 'Medição de publicidade',
    summary: 'Permitir ao Google Ads medir resultados dos anúncios.',
    detail:
      'Com a sua autorização, o site carrega o Google Tag Manager para executar etiquetas de medição do Google Ads. A Google pode usar cookies e dados da ligação e da visita.',
  },
] as const;
