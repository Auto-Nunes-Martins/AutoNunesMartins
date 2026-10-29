import { describe, expect, it } from 'vitest';
import { contactEmailSubject, contactRequestReference } from './contactEmailSubject.js';

const first = '7d79ed1a-7f5e-4c98-855e-988ff5bfd651';
const second = '5da6ef3b-66fb-4ea1-891a-823e95a023f6';

describe('public contact email subject', () => {
  it('separates different requests with the same enquiry subject', () => {
    const data = { subject: 'Informações gerais', page: '/' };
    const a = contactEmailSubject({ ...data, requestId: first });
    const b = contactEmailSubject({ ...data, requestId: second });
    expect(a).toMatch(/^Pedido do site: Informações gerais \[Ref\. [A-F0-9]{12}\]$/);
    expect(b).not.toBe(a);
  });

  it('keeps the same subject and reference on a retry', () => {
    const data = { requestId: first, subject: 'Marcar uma visita', page: '/contactos' };
    expect(contactEmailSubject({ ...data })).toBe(contactEmailSubject(data));
    expect(contactRequestReference(first.toUpperCase())).toBe(contactRequestReference(first));
  });

  it('adds readable public vehicle context without the opaque slug suffix', () => {
    const result = contactEmailSubject({ requestId: first, subject: 'Conhecer uma viatura',
      page: '/viaturas/renault-clio-2022-012345abcdef' });
    expect(result).toContain('Conhecer uma viatura — renault clio 2022 [Ref. ');
    expect(result).not.toContain('012345abcdef');
  });

  it('does not invent a vehicle from a generic or noncanonical page', () => {
    const data = { requestId: first, subject: 'Informações gerais' };
    expect(contactEmailSubject({ ...data, page: '/viaturas' }))
      .toBe(contactEmailSubject({ ...data, page: '/viaturas/not-a-public-slug' }));
  });
});
