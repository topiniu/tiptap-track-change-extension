import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, '../demo-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vue3: resolve(__dirname, 'vue3.html'),
      },
    },
  },
})
