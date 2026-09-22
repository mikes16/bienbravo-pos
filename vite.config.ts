import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Análisis de bundle on-demand: `ANALYZE=1 npm run build` emite dist/stats.html
// con tamaños gzip/brotli por módulo. Apagado por default — cero costo en CI.
const analyze = process.env.ANALYZE
  ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }) as PluginOption]
  : []

// Identificador del build. Es la versión del cache persistido (ver
// src/core/apollo/client.ts): cambia en cada deploy, así que cada deploy purga
// UNA vez el cache guardado en el dispositivo y nadie tiene que acordarse de
// subir una constante a mano tras un cambio de schema. En Vercel viene el SHA
// del commit; en CI genérico, el de GitHub; en local, el timestamp del arranque.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? `dev-${Date.now().toString(36)}`

/**
 * Publica `dist/version.json` con el MISMO `buildId` que se inyecta como
 * `__BUILD_ID__` en el bundle. Es el único dato que una pestaña abierta desde
 * hace horas puede consultar para saber que el JavaScript que está corriendo
 * ya no es el desplegado (`src/core/freshness/useDeployWatcher.ts`).
 *
 * Va como asset del propio bundle (no como archivo en `public/`) justamente
 * para que las dos mitades no puedan desincronizarse: el valor sale de la
 * misma constante en el mismo build.
 *
 * Nombre FIJO y fuera de `assets/` a propósito: `assets/*` se sirve con
 * `immutable` por un año (ver vercel.json) y un manifiesto cacheado así no
 * serviría de nada. `vercel.json` le pone `Cache-Control: no-store`.
 *
 * Solo en build: en `vite dev` el watcher está inerte y el archivo no existe.
 */
function versionManifest(): Plugin {
  return {
    name: 'bienbravo:version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ buildId })}\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionManifest(), ...analyze],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
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
    // El cliente pega HTTP a /api/graphql (same-origin) para que la cookie sea
    // first-party — en dev lo proxeamos a la API local en :3001 quitando el
    // prefijo /api. En prod lo reescribe vercel.json. Si VITE_API_URL está
    // seteado (apuntando a una API remota) no proxeamos.
    proxy: process.env.VITE_API_URL
      ? undefined
      : {
          '/api/graphql': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api/, ''),
          },
        },
  },
})
