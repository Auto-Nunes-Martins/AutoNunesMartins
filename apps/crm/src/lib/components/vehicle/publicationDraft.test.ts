import { describe, expect, it } from 'vitest';
import { publicationDraftKey, reconcilePhotoSelection } from './publicationDraft';

describe('publication draft after independently saved photos', () => {
  it('includes a new upload regardless of a legacy subset', () => {
    expect(reconcilePhotoSelection(['old'], ['old'], ['old'], ['old', 'new'])).toEqual(['old', 'new']);
  });
  it('accepts an already saved cover/order and deletion without inventing pending edits', () => {
    expect(reconcilePhotoSelection(['a', 'b'], ['a', 'b'], ['b', 'a'], ['b', 'a'])).toEqual(['b', 'a']);
    expect(reconcilePhotoSelection(['a', 'b'], ['a', 'b'], ['b'], ['b'])).toEqual(['b']);
  });
  it('ignores legacy inclusion and removal through an upload or reorder', () => {
    expect(reconcilePhotoSelection(['new'], ['old'], ['old'], ['new', 'old', 'upload'])).toEqual(['new', 'old', 'upload']);
  });
  it('drops deleted paths and includes every remaining photo', () => {
    expect(reconcilePhotoSelection(['a', 'new'], ['a', 'b'], ['a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
  });
  it('treats equivalent number input formats as saved values', () => {
    const draft = { price: '25000.00', description: 'Descrição', transmission: '', selected: ['a'], specs: { powerHp: '110.0', color: 'Azul' } };
    expect(publicationDraftKey(draft)).toBe(publicationDraftKey({ ...draft, price: 25000, specs: { powerHp: '110', color: 'Azul' } }));
    expect(publicationDraftKey({ ...draft, selected: ['b'] })).not.toBe(publicationDraftKey(draft));
  });
});
