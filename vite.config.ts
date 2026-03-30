import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.join(__dirname, 'src') },
  },
  build: {
    rollupOptions: {
      output: {
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
