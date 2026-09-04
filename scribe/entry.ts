// entry.ts — the module the page loads. It exists only so the entry sits INSIDE
// this build's root: vite serves `scribe/` as the root for ToneScribe, and a
// script pointing outside it resolves to the wrong dev URL (it bundles fine,
// then 404s under `npm run dev`). The app itself lives in src/scribe.
import '../src/scribe/main';
