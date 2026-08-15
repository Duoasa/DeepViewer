import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  root: 'src/renderer',
  build: {
    outDir: '../../.desktop/renderer',
    emptyOutDir: true,
    sourcemap: true,
  },
})
