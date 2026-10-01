import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://brapi.dev',
        changeOrigin: true,
      },
      '/i10': {
        target: 'https://investidor10.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/i10/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
