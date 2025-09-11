import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory and parent directories
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env': process.env
    },
    server: {
      port: 5173,
      proxy: {
        // Proxy API requests to the backend server
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode !== 'production',
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            tensorflow: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
            faceapi: ['face-api.js'],
          },
        },
      },
    },
  };
});
