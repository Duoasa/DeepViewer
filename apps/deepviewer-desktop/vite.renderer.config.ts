import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  root: 'src/renderer',
  build: {
    outDir: '../../.desktop/renderer',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve('src/renderer/index.html'),
        island: resolve('src/renderer/island.html'),
      },
    },
  },
})
