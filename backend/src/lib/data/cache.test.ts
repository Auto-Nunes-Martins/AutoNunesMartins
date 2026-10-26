import { expect, it } from 'vitest';
import { cache } from './cache.js';
it('does not repopulate an invalidated user list from an in-flight pre-deletion read', async () => {
  cache.clearAll();
  let resolve!: (value: string[]) => void;
  const pending = cache.wrap(
    'users:list',
    60000,
    () =>
      new Promise<string[]>((done) => {
        resolve = done;
      }),
  );
  cache.invalidate('users:list');
  resolve(['deleted']);
  await pending;
  expect(cache.get('users:list')).toBeUndefined();
});
