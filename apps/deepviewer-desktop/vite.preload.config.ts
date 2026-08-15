import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'src/preload/index.ts',
    target: 'node24',
    outDir: '.desktop/build',
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'preload.cjs',
      },
    },
  },
})
