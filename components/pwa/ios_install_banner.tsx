/**
 * IosInstallBanner (PWA install/manifest section — additive).
 *
 * Safari on iOS/iPadOS never fires `beforeinstallprompt` and has no native
 * install UI at all, so this shows a small dismissible instruction banner
 * instead — ONLY when: Safari (not Chrome/Firefox-on-iOS, which are Safari
 * WebKit wrappers but don't share this gap the same way — narrowed further
 * below to genuine Mobile Safari), on iOS/iPadOS, and NOT already running
 * standalone. Dismissal is remembered for the session (sessionStorage) so it
 * doesn't reappear on every navigation while the user is still deciding.
 */
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { BppisLogo } from "@/components/auth/bppis_logo";

const DISMISSED_KEY = "bppis_ios_install_dismissed";

function isIosSafariStandaloneEligible(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;

  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  if (!isIos) return false;

  // Genuine Safari (excludes Chrome/Firefox/Edge-on-iOS, which append their
  // own token even though they run on WebKit).
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (!isSafari) return false;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

function shouldShowInitially(): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(DISMISSED_KEY) === "1") return false;
  return isIosSafariStandaloneEligible();
}

export function IosInstallBanner() {
  const { t } = useT();
  // Lazy init only — eligibility (UA/display-mode) doesn't change mid-session.
  const [visible, setVisible] = useState(shouldShowInitially);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
        <div className="w-9 shrink-0">
          <BppisLogo />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t("pwa.iosInstallTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("pwa.iosInstallSteps")}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("pwa.iosInstallDismiss")}
          className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-neutral-bg hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
