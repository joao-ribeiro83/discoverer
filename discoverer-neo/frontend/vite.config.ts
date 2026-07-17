import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// In Docker dev, services reach each other by service name (backend:3000).
// BACKEND_URL can be set via VITE_BACKEND_URL (see docker-compose.dev.yml).
// The backend serves its API under /api natively, so no path rewrite.
const backendTarget =
  process.env.VITE_BACKEND_URL ||
  `http://localhost:${process.env.BACKEND_PORT || 3000}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.FRONTEND_PORT) || 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split the framework/router runtime (rarely changes, cacheable
        // long-term) from the rest of the app shell, and pull TanStack's
        // table/query/virtual packages into their own chunk since they're
        // pulled in by most routes but are large enough to warrant it.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-table', '@tanstack/react-virtual'],
        },
      },
    },
  },
})
