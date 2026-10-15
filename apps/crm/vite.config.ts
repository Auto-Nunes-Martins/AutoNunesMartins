import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // svelte-clerk and the Express backend use different Clerk SDK generations.
  // Bundle the CRM SDK from its own dependency tree rather than resolving hoisted backend SDKs at runtime.
  ssr: { noExternal: ['@clerk/backend', '@clerk/shared'] },
  server: {
    // PORT é definido por ferramentas que precisam de atribuir uma porta
    // livre (ex.: preview do Claude Code); sem ela mantém-se a 5173.
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
  },
});
