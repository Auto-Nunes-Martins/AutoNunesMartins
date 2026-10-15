import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '$env/dynamic/private': fileURLToPath(new URL('./test/privateEnv.ts', import.meta.url)), '$app/paths': fileURLToPath(new URL('./test/paths.ts', import.meta.url)), 'svelte-clerk/server': fileURLToPath(new URL('../../node_modules/svelte-clerk/dist/server/index.js', import.meta.url)), $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  test: {
    include: ['src/**/*.{test,spec}.{ts,svelte.ts}'],
    environment: 'node',
    globals: false,
  },
});
