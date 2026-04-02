import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3031,
    host: '0.0.0.0', // Permite acesso de fora do container
    watch: {
      usePolling: true, // Necessário para hot reload no Docker
    },
    hmr: {
      host: 'localhost', // Host para HMR
      port: 3031,
    },
    proxy: {
      '/v1': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path
      },
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsDir: 'assets'
  }
})

