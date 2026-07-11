/**
 * Bilingual label infrastructure (Phase 26B Part 5 Part K).
 *
 * "Every label must display Thai / English... Prepare infrastructure for
 * future language switching. Do NOT duplicate components." This module is
 * the single source of truth for a field label's Thai + English text pair —
 * components render it via the shared <BilingualLabel> primitive
 * (components/ui/bilingual_label.tsx), never by hand-writing "ไทย / English"
 * strings inline. Centralizing labels here (rather than scattering "th"/"en"
 * strings across every section component) is what makes a future language
 * switcher a matter of changing ONE rendering rule (which half of the pair
 * to show), not touching every component.
 *
 * Pure data — no I/O, no React.
 */

export interface BilingualText {
  th: string;
  en: string;
}

/** Builds a bilingual label pair. Trivial today; the seam every label goes through. */
export function bilingual(th: string, en: string): BilingualText {
  return { th, en };
}

/**
 * Formats a bilingual pair as "ไทย / English" (this phase's default display
 * mode — both languages always visible, per Part K). A future language
 * switcher changes ONLY this function (or the component that calls it) to
 * show a single language instead of rewriting every call site.
 */
export function formatBilingual(text: BilingualText): string {
  return `${text.th} / ${text.en}`;
}

/**
 * Central registry of every field label introduced or touched by Phase 26B
 * Part 5, keyed by a stable field id. Reusing an entry (rather than calling
 * bilingual() inline at each usage site) means the SAME field always reads
 * identically everywhere it appears (header, editor, viewer).
 */
export const FIELD_LABELS = {
  // Part A — header
  rank: bilingual("ยศ", "Rank"),
  fullName: bilingual("ชื่อ-นามสกุล", "Full Name"),
  englishName: bilingual("ชื่อภาษาอังกฤษ", "English Name"),
  currentPosition: bilingual("ตำแหน่งปัจจุบัน", "Current Position"),
  currentOrganization: bilingual("หน่วยงานปัจจุบัน", "Current Organization"),
  phone: bilingual("เบอร์โทรศัพท์", "Phone"),
  verificationBadge: bilingual("สถานะการตรวจสอบ", "Verification Status"),

  // Part C/I — organization + contact
  headquarters: bilingual("กองบัญชาการ", "Headquarters"),
  borderPatrolDivision: bilingual("ตำรวจตระเวนชายแดนภาค", "Border Patrol Division"),
  battalion: bilingual("กองกำกับการ", "Battalion"),
  company: bilingual("กองร้อย", "Company"),
  email: bilingual("อีเมล", "Email"),
  lineId: bilingual("ไลน์ไอดี", "LINE"),
  facebookUrl: bilingual("เฟซบุ๊ก", "Facebook"),
  nickname: bilingual("ชื่อเล่น", "Nickname"),

  // Part D/F/J — timeline
  day: bilingual("วัน", "Day"),
  month: bilingual("เดือน", "Month"),
  yearBE: bilingual("ปี (พ.ศ.)", "Year (B.E.)"),
  isPresent: bilingual("ปัจจุบัน", "Current"),
  source: bilingual("ที่มาของข้อมูล", "Source"),

  // Part G — personal information
  currentAge: bilingual("อายุปัจจุบัน", "Current Age"),
  careerYears: bilingual("อายุราชการ", "Career Years"),
  dateOfBirth: bilingual("วันเกิด", "Date of Birth"),
  bloodGroup: bilingual("กรุ๊ปเลือด", "Blood Group"),
  rh: bilingual("หมู่เลือด Rh", "Rh"),
  maritalStatus: bilingual("สถานภาพสมรส", "Marital Status"),
  children: bilingual("จำนวนบุตร", "Children"),
  homeProvince: bilingual("จังหวัดภูมิลำเนา", "Home Province"),
  shirtSize: bilingual("ขนาดเสื้อ", "Shirt Size"),
  nationality: bilingual("สัญชาติ", "Nationality"),

  // Part H — verification
  verificationStatus: bilingual("สถานะการตรวจสอบ", "Verification Status"),
  verifiedBy: bilingual("ผู้ตรวจสอบ", "Verified By"),
  verifiedDate: bilingual("วันที่ตรวจสอบ", "Verified Date"),
  verificationRemark: bilingual("หมายเหตุการตรวจสอบ", "Verification Remark"),

  // Part O — optional
  citizenId: bilingual("เลขบัตรประชาชน", "Citizen ID"),
  passportNumber: bilingual("เลขหนังสือเดินทาง", "Passport Number"),
  employeeNumber: bilingual("เลขประจำตัวเจ้าหน้าที่", "Employee Number"),
  retirementYear: bilingual("ปีเกษียณอายุราชการ", "Retirement Year"),
  retirementCountdown: bilingual("นับถอยหลังเกษียณอายุ", "Retirement Countdown"),
  emergencyContact: bilingual("ผู้ติดต่อฉุกเฉิน", "Emergency Contact"),
  emergencyPhone: bilingual("เบอร์โทรฉุกเฉิน", "Emergency Phone"),
  addressSummary: bilingual("ที่อยู่โดยสรุป", "Address Summary"),
  currentProvince: bilingual("จังหวัดที่อยู่ปัจจุบัน", "Current Province"),
  religion: bilingual("ศาสนา", "Religion"),
  educationLevel: bilingual("ระดับการศึกษา", "Education Level"),
  weight: bilingual("น้ำหนัก (กก.)", "Weight (kg)"),
  height: bilingual("ส่วนสูง (ซม.)", "Height (cm)"),
  bmi: bilingual("ดัชนีมวลกาย", "BMI"),
  uniformShoeSize: bilingual("ขนาดรองเท้า", "Uniform Shoe Size"),
  hatSize: bilingual("ขนาดหมวก", "Hat Size"),
  jacketSize: bilingual("ขนาดเสื้อแจ็คเก็ต", "Jacket Size"),
} as const satisfies Record<string, BilingualText>;

export type FieldLabelKey = keyof typeof FIELD_LABELS;
