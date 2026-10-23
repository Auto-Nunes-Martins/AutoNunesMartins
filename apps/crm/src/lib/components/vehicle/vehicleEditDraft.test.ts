import { expect, it } from 'vitest';
import { publicDraftFromForm, publicEditKey } from './vehicleEditDraft';

it('includes explicit version in the shared save draft and dirtiness key', () => {
  const form = new FormData();
  const baseline = publicDraftFromForm(form);
  expect(baseline.specifications.version).toBe('');
  form.set('version', '  1.6 TDI S-line  ');
  const edited = publicDraftFromForm(form);
  expect(edited.specifications.version).toBe('1.6 TDI S-line');
  expect(publicEditKey(edited)).not.toBe(publicEditKey(baseline));
  form.set('version', '');
  expect(publicEditKey(publicDraftFromForm(form))).toBe(publicEditKey(baseline));
});

it('does not treat editor initialization as an edit but retains real formatting changes', () => {
  const form = new FormData();
  form.set('publicDescription', 'Viatura de teste.');
  const plain = publicEditKey(publicDraftFromForm(form));
  form.set('publicDescription', '<!--anm:rich-description:v1--><p>Viatura de teste.</p>');
  expect(publicEditKey(publicDraftFromForm(form))).toBe(plain);
  form.set('publicDescription', '<!--anm:rich-description:v1--><p><strong>Viatura de teste.</strong></p>');
  expect(publicEditKey(publicDraftFromForm(form))).not.toBe(plain);
});
