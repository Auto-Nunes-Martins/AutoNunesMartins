/** Public error copy never uses exception messages, stack traces or backend response bodies. */
export function publicErrorCopy(status: number, pathname: string) {
  const vehicle = /^\/viaturas\/[^/]+\/?$/.test(pathname);
  if (status === 404)
    return vehicle
      ? {
          title: 'Viatura não encontrada',
          heading: 'Não encontrámos esta viatura.',
          message:
            'Não existe informação para este endereço. Consulte as viaturas disponíveis ou volte ao início.',
        }
      : {
          title: 'Página não encontrada',
          heading: 'Este caminho não está por aqui.',
          message:
            'A página que procura não existe ou mudou de endereço. Pode voltar ao início ou explorar as viaturas disponíveis.',
        };
  if (status === 503)
    return {
      title: 'Temporariamente indisponível',
      heading: vehicle
        ? 'Esta ficha está temporariamente indisponível.'
        : 'Estamos temporariamente indisponíveis.',
      message: 'Não foi possível carregar a informação. Tente novamente dentro de instantes.',
    };
  if (status >= 500)
    return {
      title: 'Não foi possível abrir a página',
      heading: 'Algo não correu como esperado.',
      message:
        'Estamos com uma dificuldade técnica. Tente novamente mais tarde ou volte ao início.',
    };
  return {
    title: 'Não foi possível abrir a página',
    heading: 'Não foi possível abrir esta página.',
    message: 'Verifique o endereço ou regresse às páginas principais.',
  };
}
