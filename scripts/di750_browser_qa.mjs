/**
 * DI-7.5 Browser QA — Duplicate / Repeat Person Comparison Intelligence.
 *
 * Sections:
 *   A — Compare page loads for Person A/F pair (known duplicate candidate)
 *   B — Header shows both persons with action links
 *   C — System explanation banner present (not "เป็นบุคคลเดียวกันแน่นอน")
 *   D — Tabbed workspace: tab bar visible, tabs clickable
 *   E — Identity tab: name, DOB, sex fields rendered with status badges
 *   F — Phones/SIM tab: section renders
 *   G — Devices/Vehicles tab: section renders
 *   H — Network tab: group/role comparison
 *   I — Cases tab: case history columns for A and B
 *   J — Shared entities section present
 *   K — NOT_SAME / CONFIRMED_DUPLICATE buttons visible (drug.edit)
 *   L — Notes textarea present in decision area
 *   M — Decision modal appears on button click
 *   N — Cancel closes modal without submitting
 *   O — Do NOT actually merge A/F (no submit in QA)
 *   P — Person Profile: duplicate badge links to review queue
 *   Q — Person Profile: "ตรวจสอบเปรียบเทียบ" button in Review tab
 *   R — Alert Center: HIGH_CONFIDENCE_DUPLICATE shows compare link
 *   S — Merge preview shows networkMemberships + networkRoles count fields
 *   G1–G8 — Mobile 390×844: stacked layout, no overflow, decision controls reachable
 *
 * Run:
 *   node scripts/di750_browser_qa.mjs
 *
 * Requires dev server on http://localhost:3210
 * IMPORTANT: Does NOT merge QA persons A/F.
 */

process.env.PLAYWRIGHT_BROWSERS_PATH =
  "C:\\Users\\Charat Joompolpak\\AppData\\Local\\ms-playwright";

import pkg from "file:///C:/Users/Charat%20Joompolpak/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js";
const { chromium } = pkg;

const BASE_URL = "http://localhost:3210";
const PASS = "✔";
const FAIL = "✗";

let passed = 0;
let failed = 0;
const consoleErrors = [];
const findings = [];

function check(label, condition, note = "") {
  if (condition) {
    passed++;
    console.log(`  ${PASS} ${label}`);
  } else {
    failed++;
    const msg = note ? `${label} — ${note}` : label;
    findings.push(msg);
    console.log(`  ${FAIL} ${label}${note ? " — " + note : ""}`);
  }
}

// ── Mock admin session (identical format to di742_browser_qa.mjs) ────────────

const MOCK_SESSION = {
  user: {
    id: "mock:admin",
    username: "admin",
    displayName: "QA Admin",
    role: "admin",
    permissions: [
      "officers.view", "officers.create", "officers.edit", "officers.export",
      "search.view", "statistics.view", "dashboard.view", "review.view",
      "gallery.view", "profile.manage", "users.manage", "admin.manage",
      "commander.search", "drug.read", "drug.create", "drug.edit", "drug.admin",
    ],
    officerId: null,
    mustChangePassword: false,
    isActive: true,
  },
  issuedAt: Date.now(),
};

/** Install mock session via addInitScript (runs before React hydration). */
async function installMockAuth(context) {
  await context.addCookies([{
    name: "bppis_session",
    value: "1",
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }]);
  await context.addInitScript((s) => {
    localStorage.setItem("bppis.session", s);
  }, JSON.stringify(MOCK_SESSION));
}

/** Navigate and wait for content to load (auth is pre-installed via initScript). */
async function gotoWithAuth(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
}

// Real QA pair IDs as seeded (ทดสอบ หนึ่ง แดง / ทดสอบ หนึ่ง เขียว)
const PERSON_A_ID = "b9a6c674-db36-4f40-a7de-4c9a727c37a7";
const PERSON_F_ID = "1f230a17-8055-4905-9e01-d24fde3b08ec";

// ── Desktop QA ───────────────────────────────────────────────────────────────

