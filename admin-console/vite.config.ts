import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_GATEWAY_URL || 'http://localhost:4000'

  return {
    plugins: [react()],
    base: command === 'serve' ? '/' : '/admin/console/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: {
      port: 5000,
      proxy: {
        '/admin/api': {
          target: gatewayTarget,
          changeOrigin: true,
        },
        '/admin/config/firebase': {
          target: gatewayTarget,
          changeOrigin: true,
        },
        '/graphql': {
          target: gatewayTarget,
          changeOrigin: true,
        },
        '/csrfToken': {
          target: gatewayTarget,
          changeOrigin: true,
        },
        '/sessionLogin': {
          target: gatewayTarget,
          changeOrigin: true,
        },
        '/sessionLogout': {
          target: gatewayTarget,
          changeOrigin: true,
        },
      }
    }
  }
})
