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
  "commander.exportPlaceholder": tr(
    "โครงสร้างการส่งออก (พร้อมสำหรับตัวเขียนไฟล์ในอนาคต)",
    "Export architecture placeholder. Data is already prepared for future file writers."
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
  /** "เกินกำหนด" — whole promotion opportunities already missed (PromotionSummary.overdueYears - 1, floored at 0; e.g. first eligible 2568, current fiscal year 2569 = 1 missed opportunity). Distinct from the deprecated commander.eligibleOverdue. */
  "commander.overdueYears": tr("เกินกำหนด", "Overdue"),
  /** "ปีนี้เป็นปีที่" — which numbered eligibility year this is (PromotionSummary.overdueYears, displayed as a bare number). */
  "commander.eligibilityYear": tr("ปีนี้เป็นปีที่", "Eligibility Year"),
  "commander.qualificationStatus": tr("สถานะ", "Status"),
  "commander.resultDistribution": tr("การกระจายผลลัพธ์", "Result Distribution"),
  "commander.rankDistribution": tr("การกระจายตามยศ", "Rank Distribution"),
  "commander.positionLevelDistribution": tr("การกระจายตามระดับตำแหน่ง", "Position Level Distribution"),
  "commander.companyDistribution": tr("การกระจายตามกองร้อย", "Company Distribution"),
  "commander.promotionCycleDistribution": tr("การกระจายรอบแต่งตั้ง", "Promotion Cycle Distribution"),
  "commander.retirementTimeline": tr("ไทม์ไลน์การเกษียณ", "Retirement Timeline"),
  "commander.retirementYear": tr("ปีเกษียณ", "Retirement Year"),

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
  "commander.intelligenceFlag": tr("สัญญาณข่าวกรอง", "Intelligence Flag"),
  "commander.priority": tr("ระดับความสำคัญ", "Priority"),
  "commander.minProfileCompleteness": tr("ความสมบูรณ์ของข้อมูลขั้นต่ำ", "Minimum Profile Completeness"),
  "commander.allRegions": tr("ทุกภาค", "All regions"),
  "commander.allBattalions": tr("ทุกกองกำกับการ", "All battalions"),
  "commander.allCompanies": tr("ทุกกองร้อย", "All companies"),

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
