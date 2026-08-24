import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    outDir: '.desktop/build',
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        preload: 'src/preload/index.ts',
        'island-preload': 'src/preload/island.ts',
      },
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
      },
    },
  },
})
