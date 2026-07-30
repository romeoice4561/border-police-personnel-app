/**
 * ServiceWorkerRegistration (PWA install/manifest section — additive).
 *
 * Registers public/sw.js exactly once, client-side only, after mount.
 * Renders nothing — this is a side-effect-only component, mounted once in
 * the root layout body (outside Providers, so it runs even if a provider
 * ever throws).
 *
 * Update handling: when a new service worker is found (a new deploy
 * changed sw.js's bytes, which the browser detects via its normal
 * byte-diff check), this immediately tells it to skip the waiting phase
 * and activate, then reloads the page ONCE so the new worker's fetch
 * handler takes over right away — this is what prevents "the app keeps
 * showing an old cached version after a deploy" (the sw.js `activate`
 * handler additionally purges any cache from a prior CACHE_VERSION).
 */
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;

    function reloadOnce() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // A new worker installed while an old one is still controlling
              // this page — tell it to activate now instead of waiting for
              // every tab to close.
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // Registration failure (e.g. unsupported browser, blocked by policy)
        // must never break the app — PWA install is an enhancement, not a
        // requirement for any existing feature.
      });

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce);
    };
  }, []);

  return null;
}
