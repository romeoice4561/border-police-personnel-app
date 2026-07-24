/**
 * Structured token extraction from free-text queries (Phase 51).
 */
import { normalizePersonQuery, normalizeUnitQuery } from "@/lib/personnel_search/normalizer";
import type { NormalizedPersonQuery, NormalizedUnitRef } from "@/lib/personnel_search/types";

export interface ParsedSearchQuery {
  raw: string;
  unit: NormalizedUnitRef | null;
  person: NormalizedPersonQuery;
  /** Buddhist-Era year when present (e.g. เกษียณปี2570). */
  yearBe: number | null;
  /** Horizon in years when present (e.g. เกษียณ3ปี). */
  horizonYears: number | null;
  targetLevelHint: string | null;
  flags: {
    promotionReadyThisYear: boolean;
    promotionReadyNextYear: boolean;
    alreadyEligible: boolean;
    missingTraining: boolean;
    missingDocuments: boolean;
    nearRetirementCollision: boolean;
    missingLevelStart: boolean;
    missingTarget: boolean;
    incompleteData: boolean;
  };
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const q = raw.replace(/\s+/g, " ").trim();
  const yearBeMatch = q.match(/(?:ปี|พ\.?ศ\.?)\s*(25\d{2})/) || q.match(/(25\d{2})/);
  const horizonMatch = q.match(/(\d+)\s*ปี/);
  const yearBe = yearBeMatch ? Number(yearBeMatch[1]) : null;
  let horizonYears: number | null = null;
  if (horizonMatch && !yearBeMatch?.[0]?.includes(horizonMatch[1])) {
    const n = Number(horizonMatch[1]);
    if (n >= 1 && n <= 10) horizonYears = n;
  }
  if (/เกษียณ\s*3\s*ปี|ภายใน\s*3\s*ปี/.test(q)) horizonYears = 3;
  if (/เกษียณ\s*1\s*ปี|ภายใน\s*1\s*ปี/.test(q)) horizonYears = 1;
  if (/เกษียณ\s*5\s*ปี|ภายใน\s*5\s*ปี/.test(q)) horizonYears = 5;

  let targetLevelHint: string | null = null;
  if (/ผกก|ผู้กำกับการ/.test(q) && !/รองผู้กำกับการ|รอง\s*ผกก/.test(q)) {
    targetLevelHint = "ผู้กำกับการ";
  } else if (/รองผู้กำกับการ|รอง\s*ผกก/.test(q)) {
    targetLevelHint = "รองผู้กำกับการ";
  }

  return {
    raw: q,
    unit: normalizeUnitQuery(q),
    person: normalizePersonQuery(q),
    yearBe,
    horizonYears,
    targetLevelHint,
    flags: {
      promotionReadyThisYear: /ปีนี้|this\s*year|eligible\s*this\s*year|ครบคุณสมบัติในปีนี้|พร้อมเลื่อนปีนี้/.test(q),
      promotionReadyNextYear: /ปีหน้า|next\s*year|พร้อมเลื่อนปีหน้า|จะครบในปีหน้า/.test(q),
      alreadyEligible: /มาแล้ว|already\s*eligible|ครบคุณสมบัติมาแล้ว|overdue/.test(q),
      missingTraining: /ขาดหลักสูตร|missing\s*training/.test(q),
      missingDocuments: /ขาดเอกสาร|missing\s*documents?/.test(q),
      nearRetirementCollision: /พร้อมเลื่อน.*เกษียณ|เกษียณ.*พร้อมเลื่อน|ใกล้เกษียณ/.test(q),
      missingLevelStart: /ไม่มีปีเริ่ม|missing\s*level\s*start|ปีเริ่มดำรงระดับ/.test(q),
      missingTarget: /ไม่มีระดับเป้าหมาย|no\s*target|missing\s*target/.test(q),
      incompleteData: /ข้อมูลไม่ครบ|ข้อมูลไม่สมบูรณ์|incomplete/.test(q),
    },
  };
}
