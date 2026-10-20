import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Multi-page build:
 *   index.html      -> the landing page, served at the domain root (/)
 *   lab/index.html  -> the virtual laboratory, served at /lab/
 *
 * Both pages live in one Vite project so Cloudflare Pages only needs one
 * build command ("npm run build") and one output directory ("dist").
 */
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        lab: fileURLToPath(new URL('./lab/index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // The optional Node backend (accounts, progress sync, analytics).
      // In development it runs on :3000; when it is absent the front-end
      // silently falls back to local-only mode. See lab/src/core/api.ts
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
