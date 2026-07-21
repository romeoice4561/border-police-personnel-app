/**
 * Deterministic document type detection (Phase 48 — spec §10).
 *
 * Keyword/pattern matching over normalized OCR text — no AI. Every
 * supported type gets a small set of signals (Thai/English keywords, known
 * document-number patterns); the type with the most/strongest matched
 * signals wins. AI is never used for a clear deterministic match — the
 * pipeline only escalates when this detector returns "UNKNOWN" or a low
 * confidence (see ai_gate.ts's UNKNOWN_DOCUMENT_TYPE reason).
 *
 * Pure — no I/O, no React.
 */

export type SupportedDocumentTypeCode =
  | "GP7"
  | "NATIONAL_ID"
  | "DRIVER_LICENSE"
  | "PASSPORT"
  | "MEDICAL_DOCUMENT"
  | "TRAINING_CERTIFICATE"
  | "EDUCATION_CERTIFICATE"
  | "AWARD"
  | "SALARY_DOCUMENT"
  | "ANNUAL_EVALUATION"
  | "FIREARMS_QUALIFICATION"
  | "UNKNOWN";

export interface DocumentTypeSignal {
  type: SupportedDocumentTypeCode;
  /** What matched — a keyword, a regex name, etc. — for the review UI's "matched signals" display. */
  signal: string;
  /** Relative weight of this signal toward its type's score. */
  weight: number;
}

export interface DetectedDocumentType {
  type: SupportedDocumentTypeCode;
  /** 0-1, derived from the winning type's total matched weight relative to its max possible weight. */
  confidence: number;
  matchedSignals: DocumentTypeSignal[];
  /** Other candidate types that also matched at least one signal, most-likely first — populated only when detection is ambiguous (more than one type scored above zero). */
  alternatives: Array<{ type: SupportedDocumentTypeCode; confidence: number }>;
}

interface TypeRule {
  type: SupportedDocumentTypeCode;
  /** Each entry: [regex, signal label, weight]. Matched case-insensitively against normalized text. */
  patterns: Array<{ pattern: RegExp; signal: string; weight: number }>;
  /** Sum of all weights for this type — used to normalize the score to 0-1. */
  maxWeight: number;
}

function rule(type: SupportedDocumentTypeCode, patterns: Array<{ pattern: RegExp; signal: string; weight: number }>): TypeRule {
  return { type, patterns, maxWeight: patterns.reduce((sum, p) => sum + p.weight, 0) };
}

/**
 * One rule set per supported type. Weights are hand-tuned toward "a single
 * strong, near-unique signal (e.g. a document title or a numbered-ID
 * pattern) should be enough to classify confidently" — GP7's Thai official
 * form title, a 13-digit Thai ID pattern, "PASSPORT" + an MRZ-like line,
 * etc.
 */
