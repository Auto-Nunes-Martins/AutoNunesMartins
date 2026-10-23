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
      typeof value === 'string' ? (key === 'publicDescription' ? descriptionHtml(value) : value) : [value.name, value.size, value.lastModified],
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

export function showFormErrors(form: HTMLFormElement, failure: FormFailure = {}) {
  clearFormErrors(form);
  const issues = failure.issues?.length
    ? failure.issues
    : failure.field
      ? [{ path: failure.field.split('.'), message: failure.error }]
      : [];
  let first: HTMLElement | undefined;
  for (const issue of issues) {
    const name = issue.path?.join('.');
    if (!name) continue;
    const field = feedbackFields(form).find(
      (el) =>
        (el.dataset.errorField === name || el.getAttribute('name') === name) &&
        el.getAttribute('type') !== 'hidden',
    );
    if (!field || !issue.message) continue;
    addFieldError(field, issue.message);
    first ??= field;
  }
  const summary = document.createElement('div');
  summary.dataset.formErrorSummary = '';
  summary.className = 'crm-form-error-summary';
  summary.setAttribute('role', 'alert');
  summary.tabIndex = -1;
  summary.textContent = first
    ? 'Há campos por corrigir. Reveja os campos assinalados; os dados preenchidos foram mantidos.'
    : (failure.error ?? 'Não foi possível guardar. Os dados preenchidos foram mantidos.');
  if (issues.length) {
    const list = document.createElement('ul');
    for (const issue of issues) {
      const item = document.createElement('li');
      item.textContent = issue.message ?? 'Reveja este campo.';
      list.append(item);
    }
    summary.append(list);
  }
  form.prepend(summary);
  (first ?? summary).focus();
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
    issues: invalid.map((field) => ({ path: [field.name], message: field.validationMessage })),
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
    if (event.target instanceof HTMLElement) clearFieldError(event.target);
    if (!form.querySelector('[data-form-error]'))
      form.querySelector('[data-form-error-summary]')?.remove();
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
      addFieldError(field, field.validationMessage);
      if (!invalidFocusQueued) {
        invalidFocusQueued = true;
        queueMicrotask(() => {
          invalidFocusQueued = false;
          if (field.isConnected) field.focus();
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