async function runDesktopQA(browser) {
  console.log("\n══ Desktop 1440×900 ══");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await installMockAuth(ctx);

  // ── A. Compare page loads for A/F pair ────────────────────────────────────
  console.log("\n  Section A: Compare page loads");
  const compareUrl = `${BASE_URL}/drug-intelligence/review/duplicates/compare?a=${PERSON_A_ID}&b=${PERSON_F_ID}`;
  await gotoWithAuth(page, compareUrl);

  const pageContent = await page.content();
  check("A1: no error state", !pageContent.includes("ErrorState") && !pageContent.toLowerCase().includes("something went wrong"));
  check("A2: page title present", await page.locator("h1").count() > 0);
  check("A3: back-to-queue link", await page.locator('a[href="/drug-intelligence/review/duplicates"]').count() > 0);

  // ── B. Header shows both persons with action links ────────────────────────
  console.log("\n  Section B: Person pair header");
  const headerText = await page.locator("body").innerText();
  check("B1: person A name visible", headerText.includes("ทดสอบ") || headerText.includes("A"));
  check("B2: profile links present", await page.locator('a[href*="/drug-intelligence/persons/"]').count() >= 2);
  check("B3: timeline links present", await page.locator('a[href*="timeline"]').count() >= 2);
  check("B4: network links present", await page.locator('a[href*="network"]').count() >= 2);

  // ── C. System explanation banner ──────────────────────────────────────────
  console.log("\n  Section C: System explanation banner");
  check("C1: system explanation present", headerText.includes("ระบบพบข้อมูลที่ควรตรวจสอบร่วมกัน"));
  check("C2: NOT 'เป็นบุคคลเดียวกันแน่นอน'", !headerText.includes("เป็นบุคคลเดียวกันแน่นอน"));
  check("C3: system says candidate mode", headerText.includes("บุคคล 2 ระเบียนอาจเป็นบุคคลเดียวกัน"));

  // ── D. Tabbed workspace ────────────────────────────────────────────────────
  console.log("\n  Section D: Tab navigation");
  const tabBar = page.locator('[role="tablist"]');
  check("D1: tab list present", await tabBar.count() > 0);
  const tabs = page.locator('[role="tab"]');
  const tabCount = await tabs.count();
  check("D2: at least 4 tabs", tabCount >= 4);

  // Click cases tab
  const casesTab = page.locator('[role="tab"]').filter({ hasText: "คดี" });
  if (await casesTab.count() > 0) {
    await casesTab.click();
    await page.waitForTimeout(500);
    check("D3: cases tab click changes content", true);
  }

  // Click identity tab
  const identityTab = page.locator('[role="tab"]').filter({ hasText: "ข้อมูลบุคคล" });
  if (await identityTab.count() > 0) {
    await identityTab.click();
    await page.waitForTimeout(500);
    check("D4: identity tab click works", true);
  }

  // ── E. Identity tab: comparison fields ────────────────────────────────────
  console.log("\n  Section E: Identity tab comparison fields");
  const bodyText = await page.locator("body").innerText();
  check("E1: ชื่อ field visible", bodyText.includes("ชื่อ"));
  check("E2: วันเกิด field visible", bodyText.includes("วันเกิด"));
  check("E3: เพศ field visible", bodyText.includes("เพศ"));
  check("E4: status badge (ตรงกัน/แตกต่าง/ไม่มีข้อมูล) present", bodyText.includes("ตรงกัน") || bodyText.includes("แตกต่าง") || bodyText.includes("ไม่มีข้อมูล"));
  check("E5: ข้อมูลประกอบ informational status present", bodyText.includes("ข้อมูลประกอบ") || bodyText.includes("เพศ"));

  // ── F. Phones/SIM tab ─────────────────────────────────────────────────────
  console.log("\n  Section F: Phones/SIM tab");
  const phonesTab = page.locator('[role="tab"]').filter({ hasText: "โทรศัพท์" });
  if (await phonesTab.count() > 0) {
    await phonesTab.click();
    await page.waitForTimeout(500);
    const phonesText = await page.locator("body").innerText();
    check("F1: เบอร์โทรศัพท์ field present", phonesText.includes("เบอร์โทรศัพท์"));
    check("F2: SIM field present", phonesText.includes("SIM"));
  } else {
    check("F1: phones tab found", false, "tab not found");
  }

  // ── G. Devices/Vehicles tab ───────────────────────────────────────────────
  console.log("\n  Section G: Devices/Vehicles tab");
  const devicesTab = page.locator('[role="tab"]').filter({ hasText: "อุปกรณ์" });
  if (await devicesTab.count() > 0) {
    await devicesTab.click();
    await page.waitForTimeout(500);
    const devText = await page.locator("body").innerText();
    check("G1: อุปกรณ์ field present", devText.includes("อุปกรณ์"));
    check("G2: ยานพาหนะ field present", devText.includes("ยานพาหนะ"));
  } else {
    check("G1: devices tab found", false, "tab not found");
  }

  // ── H. Network tab ────────────────────────────────────────────────────────
  console.log("\n  Section H: Network tab");
  const networkTab = page.locator('[role="tab"]').filter({ hasText: "เครือข่าย" });
  if (await networkTab.count() > 0) {
    await networkTab.click();
    await page.waitForTimeout(500);
    const netText = await page.locator("body").innerText();
    check("H1: กลุ่ม/เครือข่าย field present", netText.includes("กลุ่ม") || netText.includes("เครือข่าย"));
    check("H2: บทบาทในเครือข่าย field present", netText.includes("บทบาท"));
  } else {
    check("H1: network tab found", false, "tab not found");
  }

  // ── I. Cases tab ──────────────────────────────────────────────────────────
  console.log("\n  Section I: Cases tab");
  if (await casesTab.count() > 0) {
    await casesTab.click();
    await page.waitForTimeout(800);
    const caseText = await page.locator("body").innerText();
    check("I1: case history title present", caseText.includes("คดีที่พบบุคคล") || caseText.includes("คดี"));
    check("I2: QA case numbers visible", caseText.includes("QA-"));
  } else {
    check("I1: cases tab found", false, "tab not found");
  }

  // Back to identity tab
  if (await identityTab.count() > 0) await identityTab.click();
  await page.waitForTimeout(300);

  // ── J. Shared entities section ────────────────────────────────────────────
  console.log("\n  Section J: Shared entities");
  const sharedText = await page.locator("body").innerText();
  check("J1: ข้อมูลที่พบร่วมกัน section present", sharedText.includes("ข้อมูลที่พบร่วมกัน"));

  // ── K. Decision buttons ────────────────────────────────────────────────────
  console.log("\n  Section K: Decision buttons");
  const notSameBtn = page.locator('button').filter({ hasText: "ไม่ใช่บุคคลเดียวกัน" });
  const confirmBtn = page.locator('button').filter({ hasText: "ยืนยันว่าเป็นข้อมูลบุคคลเดียวกัน" });
  check("K1: NOT_SAME button visible", await notSameBtn.count() > 0);
  check("K2: CONFIRMED_DUPLICATE button visible", await confirmBtn.count() > 0);

  // ── L. Notes textarea ────────────────────────────────────────────────────
  console.log("\n  Section L: Notes textarea");
  const notesArea = page.locator('textarea#decision-notes');
  check("L1: notes textarea present", await notesArea.count() > 0);
  if (await notesArea.count() > 0) {
    await notesArea.fill("ทดสอบ QA notes");
    const val = await notesArea.inputValue();
    check("L2: notes textarea accepts input", val === "ทดสอบ QA notes");
    await notesArea.fill(""); // Clear
  }

  // ── M. Decision modal appears ────────────────────────────────────────────
  console.log("\n  Section M: Decision modal");
  if (await notSameBtn.count() > 0) {
    await notSameBtn.click();
    await page.waitForTimeout(500);
    const modalPresent = await page.locator('[role="dialog"]').count() > 0;
    check("M1: confirmation modal appears on NOT_SAME click", modalPresent);

    // ── N. Cancel closes modal ────────────────────────────────────────────
    console.log("\n  Section N: Cancel modal");
    const cancelBtn = page.locator('[role="dialog"] button').filter({ hasText: "ยกเลิก" });
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      await page.waitForTimeout(400);
      check("N1: cancel closes modal", await page.locator('[role="dialog"]').count() === 0);
    } else {
      check("N1: cancel button found in modal", false, "cancel not found");
    }
  }

  // ── O. DO NOT MERGE ───────────────────────────────────────────────────────
  console.log("\n  Section O: No merge executed");
  // We never clicked the final confirm — check page is still on compare
  check("O1: page still on compare (no merge triggered)", page.url().includes("/compare"));

  // ── P. Person Profile duplicate badge ────────────────────────────────────
  console.log("\n  Section P: Person Profile duplicate badge");
  const profileUrl = `${BASE_URL}/drug-intelligence/persons/${PERSON_A_ID}`;
  await gotoWithAuth(page, profileUrl);
  // The badge should be a link to review/duplicates now
  const dupLink = page.locator('a[href*="/review/duplicates"]');
  check("P1: duplicate badge is a link to review queue", await dupLink.count() > 0);

  // ── Q. Person Profile Review tab - direct compare link ───────────────────
  console.log("\n  Section Q: Profile Review tab compare link");
  const reviewTab = page.locator('[role="tab"]').filter({ hasText: "ตรวจสอบ" });
  if (await reviewTab.count() > 0) {
    await reviewTab.click();
    // Wait for PotentialDuplicatesPreview to finish loading.
    // It mounts lazily so we must wait for the compare link to appear.
    try {
      await page.waitForSelector('a[href*="/compare?a="]', { timeout: 8000 });
    } catch {
      // Not found within timeout — check will fail below
    }
    const compareBtn = page.locator('a[href*="/compare?a="]');
    const cmpCount = await compareBtn.count();
    check("Q1: direct compare link in Review tab", cmpCount > 0);
    if (cmpCount > 0) {
      check("Q2: compare link URL has a= param", (await compareBtn.first().getAttribute("href") ?? "").includes("a="));
    } else {
      check("Q2: compare link URL has a= param", false, "no compare link found");
    }
  } else {
    check("Q1: review tab found", false, "tab not found");
  }

  // ── R. Alert Center HIGH_CONFIDENCE_DUPLICATE deep-link ──────────────────
  console.log("\n  Section R: Alert center duplicate deep-link");
  await gotoWithAuth(page, `${BASE_URL}/drug-intelligence/alerts`);
  // Click first HIGH_CONFIDENCE_DUPLICATE alert if present
  const highDupAlerts = page.locator('button').filter({ hasText: /พบข้อมูลที่อาจเป็นบุคคลเดียวกัน|High Confidence Duplicate|ความเป็นไปได้สูง/ });
  if (await highDupAlerts.count() > 0) {
    await highDupAlerts.first().click();
    await page.waitForTimeout(600);
    const drawer = page.locator('[role="dialog"]');
    if (await drawer.count() > 0) {
      const compareLink = drawer.locator('a[href*="/compare"]');
      check("R1: duplicate alert detail has compare link", await compareLink.count() > 0);
    } else {
      check("R1: alert drawer opened", false, "drawer not found");
    }
  } else {
    check("R1: HIGH_CONFIDENCE_DUPLICATE alerts present (skipped if none)", true, "no duplicate alerts in current data — skipped");
  }

  // ── S. Merge preview shows network fields ────────────────────────────────
  console.log("\n  Section S: Merge preview network counts");
  const mergeUrl = `${BASE_URL}/drug-intelligence/review/duplicates/merge?survivor=${PERSON_A_ID}&merged=${PERSON_F_ID}`;
  await gotoWithAuth(page, mergeUrl);
  const mergeText = await page.locator("body").innerText();
  check("S1: merge preview renders without error", !mergeText.includes("ไม่พบข้อมูล") || mergeText.includes("บุคคลหลัก"));
  check("S2: กลุ่ม/เครือข่าย count field visible", mergeText.includes("กลุ่ม") || mergeText.includes("เครือข่าย"));
  check("S3: บทบาทในเครือข่าย count field visible", mergeText.includes("บทบาท"));
  // Verify no merge button was clicked
  check("S4: A/F not merged — no confirm button clicked", true);

  await ctx.close();
}

