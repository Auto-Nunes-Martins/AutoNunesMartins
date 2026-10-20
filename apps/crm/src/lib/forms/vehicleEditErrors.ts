import { z } from 'zod';
import { vehicleUpdateSchema, licensePlatePtSchema, publicSpecificationsSchema } from '@anm/types';
import type { publicDraftFromForm } from '$lib/components/vehicle/vehicleEditDraft';
export type EditIssue = { key: string; message: string; photoPath?: string };
const labels: Record<string, string> = {
  brand: 'Marca',
  model: 'Modelo',
  year: 'Ano',
  fuel: 'Combustível',
  mileage: 'Quilometragem',
  vin: 'VIN',
  licensePlate: 'Matrícula',
  purchasePrice: 'Preço de compra',
  salePrice: 'Preço de venda',
  status: 'Estado',
  acquisitionDate: 'Data de aquisição',
  description: 'Notas internas',
  publicPrice: 'Preço público',
  publicDescription: 'Descrição pública',
  publicTransmission: 'Transmissão',
  version: 'Versão / motorização',
  powerHp: 'Potência',
  engineCc: 'Cilindrada',
  doors: 'Portas',
  seats: 'Lugares',
  category: 'Categoria',
  color: 'Cor',
  equipment: 'Equipamento',
  photoPrincipal: 'Foto principal',
  photos: 'Fotografias',
  publication: 'Publicação',
};
const fields = vehicleUpdateSchema
  .omit({ id: true })
  .extend({ licensePlate: licensePlatePtSchema.nullable().optional() });
