import { expect, it } from 'vitest';
import { activeCreationDraftId } from './activeCreationDraft';
const id = 'c' + 'a'.repeat(24),
  path = '/crm/viaturas/nova';
it('excludes only a valid active creation route, including refresh at its second step', () => {
  const url = new URL('https://local' + path + '?viatura=' + id);
  expect(activeCreationDraftId(url, path, { id, status: 'DRAFT' })).toBe(id);
  expect(activeCreationDraftId(url, path)).toBeUndefined();
  expect(activeCreationDraftId(url, path, { id: 'other', status: 'DRAFT' })).toBeUndefined();
  expect(activeCreationDraftId(url, path, { id, status: 'AVAILABLE' })).toBeUndefined();
  expect(
    activeCreationDraftId(new URL('https://local/crm/viaturas/' + id + '/editar'), path),
  ).toBeUndefined();
  expect(activeCreationDraftId(new URL('https://local/crm/viaturas'), path)).toBeUndefined();
  for (const query of ['', '?viatura=invalid', '?viatura=' + id + '&viatura=' + id])
    expect(activeCreationDraftId(new URL('https://local' + path + query), path)).toBeUndefined();
});
