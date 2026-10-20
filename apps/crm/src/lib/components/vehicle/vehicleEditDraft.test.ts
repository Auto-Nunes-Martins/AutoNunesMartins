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
