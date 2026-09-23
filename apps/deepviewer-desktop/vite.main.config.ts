import { defineConfig } from 'vite'

export default defineConfig({
  // The desktop archive ships the compiled main entry without a node_modules tree.
  ssr: { noExternal: ['ipaddr.js', 'ip-address', 'socks', 'smart-buffer'] },
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
