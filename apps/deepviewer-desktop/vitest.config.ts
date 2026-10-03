import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The loading overlay injects this raw stylesheet into a second document.
    css: { include: [/launch-brand\.css/u] },
    include: ['test/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
