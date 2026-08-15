import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'src/main/main.ts',
    target: 'node24',
    outDir: '.desktop/build',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'es',
        entryFileNames: 'main.js',
      },
    },
  },
})
