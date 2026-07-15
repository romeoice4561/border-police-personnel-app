/**
 * downloadFile — force a real file download in the browser (Phase 45A, Part 3).
 *
 * The previous photo-download code set `a.target="_blank"` with the `download`
 * attribute on a CROSS-ORIGIN image URL. Browsers IGNORE the `download`
 * attribute for cross-origin hrefs, so `target="_blank"` meant the image just
 * OPENED IN A NEW TAB instead of downloading. This helper fixes that by
 * fetching the resource into a same-origin blob URL — for which the `download`
 * attribute IS honored — so the file downloads (with its filename) and no tab
 * opens.
 *
 * Preview is unaffected: previews use their own `window.open` / anchor and are
 * never routed through here.
 *
 * Pure browser utility — no React, no business logic. Never throws to the
 * caller; on any failure it falls back to a direct anchor click (best effort).
 */

/** Clicks a temporary anchor for `href`, downloading as `filename` when the browser honors it. */
function clickAnchor(href: string, filename: string, revoke?: () => void): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) {
    // Give the browser a moment to start the download before revoking the URL.
    window.setTimeout(revoke, 1000);
  }
}

/**
 * Downloads `url` as `filename`. Tries a fetch->blob->object-URL download first
 * (works for cross-origin hosts that allow CORS, keeps the filename, no new
 * tab). If the fetch fails (e.g. a host that blocks CORS), falls back to a
 * direct anchor — same-origin URLs (our own /download proxy) still download
 * correctly this way.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  if (!url) return;
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`download fetch failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    clickAnchor(objectUrl, filename, () => URL.revokeObjectURL(objectUrl));
  } catch {
    // CORS or network failure — best-effort direct anchor (no new tab).
    clickAnchor(url, filename);
  }
}

/**
 * Builds a safe download filename from a display name + optional suffix/
 * extension. Collapses whitespace to underscores and removes only characters
 * that are invalid in filenames on common OSes ( \ / : * ? " < > | ) — letters
 * (including Thai), digits, dots, underscores and hyphens are preserved.
 */
export function toDownloadName(name: string, opts?: { suffix?: string; ext?: string }): string {
  const base = (name || "file").trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]+/g, "");
  const suffix = opts?.suffix ? `_${opts.suffix}` : "";
  const ext = opts?.ext ? (opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`) : "";
  return `${base || "file"}${suffix}${ext}`;
}
