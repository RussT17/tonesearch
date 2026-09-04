import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Two apps, one Pages site. A repo gets exactly one GitHub Pages site, so
// ToneSearch sits at the root of it and ToneScribe one path down:
//
//   /tonesearch/          ToneSearch
//   /tonesearch/scribe/   ToneScribe
//
// They are separate PWAs — own HTML, manifest, icons, theme and service worker —
// so a phone installs two apps with two icons, not one app with a toggle.
//
// Each is built SEPARATELY (`npm run build` runs both, the second writing into
// the first's dist/scribe). vite-plugin-pwa emits one service worker per build,
// and two independent PWAs need two, with different scopes.
const APP = process.env.APP === 'scribe' ? 'scribe' : 'search';
const isScribe = APP === 'scribe';

const base = isScribe ? '/tonesearch/scribe/' : '/tonesearch/';

export default defineConfig({
  base,
  root: isScribe ? 'scribe' : '.',
  // Each app's own static assets. ToneScribe's live in public-scribe/ so the two
  // manifests and icon sets never collide in one folder.
  publicDir: isScribe ? '../public-scribe' : 'public',
  build: {
    outDir: isScribe ? '../dist/scribe' : 'dist',
    emptyOutDir: !isScribe, // the scribe pass must not wipe the search build
  },
  plugins: [
    // Offline support: a service worker precaches the (static, client-only) app
    // so the installed PWA launches with no connection. autoUpdate keeps it
    // fresh — a new deploy is fetched in the background and applied on next
    // load, so a stale cache never sticks. We keep our hand-written manifests
    // (manifest: false), so the plugin only manages the service worker.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        // precache only the runtime shell; the icon PNGs are launcher assets
        // (cached by the OS at install time), not needed for offline play.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: `${base}index.html`,
        // ToneSearch's worker is scoped at the Pages root, so it also controls
        // /scribe/ — without this its navigate fallback would answer ToneScribe's
        // navigations with ToneSearch's HTML, silently serving the wrong app.
        ...(isScribe ? {} : { navigateFallbackDenylist: [/^\/tonesearch\/scribe\//] }),
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    root: '.',
  },
});
