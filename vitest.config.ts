import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    // Node 25+ ships a global localStorage that shadows jsdom's; turn it off
    // so component tests see the browser implementation on every Node version.
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.{ts,tsx,js,jsx}'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/server-only.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
