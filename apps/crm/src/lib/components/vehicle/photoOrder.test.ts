import { expect, it } from 'vitest';
import { committedPhotoOrder } from './photoOrder';
it('commits a new order without changing photo authorization', () => {
  expect(
    committedPhotoOrder(
      [
        { id: 'b', path: 'b' },
        { id: 'a', path: 'a' },
      ],
      ['a', 'b'],
    ),
  ).toEqual(['b', 'a']);
});
it('never saves a drag placeholder, duplicate, missing or foreign photo', () => {
  expect(committedPhotoOrder([{ id: 'a', path: 'a', isDndShadowItem: true }], ['a'])).toBeNull();
  expect(
    committedPhotoOrder(
      [
        { id: 'a', path: 'a' },
        { id: 'a', path: 'a' },
      ],
      ['a', 'b'],
    ),
  ).toBeNull();
  expect(committedPhotoOrder([{ id: 'a', path: 'a' }], ['a', 'b'])).toBeNull();
  expect(committedPhotoOrder([{ id: 'x', path: 'x' }], ['a'])).toBeNull();
});
