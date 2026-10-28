const attempts = new WeakMap<HTMLFormElement, { body: string; requestId: string }>();

export class ContactRequestError extends Error {
  constructor(public kind: 'validation' | 'limited' | 'conflict' | 'unavailable' | 'uncertain', message: string) { super(message); this.name = 'ContactRequestError'; }
}

export async function submitContact(form: HTMLFormElement): Promise<void> {
  const fields = new FormData(form);
  const data = {
    name: String(fields.get('name') ?? ''), email: String(fields.get('email') ?? ''),
    subject: String(fields.get('subject') ?? ''), message: String(fields.get('message') ?? ''),
    website: String(fields.get('website') ?? ''), page: window.location.pathname,
  };
  const body = JSON.stringify(data);
  const attempt = attempts.get(form);
  const requestId = attempt?.body === body ? attempt.requestId : crypto.randomUUID();
  attempts.set(form, { body, requestId });
  try {
    const response = await fetch('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, requestId }), signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      if (response.status === 429) throw new ContactRequestError('limited', 'Foram feitos vários pedidos. Aguarde antes de tentar novamente; os dados continuam neste formulário.');
      if (response.status === 409) throw new ContactRequestError('conflict', 'Este pedido já não pode ser repetido com segurança. Use os contactos do stand apresentados nesta página.');
      if (response.status === 400 || response.status === 422) throw new ContactRequestError('validation', 'O pedido não foi aceite. Reveja os dados do formulário e tente novamente.');
      if (response.status === 503) throw new ContactRequestError('unavailable', 'O envio está temporariamente indisponível. Os dados continuam neste formulário. Tente novamente mais tarde.');
      throw new ContactRequestError('uncertain', 'Ainda não foi possível confirmar o envio. Os dados foram mantidos. Tente confirmar novamente sem alterar os campos, para evitar pedidos duplicados.');
    }
    attempts.delete(form);
  } catch (error) {
    if (error instanceof ContactRequestError) throw error;
    throw new ContactRequestError('uncertain', 'A ligação foi interrompida ou demorou demasiado. Não foi possível confirmar o envio. Os dados foram mantidos; tente confirmar novamente sem alterar os campos.');
  }
}
