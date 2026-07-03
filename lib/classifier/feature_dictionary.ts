/**
 * Feature dictionary (Phase 10B).
 *
 * The weighted vocabulary the FeatureScoreEngine scores against. Each entry
 * describes ONE feature: what it detects in normalized OCR text (or layout
 * signals), which category it votes for, its weight, and its confidence
 * impact. Grounded in the real OCR output observed in Phase 10A (Thai Border
 * Patrol profile cards: officer ranks like "พ.ต.ท.", unit tokens like
 * "ตชด."/"ร้อย"/"กก."/"บก.", phone numbers, etc.), and tolerant of OCR noise
 * (see text_feature_extractor.ts, which normalizes before matching).
 *
 * Pure data + small pure detector predicates — no I/O, no OCR, no OpenAI.
 * Kept separate from the engine so weights/keywords can be tuned without
 * touching scoring logic, and so the dictionary is independently testable.
 */

import type { ImageCategory } from "@/lib/classifier/classification_types";
import type { FeatureCategory } from "@/lib/classifier/classification_score";

/**
 * A textual feature definition. `patterns` are matched against the
 * already-normalized text; `countMatches` (default) tallies every pattern
 * occurrence so repeated signals (e.g. many ranks on an org chart) scale.
 */
export interface TextFeatureDefinition {
  id: string;
  category: FeatureCategory;
  votesFor: ImageCategory;
  weight: number;
  confidenceImpact: number;
  /** Regexes tested against normalized text; each global regex's match count contributes. */
  patterns: RegExp[];
  /** When true, weight is applied once regardless of occurrence count (for structural one-shot signals). */
  onceOnly?: boolean;
  reason: string;
}

/**
 * Thai Border Patrol Police officer ranks (พ.ต.อ. down to ส.ต.ต.), written
 * with the dotted abbreviations that appear on the cards. OCR frequently
 * drops or merges the trailing dots, so patterns tolerate optional dots and
 * spacing (handled by normalization + `\.?`).
 */
const RANK_PATTERNS: RegExp[] = [
  /พ\.?ต\.?อ\.?/g, // พ.ต.อ. (police colonel)
  /พ\.?ต\.?ท\.?/g, // พ.ต.ท.
  /พ\.?ต\.?ต\.?/g, // พ.ต.ต.
  /ร\.?ต\.?อ\.?/g, // ร.ต.อ.
  /ร\.?ต\.?ท\.?/g, // ร.ต.ท.
  /ร\.?ต\.?ต\.?/g, // ร.ต.ต.
  /ด\.?ต\.?/g, // ด.ต. (senior sergeant major)
  /จ\.?ส\.?ต\.?/g, // จ.ส.ต.
  /ส\.?ต\.?อ\.?/g, // ส.ต.อ.
  /ส\.?ต\.?ท\.?/g, // ส.ต.ท.
  /ส\.?ต\.?ต\.?/g, // ส.ต.ต.
  /พล\.?ต\.?[ตท]\.?/g, // พล.ต.ต. / พล.ต.ท. (general officer ranks)
];

/** Police / command-structure abbreviations that appear on personnel records. */
const POLICE_ABBREVIATION_PATTERNS: RegExp[] = [
  /ผกก\.?/g, // ผู้กำกับการ (superintendent)
  /รอง ?ผกก\.?/g, // deputy superintendent
  /สว\.?/g, // สารวัตร (inspector)
  /รอง ?สว\.?/g,
  /ผบ\.?ร้อย/g, // company commander
  /หน\.?ร้อย/g, // head of company
];

/** Border Patrol Police unit tokens — the strongest domain signal. */
const BORDER_PATROL_PATTERNS: RegExp[] = [
  /ตชด\.?/g, // ตำรวจตระเวนชายแดน (Border Patrol Police)
  /กองร้อย ?ตชด/g,
  /ร้อย ?ตชด/g,
  /บก\.?ตชด/g,
  /กก\.?ตชด/g,
];

/** Thai/Arabic phone numbers, incl. the 0X-XXXXXXX / 0XX-XXX-XXXX forms and Thai-numeral variants (normalized to Arabic first). */
const PHONE_PATTERNS: RegExp[] = [/0\d{1,2}[- ]?\d{3}[- ]?\d{3,4}/g];

