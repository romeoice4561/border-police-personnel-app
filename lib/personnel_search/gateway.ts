/**
 * Personnel Search Gateway — single entry point for all clients (Phase 51).
 *
 * Telegram / LINE / Web / Assistant → searchPersonnel() → Commander dataset.
 * No messaging platform logic lives here.
 */
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type {
  PersonnelSearchEnrichment,
  PersonnelSearchRequest,
  PersonnelSearchResult,
  SearchAction,
} from "@/lib/personnel_search/contracts";
import {
  buildPersonActions,
  formatDisambiguationLine,
  formatPersonItem,
  listEntryFromOfficer,
} from "@/lib/personnel_search/formatter";
import { resolveSearchIntent } from "@/lib/personnel_search/intent";
import { parseSearchQuery } from "@/lib/personnel_search/parser";
import {
  filterOfficersForPrincipal,
  resolveFieldAccess,
  type SearchPermissionContext,
} from "@/lib/personnel_search/permission";
import { searchContacts } from "@/lib/personnel_search/search_contact";
import { dataQualitySummaryTh, searchDataQuality } from "@/lib/personnel_search/search_data_quality";
import { documentSummaryTh, searchDocuments } from "@/lib/personnel_search/search_documents";
import { needsDisambiguation, searchPersons, sortDisambiguation } from "@/lib/personnel_search/search_person";
import { promotionSummaryTh, searchPromotion } from "@/lib/personnel_search/search_promotion";
import { retirementSummaryTh, searchRetirement } from "@/lib/personnel_search/search_retirement";
import { searchTraining, trainingSummaryTh } from "@/lib/personnel_search/search_training";
import { searchUnit } from "@/lib/personnel_search/search_unit";
import type { DisclosureLevel } from "@/lib/personnel_search/types";

export interface PersonnelSearchContext {
  dataset: CommanderQueryDataset;
  /** Optional nickname / phone enrichment keyed by officerId. */
  enrichmentByOfficerId?: ReadonlyMap<string, PersonnelSearchEnrichment>;
}

const HELP_LINES_TH = [
  "ค้นหาหน่วยงาน: ร้อย414, กก41, ภาค4",
  "ค้นหาบุคคล: ชื่อ นามสกุล ยศ+ชื่อ รหัส ชื่อเล่น รุ่นนรต.",
  "เลื่อนระดับ: พร้อมเลื่อนปีนี้, ครบคุณสมบัติมาแล้ว, ขาดหลักสูตร",
  "เกษียณ: เกษียณปี2570, เกษียณ3ปี, พร้อมเลื่อนแต่ใกล้เกษียณ",
  "เอกสาร/หลักสูตร/คุณภาพข้อมูล: ขาดเอกสาร, หลักสูตรสืบสวน, ข้อมูลไม่ครบ",
];

function emptyResult(
  request: PersonnelSearchRequest,
  intent: PersonnelSearchResult["intent"],
  accessScope: string[],
  clarificationTh: string,
  clarificationEn: string
): PersonnelSearchResult {
  const level = (request.disclosureLevel ?? 1) as DisclosureLevel;
  return {
    intent,
    resultType: "empty",
    totalCount: 0,
    items: [],
    actions: [{ type: "refine_query", labelTh: "ปรับคำค้น", labelEn: "Refine query", payload: {} }],
    clarification: {
      reasonTh: clarificationTh,
      reasonEn: clarificationEn,
      suggestionsTh: HELP_LINES_TH.slice(0, 3),
    },
    permissionScope: accessScope,
    disclosureLevel: level,
    audit: {
      query: request.query,
      intent,
      timestampIso: request.nowIso ?? new Date().toISOString(),
      permissionScope: accessScope,
      client: request.client,
      persistReady: false,
    },
  };
}

function listActions(access: ReturnType<typeof resolveFieldAccess>): SearchAction[] {
  const actions: SearchAction[] = [];
  if (access.canOpenDashboard) {
    actions.push({
      type: "open_dashboard",
      labelTh: "เปิดแดชบอร์ดเลื่อนระดับ",
      labelEn: "Open Promotion Dashboard",
      payload: { href: "/commander-promotion" },
    });
  }
  if (access.canExport) {
    actions.push({ type: "export", labelTh: "ส่งออก", labelEn: "Export", payload: {} });
  }
  return actions;
}

/**
 * Execute a personnel search against the commander dataset (+ optional enrichment).
 */
