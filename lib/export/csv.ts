/**
 * Shared CSV builder (DI-10B).
 *
 * UTF-8 BOM + RFC 4180 quoting + formula-injection neutralization.
 * Do not copy Commander `csvCell()` implementations — this is the new
 * canonical helper. Personnel Commander exporters are left unchanged.
 *
 * Formula rule: if a cell's first character is `=`, `+`, `-`, `@`, TAB,
 * CR, or LF, prefix with `'` so Excel/Sheets treat it as text. Thai text
 * and ordinary numbers are unchanged. A numeric `-123` is written as a
 * number token (unquoted) so it remains a number, not a formula.
 */

export const CSV_UTF8_BOM = "\uFEFF";
export const CSV_NEWLINE = "\r\n";

const FORMULA_PREFIX = /^[=+\-@\t\r\n]/;

export function neutralizeCsvFormula(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

/** RFC 4180 quote. Always quoted after neutralization so a leading `'` is preserved. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return `""`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = neutralizeCsvFormula(String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: ReadonlyArray<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(",");
}

export interface BuildCsvOptions {
  /** When true (default), emit a localized label row under canonical keys. */
  includeLocalizedHeaders?: boolean;
}

export function buildCsvDocument(
  columns: ReadonlyArray<{ key: string; label: string }>,
  rows: ReadonlyArray<Readonly<Record<string, string | number | boolean | null | undefined>>>,
  options: BuildCsvOptions = {}
): string {
  const includeLocalized = options.includeLocalizedHeaders !== false;
  const lines: string[] = [];
  lines.push(csvRow(columns.map((c) => c.key)));
  if (includeLocalized) lines.push(csvRow(columns.map((c) => c.label)));
  for (const row of rows) {
    lines.push(csvRow(columns.map((c) => row[c.key])));
  }
  return `${CSV_UTF8_BOM}${lines.join(CSV_NEWLINE)}`;
}

export function formatCsvIsoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
}