/** The full weighted dictionary. Positive weights push toward a category; negatives push away. */
export const TEXT_FEATURE_DEFINITIONS: TextFeatureDefinition[] = [
  {
    id: "rank_officer",
    category: "rank",
    votesFor: "PERSONNEL_PROFILE",
    weight: 30,
    confidenceImpact: 20,
    patterns: RANK_PATTERNS,
    reason: "Detected officer rank abbreviation(s)",
  },
  {
    id: "police_abbreviation",
    category: "police_abbreviation",
    votesFor: "PERSONNEL_PROFILE",
    weight: 12,
    confidenceImpact: 8,
    patterns: POLICE_ABBREVIATION_PATTERNS,
    reason: "Detected police command/position abbreviation(s)",
  },
  {
    id: "border_patrol_unit",
    category: "border_patrol",
    votesFor: "PERSONNEL_PROFILE",
    weight: 18,
    confidenceImpact: 12,
    patterns: BORDER_PATROL_PATTERNS,
    reason: "Detected Border Patrol Police unit token(s) (ตชด.)",
  },
  {
    id: "phone_number",
    category: "phone",
    votesFor: "PERSONNEL_PROFILE",
    weight: 15,
    confidenceImpact: 10,
    patterns: PHONE_PATTERNS,
    reason: "Detected phone number(s)",
  },
  {
    id: "timeline_indicator",
    category: "timeline",
    votesFor: "TIMELINE",
    weight: 20,
    confidenceImpact: 12,
    patterns: [/timeline/gi, /รับราชการ/g, /ประวัติ ?การ ?รับราชการ/g, /ดำรง ?ตำแหน่ง/g],
    reason: "Detected career-timeline indicator(s)",
  },
  {
    id: "organization_indicator",
    category: "organization",
    votesFor: "ORGANIZATION_CHART",
    weight: 40,
    confidenceImpact: 25,
    patterns: [/ผังการ ?จัด/g, /โครงสร้าง/g, /ระดับ ?บก\.?/g, /ระดับ ?กก\.?/g, /แผนผัง/g, /ผัง(?!\s*งาน)/g],
    reason: "Detected organization-chart indicator(s)",
  },
  {
    id: "title_indicator",
    category: "title",
    votesFor: "TITLE_PAGE",
    weight: 30,
    confidenceImpact: 18,
    patterns: [/เฉพาะตราหน่วย/g, /ตราสัญลักษณ์/g],
    reason: "Detected title-page indicator(s)",
  },
  {
    id: "cover_indicator",
    category: "cover",
    votesFor: "COVER_PAGE",
    weight: 45,
    confidenceImpact: 28,
    patterns: [/คำนำ/g, /บทนำ/g, /จัดทำโดย/g],
    reason: "Detected cover-page indicator(s)",
  },
  {
    id: "toc_indicator",
    category: "toc",
    votesFor: "INDEX_PAGE",
    weight: 45,
    confidenceImpact: 28,
    patterns: [/สารบัญ/g, /สารบัญ ?ตาราง/g, /หน้าที่ \d+/g],
    reason: "Detected table-of-contents indicator(s)",
  },
];

/**
 * Negative cross-features: signals that ARGUE AGAINST personnel profile even
 * when a rank happens to appear (e.g. an org chart lists many ranks). These
 * subtract from PERSONNEL_PROFILE so a page dense with structure keywords is
 * not misread as an individual's card.
 */
export const NEGATIVE_FEATURE_DEFINITIONS: TextFeatureDefinition[] = [
  {
    id: "org_penalizes_personnel",
    category: "organization",
    votesFor: "PERSONNEL_PROFILE",
    weight: -40,
    confidenceImpact: 0,
    patterns: [/ผังการ ?จัด/g, /โครงสร้าง/g, /แผนผัง/g],
    onceOnly: true,
    reason: "Organization-chart structure keywords argue against an individual profile",
  },
  {
    id: "cover_penalizes_personnel",
    category: "cover",
    votesFor: "PERSONNEL_PROFILE",
    weight: -60,
    confidenceImpact: 0,
    patterns: [/คำนำ/g, /จัดทำโดย/g],
    onceOnly: true,
    reason: "Cover-page keywords argue against an individual profile",
  },
];