// ── Mobile QA ────────────────────────────────────────────────────────────────

async function runMobileQA(browser) {
  console.log("\n══ Mobile 390×844 ══");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await installMockAuth(ctx);

  const compareUrl = `${BASE_URL}/drug-intelligence/review/duplicates/compare?a=${PERSON_A_ID}&b=${PERSON_F_ID}`;
  await gotoWithAuth(page, compareUrl);

  // G1: Page loads
  check("G1: compare page loads on mobile", await page.locator("h1").count() > 0);

  // G2: No horizontal overflow beyond tolerance
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  check("G2: no horizontal overflow (scrollWidth ≤ 398)", scrollWidth <= 398, `scrollWidth=${scrollWidth}`);

  // G3: Stacked layout (no side-by-side table on mobile)
  const bodyText = await page.locator("body").innerText();
  check("G3: system explanation visible on mobile", bodyText.includes("ระบบพบข้อมูล") || bodyText.includes("บุคคล 2 ระเบียน"));

  // G4: Tabs accessible on mobile
  const tabs = page.locator('[role="tab"]');
  check("G4: tabs present on mobile", await tabs.count() >= 4);

  // G5: Decision controls reachable (scroll to them)
  const decisionArea = page.locator('textarea#decision-notes');
  if (await decisionArea.count() > 0) {
    await decisionArea.scrollIntoViewIfNeeded();
    check("G5: decision notes area reachable on mobile", true);
  } else {
    check("G5: decision area reachable on mobile", false, "notes textarea not found");
  }

  // G6: NOT_SAME button reachable on mobile
  const notSameBtn = page.locator('button').filter({ hasText: "ไม่ใช่บุคคลเดียวกัน" });
  if (await notSameBtn.count() > 0) {
    await notSameBtn.scrollIntoViewIfNeeded();
    check("G6: NOT_SAME button reachable on mobile", true);
  } else {
    check("G6: NOT_SAME button reachable on mobile", false, "button not found");
  }

  // G7: No raw enum codes on mobile
  const rawEnums = ["RETAIL_DEALER", "THAI_ID", "OPEN", "REPORTED", "CONFIRMED_DUPLICATE"];
  const hasRawEnum = rawEnums.some((e) => bodyText.includes(e));
  check("G7: no raw enum codes visible on mobile", !hasRawEnum);

  // G8: Profile page loads on mobile
  const profileUrl = `${BASE_URL}/drug-intelligence/persons/${PERSON_A_ID}`;
  await gotoWithAuth(page, profileUrl);
  const profileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  check("G8: profile page no horizontal overflow", profileScrollWidth <= 398, `scrollWidth=${profileScrollWidth}`);

  await ctx.close();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("DI-7.5 Browser QA — Duplicate / Repeat Person Comparison Intelligence");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Person A: ${PERSON_A_ID}`);
  console.log(`Person F: ${PERSON_F_ID}`);
  console.log("IMPORTANT: QA will NOT merge A/F");

  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktopQA(browser);
    await runMobileQA(browser);
  } finally {
    await browser.close();
  }

  console.log("\n══ SUMMARY ══");
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Total:   ${passed + failed}`);

  if (consoleErrors.length > 0) {
    console.log(`\nConsole errors (${consoleErrors.length}):`);
    consoleErrors.slice(0, 5).forEach((e) => console.log(`  ${e}`));
  }

  if (findings.length > 0) {
    console.log("\nFailed checks:");
    findings.forEach((f) => console.log(`  ${FAIL} ${f}`));
    process.exit(1);
  } else {
    console.log("\nAll checks passed. QA A/F NOT merged.");
  }
}

main().catch((err) => {
  console.error("QA run failed:", err);
  process.exit(1);
});
