import { descriptionHtml } from '@anm/types/richDescription';
type Issue = { path?: PropertyKey[]; message?: string };
export type FormFailure = { error?: string; field?: string | null; issues?: Issue[] };

type FeedbackState = { dirty: boolean; valid: boolean };
type Options = { onstatechange?: (state: FeedbackState) => void };
const forms = new Map<
  HTMLFormElement,
  { baseline: string; lastSnapshot: string; dirty: boolean } & Options
>();
let nextErrorId = 0;

function snapshot(form: HTMLFormElement) {
  const state = forms.get(form);
  // Transient fieldset locks must not look like removal of all successful controls.
  if (state && form.querySelector('fieldset[data-save-lock][disabled]')) return state.lastSnapshot;
  const value = JSON.stringify(
    [...new FormData(form)].map(([key, value]) => [
      key,
      typeof value === 'string'
        ? key === 'publicDescription'
          ? descriptionHtml(value)
          : value
        : [value.name, value.size, value.lastModified],
    ]),
  );
  if (state) state.lastSnapshot = value;
  return value;
}

function notify(form: HTMLFormElement) {
  const state = forms.get(form);
  if (!state) return;
  state.dirty = snapshot(form) !== state.baseline;
  const valid = [...form.elements].every(
    (field) =>
      !(
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ) ||
      !field.willValidate ||
      field.validity.valid,
  );
  state.onstatechange?.({ dirty: state.dirty, valid });
}

/** Recheck programmatic changes, including photo inputs associated from outside the form. */
export function refreshFormFeedback(form: HTMLFormElement) {
  notify(form);
}

export function hasUnsavedForms() {
  return [...forms].some(([form, state]) => form.isConnected && snapshot(form) !== state.baseline);
}

export function isFormDirty(form: HTMLFormElement) {
  const state = forms.get(form);
  return !!state && snapshot(form) !== state.baseline;
}

export function markFormSaved(form: HTMLFormElement, options: { preserveErrors?: boolean } = {}) {
  const state = forms.get(form);
  if (state) {
    state.baseline = snapshot(form);
    state.dirty = false;
  }
  if (!options.preserveErrors) clearFormErrors(form);
  notify(form);
}

