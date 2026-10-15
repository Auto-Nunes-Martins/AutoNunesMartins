const attempts = new WeakMap<HTMLFormElement, { body: string; requestId: string }>();

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
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'Não foi possível enviar o pedido.');
    attempts.delete(form);
  } catch (error) {
    if (error instanceof Error && error.name === 'Error') throw error;
    throw new Error('Não foi possível confirmar o envio. Tente novamente dentro de alguns instantes.');
  }
}
