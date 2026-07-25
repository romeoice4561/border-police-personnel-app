/**
 * Personnel Search Gateway — single entry point for all clients (Phase 51 / 51.1A).
 *
 * Telegram / LINE / Web / Assistant
 *   → Entity Resolver
 *   → searchPersonnel()
 *   → Commander dataset
 *
 * No messaging platform logic lives here.
 */
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { OrgTree } from "@/lib/organization/org_tree";
import type {
  PersonnelSearchConversationContext,
  ResolvedEntity,
} from "@/lib/personnel_entities/contracts";
import { resolvePersonnelEntities } from "@/lib/personnel_entities/resolver";
import { buildUnitSuggestionActions } from "@/lib/personnel_entities/suggestions";
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
import { filterOfficersByResolvedOrg, searchUnit } from "@/lib/personnel_search/search_unit";
import type { DisclosureLevel } from "@/lib/personnel_search/types";
import { buildOrgEntityCatalog, lookupOrgByInternalId } from "@/lib/personnel_entities/organization";

export interface PersonnelSearchContext {
  dataset: CommanderQueryDataset;
  /** Optional nickname / phone enrichment keyed by officerId. */
  enrichmentByOfficerId?: ReadonlyMap<string, PersonnelSearchEnrichment>;
  /** OrgTree snapshot for public-code → internal-id resolution (Phase 51.1A). */
  organizationTree?: OrgTree | null;
  /** Optional prior conversation scope — not persisted in this phase. */
  conversationContext?: PersonnelSearchConversationContext | null;
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

function publicCodesForOfficer(
  officer: CommanderQueryOfficer,
  catalog: ReturnType<typeof buildOrgEntityCatalog>
): { regionCode: string | null; divisionCode: string | null; companyCode: string | null } {
  return {
    regionCode:
      officer.regionId != null
        ? lookupOrgByInternalId(catalog, "region", officer.regionId)?.publicCode ?? null
        : null,
    divisionCode:
      officer.battalionId != null
        ? lookupOrgByInternalId(catalog, "division", officer.battalionId)?.publicCode ?? null
        : null,
    companyCode:
      officer.companyId != null
        ? lookupOrgByInternalId(catalog, "company", officer.companyId)?.publicCode ?? null
        : null,
  };
}

/**
 * Execute a personnel search against the commander dataset (+ optional enrichment).
 * Flow: Intent → Entity Resolver → Search → Permission → Formatter.
 */
export function searchPersonnel(
  request: PersonnelSearchRequest,
  context: PersonnelSearchContext
): PersonnelSearchResult {
  const level = (request.disclosureLevel ?? 1) as DisclosureLevel;
  const limit = Math.min(Math.max(request.limit ?? 20, 1), 50);
  const offset = Math.max(0, request.offset ?? 0);
  const permCtx: SearchPermissionContext = {
    permissions: request.permissions,
    subjectOfficerId: request.subjectOfficerId ?? null,
  };
  const access = resolveFieldAccess(permCtx);
  const enrichment = context.enrichmentByOfficerId ?? new Map();
  const catalog = buildOrgEntityCatalog(context.organizationTree);
  const orgPublicFor = (officer: CommanderQueryOfficer) => publicCodesForOfficer(officer, catalog);

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
  const resolution = resolvePersonnelEntities(request.query, {
    catalog,
    conversationContext: context.conversationContext,
  });

  if (resolution.clarification) {
    return {
      intent: intent === "UNKNOWN" ? "UNIT_LOOKUP" : intent,
      resultType: "empty",
      totalCount: 0,
      items: [],
      actions: [{ type: "disambiguate", labelTh: "เลือกหน่วยงาน", labelEn: "Choose unit", payload: {} }],
      clarification: {
        reasonTh: resolution.clarification.reasonTh,
        reasonEn: resolution.clarification.reasonEn,
        suggestionsTh: resolution.clarification.suggestionsTh,
      },
      permissionScope: access.scopeLabels,
      disclosureLevel: level,
      audit: { ...baseAudit, intent: intent === "UNKNOWN" ? "UNIT_LOOKUP" : intent },
    };
  }

  let officers = filterOfficersForPrincipal(context.dataset.officers, access, permCtx);
  const orgEntity: ResolvedEntity | null = resolution.primaryOrganization;

  // Scope list / person searches when an organization entity is present in the query (or context).
  if (
    orgEntity &&
    intent !== "UNIT_LOOKUP" &&
    intent !== "HELP" &&
    (parsed.unit != null || resolution.primaryOrganization?.confidence === "context")
  ) {
    officers = filterOfficersByResolvedOrg(officers, orgEntity);
  }

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
    if (!orgEntity || orgEntity.internalNumericId == null) {
      const label = parsed.unit?.labelTh ?? "หน่วยงาน";
      return emptyResult(
        request,
        intent,
        access.scopeLabels,
        `ไม่พบข้อมูล${label}`,
        "Unit not found or organization catalog unavailable"
      );
    }
    const unit = searchUnit(officers, orgEntity);
    if (!unit) {
      return emptyResult(
        request,
        intent,
        access.scopeLabels,
        `ไม่พบข้อมูล${orgEntity.displayName}`,
        "Unit not found"
      );
    }
    const actions: SearchAction[] = [
      ...buildUnitSuggestionActions(orgEntity),
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
      const pageOffset = offset > 0 ? offset : 0;
      const sorted = sortDisambiguation(matches).slice(pageOffset, pageOffset + limit);
      const items = sorted.map((m) => formatPersonItem(m, level, access, permCtx, orgPublicFor(m.officer)));
      const showClarification = offset === 0;
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
        clarification: showClarification
          ? {
              reasonTh: `พบชื่อหลายรายการ (${matches.length}) — โปรดระบุให้ชัดเจน`,
              reasonEn: `Multiple matches (${matches.length}) — please refine`,
              suggestionsTh: items.slice(0, 5).map((it, i) => formatDisambiguationLine(it, i + 1)),
            }
          : null,
        permissionScope: access.scopeLabels,
        disclosureLevel: level,
        audit: { ...baseAudit, intent },
      };
    }
    const top = matches[0];
    const item = formatPersonItem(top, level, access, permCtx, orgPublicFor(top.officer));
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

