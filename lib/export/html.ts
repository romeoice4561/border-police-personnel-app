/**
 * HTML escaping for server-generated print reports (DI-10C).
 * All database/user text must pass through escapeHtml before interpolation.
 */

export function escapeHtml(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlMultiline(value: string | null | undefined): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br />");
}
