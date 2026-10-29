import { describe, expect, it } from 'vitest';
import { saleDocumentWarning } from './saleDocumentWarning';

describe('sale document notice', () => {
  it.each(['AVAILABLE', 'RESERVED'])(
    'preserves the normal %s flow without pending documents',
    (status) => {
      expect(saleDocumentWarning({ status, pendingDocFlags: { docs: false } })).toBeNull();
    },
  );
  it('warns for the existing pending status even without category flags', () => {
    expect(saleDocumentWarning({ status: 'DOCS_PENDING' })).toContain(
      'estado «Documentos pendentes»',
    );
  });
  it.each([
    ['financing', 'Financiamento'],
    ['imt', 'IMT'],
    ['registration', 'Registo'],
    ['docs', 'Documentação'],
  ])('uses recorded %s pending flags independently of vehicle status', (key, label) => {
    const message = saleDocumentWarning({ status: 'AVAILABLE', pendingDocFlags: { [key]: true } });
    expect(message).toContain(label);
    expect(message).toContain('continuar a venda mesmo com documentos em falta');
  });
  it('lists all and only recorded existing categories', () => {
    const message = saleDocumentWarning({
      status: 'RESERVED',
      pendingDocFlags: { imt: true, docs: true, financing: false, unknown: true },
    });
    expect(message).toContain('IMT, Documentação.');
    expect(message).not.toContain('Financiamento');
    expect(message).not.toContain('unknown');
  });
});
