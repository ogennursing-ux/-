import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the build works whether it is served
// from a domain root or from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      // Two apps ship from this repo: the signing app (index.html) and the
      // Kimi chat app (kimi.html).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        kimi: fileURLToPath(new URL('./kimi.html', import.meta.url)),
      },
    },
  },
});
