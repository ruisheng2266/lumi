/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Vite 编译期注入的版本号；vitest 无构建步骤，此处提供占位值
    __APP_VERSION__: JSON.stringify('0.4.1'),
  },
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
      'functions/**/*.{test,spec}.ts',
    ],
  },
});