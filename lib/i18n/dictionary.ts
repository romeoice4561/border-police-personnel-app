/**
 * Central application translation dictionary (Phase 43 — Global i18n).
 *
 * THE single source of truth for every user-visible UI string in the
 * translated (primary) workflows. One namespaced, keyed dictionary — never
 * per-component or per-page dictionaries — so a new page only ADDS keys here
 * and a new language only adds one column per entry.
 *
 * Language-agnostic by construction (requirement 4): a translation entry is a
 * plain `Record<Language, string>`, and `Language` is a small open union.
 * Adding Chinese/Malay later = extend `LANGUAGES`/`Language` and fill the new
 * column on each entry — NO architectural change, no new dictionary, no new
 * provider.
 *
 * Framework-free on purpose (requirements 1 & 2): `translate(key, lang)` is a
 * pure function with no React dependency, so the SAME dictionary powers React
 * components (via the LanguageProvider's `useT()`), future Report Builder / PDF
 * / Print templates (server-side, no hooks), and AI-summary/report-heading
 * rendering — all resolving against one dictionary in whichever language is
 * active, with no duplicate templates.
 *
 * Pure data + pure functions — no I/O, no React.
 */

import { bilingual } from "@/lib/i18n/bilingual_label";

/**
 * Supported UI languages. Open by design — append "zh" | "ms" | … here and add
 * the matching column to each dictionary entry; everything else (provider,
 * toggle, formatters) is written against this union, so no other code changes
 * structurally.
 */
