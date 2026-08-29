import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// base must match the GitHub Pages project subpath so asset URLs resolve
// correctly at https://<user>.github.io/tonesearch/
export default defineConfig({
  base: '/tonesearch/',
  plugins: [
    // Offline support: a service worker precaches the whole (static, client-only)
    // app so the installed PWA launches with no connection. autoUpdate keeps it
    // fresh — a new deploy is fetched in the background and applied on next load,
    // so a stale cache never sticks. We keep our hand-written public manifest
    // (manifest: false), so the plugin only manages the service worker.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        // precache only the runtime shell; the icon PNGs are launcher assets
        // (cached by the OS at install time), not needed for offline play.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: '/tonesearch/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
