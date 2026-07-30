/**
 * usePwaInstall (PWA install/manifest section — additive).
 *
 * Captures the browser's `beforeinstallprompt` event (Chrome/Edge/Android —
 * NOT fired by Safari/iOS, which has no native install prompt at all) and
 * exposes a `promptInstall()` action plus `canInstall`/`isStandalone` flags
 * so any component can render an install affordance without duplicating the
 * event-wiring logic.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari's own standalone flag (not covered by the media query there).
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function usePwaInstall() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Lazy init only — display-mode doesn't change mid-session, so there is
  // nothing to re-sync from an effect (and no listener update-effect needed).
  const [isStandalone] = useState(isStandaloneDisplay);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    // Chrome only allows a stored prompt event to be used once.
    setDeferredEvent(null);
  }, [deferredEvent]);

  const canInstall = deferredEvent !== null && !isStandalone && !installed;

  return { canInstall, isStandalone, installed, promptInstall };
}
