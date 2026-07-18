/**
 * Training record history — pure presentation helpers (Phase 45 completion
 * pass, Task 3). Extracted from components/officer/training_section.tsx so
 * the sort/display rules are unit-testable without a React render, matching
 * the existing lib/ui/officer_summary.ts's sortTimelineByYear pattern.
 *
 * Pure — no I/O, no React. Never fabricates a completion date, certificate
 * number, or expiry date — see lib/intelligence/training/evidence.ts's own
 * doc comment for the conservative year-parsing rule this reuses.
 */
import type { Training } from "@/lib/database/query_types";
import { toTrainingRecordEvidenceBatch } from "@/lib/intelligence/training/evidence";
import { formatBuddhistEraYearTh } from "@/lib/intelligence/shared/thai_date";

/**
 * Sorts Training rows chronologically using the SAME completionDate
 * Training Intelligence already derives (a pure re-use, not a new
 * calculation). Rows without a parseable year sort LAST, keeping their
 * relative input order — never guessed into a position.
 */
export function sortTrainingRowsChronologically(rows: readonly Training[]): Training[] {
  const evidence = toTrainingRecordEvidenceBatch(rows);
  const completionDateById = new Map(evidence.map((e) => [e.recordId, e.completionDate]));
  return [...rows].sort((a, b) => {
    const dateA = completionDateById.get(a.id);
    const dateB = completionDateById.get(b.id);
    if (dateA && dateB) return dateA.localeCompare(dateB);
    if (dateA) return -1;
    if (dateB) return 1;
    return 0;
  });
}

/**
 * Buddhist-Era year when the row's free-text `year` field parsed
 * unambiguously (completionDate non-null); otherwise the raw stored string
 * VERBATIM (e.g. "2563-2564", "ปัจจุบัน") — never reformatted into a
 * fabricated full date, and never silently dropped. `unspecifiedLabel` is
 * shown only when `row.year` itself is blank/null.
 */
export function displayTrainingYear(row: Training, completionDate: string | null, unspecifiedLabel: string): string {
  if (completionDate) {
    return formatBuddhistEraYearTh(new Date(`${completionDate}T00:00:00.000Z`));
  }
  if (row.year && row.year.trim()) return row.year.trim();
  return unspecifiedLabel;
}
