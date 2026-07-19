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
  // `server.proxy` applies to `vite dev` only, so without this `vite preview`
  // serves the built app with every /api call 404ing. Bundle and load-time work
  // has to be verified against the real build, which means preview needs the
  // same proxy the dev server gets.
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PREVIEW_PORT) || 4173,
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
        // Function form, not the object form. The object form matches whole
        // module *specifiers*, so listing 'react-dom' matched only the small
        // CJS shim — `react-dom/client`, which main.tsx actually imports and
        // which carries the ~540 kB renderer, is a different specifier and fell
        // through into the entry chunk. Matching on resolved path avoids that
        // class of near-miss entirely.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Order matters: react-router bundles its own copy of parts of the
          // react namespace, so match it before the bare react test.
          if (/[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          // react-query is constructed in main.tsx and so is unavoidably on the
          // initial path; table and virtual are only reached from the data-heavy
          // lazy routes. Splitting them keeps ~70 kB of grid machinery off the
          // login and dashboard render.
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) {
            return /react-(table|virtual)/.test(id) ? 'vendor-table' : 'vendor-query'
          }
          // Tiny styling helpers behind `cn()`, so used by essentially every
          // component — but also by recharts. Left unassigned, rollup is free to
          // hoist them into whichever chunk it likes, and it picked
          // vendor-charts: the entry then imported one clsx-sized symbol and
          // dragged all 382 kB of recharts onto the login page. Pinning them
          // here keeps that dependency edge pointing at something small.
          if (
            /[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority)[\\/]/.test(id)
          ) {
            return 'vendor-style-utils'
          }
          // Validation + HTTP + forms: pulled in by the login page, so they are
          // on the initial path regardless, but they version independently of
          // the framework and are worth caching separately.
          // axios backs the shared api client and is on the initial path no
          // matter what; zod and react-hook-form are only ever reached from a
          // page. Keeping them apart means the form stack can leave the initial
          // download as soon as every page importing it is lazy.
          if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'vendor-http'
          if (/[\\/]node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/.test(id)) {
            return 'vendor-forms'
          }
          // Recharts drags in d3-* and a full lodash. Only the audit log uses
          // it; keeping it in its own chunk stops that weight from being
          // duplicated into any other lazy route that later adds a chart.
          if (
            /[\\/]node_modules[\\/](recharts|d3-|lodash|decimal\.js-light|react-smooth|victory-|fast-equals)/.test(
              id,
            )
          ) {
            return 'vendor-charts'
          }
          return undefined
        },
      },
    },
  },
})
