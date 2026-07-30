/**
 * InstallAppButton (PWA install/manifest section — additive).
 *
 * Renders ONLY when the browser has actually fired `beforeinstallprompt`
 * (Chrome/Edge/Android — never Safari/iOS, see IosInstallBanner for that
 * path) and the app is not already running standalone. Clicking always
 * triggers the real native install prompt — never a no-op — and the button
 * disappears the moment `appinstalled` fires or the user completes install.
 */
"use client";

import { Download } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { usePwaInstallContext } from "@/components/pwa/pwa_install_provider";

interface InstallAppButtonProps {
  onInstalled?: () => void;
}

export function InstallAppButton({ onInstalled }: InstallAppButtonProps) {
  const { t } = useT();
  const { canInstall, promptInstall } = usePwaInstallContext();

  if (!canInstall) return null;

  async function handleClick() {
    await promptInstall();
    onInstalled?.();
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-neutral-bg focus:outline-none focus-visible:bg-neutral-bg"
    >
      <Download className="h-4 w-4 text-muted" aria-hidden="true" />
      {t("pwa.installButton")}
    </button>
  );
}
