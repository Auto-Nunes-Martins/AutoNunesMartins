/** Only the vehicle's recorded pending categories and status inform this notice. */
export function saleDocumentWarning(vehicle: {
  status: string;
  pendingDocFlags?: Record<string, boolean> | null;
}): string | null {
  const categories = (
    [
      ['financing', 'Financiamento'],
      ['imt', 'IMT'],
      ['registration', 'Registo'],
      ['docs', 'Documentação'],
    ] as const
  )
    .filter(([key]) => vehicle.pendingDocFlags?.[key] === true)
    .map(([, label]) => label);
  if (!categories.length && vehicle.status !== 'DOCS_PENDING') return null;
  return (
    (categories.length
      ? `Esta viatura tem documentos em falta/pendentes: ${categories.join(', ')}.`
      : 'Esta viatura está no estado «Documentos pendentes».') +
    ' Este aviso é informativo. Pode voltar ou continuar a venda mesmo com documentos em falta.'
  );
}
