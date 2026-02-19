import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Health check plugin — serves /health in both dev and preview
function healthPlugin() {
  return {
    name: 'health-check',
    configureServer(server) {
      server.middlewares.use('/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'ok',
          service: 'frontend',
          timestamp: new Date().toISOString(),
        }));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'ok',
          service: 'frontend',
          timestamp: new Date().toISOString(),
        }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), healthPlugin()],
  envDir: resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@docs': resolve(__dirname, '../docs/anwenderdoku/docs'),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - rarely changes, good for caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
