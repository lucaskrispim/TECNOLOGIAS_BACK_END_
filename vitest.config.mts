import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Um unico arquivo SQLite atende a suite inteira, entao os arquivos de
    // teste rodam em serie para nao disputar a mesma tabela.
    fileParallelism: false,
    environment: 'node',
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      // O client do Prisma e codigo gerado, e server.ts e so o bootstrap que
      // chama listen, exercitado no smoke manual e nao pela suite.
      exclude: ['src/generated/**', 'src/server.ts'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
})
