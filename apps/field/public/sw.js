/* eslint-env serviceworker */
/**
 * TimberForge field service worker.
 *
 * WHAT IT PROMISES
 *
 * The app opens with no signal. That is the only promise, and it is the whole
 * product: a cruiser is standing in a clearcut with one bar and cannot wait for
 * a bundle to download.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not cache API responses, and it does not try to be clever about
 * data. Cruise data lives in IndexedDB and is synced through the outbox; a
 * service worker caching a stale GET of somebody's tally would be a second,
 * competing source of truth. Assets here, data there.
 *
 * STRATEGY
 *
 *   * navigations       — network first, falling back to the cached shell.
 *     (Network first, so a deployed fix is picked up on the next open rather
 *     than after two.)
 *   * same-origin GETs  — cache first, revalidating in the background.
 *   * everything else   — straight to the network, untouched.
 *
 * The cache name carries a version. Bumping it is how a release evicts the old
 * bundle; the activate handler deletes every cache that is not the current one.
 */

const VERSION = 'v1';
const CACHE = `timberforge-field-${VERSION}`;

// The shell only. Hashed bundle files are picked up by the runtime handler on
// first visit — listing them here would mean regenerating this file on every
// build, and a stale list is worse than no list.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      // A failed precache must not block activation; the runtime handler will
      // fill the cache on first use. Refusing to install would leave the user
      // with no service worker at all, which is the worse outcome.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? network;
    })
  );
});
