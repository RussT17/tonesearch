import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Two apps, one Pages site. A repo gets exactly one GitHub Pages site, so both
// apps live under it — as SIBLINGS, with a plain landing page at the root:
//
//   /tonesearch/          landing page (two links; deliberately NOT a PWA)
//   /tonesearch/search/   ToneSearch
//   /tonesearch/scribe/   ToneScribe
//
// The nesting this replaces (ToneSearch at the root, ToneScribe below it) could
// not hold two installable apps. A browser treats a page inside an installed
// app's scope as part of that app, so ToneSearch's `/tonesearch/` scope
// swallowed ToneScribe: installing the second replaced the first's icon, and
// that icon then opened the wrong game. Sibling scopes contain each other
// nowhere, so both install as themselves. The root must stay manifest-less for
// that to hold — a manifest there would claim the whole site again.
//
// They are separate PWAs — own HTML, manifest, icons, theme and service worker —
// so a phone installs two apps with two icons, not one app with a toggle.
//
// Each is built SEPARATELY, into its own dist/ subdirectory. vite-plugin-pwa
// emits one service worker per build, and two independent PWAs need two, with
// different scopes.
const APP = process.env.APP === 'scribe' ? 'scribe' : 'search';
const isScribe = APP === 'scribe';

const dir = isScribe ? 'scribe' : 'search';
const base = `/tonesearch/${dir}/`;

export default defineConfig({
  base,
  root: dir,
  // Each app's own static assets, so the two manifests and icon sets never
  // collide in one folder.
  publicDir: isScribe ? '../public-scribe' : '../public',
  build: {
    outDir: `../dist/${dir}`,
    // Neither pass may wipe dist, since the other's build is in there and the
    // landing page is copied in afterwards. `npm run build` clears dist once, up
    // front, instead.
    emptyOutDir: false,
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
        // No navigateFallbackDenylist any more: each worker is scoped to its own
        // app directory, so neither can answer the other's navigations. Under the
        // old layout ToneSearch's worker sat at the Pages root and controlled
        // /scribe/ too, and without an explicit denylist its navigate fallback
        // served ToneSearch's HTML to ToneScribe's URLs.
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
