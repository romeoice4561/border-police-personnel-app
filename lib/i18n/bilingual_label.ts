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
 * Formats a bilingual pair.
 *
 * Phase 43: when called with a `language` ("th" | "en") it returns only that
 * language's string — the runtime-switch behavior. Called with no language it
 * preserves the original "ไทย / English" dual rendering (backward compatible
 * for any caller/test that hasn't been migrated to the provider). React
 * components should prefer the `useBilingualText()` hook, which binds the
 * active language automatically.
 */
export function formatBilingual(text: BilingualText, language?: "th" | "en"): string {
  if (language) return text[language] ?? text.th;
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

  // Phase 45.1 — Personnel Master Data Expansion: membership + salary/bank.
  membershipAndFinancialSection: bilingual("ข้อมูลสมาชิกและการเงิน", "Membership and Financial Information"),
  membershipGroup: bilingual("ข้อมูลสมาชิก", "Membership"),
  salaryAndBankGroup: bilingual("ข้อมูลเงินเดือนและบัญชี", "Salary and Bank Information"),
  academyClass: bilingual("รุ่น นรต.", "Police Cadet Academy Class"),
  isGpfMember: bilingual("สมาชิก กบข.", "GPF Member"),
  isPoliceFuneralWelfareMember: bilingual("สมาชิกฌาปนกิจสงเคราะห์ ตร.", "Police Funeral Welfare Member"),
  isCooperativeMember: bilingual("สมาชิกสหกรณ์", "Cooperative Member"),
  cooperativeName: bilingual("ชื่อสหกรณ์", "Cooperative Name"),
  salaryLevel: bilingual("ระดับเงินเดือน", "Salary Level"),
  currentSalaryStep: bilingual("ขั้นเงินเดือน", "Salary Step"),
  // Phase 45.1 UX refinement pass (Task 3): renamed from "เงินเดือนปัจจุบัน"
  // to "ฐานเงินเดือน" — this field is the OFFICIAL salary base determined by
  // salary level + salary step, not the employee's take-home pay (that's
  // netSalary/"เงินเดือนรับจริง" below). UI label only — the underlying
  // Officer.currentSalary column name is unchanged (no schema/migration).
  currentSalary: bilingual("ฐานเงินเดือน", "Base Salary"),
  otherSpecialAllowances: bilingual("เงินเพิ่ม / ค่าตอบแทนพิเศษ", "Special Allowances / Compensation"),
  // Stored as Officer.cooperativeMonthlyDeduction — total monthly deductions.
  cooperativeMonthlyDeduction: bilingual("รายจ่ายรวม", "Total Expenses"),
  totalMonthlyIncome: bilingual("รายรับรวม", "Total Income"),
  netSalary: bilingual("เงินเดือนรับจริง", "Net Salary"),
  bankName: bilingual("ธนาคาร", "Bank"),
  bankAccountNumber: bilingual("เลขบัญชี", "Bank Account Number"),
} as const satisfies Record<string, BilingualText>;

export type FieldLabelKey = keyof typeof FIELD_LABELS;
