import readiness from './publicationReadiness.json';

export const publicLegalLinks = [
  { href: '/informacao-legal', label: 'Informação legal' },
  { href: '/termos-de-utilizacao', label: 'Termos de utilização' },
  { href: '/politica-de-privacidade', label: 'Privacidade e cookies' },
];
const fields: {id:string;label:string;value:string|null}[] =
  [...readiness.operator, ...readiness.privacy, ...readiness.disputes, ...readiness.complaints];
export const legalValue = (id: string) => fields.find(field => field.id === id)?.value?.trim() || null;

/** Public destinations must remain HTTPS links; pending/invalid official fields are never links. */
export function officialLegalUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export const complaintsPortal = officialLegalUrl(legalValue('complaintsUrl')) || 'https://www.livroreclamacoes.pt/';
