import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds ONE self-contained HTML file (all JS/CSS inlined, no network, no server):
// double-click release/CardioFlow-MCS.html on any laptop with a modern browser.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 100_000_000 },
});