const TYPE_RULES: readonly TypeRule[] = [
  rule("GP7", [
    { pattern: /ก\.?พ\.?\s*7/i, signal: "ก.พ.7 form title", weight: 5 },
    { pattern: /ประวัติข้าราชการ/i, signal: "ประวัติข้าราชการ (personnel history)", weight: 3 },
  ]),
  rule("NATIONAL_ID", [
    { pattern: /บัตรประจำตัวประชาชน/i, signal: "บัตรประจำตัวประชาชน title", weight: 5 },
    { pattern: /identification card/i, signal: "'Identification Card' title", weight: 4 },
    { pattern: /\b\d{1}\s?\d{4}\s?\d{5}\s?\d{2}\s?\d{1}\b/, signal: "13-digit Thai ID number pattern", weight: 4 },
    { pattern: /เลขประจำตัวประชาชน/i, signal: "เลขประจำตัวประชาชน label", weight: 3 },
  ]),
  rule("DRIVER_LICENSE", [
    { pattern: /ใบอนุญาตขับ(ขี่|รถ)/i, signal: "ใบอนุญาตขับขี่ title", weight: 5 },
    { pattern: /driving licen[cs]e/i, signal: "'Driving License' title", weight: 4 },
    { pattern: /ชนิด(ที่)?\s*[1-5ก-ฮ]/i, signal: "license class marker", weight: 2 },
  ]),
  rule("PASSPORT", [
    { pattern: /passport/i, signal: "'Passport' title", weight: 5 },
    { pattern: /หนังสือเดินทาง/i, signal: "หนังสือเดินทาง title", weight: 5 },
    { pattern: /[A-Z][<]{2,}[A-Z<]+/i, signal: "MRZ-like line", weight: 3 },
  ]),
  rule("MEDICAL_DOCUMENT", [
    { pattern: /ใบรับรองแพทย์/i, signal: "ใบรับรองแพทย์ title", weight: 5 },
    { pattern: /medical certificate/i, signal: "'Medical Certificate' title", weight: 4 },
  ]),
  rule("TRAINING_CERTIFICATE", [
    { pattern: /ประกาศนียบัตร.*ฝึกอบรม|ฝึกอบรม.*ประกาศนียบัตร/i, signal: "training certificate title", weight: 5 },
    { pattern: /certificate of (completion|training)/i, signal: "'Certificate of Training/Completion'", weight: 4 },
    { pattern: /หลักสูตร/i, signal: "หลักสูตร (course) label", weight: 2 },
  ]),
  rule("EDUCATION_CERTIFICATE", [
    { pattern: /ปริญญา|วุฒิการศึกษา/i, signal: "degree/qualification wording", weight: 4 },
    { pattern: /diploma|degree|transcript/i, signal: "'Diploma/Degree/Transcript'", weight: 4 },
    { pattern: /มหาวิทยาลัย|สถาบัน/i, signal: "university/institute label", weight: 2 },
  ]),
  rule("AWARD", [
    { pattern: /เกียรติบัตร/i, signal: "เกียรติบัตร (award) title", weight: 5 },
    { pattern: /certificate of (achievement|appreciation|merit)/i, signal: "'Certificate of Achievement/Merit'", weight: 4 },
  ]),
  rule("SALARY_DOCUMENT", [
    { pattern: /เงินเดือน/i, signal: "เงินเดือน (salary) label", weight: 4 },
    { pattern: /slip|payroll|salary statement/i, signal: "payroll wording", weight: 3 },
  ]),
  rule("ANNUAL_EVALUATION", [
    { pattern: /แบบประเมิน/i, signal: "แบบประเมิน (evaluation form) title", weight: 5 },
    { pattern: /performance evaluation|appraisal/i, signal: "performance evaluation wording", weight: 4 },
  ]),
  rule("FIREARMS_QUALIFICATION", [
    { pattern: /อาวุธปืน/i, signal: "อาวุธปืน (firearms) label", weight: 4 },
    { pattern: /firearms? qualification/i, signal: "'Firearms Qualification'", weight: 5 },
  ]),
];

/**
 * Detects the document type from normalized OCR text. Returns "UNKNOWN"
 * with confidence 0 when no rule matched at all — never guesses a type
 * with zero evidence.
 */
export function detectDocumentType(normalizedText: string): DetectedDocumentType {
  const scores = TYPE_RULES.map((typeRule) => {
    const matched: DocumentTypeSignal[] = [];
    let totalWeight = 0;
    for (const p of typeRule.patterns) {
      if (p.pattern.test(normalizedText)) {
        matched.push({ type: typeRule.type, signal: p.signal, weight: p.weight });
        totalWeight += p.weight;
      }
    }
    return {
      type: typeRule.type,
      confidence: typeRule.maxWeight > 0 ? Math.min(1, totalWeight / typeRule.maxWeight) : 0,
      matchedSignals: matched,
    };
  }).filter((s) => s.matchedSignals.length > 0);

  if (scores.length === 0) {
    return { type: "UNKNOWN", confidence: 0, matchedSignals: [], alternatives: [] };
  }

  scores.sort((a, b) => b.confidence - a.confidence);
  const winner = scores[0];
  const alternatives = scores.slice(1).map((s) => ({ type: s.type, confidence: s.confidence }));

  return {
    type: winner.type,
    confidence: winner.confidence,
    matchedSignals: winner.matchedSignals,
    alternatives,
  };
}
