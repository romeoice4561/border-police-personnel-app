/**
 * Contact search — permission-aware; phones come from enrichment only.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PersonnelSearchEnrichment, PersonnelSearchListItem } from "@/lib/personnel_search/contracts";
import { listEntryFromOfficer } from "@/lib/personnel_search/formatter";
import { rankSeniority } from "@/lib/personnel_search/ranking";
import {
  type FieldAccess,
  type SearchPermissionContext,
} from "@/lib/personnel_search/permission";
import type { ParsedSearchQuery } from "@/lib/personnel_search/parser";

export function searchContacts(
  officers: CommanderQueryOfficer[],
  enrichmentById: ReadonlyMap<string, PersonnelSearchEnrichment>,
  parsed: ParsedSearchQuery,
  access: FieldAccess,
  ctx: SearchPermissionContext
): PersonnelSearchListItem[] {
  if (!access.canViewContacts && !ctx.subjectOfficerId) return [];

  const q = parsed.raw;
  let pool = officers;

  if (/ผู้บังคับหน่วย|ผบ\.หน่วย/.test(q)) {
    pool = [...officers]
      .filter((o) => /ผบ\.|ผู้บังคับ|ผู้กำกับการ/i.test(o.currentPosition ?? ""))
      .sort((a, b) => rankSeniority(b.rank) - rankSeniority(a.rank));
  } else if (/รองผู้กำกับ|รอง\s*ผกก/.test(q)) {
    pool = officers.filter((o) => /รองผู้กำกับการ|รอง\s*ผกก/i.test(o.currentPosition ?? ""));
  } else if (/เบอร์|โทร|phone|duty/i.test(q)) {
    pool = officers.filter((o) => {
      const e = enrichmentById.get(o.officerId);
      return Boolean(e?.phones?.length || e?.dutyPhone);
    });
  }

  return pool.slice(0, 25).map((o) => {
    const e = enrichmentById.get(o.officerId);
    const phone =
      access.canViewContacts || ctx.subjectOfficerId === o.officerId
        ? e?.dutyPhone || e?.phones?.[0] || "—"
        : "—";
    return listEntryFromOfficer(o, `ติดต่อ: ${phone}`, access, ctx);
  });
}