const publication = z.object({
  price: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
    .refine((v) => Number(v) > 0, 'Indique um preço público superior a zero.')
    .nullable(),
  description: z.string().max(6000),
  transmission: z.enum(['MANUAL', 'AUTOMATIC']).nullable(),
  specifications: publicSpecificationsSchema,
});
export function issueKey(path: unknown): string {
  const p = Array.isArray(path) ? path.map(String) : String(path ?? '').split('.');
  if (p[0] === 'data') p.shift();
  if (p[0] === 'publication') {
    const publicPath = p.slice(1);
    const field: string = publicPath[0] ?? '';
    if (field === 'photoPaths') return 'photoPrincipal';
    if (field === 'price') return 'publicPrice';
    if (field === 'description') return 'publicDescription';
    if (field === 'transmission') return 'publicTransmission';
    if (field === 'specifications') return publicPath[1] ?? 'publication';
    return 'publication';
  }
  if (['photos', 'uploadedPhotos'].includes(p[0] ?? '')) return 'photos';
  return p.join('.') || 'publication';
}
export function serverEditIssues(result: {
  issues?: { path?: unknown; message?: string }[];
  field?: string;
  error?: string;
}): EditIssue[] {
  const values = result.issues?.length
    ? result.issues
    : result.field
      ? [{ path: result.field, message: result.error }]
      : [];
  return values.map((issue) => {
    const key = issueKey(issue.path),
      raw = issue.message ?? '';
    let reason = raw;
    const maxChars = raw.match(/at most (\d+) character/i),
      minChars = raw.match(/at least (\d+) character/i),
      maxNumber = raw.match(/less than or equal to ([\d.]+)/i),
      minNumber = raw.match(/greater than or equal to ([\d.]+)/i);
    if (maxChars) reason = `Use até ${maxChars[1]} caracteres.`;
    else if (minChars) reason = `Use pelo menos ${minChars[1]} caracteres.`;
    else if (maxNumber) reason = `O máximo é ${maxNumber[1]}.`;
    else if (minNumber) reason = `O mínimo é ${minNumber[1]}.`;
    else if (/Required|received undefined/i.test(raw)) reason = 'Preencha este campo.';
    else if (/Expected number/i.test(raw)) reason = 'Indique um número válido.';
    else if (/Invalid date/i.test(raw)) reason = 'Indique uma data válida.';
    else if (/Invalid enum/i.test(raw)) reason = 'Escolha uma opção válida.';
    else if (/^(Expected|Invalid|String must|Number must|Too )/i.test(raw))
      reason = 'Reveja o valor e o formato deste campo.';
    return { key, message: `${labels[key] ?? 'Publicação'}: ${reason || 'Reveja este campo.'}` };
  });
}
function fieldFor(root: HTMLElement, key: string, photoPath?: string): HTMLElement | null {
  if (photoPath) {
    const card = [...root.querySelectorAll<HTMLElement>('[data-photo-path]')].find(
      (node) => node.dataset.photoPath === photoPath,
    );
    if (card) return card.querySelector('.caption');
  }
  if (key === 'photoPrincipal')
    return (
      root.querySelector('[data-error-field="photoPrincipal"]') ??
      root.querySelector('.photo-grid-scroll')
    );
  if (key === 'photos') return root.querySelector('.photo-grid-scroll');
  if (key === 'publication')
    return (
      root.querySelector('form[data-edit-publication] textarea') ??
      root.querySelector('form[data-edit-publication]')
    );
  return (
    [...root.querySelectorAll<HTMLElement>('[name],[data-error-field]')].find(
      (el) =>
        (el.getAttribute('name') === key || el.dataset.errorField === key) &&
        el.getAttribute('type') !== 'hidden',
    ) ?? null
  );
}
export function validateVehicleEdit(
  root: HTMLElement,
  data: unknown,
  pub: ReturnType<typeof publicDraftFromForm>,
  photoPaths: string[],
  principal: string | undefined,
  blockedPublic = false,
): EditIssue[] {
  const issues: EditIssue[] = [];
  for (const field of root.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(
    'form[data-edit-vehicle] input,form[data-edit-vehicle] select,form[data-edit-vehicle] textarea,form[data-edit-publication] input,form[data-edit-publication] select,form[data-edit-publication] textarea',
  )) {
    if (!field.willValidate || field.validity.valid) continue;
    const v = field.validity;
    const input = field as HTMLInputElement;
    const reason = v.valueMissing
      ? 'Preencha este campo.'
      : v.rangeUnderflow
        ? `O mínimo é ${input.min}.`
        : v.rangeOverflow
          ? `O máximo é ${input.max}.`
          : v.tooLong
            ? `Use até ${field.getAttribute('maxlength')} caracteres.`
            : v.stepMismatch
              ? 'Reveja as casas decimais ou o intervalo permitido.'
              : 'Reveja o valor e o formato deste campo.';
    issues.push({ key: field.name, message: `${labels[field.name] ?? 'Campo'}: ${reason}` });
  }
  const details = fields.safeParse(data);
  if (!details.success)
    issues.push(
      ...serverEditIssues({
        issues: details.error.issues.map((issue) => ({
          path: ['data', ...issue.path],
          message: issue.message,
        })),
      }),
    );
  const publicResult = publication.safeParse(pub);
  if (!publicResult.success)
    issues.push(
      ...serverEditIssues({
        issues: publicResult.error.issues.map((issue) => ({
          path: ['publication', ...issue.path],
          message: issue.message,
        })),
      }),
    );
  if (pub.published && !pub.description.trim())
    issues.push({
      key: 'publicDescription',
      message: 'Descrição pública: escreva uma descrição antes de publicar.',
    });
  if (
    pub.published &&
    (blockedPublic ||
      !['AVAILABLE', 'RESERVED'].includes(String((data as { status?: unknown }).status)))
  )
    issues.push({
      key: 'published',
      message:
        'Publicação: esta viatura não está disponível para anúncio. Retire a opção de publicar ou regularize o estado da viatura.',
    });
  if (pub.published && photoPaths.length && (!principal || !pub.photoPaths.includes(principal)))
    issues.unshift({
      key: 'photoPrincipal',
      message:
        'A foto principal não está selecionada para o site. Escolha outra foto principal entre as selecionadas ou volte a incluir esta fotografia.',
    });
  if (photoPaths.length > 20)
    issues.push({
      key: 'photos',
      message: 'Fotografias: mantenha até 20 fotografias antes de guardar.',
    });
  return issues.filter(
    (issue, index) => issues.findIndex((other) => other.key === issue.key) === index,
  );
}
let nextId = 0;
export function clearEditIssueMarks(root: HTMLElement, keys?: string[]) {
  for (const field of root.querySelectorAll<HTMLElement>('[data-edit-error]')) {
    if (keys && !keys.includes(field.dataset.editIssueKey ?? '')) continue;
    const id = field.dataset.editError!;
    document.getElementById(id)?.remove();
    const desc = (field.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .filter((value) => value && value !== id);
    if (desc.length) field.setAttribute('aria-describedby', desc.join(' '));
    else field.removeAttribute('aria-describedby');
    if (field.dataset.editIssueKey === 'photoPrincipal') {
      if (field.closest('.photo-card')?.querySelector('.principal-conflict'))
        field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    } else if (field.dataset.editPreviousInvalid)
      field.setAttribute('aria-invalid', field.dataset.editPreviousInvalid);
    else field.removeAttribute('aria-invalid');
    delete field.dataset.editError;
    delete field.dataset.editIssueKey;
    delete field.dataset.editPreviousInvalid;
  }
}
export function focusEditIssue(root: HTMLElement, issue: EditIssue) {
  const field = fieldFor(root, issue.key, issue.photoPath);
  if (!field) return;
  for (let parent = field.parentElement; parent; parent = parent.parentElement)
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  if (!field.hasAttribute('tabindex') && !field.matches('button,input,select,textarea,a[href]'))
    field.tabIndex = -1;
  field.focus({ preventScroll: true });
  field.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
export function markEditIssues(root: HTMLElement, issues: EditIssue[], focus = true) {
  clearEditIssueMarks(root);
  for (const issue of issues) {
    const field = fieldFor(root, issue.key, issue.photoPath);
    if (!field) continue;
    const error = document.createElement('span');
    error.id = `vehicle-edit-error-${++nextId}`;
    error.className = 'crm-field-error';
    error.textContent = issue.message;
    field.dataset.editError = error.id;
    field.dataset.editIssueKey = issue.key;
    field.dataset.editPreviousInvalid = field.getAttribute('aria-invalid') ?? '';
    if (field.matches('input,select,textarea,[role="checkbox"]'))
      field.setAttribute('aria-invalid', 'true');
    field.setAttribute(
      'aria-describedby',
      [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '),
    );
    (field.closest('label') ?? field.parentElement)?.append(error);
  }
  if (focus && issues[0]) focusEditIssue(root, issues[0]);
}
