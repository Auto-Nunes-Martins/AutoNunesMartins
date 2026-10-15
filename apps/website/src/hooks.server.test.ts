import { beforeEach, expect, it, vi } from 'vitest';
const { env } = vi.hoisted(() => ({ env: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env }));
import { handle } from './hooks.server';
const run = () => handle({ event: {}, resolve: async () => new Response('public HTML') } as unknown as Parameters<typeof handle>[0]);
beforeEach(() => { for (const key of Object.keys(env)) delete env[key]; });
it('keeps public production pages eligible for indexing', async () => {
  env.SITE_NOINDEX = 'false';
  expect((await run()).headers.get('X-Robots-Tag')).toBeNull();
});
it('protects staging regardless of page metadata', async () => {
  env.SITE_NOINDEX = 'true';
  expect((await run()).headers.get('X-Robots-Tag')).toBe('noindex, follow');
});
it('supports a simple protection flag for other staging hosts', async () => {
  env.SITE_NOINDEX = 'true';
  expect((await run()).headers.get('X-Robots-Tag')).toBe('noindex, follow');
});
it('expires a discarded theme cookie without using it for rendering', async () => {
  const cookies = { get: vi.fn(() => 'light'), delete: vi.fn() };
  const resolve = vi.fn(async () => new Response('public HTML'));
  await handle({ event: { cookies }, resolve } as unknown as Parameters<typeof handle>[0]);
  expect(cookies.delete).toHaveBeenCalledWith('anm-orbit-theme', { path: '/' });
  expect(resolve).toHaveBeenCalledOnce();
});
