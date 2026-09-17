import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The API has no CORS middleware and Keycloak's realm client only whitelists
// its own origin, so both are proxied through the dev server instead: the
// browser only ever talks to this origin. The production container does the
// same thing with nginx, which keeps one set of relative URLs in the code.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_ORIGIN ?? 'http://localhost:8000', changeOrigin: true },
      '/kc': {
        target: process.env.KEYCLOAK_ORIGIN ?? 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/kc/, ''),
      },
    },
  },
})