  // List-style intents — optionally scoped by resolved organization in the query.
  let scopedOfficers = officers;
  if (orgEntity && parsed.unit != null) {
    scopedOfficers = filterOfficersByResolvedOrg(officers, orgEntity);
  }

  let list: CommanderQueryOfficer[] = [];
  let resultType: PersonnelSearchResult["resultType"] = "empty";
  let summarize: (o: CommanderQueryOfficer) => string = () => "";

  if (intent === "PROMOTION_SEARCH") {
    list = searchPromotion(scopedOfficers, parsed);
    resultType = "promotion_list";
    summarize = promotionSummaryTh;
  } else if (intent === "RETIREMENT_SEARCH") {
    list = searchRetirement(scopedOfficers, parsed);
    resultType = "retirement_list";
    summarize = retirementSummaryTh;
  } else if (intent === "TRAINING_SEARCH") {
    list = searchTraining(scopedOfficers, parsed);
    resultType = "training_list";
    summarize = trainingSummaryTh;
  } else if (intent === "DOCUMENT_SEARCH") {
    list = searchDocuments(scopedOfficers, parsed);
    resultType = "document_list";
    summarize = documentSummaryTh;
  } else if (intent === "DATA_QUALITY_SEARCH") {
    list = searchDataQuality(scopedOfficers, parsed);
    resultType = "data_quality_list";
    summarize = dataQualitySummaryTh;
  } else if (intent === "CONTACT_SEARCH") {
    const all = searchContacts(scopedOfficers, enrichment, parsed, access, permCtx);
    const items = all.slice(offset, offset + limit);
    return {
      intent,
      resultType: "contact_list",
      totalCount: all.length,
      items,
      actions: listActions(access),
      clarification: all.length === 0
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

  const items = list
    .slice(offset, offset + limit)
    .map((o) => listEntryFromOfficer(o, summarize(o), access, permCtx));
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
