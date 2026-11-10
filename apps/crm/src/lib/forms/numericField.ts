export function normalizeDecimal(value: string): string {
  return value.replace(',', '.');
}

/** Text entry with the same bounds as the original numeric control. */
export function numericField(input: HTMLInputElement, bounds: { min?: number; max?: number }) {
  const decimal = input.inputMode === 'decimal';
  const syntax = decimal ? /^-?\d+(?:[.,]\d{1,2})?$/ : /^-?\d+$/;
  const form = input.form;

  function validate() {
    const raw = input.value;
    const value = Number(normalizeDecimal(raw));
    let error = '';
    if (
      raw &&
      (!syntax.test(raw) || !Number.isSafeInteger(decimal ? Math.round(value * 100) : value))
    ) {
      error = decimal
        ? 'Indique um valor com até duas casas decimais.'
        : 'Indique um número inteiro válido.';
    } else if (raw && bounds.min !== undefined && value < bounds.min) {
      error = `O mínimo é ${bounds.min}.`;
    } else if (raw && bounds.max !== undefined && value > bounds.max) {
      error = `O máximo é ${bounds.max}.`;
    }
    input.setCustomValidity(error);
  }

  function canonicalize(event: FormDataEvent) {
    if (!input.name || input.matches(':disabled')) return;
    const raw = event.formData.get(input.name);
    if (typeof raw === 'string' && raw.includes(',') && syntax.test(raw))
      event.formData.set(input.name, normalizeDecimal(raw));
  }

  const reset = () => queueMicrotask(validate);
  input.addEventListener('input', validate);
  input.addEventListener('change', validate);
  form?.addEventListener('reset', reset);
  if (decimal) form?.addEventListener('formdata', canonicalize);
  validate();
  return {
    update(next: typeof bounds) {
      bounds = next;
      validate();
    },
    destroy() {
      input.removeEventListener('input', validate);
      input.removeEventListener('change', validate);
      form?.removeEventListener('reset', reset);
      if (decimal) form?.removeEventListener('formdata', canonicalize);
    },
  };
}
