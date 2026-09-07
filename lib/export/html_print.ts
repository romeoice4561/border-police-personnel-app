/**
 * HTML_PRINT client success contract (DI-10E.1A).
 *
 * Primary success is: export bytes received + standalone report tab opened.
 * A file-download click is not required. Chrome returns null from
 * window.open(..., "noopener,noreferrer") even when the tab actually opens,
 * so that feature string must not be used as the open-success signal.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const HTML_PRINT_OBJECT_URL_REVOKE_MS = 60_000;

export class HtmlPrintPopupBlockedError extends Error {
  readonly code = "PRINT_POPUP_BLOCKED";
  constructor() {
    super("print popup blocked");
    this.name = "HtmlPrintPopupBlockedError";
  }
}

export function openHtmlPrintReport(
  blob: Blob,
  deps: {
    openWindow?: typeof window.open;
    createObjectURL?: typeof URL.createObjectURL;
    revokeObjectURL?: typeof URL.revokeObjectURL;
    schedule?: (fn: () => void, ms: number) => void;
  } = {}
): void {
  const openWindow = deps.openWindow ?? window.open.bind(window);
  const createObjectURL = deps.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = deps.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const schedule = deps.schedule ?? ((fn, ms) => window.setTimeout(fn, ms));
  const url = createObjectURL(blob);
  const opened = openWindow(url, "_blank");
  if (!opened) {
    revokeObjectURL(url);
    throw new HtmlPrintPopupBlockedError();
  }
  opened.opener = null;
  schedule(() => revokeObjectURL(url), HTML_PRINT_OBJECT_URL_REVOKE_MS);
}

export function htmlPrintFailureMessage(
  error: unknown,
  t: (key: TranslationKey) => string
): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof HtmlPrintPopupBlockedError) return t("di.export.printPopupBlocked");
  return t("di.export.downloadFailed");
}
