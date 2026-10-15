import node from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: node(),
    paths: { base: process.env.CRM_BASE_PATH || '' },
    alias: {
      $components: 'src/lib/components',
      $lib: 'src/lib',
    },
  },
};

export default config;
