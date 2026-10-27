import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  for (const [key, value] of Object.entries({
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    CLERK_PUBLISHABLE_KEY: 'pk_test_local',
    CLERK_SECRET_KEY: 'sk_test_local',
    SUPABASE_URL: 'https://local-test.supabase.co',
    SUPABASE_SECRET_KEY: 'local-test-only',
  }))
    vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());

it.each([undefined, '', '   '])('boots without a webhook signing secret (%s)', async (secret) => {
  vi.stubEnv('CLERK_WEBHOOK_SECRET', secret);
  const { getEnv } = await import('./env.js');
  expect(getEnv().CLERK_WEBHOOK_SECRET).toBeUndefined();
});

it('keeps the configured signing secret for verification', async () => {
  vi.stubEnv('CLERK_WEBHOOK_SECRET', '  whsec_local_test_only  ');
  const { getEnv } = await import('./env.js');
  expect(getEnv().CLERK_WEBHOOK_SECRET).toBe('whsec_local_test_only');
});

it('defaults to the owner contact budgets and accepts explicit positive integer limits', async () => {
  vi.stubEnv('CONTACT_DAILY_LIMIT', undefined);
  vi.stubEnv('CONTACT_MONTHLY_LIMIT', undefined);
  const { getEnv } = await import('./env.js');
  expect(getEnv().CONTACT_DAILY_LIMIT).toBe(20);
  expect(getEnv().CONTACT_MONTHLY_LIMIT).toBe(1000);
});
it.each(['0', '-1', '1.5', '', 'Infinity', '100001'])(
  'rejects invalid contact budgets (%s)',
  async (value) => {
    vi.stubEnv('CONTACT_DAILY_LIMIT', value);
    const { getEnv } = await import('./env.js');
    expect(() => getEnv()).toThrow('CONTACT_DAILY_LIMIT');
  },
);
