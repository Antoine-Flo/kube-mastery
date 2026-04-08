import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['refs/**', 'coverage/**', 'dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary', 'json'],
      include: ['src/core/**/*.ts', 'bin/lib/**/*.ts', 'conformance/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        'coverage/**',
        'tests/**',
        'messages/*.json',
        'src/core/openapi/specs/**',
        'src/core/openapi/generated/**',
        'src/core/cluster/generated/**',
        'src/core/kubectl/generated/**'
      ],
      thresholds: {
        lines: 74,
        statements: 74,
        functions: 80,
        branches: 62
      }
    }
  }
})
