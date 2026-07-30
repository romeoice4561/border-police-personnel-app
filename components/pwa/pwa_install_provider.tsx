/**
 * PwaInstallProvider (PWA install/manifest section — additive).
 *
 * The real `beforeinstallprompt` event fires once, early (often before any
 * user interaction), and Chrome does NOT redeliver it later. usePwaInstall's
 * listener therefore has to be mounted from first paint — NOT lazily inside
 * the install button, which only exists while the user-menu dropdown happens
 * to be open. This provider mounts the hook once at the app root and shares
 * its state via context so InstallAppButton (rendered conditionally deep in
 * UserMenu) always sees an event that arrived before it was ever opened.
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePwaInstall } from "@/components/pwa/use_pwa_install";

type PwaInstallContextValue = ReturnType<typeof usePwaInstall>;

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const value = usePwaInstall();
  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstallContext(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) throw new Error("usePwaInstallContext must be used within PwaInstallProvider");
  return ctx;
}
