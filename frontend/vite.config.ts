import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : '/static/';
  
  return {
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      strategies: 'injectManifest',

      srcDir: 'src',
      filename: 'sw.ts',

      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },

      registerType: 'autoUpdate',

      devOptions: {
        enabled: true,
        type: 'module',
      },

      manifest: {
        name: 'Maintenance Tracker',
        short_name: 'Maintenance Tracker',
        description: 'Maintenance Management System',

        theme_color: '#ffffff',
        background_color: '#ffffff',

        display: 'standalone',

        start_url: '/',
        scope: '/',

        icons: [
          {
            src: `${base}icon-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icon-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    })
  ],
  base: base,
  build: {
    outDir: path.resolve(__dirname, '../backend/static'),
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: true as any,
    proxy: {
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: true as any,
    proxy: {
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  };
});

