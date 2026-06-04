import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (third arg = '' → not just VITE_ prefixed). Non-VITE_
  // vars are build-time only — never shipped to the client.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Proxy /api and /ws to the Django backend so the browser sees everything
      // as same-origin. Eliminates cross-port cookie quirks (Safari especially)
      // and avoids CORS preflights in dev. In production a real reverse proxy
      // (nginx, ALB, …) fills the same role.
      proxy: {
        '/api': {
          target: env.DEV_PROXY_HTTP_TARGET,
          changeOrigin: false,
        },
        '/ws': {
          target: env.DEV_PROXY_WS_TARGET,
          ws: true,
          changeOrigin: false,
        },
      },
    },
  }
})