export function searchPersonnel(
  request: PersonnelSearchRequest,
  context: PersonnelSearchContext
): PersonnelSearchResult {
  const level = (request.disclosureLevel ?? 1) as DisclosureLevel;
  const limit = Math.min(Math.max(request.limit ?? 20, 1), 50);
  const permCtx: SearchPermissionContext = {
    permissions: request.permissions,
    subjectOfficerId: request.subjectOfficerId ?? null,
  };
  const access = resolveFieldAccess(permCtx);
  const enrichment = context.enrichmentByOfficerId ?? new Map();

  const baseAudit = {
    query: request.query,
    timestampIso: request.nowIso ?? new Date().toISOString(),
    permissionScope: access.scopeLabels,
    client: request.client,
    persistReady: false as const,
  };

  if (!access.canSearch) {
    return {
      intent: "UNKNOWN",
      resultType: "error",
      totalCount: 0,
      items: [],
      actions: [],
      clarification: {
        reasonTh: "ไม่มีสิทธิ์ค้นหา",
        reasonEn: "Search permission denied",
        suggestionsTh: [],
      },
      permissionScope: access.scopeLabels,
      disclosureLevel: level,
      audit: { ...baseAudit, intent: "UNKNOWN" },
    };
  }

  const intentRes = resolveSearchIntent(request.query);
  const intent = intentRes.intent;
  const parsed = parseSearchQuery(request.query);
  const officers = filterOfficersForPrincipal(context.dataset.officers, access, permCtx);

  if (intent === "HELP") {
    return {
      intent,
      resultType: "help",
      totalCount: 0,
      items: [{ kind: "help", linesTh: HELP_LINES_TH }],
      actions: listActions(access),
      clarification: null,
      permissionScope: access.scopeLabels,
      disclosureLevel: level,
      audit: { ...baseAudit, intent },
    };
  }

  if (intent === "UNIT_LOOKUP") {
    if (!parsed.unit) {
      return emptyResult(request, intent, access.scopeLabels, "ไม่พบหน่วยงานจากคำค้น", "Could not normalize unit");
    }
    const unit = searchUnit(officers, parsed.unit);
    if (!unit) {
      return emptyResult(request, intent, access.scopeLabels, `ไม่พบข้อมูล${parsed.unit.labelTh}`, "Unit not found");
    }
    const actions: SearchAction[] = [
      {
        type: "view_unit",
        labelTh: "ดูหน่วยงาน",
        labelEn: "View Unit",
        payload: { unitKey: unit.key, level: unit.level },
      },
      ...listActions(access),
    ];
    return {
      intent,
      resultType: "unit_summary",
      totalCount: unit.officerCount,
      items: [unit],
      actions,
      clarification: null,
      permissionScope: access.scopeLabels,
      disclosureLevel: level,
      audit: { ...baseAudit, intent },
    };
  }

  if (intent === "PERSON_LOOKUP") {
    const matches = searchPersons(officers, enrichment, request.query);
    if (matches.length === 0) {
      return emptyResult(request, intent, access.scopeLabels, "ไม่พบรายชื่อที่ตรงกับคำค้น", "No person matches");
    }
    if (needsDisambiguation(matches, request.query)) {
      const sorted = sortDisambiguation(matches).slice(0, limit);
      const items = sorted.map((m) => formatPersonItem(m, level, access, permCtx));
      return {
        intent,
        resultType: "person_disambiguation",
        totalCount: matches.length,
        items,
        actions: [
          {
            type: "disambiguate",
            labelTh: "เลือกจากรายการ",
            labelEn: "Choose from list",
            payload: { count: matches.length },
          },
        ],
        clarification: {
          reasonTh: `พบชื่อหลายรายการ (${matches.length}) — โปรดระบุให้ชัดเจน`,
          reasonEn: `Multiple matches (${matches.length}) — please refine`,
          suggestionsTh: items.slice(0, 5).map((it, i) => formatDisambiguationLine(it, i + 1)),
        },
        permissionScope: access.scopeLabels,
        disclosureLevel: level,
        audit: { ...baseAudit, intent },
      };
    }
    const top = matches[0];
    const item = formatPersonItem(top, level, access, permCtx);
    return {
      intent,
      resultType: "person",
      totalCount: 1,
      items: [item],
      actions: buildPersonActions(top.officer.officerId, access, level),
      clarification: null,
      permissionScope: access.scopeLabels,
      disclosureLevel: level,
      audit: { ...baseAudit, intent },
    };
  }

  // List-style intents
  let list: CommanderQueryOfficer[] = [];
  let resultType: PersonnelSearchResult["resultType"] = "empty";
  let summarize: (o: CommanderQueryOfficer) => string = () => "";

  if (intent === "PROMOTION_SEARCH") {
    list = searchPromotion(officers, parsed);
    resultType = "promotion_list";
    summarize = promotionSummaryTh;
  } else if (intent === "RETIREMENT_SEARCH") {
    list = searchRetirement(officers, parsed);
    resultType = "retirement_list";
    summarize = retirementSummaryTh;
  } else if (intent === "TRAINING_SEARCH") {
    list = searchTraining(officers, parsed);
    resultType = "training_list";
    summarize = trainingSummaryTh;
  } else if (intent === "DOCUMENT_SEARCH") {
    list = searchDocuments(officers, parsed);
    resultType = "document_list";
    summarize = documentSummaryTh;
  } else if (intent === "DATA_QUALITY_SEARCH") {
    list = searchDataQuality(officers, parsed);
    resultType = "data_quality_list";
    summarize = dataQualitySummaryTh;
  } else if (intent === "CONTACT_SEARCH") {
    const items = searchContacts(officers, enrichment, parsed, access, permCtx).slice(0, limit);
    return {
      intent,
      resultType: "contact_list",
      totalCount: items.length,
      items,
      actions: listActions(access),
      clarification: items.length === 0
        ? {
            reasonTh: access.canViewContacts ? "ไม่พบผู้ติดต่อ" : "ไม่มีสิทธิ์ดูข้อมูลติดต่อ",
            reasonEn: access.canViewContacts ? "No contacts" : "Contact permission denied",
            suggestionsTh: [],
          }
        : null,
      permissionScope: access.scopeLabels,
      disclosureLevel: level,
      audit: { ...baseAudit, intent },
    };
  } else {
    return emptyResult(
      request,
      "UNKNOWN",
      access.scopeLabels,
      "ไม่เข้าใจคำค้น — พิมพ์ help เพื่อดูตัวอย่าง",
      "Unrecognized query — type help for examples"
    );
  }

  if (list.length === 0) {
    return emptyResult(request, intent, access.scopeLabels, "ไม่พบรายการที่ตรงเงื่อนไข", "No matching records");
  }

  const items = list.slice(0, limit).map((o) => listEntryFromOfficer(o, summarize(o), access, permCtx));
  return {
    intent,
    resultType,
    totalCount: list.length,
    items,
    actions: listActions(access),
    clarification: null,
    permissionScope: access.scopeLabels,
    disclosureLevel: level,
    audit: { ...baseAudit, intent },
  };
}
