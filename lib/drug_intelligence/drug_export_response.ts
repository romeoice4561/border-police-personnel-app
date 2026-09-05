/**
 * Intelligence export download Response. Private, no-store.
 * RFC 6266 filename + filename* so Thai names do not crash Headers.
 */

export function asciiFallbackExportFilename(filename: string, ext: string): string {
  const asciiOnly = filename.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "").trim();
  if (asciiOnly.length > 0) return asciiOnly;
  return `export.${ext}`;
}

export function contentTypeForExportFormat(format: "CSV" | "JSON" | "HTML_PRINT"): string {
  if (format === "CSV") return "text/csv; charset=utf-8";
  if (format === "HTML_PRINT") return "text/html; charset=utf-8";
  return "application/json; charset=utf-8";
}

export function exportDownloadResponse(body: string, filename: string, format: "CSV" | "JSON" | "HTML_PRINT"): Response {
  const ext = format === "CSV" ? "csv" : format === "HTML_PRINT" ? "html" : "json";
  const fallback = asciiFallbackExportFilename(filename, ext);
  const encoded = encodeURIComponent(filename);
  const bytes = new TextEncoder().encode(body);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForExportFormat(format),
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
