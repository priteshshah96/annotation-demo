import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 60000,
        proxyTimeout: 60000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy Error Details:', {
              message: err.message,
              code: err.code,
              stack: err.stack
            });
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request:', req.method, req.url);
            // Set longer timeout for the proxy request
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.setHeader('Keep-Alive', 'timeout=60');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response:', proxyRes.statusCode, req.url);
          });
        }
      }
    },
    // Add CORS headers
    cors: true,
    // Increase connection timeout
    hmr: {
      timeout: 60000
    }
  }
});