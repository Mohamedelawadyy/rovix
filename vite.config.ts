/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Port 3000 matches the backend defaults (CORS_ALLOWED_ORIGINS and FRONTEND_RESET_PASSWORD_URL).
const DEV_PORT = 3000;

export default defineConfig(({ mode }) => {
  // Not prefixed with VITE_: the proxy target is dev-server only and never shipped to the browser.
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_PROXY_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
      proxy: {
        // Same-origin API calls in development: /api/v1/* -> {backend}/api/v1/*
        '/api': { target: backendUrl, changeOrigin: true },
        // Public vehicle images served by `php artisan storage:link`.
        '/storage': { target: backendUrl, changeOrigin: true },
      },
    },
    preview: {
      port: DEV_PORT,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // Deterministic env for tests, independent of any local .env files.
      env: {
        VITE_APP_NAME: 'Test CDMS',
        VITE_API_BASE_URL: '/api/v1',
      },
      css: false,
      restoreMocks: true,
      unstubEnvs: true,
    },
  };
});