export const LANGUAGES = ["th", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Thai is the product's default and the SSR/first-render language. */
export const DEFAULT_LANGUAGE: Language = "th";

export function isLanguage(value: string | null | undefined): value is Language {
  return value != null && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * A translation entry: one string per language. Today it's structurally a
 * superset of BilingualText ({th,en}) so existing `bilingual()`/BilingualText
 * data folds in unchanged; adding a language widens this to that language too.
 */
export type Translation = Record<Language, string>;

/** Builds a translation entry. Reuses the existing bilingual() seam so all prior data is compatible. */
function tr(th: string, en: string): Translation {
  return bilingual(th, en);
}

/**
 * The dictionary. Keys are dot-namespaced strings ("profile.dateOfBirth",
 * "commander.foundOfficers", "dashboard.statistics") — flat map, namespaced by
 * convention so it's greppable and collision-resistant without nested objects.
 */
export const DICTIONARY = {
  // ── common.* — shared across the whole app ──
  "common.apply": tr("ค้นหา", "Apply"),
  "common.resetAll": tr("รีเซ็ตทั้งหมด", "Reset All"),
  "common.clearFilters": tr("ล้างตัวกรอง", "Clear Filters"),
  "common.clear": tr("ล้าง", "Clear"),
  "common.save": tr("บันทึก", "Save"),
  "common.cancel": tr("ยกเลิก", "Cancel"),
  "common.edit": tr("แก้ไข", "Edit"),
  "common.delete": tr("ลบ", "Delete"),
  "common.add": tr("เพิ่ม", "Add"),
  "common.close": tr("ปิด", "Close"),
  "common.confirm": tr("ยืนยัน", "Confirm"),
  "common.loading": tr("กำลังโหลด…", "Loading…"),
  "common.error": tr("เกิดข้อผิดพลาด", "An error occurred"),
  "common.retry": tr("ลองใหม่", "Retry"),
  "common.noData": tr("ไม่มีข้อมูล", "No data"),
  "common.none": tr("—", "—"),
  "common.all": tr("ทั้งหมด", "All"),
  "common.any": tr("ทุกประเภท", "Any"),
  "common.yes": tr("ใช่", "Yes"),
  "common.no": tr("ไม่", "No"),
  "common.search": tr("ค้นหา", "Search"),
  "common.previous": tr("ก่อนหน้า", "Previous"),
  "common.next": tr("ถัดไป", "Next"),
  "common.page": tr("หน้า", "Page"),
  "common.of": tr("จาก", "of"),
  "common.results": tr("ผลลัพธ์", "results"),
  "common.export": tr("ส่งออก", "Export"),
  "common.language": tr("ภาษา", "Language"),

  // ── nav.* — AppShell navigation (Phase 48A: enterprise sidebar) ──
  "nav.brand": tr("ตำรวจตระเวนชายแดน", "Border Patrol Police"),
  "nav.brandSub": tr("ระบบข่าวกรองกำลังพล", "Personnel Intelligence System"),
  "nav.dashboard": tr("แดชบอร์ด", "Dashboard"),
  "nav.commanderSearch": tr("ศูนย์ค้นหา", "Search Center"),
  "nav.officers": tr("กำลังพล", "Personnel"),
  "nav.search": tr("ค้นหา", "Search"),
  "nav.statistics": tr("การวิเคราะห์", "Analytics"),
  "nav.review": tr("ศูนย์ตรวจสอบข้อมูล", "Data Quality Center"),
  "nav.gallery": tr("ศูนย์สื่อ", "Media Center"),
  "nav.portraitCleanup": tr("จัดการรูปโปรไฟล์", "Portrait Cleanup"),
  "nav.myProfile": tr("โปรไฟล์ของฉัน", "My Profile"),
  // Sidebar group headers (presentation only — grouping is visual, RBAC
  // filtering is unchanged and still per-item via can(permission)).
  "nav.groupMain": tr("หลัก", "Main"),
  "nav.groupOperations": tr("ปฏิบัติการ", "Operations"),
  "nav.groupAdministration": tr("การจัดการระบบ", "Administration"),
  "nav.groupProfile": tr("โปรไฟล์", "Profile"),
  "nav.groupAppearance": tr("รูปแบบการแสดงผล", "Appearance"),

  // ── dashboard.* ──
  "dashboard.title": tr("แดชบอร์ด", "Dashboard"),
  "dashboard.statistics": tr("สถิติ", "Statistics"),
  "dashboard.totalOfficers": tr("กำลังพลทั้งหมด", "Total Officers"),
  "dashboard.insights": tr("ข้อมูลเชิงลึก", "Insights"),
  "dashboard.kpis": tr("ตัวชี้วัด", "KPIs"),
  "dashboard.warnings": tr("คำเตือน", "Warnings"),
  "dashboard.notifications": tr("การแจ้งเตือน", "Notifications"),
  "dashboard.commanderDashboard": tr("แดชบอร์ดผู้บังคับบัญชา", "Commander Dashboard"),
  "dashboard.subtitle": tr(
    "ข้อมูลเชิงลึกด้านความพร้อม การเกษียณ โปรไฟล์ และการเลื่อนตำแหน่งสำหรับผู้บังคับบัญชา",
    "Actionable readiness, retirement, profile, and promotion intelligence for commanders."
  ),
  // Phase 48A — Enterprise Workspace Foundation (Dashboard reference implementation)
  "dashboard.breadcrumbHome": tr("หน้าหลัก", "Home"),
  "dashboard.lastUpdated": tr("อัปเดตล่าสุด", "Last updated"),
  // Phase 48A.1 — WorkspaceHeader statusBadge demonstration. "Live" reflects
  // this page's actual rendering mode (force-dynamic — every load re-fetches
  // current intelligence), not an invented/decorative status.
  "dashboard.liveStatus": tr("สดทันที", "Live"),
  "dashboard.filtersAria": tr("ตัวกรองข่าวกรองผู้บังคับบัญชา", "Commander intelligence filters"),
  "dashboard.officerListAria": tr("รายการข่าวกรองกำลังพล", "Officer intelligence list"),
  "dashboard.officerIntelligence": tr("ข่าวกรองกำลังพล", "Officer Intelligence"),
  "dashboard.officersCount": tr("นาย", "officers"),
  "dashboard.noOfficersMatch": tr("ไม่มีกำลังพลตรงกับตัวกรองนี้", "No officers match this intelligence filter."),
  "dashboard.filterAll": tr("ทั้งหมด", "All"),
  "dashboard.filterPromotionReady": tr("พร้อมเลื่อนตำแหน่ง", "Promotion Ready"),
  "dashboard.filterRetiringSoon": tr("ใกล้เกษียณ", "Retiring Soon"),
  "dashboard.filterDocumentsMissing": tr("เอกสารไม่ครบ", "Missing Documents"),
  "dashboard.filterMissingPortrait": tr("ไม่มีรูปโปรไฟล์", "Missing Portrait"),
  "dashboard.filterNeedsTraining": tr("ขาดหลักสูตร", "Needs Training"),
  "dashboard.filterHighPriority": tr("ความสำคัญสูง", "High Priority"),
  "dashboard.filterCritical": tr("วิกฤต", "Critical"),
  "dashboard.totalOfficersKpi": tr("กำลังพลทั้งหมด", "Total Officers"),
  "dashboard.promotionReady": tr("พร้อมเลื่อนตำแหน่ง", "Promotion Ready"),
  "dashboard.nearPromotion": tr("ใกล้เลื่อนตำแหน่ง", "Near Promotion"),
  "dashboard.retiringSoon": tr("ใกล้เกษียณ", "Retiring Soon"),
  "dashboard.missingDocs": tr("เอกสารไม่ครบ", "Missing Docs"),
  "dashboard.missingGp7": tr("ขาด ก.พ.7", "Missing GP7"),
  "dashboard.missingPortrait": tr("ไม่มีรูปโปรไฟล์", "Missing Portrait"),
  "dashboard.missingTraining": tr("ขาดหลักสูตร", "Missing Training"),
  "dashboard.trainingNoPolicy": tr("ยังไม่ได้กำหนดนโยบาย", "No Policy Configured"),
  "dashboard.trainingUnavailable": tr("ข้อมูลไม่เพียงพอ", "Insufficient Data"),
  "dashboard.trainingZeroConfirmedHint": tr(
    "ไม่พบผู้ขาดหลักสูตรตามนโยบายที่กำหนด",
    "No officers found missing required training under the configured policy."
  ),
  "dashboard.trainingNoPolicyHint": tr(
    "ยังไม่สามารถประเมินหลักสูตรที่จำเป็นต่อการเลื่อนตำแหน่งได้",
    "Required training cannot be evaluated for promotion yet."
  ),

  // ── dashboard.* — Phase 45 completion pass: Training Overview card group (Task 6) ──
  "dashboard.trainingOverviewTitle": tr("ภาพรวมการฝึกอบรม", "Training Overview"),
  "dashboard.trainingHasDataCount": tr("มีกำลังพลที่มีข้อมูลการอบรม", "Officers With Training Data"),
  "dashboard.trainingNoDataCount": tr("ยังไม่มีข้อมูลการอบรม", "No Training Data"),
  "dashboard.trainingDataIssueCount": tr("มีข้อมูลหลักสูตรที่ควรตรวจสอบ", "Training Records to Review"),
  "dashboard.trainingMissingRequiredCount": tr("ขาดหลักสูตรตามนโยบาย", "Missing Required Training"),
  "dashboard.trainingPolicyNotSetCount": tr("นโยบายหลักสูตรยังไม่กำหนด", "Training Policy Not Configured"),

  // ── dashboard.* — Phase 45 completion pass: Training Priority panel (Task 10) ──
  "dashboard.trainingPriorityTitle": tr(
    "กำลังพลที่ควรพิจารณาส่งเข้ารับการอบรม",
    "Officers Recommended for Training"
  ),
  "dashboard.trainingPriorityMissingCourses": tr("หลักสูตรที่ขาด", "Missing Courses"),
  "dashboard.trainingPriorityRecommendedAction": tr("ข้อเสนอแนะ", "Recommended Action"),

  // ── dashboard.* — Phase 42: Commander Dashboard Intelligence ──
  "dashboard.fiscalYearLabel": tr("ปีงบประมาณปัจจุบัน", "Current Fiscal Year"),
  "dashboard.actionCenterTitle": tr("ศูนย์ปฏิบัติการผู้บังคับบัญชา", "Commander Action Center"),
  "dashboard.actionCenterEmpty": tr("ไม่มีรายการที่ต้องดำเนินการเร่งด่วนในขณะนี้", "No urgent items right now."),
  "dashboard.promotionIntelligenceTitle": tr("ข่าวกรองการเลื่อนตำแหน่ง", "Promotion Intelligence"),
  "dashboard.promotionEligibleThisYear": tr("ครบคุณสมบัติปีนี้", "Eligible This Year"),
  "dashboard.promotionAlreadyEligible": tr("ครบคุณสมบัติสะสม", "Already Eligible"),
  "dashboard.promotionWaiting": tr("รอดำเนินการ", "Waiting"),
  "dashboard.promotionMissingTraining": tr("ขาดหลักสูตร", "Missing Training"),
  "dashboard.promotionMissingDocuments": tr("ขาดเอกสาร", "Missing Documents"),
  "dashboard.promotionRetirementRestricted": tr("ใกล้เกษียณก่อนเลื่อนตำแหน่ง", "Retirement Restricted"),
  "dashboard.promotionUnknown": tr("ไม่สามารถวิเคราะห์ได้", "Not Yet Analyzable"),
  "dashboard.promotionZeroHint": tr("ยังไม่ได้กำหนดนโยบาย", "Not yet configured by policy"),
  "dashboard.priorityListTitle": tr("ผู้ควรได้รับการพิจารณาก่อน", "Priority Candidates"),
  "dashboard.priorityListSubtitle": tr(
    "ข้อมูลสนับสนุนการตัดสินใจ ไม่ใช่คำสั่งแต่งตั้งอัตโนมัติ",
    "Decision-support information — not an automatic appointment decision."
  ),
  "dashboard.priorityColumnPhoto": tr("รูป", "Photo"),
  "dashboard.priorityColumnName": tr("ยศ ชื่อ–สกุล", "Rank / Name"),
  "dashboard.priorityColumnPosition": tr("ตำแหน่ง", "Position"),
  "dashboard.priorityColumnUnit": tr("หน่วย", "Unit"),
  "dashboard.priorityColumnStatus": tr("สถานะ", "Status"),
  /** @deprecated Commander Promotion UX refinement dropped this column from the Dashboard table (superseded by "คุณสมบัติ"/"สถานะ"). Kept for backward compatibility. */
  "dashboard.priorityColumnEligibleSince": tr("ครบครั้งแรก", "First Eligible"),
  /** Phase 42 UI refinement (Task 4): replaces the verbose duration column — shows "ปีนี้เป็นปีที่ N" instead of "20 ปี 8 เดือน 15 วัน". */
  "dashboard.priorityColumnEligibleDuration": tr("ปีนี้เป็นปีที่", "Eligibility Year"),
  /** @deprecated Commander Promotion UX refinement replaces this column with "ดำรงตำแหน่งระดับนี้มา" (years at the current level, not a cycle count). Kept for backward compatibility. */
  "dashboard.priorityColumnCycles": tr("รอบการแต่งตั้ง", "Appointment Cycle"),
  /** @deprecated Phase 42 UI refinement (Task 6) removed this column from the table. Kept only so any other reader of the dictionary keeps working. */
  "dashboard.priorityColumnScore": tr("คะแนนความสำคัญ", "Priority Score"),
  /** @deprecated Phase 42 UI refinement (Task 6) removed this column from the table. Kept only so any other reader of the dictionary keeps working. */
  "dashboard.priorityColumnReason": tr("เหตุผล", "Reason"),
  /** Phase 42 UI refinement (Task 7): exact government-service duration, from Service Intelligence. */
  "dashboard.priorityColumnServiceYears": tr("อายุราชการ", "Years of Service"),
  /** Phase 42 UI refinement (Task 8): Buddhist-Era retirement fiscal year, from Retirement Intelligence. */
  "dashboard.priorityColumnRetirementYear": tr("ปีเกษียณอายุราชการ", "Retirement Year"),
  /** Commander Promotion UX refinement: answers "ครบขึ้นตำแหน่งอะไร" (which position the officer would advance into), e.g. "ครบขึ้น ผกก." — not a generic "Eligible" label. */
  "dashboard.priorityColumnQualification": tr("คุณสมบัติ", "Qualification"),
  /** Commander Promotion UX refinement: whole years held at the CURRENT position level — answers "อยู่ในระดับตำแหน่งนี้มาแล้วกี่ปี", never a cycle count. */
  "dashboard.priorityColumnYearsAtLevel": tr("ดำรงตำแหน่งระดับนี้มา", "Time at Current Level"),
  "dashboard.priorityColumnAction": tr("ดูประวัติ", "View History"),
  "dashboard.priorityViewAll": tr("ดูทั้งหมด", "View All"),
  "dashboard.priorityEmpty": tr("ไม่มีกำลังพลที่ต้องพิจารณาก่อนในขณะนี้", "No priority candidates right now."),
  "dashboard.birthdayTitle": tr("วันเกิดกำลังพล", "Birthday Intelligence"),
  "dashboard.birthdayToday": tr("เกิดวันนี้", "Birthdays Today"),
  "dashboard.birthdayNextSevenDays": tr("เกิดภายใน 7 วัน", "Birthdays Within 7 Days"),
  "dashboard.birthdayThisMonth": tr("เกิดเดือนนี้", "Birthdays This Month"),
  "dashboard.birthdayEmpty": tr("ไม่มีวันเกิดในช่วงนี้", "No birthdays in this range."),
  "dashboard.retirementTitle": tr("ข่าวกรองการเกษียณอายุ", "Retirement Awareness"),
  "dashboard.retirementWithinOneYear": tr("เกษียณภายใน 1 ปี", "Retiring Within 1 Year"),
  "dashboard.retirementWithinThreeYears": tr("เกษียณภายใน 3 ปี", "Retiring Within 3 Years"),
  "dashboard.retirementWithinFiveYears": tr("เกษียณภายใน 5 ปี", "Retiring Within 5 Years"),
  "dashboard.retirementColumnAge": tr("อายุปัจจุบัน", "Current Age"),
  "dashboard.retirementColumnDate": tr("วันเกษียณ", "Retirement Date"),
  "dashboard.retirementColumnYear": tr("ปีเกษียณ พ.ศ.", "Retirement Fiscal Year"),
  "dashboard.retirementColumnRemaining": tr("ระยะเวลาคงเหลือ", "Time Remaining"),
  "dashboard.retirementEmpty": tr("ไม่มีกำลังพลใกล้เกษียณในช่วงนี้", "No officers approaching retirement in this range."),
  "dashboard.overviewTitle": tr("ภาพรวมกำลังพล", "Personnel Overview"),
  "dashboard.dataUnavailable": tr("ข้อมูลไม่เพียงพอสำหรับวิเคราะห์", "Data Unavailable"),
  "dashboard.dataUnavailableHint": tr("ไม่มีข้อมูลวันเกิดที่ใช้คำนวณได้", "No usable date-of-birth data."),
  "dashboard.documentExpiryComingSoon": tr(
    "เอกสารใกล้หมดอายุ — รอเชื่อมระบบ Document Intelligence",
    "Document Expiry — pending Document Intelligence integration"
  ),

  // ── commander.* — Commander Search ──
  "commander.title": tr("ศูนย์ค้นหากำลังพล", "Commander Search Center"),
  "commander.subtitle": tr(
    "ศูนย์ช่วยตัดสินใจด้านกำลังพลสำหรับผู้บังคับบัญชา",
    "Advanced personnel decision-support workspace."
  ),
  "commander.personnelQuery": tr("ค้นหากำลังพล", "Personnel Query"),
  "commander.promotionEligibilitySearch": tr("ค้นหาผู้มีสิทธิ์เลื่อนตำแหน่ง", "Promotion Eligibility Search"),
  "commander.searchMode": tr("โหมดค้นหา", "Search mode"),
  "commander.presets": tr("ชุดค้นหาสำเร็จรูป", "Presets"),
  "commander.readyForPromotion": tr("ครบขึ้นระดับตำแหน่ง", "Ready for promotion"),
  "commander.readyPrefix": tr("ครบขึ้น", "Ready for"),
  "commander.foundOfficers": tr("พบกำลังพล", "Found Officers"),
  "commander.averageYears": tr("อายุเฉลี่ย", "Average Years"),
  "commander.inCurrentRank": tr("ในยศปัจจุบัน", "in current rank"),
  "commander.oldest": tr("อาวุโสที่สุด", "Oldest"),
  "commander.youngest": tr("อ่อนอาวุโสที่สุด", "Youngest"),
  "commander.avgService": tr("อายุราชการเฉลี่ย", "Avg Service"),
  "commander.avgAge": tr("อายุเฉลี่ย", "Avg Age"),
  "commander.governmentService": tr("อายุราชการ", "government service"),
  "commander.topRank": tr("ยศที่พบมากสุด", "Top rank"),
  "commander.resultsTable": tr("ตารางผลลัพธ์", "Results Table"),
  "commander.noOfficersMatch": tr("ไม่มีกำลังพลตรงกับเงื่อนไข", "No officers match the current query."),
  "commander.drilldown": tr("เจาะข้อมูล", "Drill-down"),
  "commander.clearDrilldown": tr("ล้างการเจาะข้อมูล", "Clear drill-down"),
  // Commander — Phase 43 Intelligence Summary cards (reflect the FILTERED result set; drill down via promotionEligibilityStatus)
  "commander.intelligenceSummary": tr("สรุปข่าวกรองผลลัพธ์", "Commander Intelligence Summary"),
  "commander.summaryTotal": tr("ผลลัพธ์ทั้งหมด", "All Results"),
  "commander.summaryEligibleThisYear": tr("ครบคุณสมบัติปีนี้", "Eligible This Year"),
  "commander.summaryAlreadyEligible": tr("มีคุณสมบัติครบแล้ว", "Already Eligible"),
  "commander.summaryWaiting": tr("รอการแต่งตั้ง", "Waiting"),
  "commander.summaryMissingTraining": tr("ขาดหลักสูตร", "Missing Training"),
  "commander.summaryMissingDocuments": tr("ขาดเอกสาร", "Missing Documents"),
  "commander.summaryRetirementRestricted": tr("ใกล้เกษียณ", "Near Retirement"),
  "commander.summaryUnknown": tr("ไม่สามารถวิเคราะห์ได้", "Unable to Analyze"),
  "commander.exportPlaceholder": tr(
    "โครงสร้างการส่งออก (พร้อมสำหรับตัวเขียนไฟล์ในอนาคต)",
    "Export architecture placeholder. Data is already prepared for future file writers."
  ),
  "commander.print": tr("พิมพ์", "Print"),
  "commander.exportPdfFutureWork": tr(
    "การส่งออก PDF อยู่ระหว่างการวางแผนสำหรับเฟสถัดไป",
    "PDF export is planned for a future phase."
  ),

  // Commander — table headers
  "commander.portrait": tr("รูป", "Portrait"),
  "commander.name": tr("ชื่อ", "Name"),
  "commander.rankYears": tr("ปีในยศ", "Rank Years"),
  "commander.positionYears": tr("ปีในตำแหน่ง", "Position Years"),
  "commander.service": tr("อายุราชการ", "Service"),
  "commander.promotion": tr("การเลื่อนตำแหน่ง", "Promotion"),
  "commander.retirement": tr("การเกษียณ", "Retirement"),
  "commander.nextLevel": tr("ระดับถัดไป", "Next Level"),
  "commander.targetLevel": tr("ระดับเป้าหมาย", "Target Level"),
  "commander.sortBy": tr("เรียงตาม", "Sort by"),
  /** @deprecated superseded by commander.firstEligibleYear in the Commander Promotion UX refinement's rebuilt results table. Kept for backward compatibility (not removed). */
  "commander.eligibleSince": tr("ครบตั้งแต่", "Eligible Since"),
  /** @deprecated superseded by commander.overdueYears (Commander Promotion UX refinement redefines "เกินกำหนด" semantics — whole missed promotion opportunities, from PromotionSummary, not the old cycle-count field). Kept for backward compatibility. */
  "commander.eligibleOverdue": tr("เกินกำหนด", "Eligible Overdue"),
  "commander.completedCycles": tr("วาระที่ครบ", "Completed Cycles"),
  // ── Commander Promotion UX refinement: rebuilt Commander Search results table ──
  "commander.positionLevelStartYear": tr("ดำรงตำแหน่งนี้มาตั้งแต่ปี", "In Level Since"),
  "commander.yearsInLevel": tr("จำนวนปีในระดับนี้", "Years in Level"),
  /** "ปีที่ครบครั้งแรก" — the Buddhist-Era fiscal year the officer FIRST became eligible (PromotionSummary.eligibleFiscalYearBe). Distinct from the deprecated commander.eligibleSince (a cycle-count field). */
  "commander.firstEligibleYear": tr("ปีที่ครบครั้งแรก", "First Eligible Year"),
  /** Phase 43: user-facing label changed from "เกินกำหนด" to "รอการแต่งตั้งมาแล้ว" — clearer, does not imply misconduct. Internal key name (commander.overdueYears) and filter-field compatibility unchanged. Value: whole promotion opportunities already missed (PromotionSummary.overdueYears - 1, floored at 0; e.g. first eligible 2568, current fiscal year 2569 = 1 missed opportunity). Distinct from the deprecated commander.eligibleOverdue. */
  "commander.overdueYears": tr("รอการแต่งตั้งมาแล้ว", "Waiting for Appointment"),
  /** "ปีนี้เป็นปีที่" — which numbered eligibility year this is (PromotionSummary.overdueYears, displayed as a bare number). */
  "commander.eligibilityYear": tr("ปีนี้เป็นปีที่", "Eligibility Year"),
  "commander.qualificationStatus": tr("สถานะ", "Status"),
  "commander.resultDistribution": tr("การกระจายผลลัพธ์", "Result Distribution"),
  "commander.rankDistribution": tr("การกระจายตามยศ", "Rank Distribution"),
  "commander.positionLevelDistribution": tr("การกระจายตามระดับตำแหน่ง", "Position Level Distribution"),
  "commander.companyDistribution": tr("การกระจายตามกองร้อย", "Company Distribution"),
  "commander.promotionCycleDistribution": tr("การกระจายรอบแต่งตั้ง", "Promotion Cycle Distribution"),
  "commander.retirementTimeline": tr("ไทม์ไลน์การเกษียณ", "Retirement Timeline"),
  "commander.noTimelineData": tr("ไม่มีข้อมูลไทม์ไลน์", "No timeline data available."),
  "commander.retirementYear": tr("ปีเกษียณอายุราชการ", "Retirement Year"),

  // Commander — filter fields
  "commander.rank": tr("ยศ", "Rank"),
  "commander.currentPosition": tr("ตำแหน่งปัจจุบัน", "Current Position"),
  "commander.positionLevel": tr("ระดับตำแหน่ง", "Position Level"),
  "commander.region": tr("ภาค", "Region"),
  "commander.battalion": tr("กองกำกับการ", "Battalion"),
  "commander.company": tr("กองร้อย", "Company"),
  "commander.yearsInRank": tr("อายุการดำรงยศ", "Years in Rank"),
  "commander.yearsInPosition": tr("อายุการดำรงตำแหน่ง", "Years in Position"),
  "commander.yearsInPositionLevel": tr("อายุการดำรงระดับตำแหน่ง", "Years in Position Level"),
  "commander.age": tr("อายุ", "Age"),
  "commander.governmentServiceYears": tr("อายุราชการ", "Government Service Years"),
  "commander.trainingStatus": tr("สถานะหลักสูตร", "Training Status"),
  "commander.showTrainingColumn": tr("แสดงคอลัมน์หลักสูตร", "Show Training Column"),
  "commander.hideTrainingColumn": tr("ซ่อนคอลัมน์หลักสูตร", "Hide Training Column"),

  // ── commander.* — Phase 45 completion pass: discoverable training filter group (Task 8) ──
  "commander.trainingFilterGroupTitle": tr("สถานะการฝึกอบรม", "Training Status"),
  "commander.trainingFilterAll": tr("ทั้งหมด", "All"),
  // Phase 45.1 (Task 9): Personnel Master Data filters.
  "commander.masterDataFilterGroupTitle": tr("ข้อมูลสมาชิก", "Membership Data"),
  "commander.academyClassFilter": tr("รุ่น นรต.", "Police Cadet Academy Class"),
  "commander.gpfMemberFilter": tr("สมาชิก กบข.", "GPF Member"),
  "commander.cooperativeMemberFilter": tr("สมาชิกสหกรณ์", "Cooperative Member"),
  "commander.cooperativeNameFilter": tr("ชื่อสหกรณ์", "Cooperative Name"),
  // Phase 45.1 hardening pass (Task 6): localized authorization errors —
  // usability-layer copy only (see lib/officer_profile/officer_financial_redaction.ts
  // for why these are not, today, backed by a real server-side check).
  "officer.financialViewDenied": tr("คุณไม่มีสิทธิ์ดูข้อมูลการเงิน", "You do not have permission to view financial information."),
  "officer.financialEditDenied": tr("คุณไม่มีสิทธิ์แก้ไขข้อมูลการเงิน", "You do not have permission to edit financial information."),
  // Phase 45.1 UX refinement pass (Task 2/6): Membership and Financial
  // Information placeholders/helper text — meaningful guidance, not
  // generic dropdown prompts.
  "officer.academyClassPlaceholder": tr("เช่น 61", "e.g. 61"),
  "officer.membershipStatusPlaceholder": tr("เลือกสถานะสมาชิก", "Select membership status"),
  "officer.cooperativeNamePlaceholder": tr("เช่น สหกรณ์ออมทรัพย์ตำรวจ", "e.g. Police Savings Cooperative"),
  "officer.salaryLevelPlaceholder": tr("เลือกระดับเงินเดือน", "Select salary level"),
  "officer.salaryLevelHelper": tr("เช่น ส.5", "e.g. ส.5"),
  "officer.salaryStepPlaceholder": tr("เลือกขั้นเงินเดือน", "Select salary step"),
  "officer.salaryStepHelper": tr("เช่น 31.5", "e.g. 31.5"),
  "officer.baseSalaryPlaceholder": tr("เลือกจากรายการ หรือกรอกเอง", "Select from the list or enter manually"),
  "officer.baseSalaryHelper": tr("เลือกอัตราที่ตรงกับเอกสารต้นทาง", "Choose the rate matching the source document"),
  "officer.baseSalaryNoStepHelper": tr("เลือกขั้นเงินเดือนเพื่อดูอัตราที่เกี่ยวข้อง หรือกรอกเอง", "Select a salary step to see related rates, or enter manually"),
  "officer.baseSalaryManualHelper": tr("กรอกเอง — กรุณาตรวจสอบกับเอกสารต้นทาง", "Manually entered — please verify against the source document"),
  "officer.netSalaryPlaceholder": tr("กรอกยอดรับจริงตามสลิปเงินเดือน", "Enter the net amount from the pay slip"),
  "officer.salaryFormulaHelper": tr(
    "เงินเดือนรับจริง = ฐานเงินเดือน + เงินเพิ่ม / ค่าตอบแทนพิเศษ − รายจ่ายรวม",
    "Net salary = base salary + special allowances / compensation − total expenses"
  ),
  "officer.netSalaryHelper": tr(
    "คำนวณจากฐานเงินเดือน + เงินเพิ่ม / ค่าตอบแทนพิเศษ − รายจ่ายรวม",
    "Calculated from base salary + special allowances / compensation − total expenses"
  ),
  "officer.otherSpecialAllowancesPlaceholder": tr("เช่น 2,000", "e.g. 2,000"),
  "officer.otherSpecialAllowancesHelper": tr(
    "พ.ส.ร. / ต.ป.ป. / ค่าเสี่ยงภัย / เงินเพิ่มและค่าตอบแทนอื่นต่อเดือน",
    "Hazard / special duty / risk / other monthly allowances and compensation"
  ),
  "officer.otherSpecialAllowancesNone": tr("ไม่มีเงินเพิ่ม / ค่าตอบแทนพิเศษ", "No special allowances / compensation"),
  "officer.cooperativeDeductionPlaceholder": tr("เช่น 8,000", "e.g. 8,000"),
  "officer.cooperativeDeductionHelper": tr(
    "ภาษี / กบข. / แฟลต / ค่าน้ำไฟ / หนี้สหกรณ์ / รายจ่ายอื่นต่อเดือน",
    "Tax / GPF / housing / utilities / cooperative debt / other monthly expenses"
  ),
  "officer.cooperativeDeductionExceedsSalary": tr(
    "รายจ่ายรวมต้องไม่เกินฐานเงินเดือนรวมเงินเพิ่มพิเศษ",
    "Total expenses must not exceed base salary plus special allowances"
  ),
  "officer.cooperativeDeductionNone": tr("ไม่มีรายการหัก", "No expenses"),
  "officer.salaryGaugeEmpty": tr("ยังไม่มีข้อมูลรายรับ", "No income data yet"),
  "officer.salaryGaugeNetLabel": tr("เงินเดือนรับจริง", "Net salary"),
  "officer.salaryGaugeLegendRemaining": tr("เงินคงเหลือ {pct}%", "Remaining {pct}%"),
  "officer.salaryGaugeLegendExpenses": tr("รายจ่ายรวม {pct}%", "Total expenses {pct}%"),
  "officer.salaryGaugeAria": tr(
    "รายรับรวม {income} รายจ่ายรวม {expenses} คิดเป็น {expensePct} เปอร์เซ็นต์ เงินเดือนรับจริง {net} คิดเป็น {remainingPct} เปอร์เซ็นต์",
    "Total income {income}. Total expenses {expenses} ({expensePct} percent). Net salary {net} ({remainingPct} percent)."
  ),
  "officer.bankNamePlaceholder": tr("เลือกหรือพิมพ์ชื่อธนาคาร", "Select or type a bank name"),
  "officer.bankAccountNumberPlaceholder": tr("กรอกเลขบัญชี", "Enter account number"),
  "officer.bankAccountNumberOnFileHelper": tr("มีข้อมูลอยู่แล้ว — พิมพ์เพื่อเปลี่ยน", "On file — type to change"),
  "commander.intelligenceFlag": tr("สัญญาณข่าวกรอง", "Intelligence Flag"),
  "commander.priority": tr("ระดับความสำคัญ", "Priority"),
  "commander.minProfileCompleteness": tr("ความสมบูรณ์ของข้อมูลขั้นต่ำ", "Minimum Profile Completeness"),
  "commander.allRegions": tr("ทุกภาค", "All regions"),
  "commander.allBattalions": tr("ทุกกองกำกับการ", "All battalions"),
  "commander.allCompanies": tr("ทุกกองร้อย", "All companies"),
  "commander.anyRetirementHorizon": tr("ทุกช่วงเวลา", "Any horizon"),
  "commander.retirementWithin1Year": tr("ภายใน 1 ปี", "Within 1 year"),
  "commander.retirementWithin3Years": tr("ภายใน 3 ปี", "Within 3 years"),
  "commander.retirementWithin5Years": tr("ภายใน 5 ปี", "Within 5 years"),

  // Commander — promotion eligibility
  "commander.currentRank": tr("ยศปัจจุบัน", "Current Rank"),
  "commander.targetRank": tr("ยศเป้าหมาย", "Target Rank"),
  "commander.currentPositionLevel": tr("ระดับตำแหน่งปัจจุบัน", "Current Position Level"),
  "commander.targetPositionLevel": tr("ระดับตำแหน่งเป้าหมาย", "Target Position Level"),
  "commander.eligibilityStatus": tr("สถานะสิทธิ์เลื่อนตำแหน่ง", "Eligibility Status"),
  "commander.eligibleNow": tr("ครบแล้ว", "Eligible now"),
  "commander.eligibleSoon": tr("ใกล้ครบ", "Eligible soon"),
  "commander.overdue": tr("เกินกำหนด", "Overdue"),
  "commander.notEligible": tr("ยังไม่ครบ", "Not eligible"),
  "commander.promotionCycle": tr("รอบแต่งตั้ง", "Promotion Cycle"),
  "commander.anyCycle": tr("ทุกรอบ", "Any cycle"),
  "commander.completedPromotionCycles": tr("ครบวาระแต่งตั้ง", "Completed Promotion Cycles"),
  "commander.appointmentCycle": tr("รอบแต่งตั้ง", "Appointment Cycle"),
  "commander.eligibleThisCycle": tr("ครบรอบนี้", "Eligible this cycle"),
  "commander.eligibleYear1": tr("ครบใน 1 ปี", "Eligible Year 1"),
  "commander.eligibleYear2": tr("ครบใน 2 ปี", "Eligible Year 2"),
  "commander.eligibleYear3": tr("ครบใน 3 ปี", "Eligible Year 3"),
  "commander.eligibleYear4": tr("ครบใน 4 ปี", "Eligible Year 4"),
  "commander.eligibleMoreThan5": tr("ครบเกิน 5 ปี", "Eligible more than 5 years"),
  "commander.years": tr("ปี", "years"),
  "commander.yearsPlaceholder": tr("จำนวนปี", "Years"),
  "commander.avgCompletedCycles": tr("วาระเฉลี่ยที่ครบ", "Avg Completed Cycles"),
  "commander.avgCompletedCyclesHint": tr("วาระแต่งตั้งในระดับปัจจุบัน", "appointment cycles at current level"),
  "commander.avgAppointmentCycle": tr("รอบแต่งตั้งเฉลี่ย", "Avg Appointment Cycle"),
  "commander.currentPositionLevelHint": tr("ระดับตำแหน่งปัจจุบัน", "current position level"),
  "commander.eligibleThisCycleShort": tr("ครบรอบนี้", "Eligible This Cycle"),
  "commander.eligible5PlusYears": tr("ครบ 5+ ปี", "Eligible 5+ Years"),

  // Commander — duration operators
  "commander.completed": tr("ครบ", "Completed"),
  "commander.cycles": tr("วาระ", "Cycles"),
  "commander.operatorExactly": tr("พอดี", "Exactly"),
  "commander.operatorAtLeast": tr("อย่างน้อย", "At least"),
  "commander.operatorMoreThan": tr("มากกว่า", "More than"),
  "commander.operatorLessThan": tr("น้อยกว่า", "Less than"),

  // Commander — selects "all/any"
  "commander.allRanks": tr("ทุกยศ", "All ranks"),
  "commander.allPositionLevels": tr("ทุกระดับตำแหน่ง", "All position levels"),
  "commander.anyFlag": tr("ทุกสัญญาณ", "Any flag"),
  "commander.anyPriority": tr("ทุกระดับความสำคัญ", "Any priority"),
  "commander.anyStatus": tr("ทุกสถานะ", "Any status"),

  // Commander — intelligence flags
  "commander.flagPromotionReady": tr("พร้อมเลื่อนตำแหน่ง", "Promotion Ready"),
  "commander.flagRetiringSoon": tr("ใกล้เกษียณ", "Retiring Soon"),
  "commander.flagDocumentsMissing": tr("เอกสารไม่ครบ", "Missing Documents"),
  "commander.flagMissingPortrait": tr("ไม่มีรูปโปรไฟล์", "Missing Portrait"),
  "commander.flagNeedsTraining": tr("ขาดหลักสูตร", "Missing Training"),
  "commander.flagProfileIncomplete": tr("ข้อมูลไม่สมบูรณ์", "Profile Incomplete"),

  // Commander — presets (labels)
  "commander.presetNearRetirement": tr("ผู้ใกล้เกษียณ", "Near retirement"),
  "commander.presetEligibleTwoStep": tr("ผู้มีสิทธิ์ 2 ขั้น", "Eligible for two-step"),
  "commander.presetMustSkipStep": tr("ผู้ต้องเว้นขั้น", "Must skip a step"),
  "commander.presetMissingGp7": tr("ผู้ขาด ก.พ.7", "Missing GP7"),
  "commander.presetMissingDocuments": tr("ผู้ขาดเอกสาร", "Missing documents"),
  "commander.presetMissingTraining": tr("ผู้ขาดหลักสูตร", "Missing training"),
  "commander.presetMissingPortrait": tr("ผู้ไม่มีรูปโปรไฟล์", "Missing profile photo"),
  "commander.presetReadyPrefix": tr("ผู้ครบขึ้น", "Ready for"),

  // ── officer.* — Officer Detail / Workspace ──
  "officer.profile": tr("โปรไฟล์", "Profile"),
  "officer.basicInformation": tr("ข้อมูลพื้นฐาน", "Basic Information"),
  "officer.personalInformation": tr("ข้อมูลส่วนบุคคล", "Personal Information"),
  "officer.contact": tr("ข้อมูลติดต่อ", "Contact"),
  "officer.currentOrganization": tr("หน่วยงานปัจจุบัน", "Current Organization"),
  "officer.careerTimeline": tr("ประวัติการรับราชการ", "Career Timeline"),
  "officer.promotion": tr("การเลื่อนตำแหน่ง", "Promotion"),
  "officer.salaryHistory": tr("ประวัติขั้นเงินเดือน", "Salary History"),
  "officer.training": tr("การฝึกอบรม", "Training"),
  "officer.education": tr("การศึกษา", "Education"),
  "officer.documents": tr("เอกสาร", "Documents"),
  "officer.media": tr("สื่อ", "Media"),
  "officer.achievements": tr("ผลงาน/รางวัล", "Achievements"),
  "officer.qualitySummary": tr("สรุปคุณภาพข้อมูล", "Quality Summary"),
  "officer.editProfile": tr("แก้ไขข้อมูล", "Edit Profile"),
  "officer.saveChanges": tr("บันทึกการแก้ไข", "Save Changes"),
  "officer.noRecords": tr("ยังไม่มีข้อมูล", "No records yet."),
  "officer.editModeBanner": tr(
    "โหมดแก้ไขข้อมูล — แก้ไขได้ทุกส่วน แล้วกด \"บันทึก\" เพื่อบันทึกพร้อมกันทั้งหมด",
    "Edit mode — change any section, then press \"Save\" to save everything at once."
  ),
  "officer.saveFailed": tr("บันทึกไม่สำเร็จ", "Save failed"),
  // Bug-fix pass (Task 10): distinct, user-safe success/failure copy for the
  // Officer Workspace save flow — never the raw server/network error message.
  "officer.saveSuccess": tr("บันทึกข้อมูลสำเร็จ", "Information saved successfully."),
  "officer.saveErrorGeneric": tr("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง", "Unable to save the information. Please try again."),

  // Officer — profile fields (spec examples; complements FIELD_LABELS)
  "profile.personalInformation": tr("ข้อมูลส่วนบุคคล", "Personal Information"),
  "profile.dateOfBirth": tr("วันเกิด", "Date of Birth"),
  "profile.currentAge": tr("อายุปัจจุบัน", "Current Age"),
  "profile.bloodGroup": tr("กรุ๊ปเลือด", "Blood Group"),
  "profile.careerYears": tr("อายุราชการ", "Career Years"),

  // Officer — Basic Information fields
  "officer.rankField": tr("ยศ", "Rank"),
  "officer.fullName": tr("ชื่อ-นามสกุล", "Full name"),
  "officer.regionField": tr("ภาค", "Region"),
  "officer.officerId": tr("รหัสกำลังพล", "Officer ID"),
  "officer.basicInfoAndContact": tr("ข้อมูลพื้นฐานและการติดต่อ", "Basic Information & Contact"),
  "officer.actions": tr("การดำเนินการ", "Actions"),
  "officer.profileCompleteness": tr("ความสมบูรณ์ของโปรไฟล์", "Profile Completeness"),
  "officer.qualityAiSummary": tr("สรุปคุณภาพและ AI", "Quality & AI Summary"),
  "officer.notes": tr("บันทึก", "Notes"),

  // Officer — Career section
  "officer.career": tr("ประวัติการทำงาน", "Career"),
  "officer.position": tr("ตำแหน่ง", "Position"),
  "officer.unit": tr("หน่วยงาน", "Unit"),
  "officer.notAssigned": tr("ยังไม่ได้ระบุ", "Not Assigned"),
  "officer.careerYearsImported": tr("อายุราชการ (นำเข้า)", "Career years (imported)"),
  "officer.careerYearsCalculated": tr("อายุราชการ (คำนวณ)", "Career years (calculated)"),
  "officer.yearsInCurrentRank": tr("อายุการดำรงยศปัจจุบัน", "Years in current rank"),
  "officer.yearsInCurrentPosition": tr("อายุการดำรงตำแหน่งปัจจุบัน", "Years in current position"),
  "officer.importedMismatch": tr("ค่าที่นำเข้าต่างจากค่าที่คำนวณได้", "Imported value differs from calculated value."),
  "officer.yearsSuffix": tr("ปี", "years"),

  // Officer — Career Timeline (read-only table)
  "officer.timelineDate": tr("วันที่", "Date"),
  "officer.timelineRank": tr("ยศ", "Rank"),
  "officer.timelinePositionOrg": tr("ตำแหน่ง / หน่วยงาน", "Position / Organization"),
  "officer.timelineSource": tr("ที่มา", "Source"),
  "officer.timelineVerification": tr("การตรวจสอบ", "Verification"),
  "officer.timelineEmpty": tr("ยังไม่มีประวัติการรับราชการ", "No career-history entries on record."),
  "officer.current": tr("ปัจจุบัน", "Current"),
  "officer.verifiedBy": tr("โดย", "by"),

  // Officer — Salary evaluation / simulation cards
  "officer.currentEligibility": tr("สิทธิ์ปัจจุบัน", "Current Eligibility"),
  "officer.careerSimulation": tr("จำลองผลการประเมิน", "Career Simulation"),
  "officer.twoStepEligible": tr("มีสิทธิ์ 2 ขั้น", "Eligible"),
  "officer.twoStepNotEligible": tr("ไม่มีสิทธิ์ 2 ขั้น", "Not Eligible"),
  "officer.twoStepUnknown": tr("ไม่สามารถระบุได้", "Unknown"),
  "officer.buddhistYearPrefix": tr("พ.ศ.", "B.E."),
  "officer.preview": tr("พรีวิว", "Preview"),
  "officer.ifSavedNow": tr("หากบันทึกตอนนี้", "If saved now"),
  "officer.cannotDetermine": tr("ไม่สามารถระบุได้", "Cannot determine"),
  "officer.noEducation": tr("ยังไม่มีข้อมูลการศึกษา", "No education records yet."),
  "officer.noTraining": tr("ยังไม่มีข้อมูลการฝึกอบรม", "No training records yet."),

  // ── Officer — Training Intelligence card (Phase 45 completion pass) ──
  "officer.trainingIntelligenceTitle": tr("การวิเคราะห์การฝึกอบรม", "Training Intelligence"),
  "officer.trainingStatusLabel": tr("สถานะการฝึกอบรม", "Training Status"),
  "officer.trainingTotalRecords": tr("หลักสูตรทั้งหมด", "Total Courses"),
  "officer.trainingVerified": tr("ข้อมูลที่ตรวจสอบแล้ว", "Verified Records"),
  "officer.trainingUnverified": tr("ข้อมูลที่ยังไม่ตรวจสอบ", "Unverified Records"),
  "officer.trainingRequiredByPolicy": tr("หลักสูตรตามนโยบาย", "Required by Policy"),
  "officer.trainingMissing": tr("หลักสูตรที่ขาด", "Missing Courses"),
  "officer.trainingDataIssueCount": tr("ข้อมูลผิดปกติ", "Data Issues"),
  "officer.trainingNoPolicySupportingText": tr(
    "ระบบพบข้อมูลการฝึกอบรม แต่ยังไม่สามารถประเมินว่าหลักสูตรครบตามเกณฑ์หรือไม่ เนื่องจากยังไม่ได้กำหนดนโยบายหลักสูตรสำหรับตำแหน่งเป้าหมายนี้",
    "Training records were found, but course requirements cannot be evaluated yet because no training policy is configured for this target position."
  ),
  "officer.trainingHistoryTitle": tr("ประวัติการฝึกอบรม", "Training History"),
  "officer.trainingDataIssuesTitle": tr("ประเด็นข้อมูลที่ควรตรวจสอบ", "Training Data Issues"),
  "officer.trainingNoDataIssues": tr("ไม่พบปัญหาคุณภาพข้อมูลที่ตรวจสอบได้", "No data-quality issues detected."),
  "officer.trainingYearUnavailable": tr("ไม่ระบุปี", "Year not specified"),
  "officer.trainingProviderUnavailable": tr("ไม่ระบุหน่วยงานที่จัด", "Provider not specified"),
  "officer.trainingCourseNameUnavailable": tr("ไม่มีชื่อหลักสูตร", "Course name missing"),
  "officer.trainingUnavailable": tr("ยังไม่สามารถวิเคราะห์ได้", "Not enough data to analyze."),
  "officer.trainingRecommendationsTitle": tr("ข้อเสนอแนะ", "Recommendations"),

  // Data-quality flag labels (Phase 45 completion pass) — keyed by
  // TrainingDataQualityFlagCode so the UI can localize instead of trusting
  // the engine's Thai-only messageTh directly (see data_quality.ts).
  "officer.trainingFlag.MISSING_COURSE_NAME": tr("ไม่มีชื่อหลักสูตร", "Missing course name"),
  "officer.trainingFlag.INVALID_DATE": tr("ปีไม่ถูกต้อง", "Invalid date"),
  "officer.trainingFlag.COMPLETION_AFTER_EXPIRY": tr(
    "วันที่สำเร็จการอบรมอยู่หลังวันหมดอายุ",
    "Completion date is after the expiry date"
  ),
  "officer.trainingFlag.DUPLICATE_CERTIFICATE_NUMBER": tr(
    "พบเลขที่ใบรับรองซ้ำกัน",
    "Duplicate certificate number found"
  ),
  "officer.trainingFlag.DUPLICATE_COURSE_RECORD": tr(
    "พบรายการหลักสูตรที่อาจซ้ำกัน",
    "Possible duplicate course record found"
  ),
  "officer.trainingFlag.UNVERIFIED_RECORD": tr(
    "มีข้อมูลหลักสูตรที่ยังไม่ผ่านการตรวจสอบ",
    "Unverified training record"
  ),
  "officer.comingSoon": tr("เร็ว ๆ นี้", "Coming soon"),
  "officer.availableFuture": tr("จะเปิดใช้งานในอนาคต", "Available in a future update"),
  "officer.uploadPortrait": tr("อัปโหลดรูปโปรไฟล์", "Upload Portrait"),
  "officer.uploadGp7": tr("อัปโหลด ก.พ.7", "Upload GP7"),
  "officer.manageDocuments": tr("จัดการเอกสาร", "Manage Documents"),
  "officer.manageAchievements": tr("จัดการผลงาน", "Manage Achievements"),

  // Officer — completeness checklist + card titles
  "officer.completeness": tr("ความสมบูรณ์ของโปรไฟล์", "Profile Completeness"),
  "officer.completenessAria": tr("ความสมบูรณ์ของโปรไฟล์", "Profile completeness"),
  "officer.completeness.basicInformation": tr("ข้อมูลพื้นฐาน", "Basic Information"),
  "officer.completeness.currentPosition": tr("ตำแหน่งปัจจุบัน", "Current Position"),
  "officer.completeness.careerTimeline": tr("ประวัติการรับราชการ", "Career Timeline"),
  "officer.completeness.officialPortrait": tr("รูปโปรไฟล์ทางการ", "Official Portrait"),
  "officer.completeness.contactInformation": tr("ข้อมูลติดต่อ", "Contact Information"),
  "officer.completeness.education": tr("การศึกษา", "Education"),
  "officer.completeness.trainingCourses": tr("หลักสูตรฝึกอบรม", "Training Courses"),
  "officer.completeness.awards": tr("รางวัล", "Awards"),
  "officer.completeness.documents": tr("เอกสาร", "Documents"),
  "officer.completeness.gp7": tr("ก.พ.7", "GP7"),

  // Phase 45.2 — organization hierarchy picker labels (previously hardcoded
  // "กองบัญชาการ (Headquarters)"-style concatenated bilingual strings).
  "officer.orgHierarchy.headquarters": tr("กองบัญชาการ", "Headquarters"),
  "officer.orgHierarchy.region": tr("กองบังคับการ ตชด.ภาค", "Border Patrol Region"),
  "officer.orgHierarchy.battalion": tr("กองกำกับ", "Battalion"),
  "officer.orgHierarchy.company": tr("กองร้อย", "Company"),

  // Phase 45.2 — Career Timeline row labels (previously hardcoded slash-joined
  // bilingual strings, e.g. "รอบแต่งตั้ง / Appointment Cycle").
  "officer.timeline.appointmentCycle": tr("รอบแต่งตั้ง", "Appointment Cycle"),
  "officer.timeline.positionLevel": tr("ระดับตำแหน่ง", "Position Level"),

  // Phase 45.2 — Commander Intelligence card (components/intelligence/
  // officer_intelligence_card.tsx, components/intelligence/intelligence_badge.tsx).
  // Every key here maps a STABLE engine status/priority/flag CODE to display
  // text — the engine's own calculation (severity, eligibility, score) is
  // never touched; only how its output is presented changes.
  "commander.intelligence.title": tr("ข้อมูลวิเคราะห์สำหรับผู้บังคับบัญชา", "Commander Intelligence"),
  "commander.intelligence.profileCompletion": tr("ความสมบูรณ์ของข้อมูล", "Profile Completion"),
  "commander.intelligence.recommendations": tr("ข้อเสนอแนะ", "Recommendations"),
  "commander.intelligence.noRecommendations": tr("ไม่มีข้อเสนอแนะในขณะนี้", "No immediate recommendations."),
  "commander.intelligence.completenessSummaryPrefix": tr("ความสมบูรณ์ของข้อมูล:", "Profile completeness:"),
  "commander.intelligence.priorityScoreLabel": tr("คะแนนความสำคัญ", "Priority score"),

  // Promotion status (PromotionStatus — lib/intelligence/types.ts).
  "commander.intelligence.promotionStatus.eligible": tr("พร้อมเลื่อนตำแหน่ง", "Promotion Ready"),
  "commander.intelligence.promotionStatus.near_eligible": tr("ใกล้ครบเกณฑ์เลื่อนตำแหน่ง", "Near Promotion"),
  "commander.intelligence.promotionStatus.not_eligible": tr("ยังไม่ผ่านเกณฑ์", "Not Eligible"),
  "commander.intelligence.promotionStatus.unknown": tr("ยังไม่ทราบสถานะการเลื่อนตำแหน่ง", "Promotion Unknown"),

  // Retirement status (RetirementStatus).
  "commander.intelligence.retirementStatus.normal": tr("เกษียณตามปกติ", "Retirement Normal"),
  "commander.intelligence.retirementStatus.retiring_within_2_years": tr("เกษียณภายใน 2 ปี", "Retiring < 2 Years"),
  "commander.intelligence.retirementStatus.retiring_within_1_year": tr("เกษียณภายใน 1 ปี", "Retiring < 1 Year"),
  "commander.intelligence.retirementStatus.retired": tr("เกษียณอายุราชการแล้ว", "Retired"),
  "commander.intelligence.retirementStatus.unknown": tr("ยังไม่ทราบสถานะการเกษียณ", "Retirement Unknown"),

  // Priority (OfficerPriority).
  "commander.intelligence.priority.low": tr("ความสำคัญต่ำ", "Low Priority"),
  "commander.intelligence.priority.medium": tr("ความสำคัญปานกลาง", "Medium Priority"),
  "commander.intelligence.priority.high": tr("ความสำคัญสูง", "High Priority"),
  "commander.intelligence.priority.critical": tr("ความสำคัญเร่งด่วน", "Critical Priority"),

  // Completeness band (CompletenessStatus).
  "commander.intelligence.completenessBand.high": tr("สูง", "high"),
  "commander.intelligence.completenessBand.medium": tr("ปานกลาง", "medium"),
  "commander.intelligence.completenessBand.low": tr("ต่ำ", "low"),
  "commander.intelligence.completenessBand.unknown": tr("ไม่ทราบ", "unknown"),

  // Flags (OfficerFlagCode — lib/intelligence/flags.ts).
  "commander.intelligence.flag.PROMOTION_READY": tr("พร้อมเลื่อนตำแหน่ง", "Promotion Ready"),
  "commander.intelligence.flag.NEAR_PROMOTION": tr("ใกล้ครบเกณฑ์เลื่อนตำแหน่ง", "Near Promotion"),
  "commander.intelligence.flag.RETIRING_SOON": tr("ใกล้เกษียณอายุราชการ", "Retiring Soon"),
  "commander.intelligence.flag.NEEDS_TRAINING": tr("ขาดหลักสูตรที่กำหนด", "Needs Training"),
  "commander.intelligence.flag.DOCUMENTS_MISSING": tr("เอกสารไม่ครบถ้วน", "Documents Missing"),
  "commander.intelligence.flag.PROFILE_INCOMPLETE": tr("ข้อมูลยังไม่สมบูรณ์", "Profile Incomplete"),
  "commander.intelligence.flag.MISSING_OFFICIAL_PORTRAIT": tr("ยังไม่มีรูปประจำตัวทางการ", "Missing Official Portrait"),

  // Recommendation TOPICS (lib/intelligence/recommendations.ts's
  // generateRecommendations output — see topicForCode; each topic maps to
  // exactly one translated line, never a raw rule/requirement code).
  "commander.intelligence.recommendation.PROMOTION_READY": tr("พร้อมเข้ารับการพิจารณาเลื่อนตำแหน่ง", "Officer is ready for promotion review."),
  "commander.intelligence.recommendation.NEAR_PROMOTION": tr(
    "ตรวจสอบเกณฑ์ที่ยังขาดและเตรียมความพร้อมสำหรับรอบเลื่อนตำแหน่งถัดไป",
    "Review remaining promotion gaps and prepare the officer for the next cycle."
  ),
  "commander.intelligence.recommendation.RETIRING_SOON": tr("ควรเริ่มวางแผนก่อนเกษียณอายุราชการ", "Retirement planning should begin."),
  "commander.intelligence.recommendation.training": tr("เพิ่มข้อมูลหรือผ่านหลักสูตรที่ระบบกำหนด", "Complete required training."),
  "commander.intelligence.recommendation.DOCUMENTS_MISSING": tr("จัดทำเอกสารที่ใช้ประกอบการเลื่อนตำแหน่งให้ครบถ้วน", "Complete missing promotion documents."),
  "commander.intelligence.recommendation.PROFILE_INCOMPLETE": tr("ปรับปรุงข้อมูลโปรไฟล์ที่ยังไม่สมบูรณ์", "Update incomplete profile information."),
  "commander.intelligence.recommendation.MISSING_OFFICIAL_PORTRAIT": tr("เปลี่ยนรูปประจำตัวทางการที่ขาดหายไป", "Replace missing official portrait."),
  "commander.intelligence.recommendation.document:gp7": tr("จัดทำเอกสาร ก.พ.7 ให้ครบถ้วน", "Complete GP7."),

  // ── capability.* — Phase 44 Personnel Capability Intelligence ──
  "capability.title": tr("ความเชี่ยวชาญและศักยภาพ", "Professional Skills & Competencies"),
  "capability.level": tr("ระดับความสามารถ", "Proficiency Level"),
  "capability.experience": tr("ประสบการณ์", "Experience"),
  "capability.years": tr("ปี", "years"),
  "capability.yearsExperience": tr("จำนวนปีประสบการณ์", "Years of Experience"),
  "capability.certificate": tr("ใบรับรอง", "Certificate"),
  "capability.certificateNumber": tr("เลขที่ใบรับรอง", "Certificate Number"),
  "capability.issuingOrganization": tr("หน่วยงานที่ออก", "Issuing Organization"),
  "capability.issueDate": tr("วันที่ได้รับ", "Issue Date"),
  "capability.expiryDate": tr("วันหมดอายุ", "Expiry Date"),
  "capability.verification": tr("การตรวจสอบ", "Verification"),
  "capability.verified": tr("ผ่านการตรวจสอบ", "Verified"),
  "capability.verifiedBy": tr("ตรวจสอบโดย", "Verified By"),
  "capability.verifiedDate": tr("วันที่ตรวจสอบ", "Verified Date"),
  "capability.deploymentReadiness": tr("ความพร้อมปฏิบัติภารกิจ", "Mission Readiness"),
  "capability.availableForDeployment": tr("พร้อมปฏิบัติภารกิจ", "Available for Deployment"),
  "capability.remarks": tr("หมายเหตุ", "Remarks"),
  "capability.datePlaceholder": tr("วว/ดด/ปปปป (พ.ศ.)", "DD/MM/YYYY (B.E.)"),
  "capability.noSkills": tr("ยังไม่มีข้อมูลความเชี่ยวชาญ", "No skills recorded yet."),
  "capability.selectSkills": tr("เลือกความสามารถที่มี", "Select the skills held"),
  "capability.skillsSelected": tr("รายการที่เลือก", "selected"),
  "capability.selectLevel": tr("เลือกระดับ", "Select level"),

  // Commander Search — skill filter
  "capability.filterTitle": tr("ความเชี่ยวชาญและศักยภาพ", "Skills & Competencies"),
  "capability.category": tr("หมวดความสามารถ", "Skill Category"),
  "capability.skill": tr("ความสามารถ", "Skill"),
  "capability.minLevel": tr("ระดับขั้นต่ำ", "Minimum Level"),
  "capability.hasCertificate": tr("มีใบรับรอง", "Has Certificate"),
  "capability.certificateExpiringSoon": tr("ใบรับรองใกล้หมดอายุ", "Certificate Expiring Soon"),
  "capability.expert": tr("ผู้เชี่ยวชาญ", "Expert"),
  "capability.instructor": tr("ครูฝึก / วิทยากร", "Instructor"),
  "capability.allCategories": tr("ทุกหมวด", "All categories"),
  "capability.allSkills": tr("ทุกความสามารถ", "All skills"),
  "capability.anyLevel": tr("ทุกระดับ", "Any level"),
  "capability.minYearsExperience": tr("ประสบการณ์ขั้นต่ำ (ปี)", "Min. Experience (years)"),

  // Dashboard — skill analytics
  "capability.dashboardTitle": tr("ความเชี่ยวชาญและศักยภาพกำลังพล", "Personnel Capability"),
  "capability.topSkills": tr("ทักษะยอดนิยม", "Top Skills"),
  "capability.languageSpeakers": tr("ผู้ใช้ภาษาต่างประเทศ", "Language Speakers"),
  "capability.aiExperts": tr("ผู้เชี่ยวชาญ AI", "AI Experts"),
  "capability.droneExperts": tr("ผู้เชี่ยวชาญโดรน", "Drone Experts"),
  "capability.allInstructors": tr("ครูฝึกทั้งหมด", "All Instructors"),
  "capability.medicalStaff": tr("เจ้าหน้าที่ด้านการแพทย์", "Medical Staff"),
  "capability.legalStaff": tr("เจ้าหน้าที่ด้านกฎหมาย", "Legal Staff"),
  "capability.itStaff": tr("เจ้าหน้าที่ด้านไอที", "IT Staff"),
  "capability.prStaff": tr("เจ้าหน้าที่ด้านประชาสัมพันธ์", "PR Staff"),
  "capability.certsExpiring": tr("ใบรับรองใกล้หมดอายุ", "Certificates Expiring Soon"),
  "capability.skillCoverage": tr("ความครอบคลุมทักษะ", "Skill Coverage"),
  "capability.deploymentReady": tr("พร้อมปฏิบัติภารกิจ", "Deployment Ready"),
  "capability.officersWithSkills": tr("กำลังพลที่มีทักษะบันทึกไว้", "Officers with recorded skills"),
  "capability.peopleUnit": tr("นาย", "officers"),

  // ── timeline.* — Phase 45 Timeline Workspace UX ──
  "timeline.title": tr("ประวัติการรับราชการ", "Career Timeline"),
  "timeline.addRow": tr("เพิ่มแถว", "Add Entry"),
  "timeline.empty": tr("ยังไม่มีข้อมูลประวัติการรับราชการ — กด \"เพิ่มแถว\" เพื่อเริ่มกรอก", "No career-history entries yet — press \"Add Entry\" to start."),
  "timeline.entry": tr("รายการที่", "Timeline"),
  "timeline.currentPosition": tr("ตำแหน่งปัจจุบัน", "Current Position"),
  "timeline.noDate": tr("ยังไม่ระบุวันที่", "No date"),
  "timeline.noPosition": tr("ยังไม่ระบุตำแหน่ง", "No position"),
  "timeline.noUnit": tr("ยังไม่ระบุหน่วย", "No unit"),
  "timeline.expand": tr("ขยาย", "Expand"),
  "timeline.collapse": tr("ย่อ", "Collapse"),
  "timeline.moveUp": tr("เลื่อนขึ้น", "Move up"),
  "timeline.moveDown": tr("เลื่อนลง", "Move down"),
  "timeline.delete": tr("ลบรายการนี้", "Delete this entry"),

  // Per-card + section status
  "timeline.statusDraft": tr("ร่าง", "Draft"),
  "timeline.statusSaving": tr("กำลังบันทึก", "Saving"),
  "timeline.statusSaved": tr("บันทึกแล้ว", "Saved"),
  "timeline.statusError": tr("ผิดพลาด", "Error"),
  "timeline.unsavedChanges": tr("มีการแก้ไขที่ยังไม่บันทึก", "Unsaved changes"),

  // Verification (single control — Part 6)
  "timeline.verification": tr("การตรวจสอบ", "Verification"),
  "timeline.verificationStatus": tr("สถานะการตรวจสอบ", "Verification Status"),
  "timeline.notVerified": tr("ยังไม่ตรวจสอบ", "Not verified"),
  "timeline.verifiedBy": tr("ผู้ตรวจสอบ", "Verified By"),
  "timeline.verifiedDate": tr("วันที่ตรวจสอบ", "Verified Date"),
  "timeline.verificationRemark": tr("หมายเหตุการตรวจสอบ", "Verification Remark"),

  // Validation warnings (Part 8/9) — advisory
  "timeline.warningsTitle": tr("ข้อควรตรวจสอบ (ไม่บล็อกการบันทึก)", "Please review (does not block saving)"),
  "timeline.warnMultipleCurrent": tr("มีตำแหน่งปัจจุบันมากกว่าหนึ่งรายการ", "More than one entry is marked as the current position."),
  "timeline.warnYearOrder": tr("ลำดับปีอาจไม่เรียงกัน", "The years may be out of order."),
  "timeline.warnOverlapping": tr("มีรายการที่ปีซ้ำกัน", "Some entries share the same year."),
  "timeline.warnMissingFields": tr("บางรายการยังไม่ได้กรอกปีหรือตำแหน่ง", "Some entries are missing a year or a position."),

  // ── document.* — Phase 45A document status + filter ──
  "document.statusVerified": tr("ตรวจสอบแล้ว", "Verified"),
  "document.statusPending": tr("รอตรวจสอบ", "Pending Review"),
  "document.statusMissing": tr("ยังไม่มีเอกสาร", "No Document"),
  "document.statusExpired": tr("หมดอายุ", "Expired"),
  "document.statusRejected": tr("ปฏิเสธ", "Rejected"),
  "document.filterAll": tr("ทั้งหมด", "All"),
  "document.filterVerified": tr("ตรวจสอบแล้ว", "Verified"),
  "document.filterPending": tr("รอตรวจสอบ", "Pending"),
  "document.filterMissing": tr("ยังไม่มีเอกสาร", "Missing"),
  "document.filterLabel": tr("กรองเอกสาร", "Filter documents"),

  // ── epf.* — Phase 46 Electronic Personnel File (e-PF) Foundation ──
  "epf.sectionTitle": tr("แฟ้มประวัติอิเล็กทรอนิกส์ (e-PF)", "Electronic Personnel File (e-PF)"),
  "epf.sectionSubtitle": tr(
    "ศูนย์รวมเอกสารประจำตัวข้าราชการตำรวจ",
    "Central document repository for this officer"
  ),
  "epf.documentCount": tr("เอกสารทั้งหมด", "Total Documents"),
  "epf.categoryDocumentCount": tr("รายการ", "documents"),
  "epf.collapseCategory": tr("ย่อหมวดหมู่", "Collapse category"),
  "epf.expandCategory": tr("ขยายหมวดหมู่", "Expand category"),

  // Search
  "epf.searchLabel": tr("ค้นหาในแฟ้มประวัติ", "Search in e-PF"),
  "epf.searchPlaceholder": tr("ค้นหาชื่อ, หมวดหมู่, แท็ก, เลขที่เอกสาร", "Search title, category, tag, document number"),
  "epf.searchNoResults": tr("ไม่พบเอกสารที่ตรงกับการค้นหา", "No documents match your search."),

  // Filters
  "epf.filterCategory": tr("หมวดหมู่", "Category"),
  "epf.filterStatus": tr("สถานะ", "Status"),
  "epf.filterYear": tr("ปี", "Year"),
  "epf.filterUploadedBy": tr("ผู้อัปโหลด", "Uploaded By"),
  "epf.filterAllCategories": tr("ทุกหมวดหมู่", "All Categories"),
  "epf.filterAllYears": tr("ทุกปี", "All Years"),
  "epf.filterAllUploaders": tr("ทุกคน", "Everyone"),
  "epf.sortLabel": tr("เรียงลำดับ", "Sort"),
  "epf.sortNewest": tr("ใหม่ล่าสุด", "Newest"),
  "epf.sortOldest": tr("เก่าที่สุด", "Oldest"),
  "epf.sortAlphabetical": tr("ตามตัวอักษร", "Alphabetical"),

  // Document status (e-PF badge language — reuses document.status* tones)
  "epf.statusOfficial": tr("เอกสารทางการ", "Official"),
  "epf.statusVerified": tr("ตรวจสอบแล้ว", "Verified"),
  "epf.statusPendingVerification": tr("รอการตรวจสอบ", "Pending Verification"),
  "epf.statusArchived": tr("จัดเก็บถาวร", "Archived"),
  "epf.statusDraft": tr("ยังไม่มีเอกสาร", "Draft"),

  // Document card
  "epf.cardIssueDate": tr("วันที่ออกเอกสาร", "Issue Date"),
  "epf.cardUploadedDate": tr("วันที่อัปโหลด", "Uploaded"),
  "epf.cardFileSize": tr("ขนาดไฟล์", "File Size"),
  "epf.cardFileType": tr("ประเภทไฟล์", "File Type"),
  "epf.cardUploadedBy": tr("อัปโหลดโดย", "Uploaded By"),
  "epf.cardAiReady": tr("พร้อมสำหรับ AI", "AI Ready"),
  "epf.cardPreview": tr("ดูตัวอย่าง", "Preview"),
  "epf.cardDownload": tr("ดาวน์โหลด", "Download"),
  "epf.cardDetails": tr("รายละเอียด", "Details"),
  "epf.cardHistory": tr("ประวัติ", "History"),
  "epf.cardUpload": tr("อัปโหลด", "Upload"),
  "epf.cardReplace": tr("แทนที่", "Replace"),

  // Detail drawer
  "epf.detailTitle": tr("รายละเอียดเอกสาร", "Document Details"),
  "epf.detailClose": tr("ปิด", "Close"),
  "epf.detailMetadataHeading": tr("ข้อมูลเอกสาร", "Metadata"),
  "epf.detailNotesHeading": tr("หมายเหตุ", "Notes"),
  "epf.detailTimelineHeading": tr("ไทม์ไลน์", "Timeline"),
  "epf.detailHistoryHeading": tr("ประวัติการอัปโหลด", "Upload History"),
  "epf.detailAiHeading": tr("การวิเคราะห์ด้วย AI", "AI Analysis"),
  "epf.detailAiComingSoon": tr("ความสามารถนี้จะเปิดใช้งานในระยะถัดไป", "This capability will be available in a future phase."),
  "epf.detailFieldTitle": tr("ชื่อเอกสาร", "Title"),
  "epf.detailFieldDescription": tr("คำอธิบาย", "Description"),
  "epf.detailFieldCategory": tr("หมวดหมู่", "Category"),
  "epf.detailSave": tr("บันทึก", "Save"),
  "epf.detailCancel": tr("ยกเลิก", "Cancel"),
  "epf.detailSaved": tr("บันทึกแล้ว", "Saved"),
  "epf.detailSaveFailed": tr("บันทึกไม่สำเร็จ", "Failed to save"),
  "epf.detailUnsupportedFieldsNote": tr(
    "เลขที่เอกสาร วันที่ออกเอกสาร หน่วยงานที่ออก แท็ก และหมายเหตุ จะรองรับในระยะถัดไป",
    "Document number, issue date, issuing agency, tags, and remarks will be supported in a future phase."
  ),

  // Empty state
  "epf.emptyStateTitle": tr("ยังไม่มีการอัปโหลดเอกสารประจำตัว", "No personnel documents have been uploaded."),
  "epf.emptyStateAction": tr("อัปโหลดเอกสาร", "Upload Document"),

  // Category labels (Phase 46 — DOCUMENT_CATEGORIES)
  "epf.category.IDENTITY": tr("เอกสารประจำตัว", "Identity Documents"),
  "epf.category.OFFICIAL_PERSONNEL": tr("เอกสารราชการ", "Official Personnel Documents"),
  "epf.category.EDUCATION": tr("การศึกษา", "Education"),
  "epf.category.TRAINING": tr("การฝึกอบรม", "Training"),
  "epf.category.AWARDS": tr("เกียรติบัตรและรางวัล", "Awards"),
  "epf.category.MEDICAL": tr("การแพทย์", "Medical"),
  "epf.category.FINANCIAL": tr("การเงิน", "Financial"),
  "epf.category.WEAPONS_QUALIFICATION": tr("การทดสอบอาวุธปืน", "Weapons Qualification"),
  "epf.category.MISCELLANEOUS": tr("เอกสารอื่น ๆ", "Miscellaneous"),

  // ── epf.dashboard.* — Phase 46A Intelligence Dashboard ──
  "epf.dashboard.title": tr("ภาพรวมแฟ้มประวัติ", "e-PF Overview"),
  "epf.dashboard.totalDocuments": tr("เอกสารทั้งหมด", "Total Documents"),
  "epf.dashboard.categoriesUsed": tr("หมวดหมู่ที่ใช้งาน", "Categories Used"),
  "epf.dashboard.completionPercent": tr("ความสมบูรณ์ของแฟ้ม", "Completion"),
  "epf.dashboard.missingRecommended": tr("เอกสารแนะนำที่ขาด", "Missing Recommended"),
  "epf.dashboard.recentlyUploaded": tr("อัปโหลดล่าสุด", "Recently Uploaded"),
  "epf.dashboard.totalStorage": tr("พื้นที่จัดเก็บทั้งหมด", "Total Storage Used"),
  "epf.dashboard.largestFile": tr("ไฟล์ขนาดใหญ่ที่สุด", "Largest File"),
  "epf.dashboard.latestUpdated": tr("อัปเดตล่าสุด", "Latest Updated"),
  "epf.dashboard.unknown": tr("ไม่ทราบ", "Unknown"),
  "epf.dashboard.none": tr("ไม่มี", "None"),

  // Completeness intelligence
  "epf.completeness.title": tr("ความสมบูรณ์ของเอกสาร", "Document Completeness"),
  "epf.completeness.present": tr("มีเอกสารแล้ว", "Present"),
  "epf.completeness.missing": tr("ยังไม่มี", "Missing"),
  "epf.completeness.unknown": tr("ไม่ทราบสถานะ", "Unknown"),
  "epf.completeness.progressLabel": tr("ความคืบหน้าความสมบูรณ์ของแฟ้มประวัติ", "e-PF completeness progress"),
  "epf.completeness.checklist.GP7": tr("ก.พ.7", "GP7"),
  "epf.completeness.checklist.OFFICIAL_PORTRAIT": tr("ภาพถ่ายทางการ", "Official Portrait"),
  "epf.completeness.checklist.NATIONAL_ID": tr("บัตรประชาชน", "ID Card"),
  "epf.completeness.checklist.HOUSE_REGISTRATION": tr("ทะเบียนบ้าน", "House Registration"),
  "epf.completeness.checklist.EDUCATION_CERTIFICATE": tr("วุฒิการศึกษา", "Education"),
  "epf.completeness.checklist.TRAINING_CERTIFICATE": tr("การฝึกอบรม", "Training"),
  "epf.completeness.checklist.AWARD": tr("เกียรติบัตร/รางวัล", "Awards"),
  "epf.completeness.checklist.MEDICAL_DOCUMENT": tr("เอกสารทางการแพทย์", "Medical"),
  "epf.completeness.checklist.SALARY_DOCUMENT": tr("เอกสารเงินเดือน", "Salary"),
  "epf.completeness.checklist.ANNUAL_EVALUATION": tr("แบบประเมินผลงานประจำปี", "Evaluation"),
  "epf.completeness.checklist.FIREARMS_QUALIFICATION": tr("ผลทดสอบอาวุธปืน", "Firearms Qualification"),

  // Missing document panel
  "epf.missingPanel.title": tr("เอกสารที่แนะนำให้เพิ่มเติม", "Documents Recommended for Completion"),
  "epf.missingPanel.allComplete": tr("เอกสารครบถ้วนตามรายการแนะนำแล้ว", "All recommended documents are on file."),
  "epf.missingPanel.upload": tr("อัปโหลด", "Upload"),
  "epf.missingPanel.groupRequired": tr("เอกสารจำเป็น", "Required Documents"),
  "epf.missingPanel.groupProfessional": tr("เอกสารวิชาชีพ", "Professional Documents"),
  "epf.missingPanel.groupOptional": tr("เอกสารเพิ่มเติม", "Optional Documents"),

  // Recent activity
  "epf.activity.title": tr("กิจกรรมล่าสุด", "Recent Activity"),
  "epf.activity.uploaded": tr("อัปโหลดแล้ว", "Uploaded"),
  "epf.activity.updated": tr("อัปเดตแล้ว", "Updated"),
  "epf.activity.empty": tr("ยังไม่มีกิจกรรม", "No activity yet."),

  // Quick actions
  "epf.actions.upload": tr("อัปโหลดเอกสาร", "Upload Document"),
  "epf.actions.expandAll": tr("ขยายทั้งหมด", "Expand All"),
  "epf.actions.collapseAll": tr("ย่อทั้งหมด", "Collapse All"),
  "epf.actions.downloadSelected": tr("ดาวน์โหลดที่เลือก", "Download Selected"),
  "epf.actions.printEpf": tr("พิมพ์แฟ้มประวัติ", "Print e-PF"),
  "epf.actions.exportPdf": tr("ส่งออก PDF", "Export PDF"),
  "epf.actions.ocr": tr("OCR อัตโนมัติ", "Automatic OCR"),
  "epf.actions.aiAnalysis": tr("การวิเคราะห์ด้วย AI", "AI Analysis"),
  "epf.actions.comingSoon": tr("จะเปิดใช้งานในระยะถัดไป", "Coming in a future phase"),

  // Storage summary
  "epf.storage.title": tr("สรุปพื้นที่จัดเก็บ", "Storage Summary"),
  "epf.storage.total": tr("พื้นที่ทั้งหมด", "Total Storage"),
  "epf.storage.average": tr("ขนาดเฉลี่ยต่อเอกสาร", "Average Document Size"),
  "epf.storage.largest": tr("เอกสารขนาดใหญ่ที่สุด", "Largest Document"),
  "epf.storage.images": tr("รูปภาพ", "Images"),
  "epf.storage.pdfs": tr("PDF", "PDFs"),
  "epf.storage.other": tr("อื่น ๆ", "Other"),

  // Category dashboard
  "epf.categoryDashboard.documents": tr("เอกสาร", "documents"),
  "epf.categoryDashboard.storage": tr("พื้นที่จัดเก็บ", "Storage"),
  "epf.categoryDashboard.lastUpdated": tr("อัปเดตล่าสุด", "Last updated"),
  "epf.categoryDashboard.noUpdates": tr("ยังไม่มีการอัปเดต", "No updates yet"),

  // ── epf.expiry.* — Phase 47 Document Expiry Intelligence ──
  "epf.expiry.sectionTitle": tr("ข้อมูลวิเคราะห์วันหมดอายุเอกสาร", "Document Expiry Intelligence"),
  "epf.expiry.expiringSoon": tr("ใกล้หมดอายุ", "Expiring Soon"),
  "epf.expiry.expired": tr("หมดอายุแล้ว", "Expired"),
  "epf.expiry.unknownExpiry": tr("ไม่ทราบวันหมดอายุ", "Unknown Expiry"),
  "epf.expiry.healthy": tr("ยังไม่หมดอายุ", "Healthy"),
  "epf.expiry.statusValid": tr("ยังไม่หมดอายุ", "Valid"),
  "epf.expiry.statusExpiringSoon": tr("ใกล้หมดอายุ", "Expiring Soon"),
  "epf.expiry.statusExpired": tr("หมดอายุแล้ว", "Expired"),
  "epf.expiry.statusUnknown": tr("ไม่ทราบ", "Unknown"),
  "epf.expiry.daysRemaining": tr("เหลือเวลา", "Days Remaining"),
  "epf.expiry.daysUnit": tr("วัน", "days"),
  "epf.expiry.daysOverdue": tr("เกินกำหนด", "overdue"),
  "epf.expiry.today": tr("วันนี้", "Today"),

  // Timeline groups
  "epf.expiry.timelineTitle": tr("ไทม์ไลน์วันหมดอายุ", "Expiry Timeline"),
  "epf.expiry.groupExpired": tr("หมดอายุแล้ว", "Expired"),
  "epf.expiry.groupNext30": tr("30 วันข้างหน้า", "Next 30 Days"),
  "epf.expiry.groupNext60": tr("60 วันข้างหน้า", "Next 60 Days"),
  "epf.expiry.groupNext90": tr("90 วันข้างหน้า", "Next 90 Days"),
  "epf.expiry.groupLater": tr("มากกว่า 90 วัน", "Later"),
  "epf.expiry.groupUnknown": tr("ไม่ทราบวันหมดอายุ", "Unknown Expiry"),
  "epf.expiry.timelineEmpty": tr("ไม่มีเอกสารที่ติดตามวันหมดอายุ", "No expiry-tracked documents."),

  // Alert panel
  "epf.expiry.alertTitle": tr("ต้องดำเนินการ", "Attention Required"),
  "epf.expiry.alertEmpty": tr("ไม่มีรายการที่ต้องดำเนินการ", "Nothing requires attention right now."),
  "epf.expiry.alertExpiresIn": tr("หมดอายุในอีก", "expires in"),
  "epf.expiry.alertExpiredSince": tr("หมดอายุแล้ว", "expired"),
  "epf.expiry.alertMissing": tr("ยังไม่มีเอกสาร", "missing"),
  "epf.expiry.alertReview": tr("ตรวจสอบ", "Review"),
  "epf.expiry.alertRenew": tr("ต่ออายุ", "Renew"),
  "epf.expiry.alertUpload": tr("อัปโหลด", "Upload"),

  // Readiness summary
  "epf.expiry.readinessTitle": tr("สรุปความพร้อมของเอกสาร", "Document Readiness Summary"),
  "epf.expiry.readinessAllValid": tr("เอกสารที่ติดตามทั้งหมดยังไม่หมดอายุ", "All monitored documents are valid."),
  "epf.expiry.readinessNeedsRenewal": tr("เอกสารต้องต่ออายุ", "documents require renewal."),
  "epf.expiry.readinessExpired": tr("เอกสารหมดอายุแล้ว", "expired documents."),
  "epf.expiry.readinessNoneTracked": tr("ยังไม่มีเอกสารที่ติดตามวันหมดอายุ", "No documents are being expiry-tracked yet."),

  // Detail drawer
  "epf.expiry.detailIssueDate": tr("วันที่ออกเอกสาร", "Issue Date"),
  "epf.expiry.detailExpiryDate": tr("วันหมดอายุ", "Expiry Date"),
  "epf.expiry.detailRenewalDate": tr("วันที่ต่ออายุ", "Renewal Date"),
  "epf.expiry.detailDaysRemaining": tr("จำนวนวันคงเหลือ", "Days Remaining"),
  "epf.expiry.detailStatus": tr("สถานะวันหมดอายุ", "Expiry Status"),
  "epf.expiry.detailNotSet": tr("ยังไม่ระบุ", "Not set"),
  "epf.expiry.detailHeading": tr("ข้อมูลวันหมดอายุ", "Expiry Information"),

  // Search & filter
  "epf.expiry.filterExpiryStatus": tr("สถานะวันหมดอายุ", "Expiry Status"),
  "epf.expiry.filterExpiringWithin": tr("ใกล้หมดอายุภายใน", "Expiring Within"),
  "epf.expiry.filterExpiringWithin30": tr("30 วัน", "30 days"),
  "epf.expiry.filterExpiringWithin60": tr("60 วัน", "60 days"),
  "epf.expiry.filterExpiringWithin90": tr("90 วัน", "90 days"),
  "epf.expiry.sortNewestExpiry": tr("วันหมดอายุใหม่สุด", "Newest Expiry"),
  "epf.expiry.sortOldestExpiry": tr("วันหมดอายุเก่าสุด", "Oldest Expiry"),

  // ── epf.hero.* — Phase 46B Executive Hero Summary ──
  "epf.hero.title": tr("แฟ้มประวัติอิเล็กทรอนิกส์", "Electronic Personnel File"),
  "epf.hero.fileHealth": tr("สถานะความสมบูรณ์ของแฟ้ม", "Officer File Health"),
  "epf.hero.documentCount": tr("จำนวนเอกสาร", "Documents"),
  "epf.hero.storageUsed": tr("พื้นที่จัดเก็บ", "Storage Used"),
  "epf.hero.lastUpdated": tr("อัปเดตล่าสุด", "Last Updated"),

  // File Health card
  "epf.health.title": tr("สถานะความสมบูรณ์ของแฟ้ม", "File Health"),
  "epf.health.healthy": tr("สมบูรณ์ดี", "Healthy"),
  "epf.health.needsAttention": tr("ควรตรวจสอบ", "Needs Attention"),
  "epf.health.incomplete": tr("ยังไม่สมบูรณ์", "Incomplete"),
  "epf.health.complete": tr("ครบถ้วน", "Complete"),
  "epf.health.missing": tr("ขาดหาย", "Missing"),
  "epf.health.unknown": tr("ไม่ทราบ", "Unknown"),

  // AI Insights (deterministic, rule-based — never an LLM)
  "epf.insights.title": tr("ข้อมูลเชิงวิเคราะห์", "AI Insights"),
  "epf.insights.subtitle": tr("สรุปข้อเท็จจริงจากข้อมูลที่มีอยู่โดยอัตโนมัติ", "Automated facts derived from existing data"),
  "epf.insights.empty": tr("ยังไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์", "Not enough data yet for insights."),
  "epf.insight.missingGp7": tr("ยังไม่มีการอัปโหลด ก.พ.7", "GP7 has not been uploaded."),
  "epf.insight.missingMedical": tr("ยังไม่มีใบรับรองแพทย์", "Medical certificate is missing."),
  "epf.insight.missingPortrait": tr("ยังไม่มีภาพถ่ายทางการ", "Official portrait is missing."),
  "epf.insight.hasPortrait": tr("มีภาพถ่ายทางการแล้ว", "Official portrait already exists."),
  "epf.insight.hasTraining": tr("มีเอกสารการฝึกอบรม", "Training records available."),
  "epf.insight.hasAwards": tr("มีเอกสารเกียรติบัตร/รางวัล", "Awards available."),
  "epf.insight.pendingVerification": tr("มีเอกสารรอการตรวจสอบ", "documents pending verification."),
  "epf.insight.latestUploadDaysAgo": tr("อัปโหลดล่าสุดเมื่อ", "Latest upload was"),
  "epf.insight.latestUploadDaysAgoSuffix": tr("วันที่แล้ว", "days ago."),
  "epf.insight.completionSummary": tr("แฟ้มประวัติมีความสมบูรณ์", "Personnel file is"),
  "epf.insight.completionSummarySuffix": tr("เปอร์เซ็นต์", "% complete."),

  // Recommended Next Actions
  "epf.nextActions.title": tr("ขั้นตอนที่แนะนำต่อไป", "Recommended Next Actions"),
  "epf.action.uploadMissing": tr("อัปโหลดเอกสารที่ขาด", "Upload missing document"),
  "epf.action.verifyPending": tr("ตรวจสอบเอกสารที่รอดำเนินการ", "documents awaiting verification"),
  "epf.action.reviewRecent": tr("ตรวจทานเอกสารที่อัปเดตล่าสุด", "Review recently updated document"),
  "epf.action.completeProfile": tr("ดำเนินการให้แฟ้มประวัติสมบูรณ์", "Complete the personnel file"),
  "epf.action.uploadMissingExplain": tr("เอกสารนี้ยังไม่มีในแฟ้มประวัติ", "This document has not been added to the file yet."),
  "epf.action.verifyPendingExplain": tr("เอกสารเหล่านี้อัปโหลดแล้วแต่ยังไม่ได้รับการตรวจสอบ", "These documents have been uploaded but not yet verified."),
  "epf.action.reviewRecentExplain": tr("มีเอกสารที่เพิ่งอัปโหลดหรืออัปเดต ควรตรวจทาน", "A document was recently uploaded or updated and may need review."),
  "epf.action.completeProfileExplain": tr("แฟ้มประวัติยังไม่ครบตามรายการแนะนำ", "The personnel file is not yet complete against the recommended checklist."),

  // Quick Actions groups
  "epf.actions.availableGroup": tr("การดำเนินการที่ใช้งานได้", "Available Actions"),
  "epf.actions.futureGroup": tr("ความสามารถในอนาคต", "Future Capabilities"),
  "epf.actions.futurePhaseBadge": tr("ระยะถัดไป", "Future Phase"),

  // Improved empty states
  "epf.emptyStateHelp": tr("อัปโหลดเอกสารเพื่อเริ่มต้นแฟ้มประวัติอิเล็กทรอนิกส์ของเจ้าหน้าที่นายนี้", "Upload a document to start building this officer's electronic personnel file."),
  "epf.categoryEmptyState": tr("ยังไม่มีเอกสารในหมวดหมู่นี้", "No documents have been uploaded in this category."),
  "epf.categoryEmptyUpload": tr("อัปโหลดเอกสารแรก", "Upload First Document"),

  // Recent activity grouping
  "epf.activity.groupToday": tr("วันนี้", "Today"),
  "epf.activity.groupLast7Days": tr("7 วันล่าสุด", "Last 7 Days"),
  "epf.activity.groupEarlier": tr("ก่อนหน้านี้", "Earlier"),

  // ── auth.* — Phase 46 login screen ──
  "auth.systemNameShort": tr("BPPIS", "BPPIS"),
  // Phase 46A: title parts (each styled distinctly — see requirement 3).
  "auth.orgName": tr("Border Patrol Police", "Border Patrol Police"),
  "auth.systemNameFull": tr("Personnel Intelligence System", "Personnel Intelligence System"),
  "auth.systemNameAbbrev": tr("(BPPIS)", "(BPPIS)"),
  // Two-line Thai subtitle.
  "auth.systemSubtitleLine1": tr("ระบบสารสนเทศกำลังพล", "Border Patrol Police"),
  "auth.systemSubtitleLine2": tr("ตำรวจตระเวนชายแดน", "Personnel Intelligence System"),
  "auth.signInTitle": tr("เข้าสู่ระบบ", "Sign in"),
  "auth.signInSubtitle": tr("กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ", "Please sign in to continue"),
  "auth.username": tr("ชื่อผู้ใช้", "Username"),
  // Multi-line non-email placeholder (examples).
  "auth.usernamePlaceholder": tr("เช่น admin หรือเลขบัตรประชาชน", "e.g. admin or national ID number"),
  "auth.password": tr("รหัสผ่าน", "Password"),
  "auth.passwordPlaceholder": tr("กรอกรหัสผ่าน", "Enter your password"),
  "auth.showPassword": tr("แสดงรหัสผ่าน", "Show password"),
  "auth.hidePassword": tr("ซ่อนรหัสผ่าน", "Hide password"),
  "auth.rememberMe": tr("จดจำการเข้าสู่ระบบ", "Remember me"),
  // Phase 46A: Forgot Password replaced by a disabled "Contact Administrator".
  "auth.contactAdministrator": tr("ติดต่อผู้ดูแลระบบ", "Contact Administrator"),
  "auth.login": tr("เข้าสู่ระบบ", "Log in"),
  "auth.loggingIn": tr("กำลังเข้าสู่ระบบ…", "Signing in…"),
  "auth.errorInvalidCredentials": tr("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "Invalid username or password."),
  "auth.errorAccountDisabled": tr("บัญชีนี้ถูกระงับการใช้งาน", "This account has been disabled."),
  "auth.errorUnknown": tr("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", "Something went wrong. Please try again."),
  // Phase 46A: demo accounts card (dev-only).
  "auth.demoAccounts": tr("บัญชีทดลอง", "Demo Accounts"),
  "auth.demoAdmin": tr("ผู้ดูแลระบบ", "Admin"),
  "auth.demoCommander": tr("ผู้บังคับบัญชา", "Commander"),
  // Phase 46A: footer.
  "auth.versionLabel": tr("เวอร์ชัน 1.0", "Version 1.0"),
  "auth.buildLabel": tr("Build 2026.07 • Phase 46", "Build 2026.07 • Phase 46"),
  "auth.authorizedOnly": tr("ระบบนี้สำหรับเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น", "For authorized personnel only."),
  "auth.unauthorizedProhibited": tr("ห้ามเข้าถึงโดยไม่ได้รับอนุญาต", "Unauthorized access is prohibited."),
  "auth.systemArchitect": tr("พัฒนาและดูแลระบบ", "Developed & Maintained by"),
  "auth.phoneLabel": tr("โทรศัพท์", "Phone"),
  // User menu (Phase 46 foundation)
  "auth.logout": tr("ออกจากระบบ", "Log out"),
  "auth.userMenu": tr("เมนูผู้ใช้", "User menu"),
  "auth.roleAdmin": tr("ผู้ดูแลระบบ", "Administrator"),
  "auth.roleCommander": tr("ผู้บังคับบัญชา", "Commander"),
  "auth.roleOfficer": tr("กำลังพล", "Officer"),
  // Phase 47 — restricted profile view (officer viewing a colleague)
  "auth.restrictedProfileNotice": tr(
    "คุณกำลังดูข้อมูลแบบจำกัดสิทธิ์ ข้อมูลส่วนบุคคลและประวัติเชิงลึกถูกซ่อนไว้",
    "You are viewing a restricted profile. Personal and detailed records are hidden.",
  ),

  // ── appearance.* — Phase 48A.1: theme switcher ──
  "appearance.switcher": tr("รูปแบบการแสดงผล", "Appearance"),
  "appearance.selectTheme": tr("เลือกธีม", "Select theme"),
  "appearance.currentTheme": tr("ธีมปัจจุบัน", "Current theme"),

  // ── sidebar.* — Phase 48A.1: enterprise sidebar redesign ──
  "sidebar.collapse": tr("ย่อเมนู", "Collapse sidebar"),
  "sidebar.expand": tr("ขยายเมนู", "Expand sidebar"),
} as const satisfies Record<string, Translation>;

export type TranslationKey = keyof typeof DICTIONARY;

/**
 * Resolves a key to a string in `lang`. Pure — usable in React (via useT),
 * server-side report/PDF/print templates, and AI-summary rendering alike.
 * Falls back to the default language, then the raw key, so a missing
 * translation degrades visibly (the key) rather than crashing.
 */
export function translate(key: TranslationKey, lang: Language): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  return entry[lang] ?? entry[DEFAULT_LANGUAGE] ?? key;
}
