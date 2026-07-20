import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the build works whether it is served
// from a domain root or from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    // jsdom gives lib modules a browser-like environment (localStorage, canvas
    // stubs, document) without a real browser. Individual node-only tests can
    // opt out with an `// @vitest-environment node` file comment.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
