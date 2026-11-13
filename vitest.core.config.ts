import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    include: ['src/core/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.spec.ts', 'src/core/**/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      reporter: ['text', 'html'],
    },
  },
});
