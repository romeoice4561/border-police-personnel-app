/**
 * Return-context navigation (Phase DI-8.1.1, Defect B).
 *
 * A small, reusable "where did the user come from" mechanism carried via a
 * single `returnTo` URL query parameter — audited first (no existing
 * returnTo/backTo/redirectTo/from/source convention was found anywhere in
 * this codebase; every "back to X" link found elsewhere is a hardcoded
 * static destination, not propagated state), so this is a new, minimal
 * convention rather than a duplicate of an existing one.
 *
 * Pure — no I/O, no React. `isSafeInternalReturnPath` is the ONLY thing
 * that decides whether a returnTo value may be used to navigate/render a
 * link: it must be an internal, same-origin path (never an absolute URL,
 * protocol-relative URL, or javascript:/data: scheme) — this is what
 * prevents an open-redirect via a crafted `?returnTo=` value.
 */

const RETURN_TO_PARAM = "returnTo";

/**
 * Accepts only a same-origin internal application path: must start with a
 * single "/" (never "//", which the browser resolves as protocol-relative
 * to another host) and must not contain a "://" scheme separator anywhere
 * in the string (rules out "javascript:", "data:", "https://evil.example",
 * and a same-path trick like "/x\thttps://evil.example" too, since that
 * still contains "://"). Returns null for anything unsafe or empty.
 */
export function isSafeInternalReturnPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("://")) return false;
  if (/[\x00-\x1f]/.test(value)) return false;
  return true;
}

/** Reads and validates `returnTo` from URLSearchParams. Returns null when absent or unsafe — callers must never fall back to an unvalidated value. */
export function getSafeReturnTo(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(RETURN_TO_PARAM);
  return isSafeInternalReturnPath(raw) ? raw : null;
}

/** Appends a validated returnTo path onto a target URL's query string. No-ops (returns the target unchanged) when returnPath is unsafe. */
export function withReturnTo(targetPath: string, returnPath: string | null | undefined): string {
  if (!isSafeInternalReturnPath(returnPath)) return targetPath;
  const separator = targetPath.includes("?") ? "&" : "?";
  return `${targetPath}${separator}${RETURN_TO_PARAM}=${encodeURIComponent(returnPath)}`;
}

export { RETURN_TO_PARAM };
