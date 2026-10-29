import { createHash } from 'node:crypto';

interface ContactSubjectData {
  requestId: string;
  subject: string;
  page: string;
}

/** Stable per submission, including retries; contains no customer information. */
export function contactRequestReference(requestId: string): string {
  return createHash('sha256').update(requestId.toLowerCase()).digest('hex').slice(0, 12).toUpperCase();
}

export function contactEmailSubject(data: ContactSubjectData): string {
  // Canonical public vehicle slugs contain a readable label followed by an opaque suffix.
  // Keep that public context without interpreting the customer's free-text message.
  const vehicle = /^\/viaturas\/([a-z0-9]+(?:-[a-z0-9]+)*)-[a-f0-9]{12,64}\/?$/.exec(data.page)?.[1];
  const context = vehicle ? ` — ${vehicle.replaceAll('-', ' ').slice(0, 72)}` : '';
  return `Pedido do site: ${data.subject}${context} [Ref. ${contactRequestReference(data.requestId)}]`;
}
