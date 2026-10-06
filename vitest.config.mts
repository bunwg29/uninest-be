import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@common': fileURLToPath(new URL('./src/common', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/modules/booking/**/*.ts'],
      exclude: [
        'src/modules/booking/**/*.module.ts',
        'src/modules/booking/**/index.ts',
      ],
      thresholds: {
        statements: 80,
        lines: 80,
      },
    },
  },
});