function clearFieldError(field: HTMLElement) {
  const id = field.dataset.formError;
  if (!id) return;
  document.getElementById(id)?.remove();
  const describedBy = (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((x) => x && x !== id);
  if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
  else field.removeAttribute('aria-describedby');
  field.removeAttribute('aria-invalid');
  delete field.dataset.formError;
}

function feedbackFields(form: HTMLFormElement): HTMLElement[] {
  // Controls may be displayed in another panel while retaining their native form owner.
  return [...new Set([...form.elements, ...form.querySelectorAll('[data-error-field]')])].filter(
    (field): field is HTMLElement => field instanceof HTMLElement,
  );
}

export function clearFormErrors(form: HTMLFormElement) {
  feedbackFields(form)
    .filter((field) => field.hasAttribute('data-form-error'))
    .forEach(clearFieldError);
  form.querySelector('[data-form-error-summary]')?.remove();
}

function addFieldError(field: HTMLElement, message: string) {
  clearFieldError(field);
  const error = document.createElement('span');
  error.id = `crm-field-error-${++nextErrorId}`;
  error.className = 'crm-field-error';
  error.textContent = message;
  field.dataset.formError = error.id;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute(
    'aria-describedby',
    [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '),
  );
  (field.closest('label') ?? field.parentElement)?.append(error);
}

const fieldLabels: Record<string, string> = {
  brand: 'Marca',
  model: 'Modelo',
  year: 'Ano',
  fuel: 'Combustível',
  mileage: 'Quilometragem',
  licensePlate: 'Matrícula',
  vin: 'VIN',
  purchasePrice: 'Preço de compra',
  salePrice: 'Preço de venda',
  acquisitionDate: 'Data de aquisição',
  status: 'Estado',
  description: 'Descrição',
  name: 'Nome',
  nif: 'NIF',
  phone: 'Telefone',
  email: 'Email',
  title: 'Título',
  amount: 'Valor',
  date: 'Data',
};
const requiredReasons: Record<string, string> = {
  brand: 'Indique a marca.',
  model: 'Indique o modelo.',
  year: 'Indique o ano.',
  mileage: 'Indique a quilometragem.',
  licensePlate: 'Indique a matrícula.',
  purchasePrice: 'Indique o preço de compra.',
  salePrice: 'Indique o preço de venda.',
  acquisitionDate: 'Indique a data de aquisição.',
};
type NativeField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function isNativeField(field: HTMLElement): field is NativeField {
  return (
    field instanceof HTMLInputElement ||
    field instanceof HTMLSelectElement ||
    field instanceof HTMLTextAreaElement
  );
}
function fieldLabel(field: HTMLElement | undefined, name: string) {
  if (field) {
    const explicit = field.dataset.errorLabel || field.getAttribute('aria-label');
    if (explicit) return explicit;
    const labelledBy = field
      .getAttribute('aria-labelledby')
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (labelledBy) return labelledBy;
    const label = (isNativeField(field) ? field.labels?.[0] : null) ?? field.closest('label');
    if (label) {
      const copy = (label.querySelector(':scope > span:first-child') ?? label).cloneNode(
        true,
      ) as HTMLElement;
      copy
        .querySelectorAll(
          'input,select,textarea,button,svg,[aria-hidden="true"],.crm-field-error,small',
        )
        .forEach((node) => node.remove());
      const text = copy.textContent
        ?.replace(/\s+/g, ' ')
        .replace(/\s*\*\s*$/, '')
        .trim();
      if (text) return text;
    }
  }
  return fieldLabels[name] ?? fieldLabels[name.split('.').at(-1) ?? ''] ?? name;
}
function missingReason(field: HTMLElement, name: string) {
  if (field instanceof HTMLSelectElement) return 'Selecione uma opção.';
  return requiredReasons[name] ?? 'Preencha este campo.';
}
function nativeReason(field: NativeField) {
  const v = field.validity;
  if (v.customError) return field.validationMessage;
  if (v.valueMissing) return missingReason(field, field.dataset.errorField ?? field.name);
  if (v.rangeUnderflow) return `O mínimo é ${field.getAttribute('min')}.`;
  if (v.rangeOverflow) return `O máximo é ${field.getAttribute('max')}.`;
  if (v.tooShort) return `Use pelo menos ${field.getAttribute('minlength')} caracteres.`;
  if (v.tooLong) return `Use até ${field.getAttribute('maxlength')} caracteres.`;
  if (v.badInput) return 'Indique um número válido.';
  if (v.typeMismatch)
    return field.getAttribute('type') === 'email'
      ? 'Indique um email válido.'
      : 'Reveja o formato do valor.';
  if (v.stepMismatch) return 'Reveja as casas decimais ou o intervalo permitido.';
  return 'Reveja o valor e o formato deste campo.';
}
function issueReason(message: string, field: HTMLElement | undefined, name: string, label: string) {
  const reason = message.startsWith(`${label}:`) ? message.slice(label.length + 1).trim() : message;
  if (
    /^(Required|Preencha este campo\.?|Please fill out this field\.?|Selecione um item da lista\.?|Please select an item in the list\.?)$/i.test(
      reason,
    )
  )
    return field ? missingReason(field, name) : 'Preencha este campo.';
  const minChars = reason.match(/at least (\d+) character/i),
    maxChars = reason.match(/at most (\d+) character/i);
  if (minChars) return `Use pelo menos ${minChars[1]} caracteres.`;
  if (maxChars) return `Use até ${maxChars[1]} caracteres.`;
  const minNumber = reason.match(/greater than or equal to ([\d.]+)/i),
    maxNumber = reason.match(/less than or equal to ([\d.]+)/i);
  if (minNumber) return `O mínimo é ${minNumber[1]}.`;
  if (maxNumber) return `O máximo é ${maxNumber[1]}.`;
  if (/Invalid enum|received undefined/i.test(reason))
    return field ? missingReason(field, name) : 'Selecione uma opção válida.';
  if (/Expected number|received nan/i.test(reason)) return 'Indique um número válido.';
  if (/Invalid date/i.test(reason)) return 'Indique uma data válida.';
  return reason;
}
function focusField(field: HTMLElement) {
  const target = field.matches('input,select,textarea,button,[tabindex],[contenteditable="true"]')
    ? field
    : (field.querySelector<HTMLElement>(
        'input,select,textarea,button,[tabindex],[contenteditable="true"]',
      ) ?? field);
  if (!target.matches('input,select,textarea,button,[tabindex],[contenteditable="true"]'))
    target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'center' });
}
function summaryTitle(summary: HTMLElement) {
  const count = summary.querySelectorAll('[data-form-error-item]').length;
  const heading = summary.querySelector<HTMLElement>('[data-form-error-heading]');
  if (heading && count)
    heading.textContent =
      count === 1 ? 'Corrija o campo indicado.' : `Corrija os ${count} campos indicados.`;
  else if (
    heading &&
    summary.querySelector('[data-form-failure-message]:not([data-form-error-heading])')
  )
    heading.textContent = 'Não foi possível guardar.';
}

