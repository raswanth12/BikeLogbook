import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from https://<username>.github.io/<repo-name>/.
// The deploy workflow sets BASE_PATH from the repo name automatically.
// Change the fallback below only if you build locally for a differently named repo.
const BASE = process.env.BASE_PATH ?? '/bike-logbook/';

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png', '404.html'],
      manifest: {
        name: 'Bike Logbook',
        short_name: 'Logbook',
        description: 'Offline logbook for your motorcycle: fuel, service, trips and costs.',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        theme_color: '#07080A',
        background_color: '#07080A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  // ExcelJS is ~930 kB on its own; it's split out and only loaded when you export.
  build: {
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
