// Global test setup, run once before each test file (see vite.config.js).
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Keep tests isolated: localStorage is shared process-wide in jsdom, so a value
// written by one test must not leak into the next.
afterEach(() => {
  localStorage.clear();
});
