/**
 * Personnel Search Gateway — request/response contracts (Phase 51).
 * All clients (Telegram / LINE / Web / Assistant) consume these shapes.
 */
import type { Permission } from "@/lib/auth/roles";
import type {
  DisclosureLevel,
  MatchKind,
  SearchClient,
  SearchIntent,
  SearchResultType,
  UnitLevel,
} from "@/lib/personnel_search/types";

export type SearchActionType =
  | "open_profile"
  | "view_promotion"
  | "view_timeline"
  | "view_training"
  | "view_documents"
  | "view_unit"
  | "open_dashboard"
  | "export"
  | "disambiguate"
  | "refine_query";

export interface SearchAction {
  type: SearchActionType;
  labelTh: string;
  labelEn: string;
  /** Opaque payload the client maps to its own navigation / reply buttons. */
  payload: Record<string, string | number | boolean | null>;
}

export interface SearchClarification {
  reasonTh: string;
  reasonEn: string;
  suggestionsTh: string[];
}

export interface SearchAuditMeta {
  query: string;
  intent: SearchIntent;
  timestampIso: string;
  permissionScope: string[];
  client: SearchClient;
  /** Prepared for future persistence — not stored in Phase 51. */
  persistReady: false;
}

export interface PersonnelSearchRequest {
  query: string;
  client: SearchClient;
  /** Effective permissions for the calling principal. */
  permissions: readonly Permission[];
  /** Optional role label for audit/display only — never used as an ACL bypass. */
  role?: string | null;
  /** Subject officer id when the principal is an ownership-scoped officer. */
  subjectOfficerId?: string | null;
  disclosureLevel?: DisclosureLevel;
  /** Hard cap on list items (disambiguation / lists). */
  limit?: number;
  /**
   * Zero-based offset into the ranked result list (Phase 51.1 pagination).
   * Ignored for unit summaries, help, and single exact person matches.
   */
  offset?: number;
  /** ISO timestamp override for tests. */
  nowIso?: string;
}

/**
 * Optional enrichment not present on CommanderQueryOfficer today
 * (nickname / phones). Clients/adapters supply these without changing
 * CommanderQueryDataset contracts.
 */
export interface PersonnelSearchEnrichment {
  nickname?: string | null;
  phones?: string[];
  dutyPhone?: string | null;
}

export interface PersonnelSearchPersonItem {
  kind: "person";
  officerId: string;
  /** Masked when the principal lacks officers.view / ownership. */
  officerIdDisplay: string;
  rank: string;
  fullName: string;
  nickname: string | null;
  currentPosition: string | null;
  unitLabel: string;
  /**
   * Public organization codes for clients. Internal DB FKs are not exposed.
   */
  organizationPublic: {
    regionCode: string | null;
    divisionCode: string | null;
    companyCode: string | null;
  };
  academyClass: number | null;
  matchKind: MatchKind;
  matchScore: number;
  /**
   * Level 2+ intelligence snippets (permission-filtered).
   * Tenure / eligibility scalars are a curated copy of CommanderQueryOfficer +
   * PromotionSummary fields already computed by toQueryOfficer — never recalculated here.
   */
  intelligence?: {
    /** CommanderQueryOfficer.positionLevel */
    positionLevel: string | null;
    /** CommanderQueryOfficer.positionLevelYearCount */
    positionLevelYearCount: number | null;
    /** CommanderQueryOfficer.positionLevelStartYearBe */
    positionLevelStartYearBe: number | null;
    promotionStatusTh: string | null;
    promotionStatus: string | null;
    /** PromotionSummary.firstEligibleDate */
    firstEligibleDate: string | null;
    /** PromotionSummary.firstEligibleYearBe */
    firstEligibleYearBe: number | null;
    /** PromotionSummary.firstEligibleFiscalYearBe */
    firstEligibleFiscalYearBe: number | null;
    /** PromotionSummary.promotionCyclesPassed */
    promotionCyclesPassed: number | null;
    /** PromotionSummary.requiredTenureYears */
    requiredTenureYears: number | null;
    retirementYearBe: number | null;
    retirementStatus: string | null;
    trainingStatusTh: string | null;
    documentReadinessTh: string | null;
    dataQualityNotesTh: string[];
  };
  /** Level 3 only — Web UI deep links. */
  links?: {
    profileHref: string;
    promotionHref: string | null;
  };
}

export interface PersonnelSearchUnitItem {
  kind: "unit";
  level: UnitLevel;
  key: string;
  labelTh: string;
  /** Public organization code (e.g. "414") — never an internal FK. */
  publicCode: string;
  commanderName: string | null;
  deputyNames: string[];
  officerCount: number;
  policeCount: number;
  promotionReadyCount: number;
  retirementNearCount: number;
  incompleteDataCount: number;
  topContacts: Array<{ labelTh: string; value: string }>;
}

export interface PersonnelSearchListItem {
  kind: "list_entry";
  officerId: string;
  officerIdDisplay: string;
  rank: string;
  fullName: string;
  unitLabel: string;
  summaryTh: string;
  matchScore: number;
}

export type PersonnelSearchItem =
  | PersonnelSearchPersonItem
  | PersonnelSearchUnitItem
  | PersonnelSearchListItem
  | { kind: "help"; linesTh: string[] };

export interface PersonnelSearchResult {
  intent: SearchIntent;
  resultType: SearchResultType;
  totalCount: number;
  items: PersonnelSearchItem[];
  actions: SearchAction[];
  clarification: SearchClarification | null;
  permissionScope: string[];
  disclosureLevel: DisclosureLevel;
  audit: SearchAuditMeta;
}
