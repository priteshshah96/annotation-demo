import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/vercel': {
          target: env.VERCEL_URL 
            ? `https://${env.VERCEL_URL}`
            : 'http://localhost:3000',
          changeOrigin: true,
          secure: true,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response:', proxyRes.statusCode, req.url);
            });
          }
        }
      },
      historyApiFallback: {
        disableDotRule: true,
        index: '/index.html'
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: 'es',
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            clerk: ['@clerk/clerk-react']
          }
        }
      },
      modulePreload: true,
      target: 'esnext',
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext'
      },
      include: ['react', 'react-dom', 'react-router-dom', '@clerk/clerk-react']
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '/api/vercel'),
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(env.VITE_CLERK_PUBLISHABLE_KEY)
    }
  };
});