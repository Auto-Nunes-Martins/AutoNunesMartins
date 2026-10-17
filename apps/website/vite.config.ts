import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // The classic pre-hydration startup lives outside src; serve that asset in dev too.
    fs: { allow: [fileURLToPath(new URL('./assets', import.meta.url))] },
  },
});
