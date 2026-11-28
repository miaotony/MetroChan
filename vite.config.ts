import { defineConfig } from 'vite';
import { networkDefines } from './scripts/network-build.ts';

export default defineConfig(({ command }) => ({
  base: './',
  define: command === 'build' ? networkDefines() : undefined,
  build: { modulePreload: false, assetsInlineLimit: 0 },
}));
