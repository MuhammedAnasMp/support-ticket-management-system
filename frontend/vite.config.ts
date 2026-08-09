import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      strategies: 'injectManifest',

      srcDir: 'src',
      filename: 'sw.ts',

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
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    })

  ],
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: true as any,
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: true as any,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
