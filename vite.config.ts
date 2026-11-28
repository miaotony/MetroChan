import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { modulePreload: false, assetsInlineLimit: 0 },
});
