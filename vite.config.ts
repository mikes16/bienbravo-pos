import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Análisis de bundle on-demand: `ANALYZE=1 npm run build` emite dist/stats.html
// con tamaños gzip/brotli por módulo. Apagado por default — cero costo en CI.
const analyze = process.env.ANALYZE
  ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }) as PluginOption]
  : []

export default defineConfig({
  plugins: [react(), tailwindcss(), ...analyze],
  resolve: {
    alias: { '@': path.join(__dirname, 'src') },
  },
  build: {
    rollupOptions: {
      output: {
        // El entry (main.tsx) se nombra distinto de los chunks de ruta —
        // ambos serían 'index-*' porque las features son barrels index.ts.
        // Con un nombre propio, size-limit puede presupuestar el bundle
        // inicial sin confundirlo con los chunks lazy.
        entryFileNames: 'assets/main-[hash].js',
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/react-router') || id.includes('/@remix-run/')) {
            return 'vendor-router'
          }
          if (id.includes('/@radix-ui/')) {
            return 'vendor-radix'
          }
          if (id.includes('/@apollo/') || id.includes('/graphql')) {
            return 'vendor-apollo'
          }
        },
      },
    },
  },
  server: {
    port: 3002,
    host: true,
    proxy: process.env.VITE_API_URL
      ? undefined
      : { '/graphql': { target: 'http://localhost:3001', changeOrigin: true } },
  },
})
