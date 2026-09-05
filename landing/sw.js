// A tombstone, not a service worker.
//
// ToneSearch used to be served from /tonesearch/, so browsers that visited it
// registered a worker at this exact URL with the whole site in scope. That
// worker precached ToneSearch's HTML and answered every navigation under
// /tonesearch/ with it — including, now, this landing page and both apps at
// their new addresses, whose real files it has never heard of.
//
// It cannot simply be deleted: a worker already registered keeps running, and
// removing the file only makes the update check fail, leaving it in place. The
// way out is to serve something different HERE, which the browser installs as an
// update, and have that unregister itself. It has no fetch handler, so from the
// moment it activates every request reaches the network again.
//
// Safe to delete once no browser is running the old worker any more; harmless to
// keep, since a URL nothing registers is never fetched.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Cache storage is per ORIGIN, not per scope, so the two apps' own precaches
    // are visible from here — and clearing them would throw away a working app's
    // offline copy. Only the caches named for the old root scope go.
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.includes('/tonesearch/search/') && !k.includes('/tonesearch/scribe/'))
        .map((k) => caches.delete(k)),
    );
    await self.registration.unregister();
    // Reload whatever this worker was still controlling, so the visitor lands on
    // the real page instead of the stale one it just served them.
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.navigate(client.url);
  })());
});
