/**
 * Service Worker (PWA install/manifest section — additive).
 *
 * Scope: ONLY makes the app installable (a "fetch" handler + a manifest are
 * both required by the browser install-eligibility check) and speeds up
 * repeat loads of genuinely static, non-personal assets. It does NOT cache
 * anything an officer/commander's data could appear in.
 *
 * Cache policy (cache-first, versioned):
 *   - Next.js build output under /_next/static/** (hashed filenames — safe
 *     to cache forever; a new deploy ships new hashes, so stale JS/CSS is
 *     never served after an update).
 *   - The PWA icon set under /icons/** and /assets/branding/** (the
 *     official logo files) — static images, never personal data.
 *   - manifest.json and the root document shell are explicitly EXCLUDED
 *     from the cache so the app never boots from a stale HTML shell.
 *
 * Everything else — every page navigation, every /api/** call, every
 * officer/search/document response — is NETWORK-ONLY: this worker never
 * intercepts or caches it. That is the default (do nothing) for any
 * request not matched by `isCacheableStaticAsset`, so there is nothing to
 * accidentally serve stale or leak across sessions.
 *
 * Versioning: bump CACHE_VERSION on any change to the cached-file set (or
 * simply on every deploy that changes static asset hashes, which Next.js
 * already does automatically via its content-hashed filenames — this
 * version bump is a manual safety net for the /icons and branding assets,
 * which are NOT content-hashed). `activate` deletes every cache that isn't
 * the current version, so an old deploy's cache never lingers.
 */

const CACHE_VERSION = "bppis-pwa-v1";

const STATIC_CACHE_PATH_PREFIXES = ["/_next/static/", "/icons/", "/assets/branding/"];

function isCacheableStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return STATIC_CACHE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  // Activate immediately on next load rather than waiting for all tabs of
  // the OLD service worker to close — required so a new deploy's fix
  // reaches an already-installed PWA promptly (see also `skipWaiting`
  // requested from the client in service_worker_registration.tsx).
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept mutations

  const url = new URL(request.url);
  if (!isCacheableStaticAsset(url)) return; // network-only: pages, API, manifest, everything else

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Only cache genuinely successful, basic (same-origin) responses.
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline and not yet cached — let the browser surface its own
        // network-error page rather than fabricating a fallback response.
        throw err;
      }
    })()
  );
});
