/**
 * Service Worker (PWA install/manifest section — additive).
 *
 * Scope: ONLY makes the app installable (a "fetch" handler + a manifest are
 * both required by the browser install-eligibility check) and speeds up
 * repeat loads of genuinely static, non-personal assets. It does NOT cache
 * anything an officer/commander's data could appear in.
 *
 * Cache policy (versioned):
 *   - /_next/static/** is NETWORK-FIRST. Next 16 Turbopack `next dev`
 *     reuses stable chunk ids such as `_1gsu6fh._.js` (not content hashes).
 *     Cache-first of those URLs served a stale ActionGroup module after
 *     Phase 2E.1 even in a new tab. Production hashed files are still
 *     written into the cache after a successful fetch (offline fallback).
 *   - The PWA icon set under /icons/** and /assets/branding/** stays
 *     cache-first — static images, never personal data.
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

const CACHE_VERSION = "bppis-pwa-v2";

const NETWORK_FIRST_PREFIXES = ["/_next/static/"];
const CACHE_FIRST_PREFIXES = ["/icons/", "/assets/branding/"];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function startsWithAny(pathname, prefixes) {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

function isCacheableStaticAsset(url) {
  if (!isSameOrigin(url)) return false;
  return startsWithAny(url.pathname, NETWORK_FIRST_PREFIXES) || startsWithAny(url.pathname, CACHE_FIRST_PREFIXES);
}

function isNetworkFirstStaticAsset(url) {
  return isSameOrigin(url) && startsWithAny(url.pathname, NETWORK_FIRST_PREFIXES);
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
      if (isNetworkFirstStaticAsset(url)) {
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw err;
        }
      }

      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        throw err;
      }
    })()
  );
});
