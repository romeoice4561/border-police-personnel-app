/**
 * Deterministic search intent resolution (Phase 51).
 * Exactly one primary intent per request — no AI.
 */
import { normalizeUnitQuery } from "@/lib/personnel_search/normalizer";
import type { SearchIntent } from "@/lib/personnel_search/types";

export interface IntentResolution {
  intent: SearchIntent;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

const HELP_RE = /^(help|ช่วยเหลือ|วิธีใช้|คำสั่ง|เมนู|\?)$/i;

const PROMOTION_RE =
  /พร้อมเลื่อน|ครบคุณสมบัติ|ครบขึ้น|เลื่อนระดับ|eligible|promotion|ผกก\.?|รองผู้กำกับการ|ปีนี้|ปีหน้า|มาแล้ว/;

const RETIREMENT_RE = /เกษียณ|retirement|ใกล้เกษียณ|retire/;

const TRAINING_RE = /หลักสูตร|training|อบรม|สืบสวน|ผู้กำกับ/;

const DOCUMENT_RE = /เอกสาร|บัตรประชาชน|ใบขับขี่|หมดอายุ|document|id\s*card|license/;

const CONTACT_RE = /เบอร์|โทร|ติดต่อ|ผู้บังคับหน่วย|รองผู้กำกับ|duty\s*phone|contact|phone/;

const DATA_QUALITY_RE =
  /ข้อมูลไม่ครบ|ข้อมูลไม่สมบูรณ์|ไม่มีปีเริ่ม|ไม่มีระดับเป้าหมาย|unknown\s*promotion|data\s*quality|ประเมินไม่ได้/;

const PERSON_HINT_RE =
  /ชื่อ|นาย|พ\.?ต\.?|ร\.?ต\.?|ด\.?ต\.?|ส\.?ต\.?|นรต|รุ่น|officer|ชื่อเล่น/;

/**
 * Resolve exactly one primary intent from a raw query string.
 */
export function resolveSearchIntent(query: string): IntentResolution {
  const q = query.replace(/\s+/g, " ").trim();
  if (!q) {
    return { intent: "UNKNOWN", confidence: "low", reasons: ["empty_query"] };
  }
  if (HELP_RE.test(q)) {
    return { intent: "HELP", confidence: "high", reasons: ["help_keyword"] };
  }

  // Unit shorthand wins when the whole query (or dominant token) is a unit.
  const unit = normalizeUnitQuery(q);
  if (unit && !PERSON_HINT_RE.test(q) && !PROMOTION_RE.test(q) && !RETIREMENT_RE.test(q)) {
    return { intent: "UNIT_LOOKUP", confidence: "high", reasons: ["unit_normalized", unit.key] };
  }

  // Specific domain intents — order matters (more specific before person).
  if (DATA_QUALITY_RE.test(q)) {
    return { intent: "DATA_QUALITY_SEARCH", confidence: "high", reasons: ["data_quality_keyword"] };
  }
  if (CONTACT_RE.test(q) && !PROMOTION_RE.test(q)) {
    return { intent: "CONTACT_SEARCH", confidence: "high", reasons: ["contact_keyword"] };
  }
  if (DOCUMENT_RE.test(q) && !PROMOTION_RE.test(q)) {
    return { intent: "DOCUMENT_SEARCH", confidence: "high", reasons: ["document_keyword"] };
  }
  // Training vs promotion: "ขาดหลักสูตร" is both — prefer PROMOTION when paired with promotion words.
  if (TRAINING_RE.test(q)) {
    if (/ขาดหลักสูตร/.test(q) && /พร้อมเลื่อน|ครบคุณสมบัติ|เลื่อน/.test(q)) {
      return { intent: "PROMOTION_SEARCH", confidence: "high", reasons: ["promotion_missing_training"] };
    }
    if (/ขาดหลักสูตร/.test(q) && PROMOTION_RE.test(q)) {
      return { intent: "PROMOTION_SEARCH", confidence: "medium", reasons: ["promotion_training_overlap"] };
    }
    // Bare "ขาดหลักสูตร" → promotion (uses PromotionSummary.MissingTraining) per product examples.
    if (/^ขาดหลักสูตร$/.test(q)) {
      return { intent: "PROMOTION_SEARCH", confidence: "high", reasons: ["missing_training_as_promotion"] };
    }
    return { intent: "TRAINING_SEARCH", confidence: "high", reasons: ["training_keyword"] };
  }
  if (PROMOTION_RE.test(q)) {
    return { intent: "PROMOTION_SEARCH", confidence: "high", reasons: ["promotion_keyword"] };
  }
  if (RETIREMENT_RE.test(q)) {
    return { intent: "RETIREMENT_SEARCH", confidence: "high", reasons: ["retirement_keyword"] };
  }

  if (unit) {
    return { intent: "UNIT_LOOKUP", confidence: "medium", reasons: ["unit_normalized_fallback", unit.key] };
  }

  // Default: person lookup for name-like / id-like queries.
  if (PERSON_HINT_RE.test(q) || /[ก-๙]{2,}/.test(q) || /\/\d+/.test(q)) {
    return { intent: "PERSON_LOOKUP", confidence: "medium", reasons: ["person_default"] };
  }

  return { intent: "UNKNOWN", confidence: "low", reasons: ["unrecognized"] };
}