export function showFormErrors(form: HTMLFormElement, failure: FormFailure = {}) {
  clearFormErrors(form);
  const issues = failure.issues?.length
    ? failure.issues
    : failure.field
      ? [{ path: failure.field.split('.'), message: failure.error }]
      : [];
  const fields = feedbackFields(form);
  const entries = new Map<
    HTMLElement | string,
    { field?: HTMLElement; label: string; messages: Set<string> }
  >();
  for (const issue of issues) {
    const name = issue.path?.map(String).join('.') ?? '';
    const field = name
      ? fields.find(
          (el) =>
            (el.dataset.errorField === name || el.getAttribute('name') === name) &&
            el.getAttribute('type') !== 'hidden',
        )
      : undefined;
    const label = fieldLabel(field, name);
    const reason = issueReason(issue.message ?? 'Reveja este campo.', field, name, label);
    const key = field ?? (name || reason);
    const entry = entries.get(key) ?? { field, label, messages: new Set<string>() };
    entry.messages.add(reason);
    entries.set(key, entry);
  }
  const summary = document.createElement('div');
  summary.dataset.formErrorSummary = '';
  summary.className = 'crm-form-error-summary';
  // Focus announces this summary once. Inline errors are descriptions, not live regions.
  summary.setAttribute('role', 'region');
  summary.tabIndex = -1;
  const heading = document.createElement('strong');
  heading.id = `crm-error-summary-${++nextErrorId}`;
  heading.dataset.formErrorHeading = '';
  heading.textContent = failure.error ?? 'Não foi possível guardar.';
  if (!entries.size) heading.dataset.formFailureMessage = '';
  summary.setAttribute('aria-labelledby', heading.id);
  summary.append(heading);
  const hint = document.createElement('p');
  hint.id = `${heading.id}-hint`;
  hint.textContent = 'Os dados preenchidos foram mantidos.';
  summary.append(hint);
  summary.setAttribute('aria-describedby', hint.id);
  if (entries.size) {
    if (
      failure.error &&
      !issues.some((issue) => issue.message === failure.error) &&
      !/^(Dados inv[áa]lidos\.?|Invalid (body|query)|Validation failed)$/i.test(failure.error)
    ) {
      const message = document.createElement('p');
      message.textContent = failure.error;
      message.dataset.formFailureMessage = '';
      message.id = `${heading.id}-failure`;
      summary.append(message);
      summary.setAttribute('aria-describedby', `${message.id} ${hint.id}`);
    }
    const list = document.createElement('ul');
    for (const entry of entries.values()) {
      const item = document.createElement('li');
      item.dataset.formErrorItem = '';
      const reason = [...entry.messages].join(' ');
      const text = entry.label ? `${entry.label}: ${reason}` : reason;
      if (entry.field) {
        const field = entry.field;
        addFieldError(field, reason);
        field.id ||= `crm-invalid-control-${++nextErrorId}`;
        item.dataset.formErrorFor = field.id;
        const link = document.createElement('a');
        link.href = `#${field.id}`;
        link.textContent = text;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          focusField(field);
        });
        item.append(link);
      } else item.textContent = text;
      list.append(item);
    }
    summary.append(list);
  }
  summaryTitle(summary);
  form.prepend(summary);
  summary.focus({ preventScroll: true });
  summary.scrollIntoView({ block: 'start' });
}

/** Show native constraints inside the CRM without a browser validation popup. */
export function showInvalidFormFields(form: HTMLFormElement) {
  const invalid = [...form.elements].filter(
    (field): field is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      (field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement) &&
      field.willValidate &&
      !field.validity.valid,
  );
  if (!invalid.length) return false;
  showFormErrors(form, {
    issues: invalid.map((field) => ({ path: [field.dataset.errorField ?? field.name], message: nativeReason(field) })),
  });
  return true;
}

/** In-memory only: no personal data is copied to browser storage. */
export function formFeedback(form: HTMLFormElement, options: Options = {}) {
  const initial = snapshot(form);
  const state = { baseline: initial, lastSnapshot: initial, dirty: false, ...options };
  forms.set(form, state);
  queueMicrotask(() => {
    if (!state.dirty) state.baseline = snapshot(form);
    notify(form);
  });
  const changed = (event: Event) => {
    if (event.target instanceof HTMLElement) {
      const field = event.target;
      clearFieldError(field);
      const summary = form.querySelector<HTMLElement>('[data-form-error-summary]');
      summary?.querySelectorAll<HTMLElement>('[data-form-error-for]').forEach((item) => {
        if (item.dataset.formErrorFor === field.id) item.remove();
      });
      if (summary && !summary.querySelector('[data-form-error-item],[data-form-failure-message]'))
        summary.remove();
      else if (summary) summaryTitle(summary);
    }
    // Include Svelte's formatted/bound value after the input handler flushes.
    queueMicrotask(() => notify(form));
  };
  let invalidFocusQueued = false;
  const invalid = (event: Event) => {
    const field = event.target;
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      event.preventDefault();
      if (!invalidFocusQueued) {
        invalidFocusQueued = true;
        queueMicrotask(() => {
          invalidFocusQueued = false;
          if (form.isConnected) showInvalidFormFields(form);
        });
      }
    }
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (snapshot(form) === state.baseline) return;
    event.preventDefault();
    event.returnValue = '';
  };
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('invalid', invalid, true);
  window.addEventListener('beforeunload', beforeUnload);
  return {
    destroy() {
      forms.delete(form);
      clearFormErrors(form);
      form.removeEventListener('input', changed);
      form.removeEventListener('change', changed);
      form.removeEventListener('invalid', invalid, true);
      window.removeEventListener('beforeunload', beforeUnload);
    },
  };
}
