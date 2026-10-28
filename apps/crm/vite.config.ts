import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  worker: { format: 'es' },
  plugins: [tailwindcss(), sveltekit()],
  // svelte-clerk and the Express backend use different Clerk SDK generations.
  // Bundle the CRM SDK from its own dependency tree rather than resolving hoisted backend SDKs at runtime.
  ssr: { noExternal: ['@clerk/backend', '@clerk/shared'] },
  server: {
    // Tools may set PORT when they need to allocate a free development
    // port; otherwise use the default configured below.
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
  },
});
