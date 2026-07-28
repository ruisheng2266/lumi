/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup.ts',                  // root: fake-indexeddb polyfill
      './validation/src/setup.ts',            // validation: same polyfill
    ],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'validation/src/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});