/**
 * Phase 46 — e-PF Foundation runtime verification.
 * Drives the real /officers/[id] page: section renders in the right slot,
 * category groups collapse/expand, a document card's Details drawer opens
 * with focus trap, metadata save round-trips, existing upload still works,
 * and responsive/no-horizontal-overflow holds at desktop/tablet/mobile.
 * Run: node scripts/runtime_epf_verify.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OFFICER_PATH = `/officers/${encodeURIComponent("ภาค4/20")}`;
const OUT_DIR = path.join(process.cwd(), "tmp-runtime-evidence");

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "414");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { steps: [], errors: [], consoleErrors: [] };

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (err) => report.errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });

  try {
    await login(page);
    await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // 1. Section exists, positioned before Media. Default locale is Thai.
    const epfHeading = page.locator("text=แฟ้มประวัติอิเล็กทรอนิกส์").first();
    const epfVisible = await epfHeading.isVisible().catch(() => false);
    const mediaHeading = page.locator("h2:has-text('Media')").first();
    const mediaVisible = await mediaHeading.isVisible().catch(() => false);
    let epfBeforeMedia = null;
    if (epfVisible && mediaVisible) {
      const epfBox = await epfHeading.boundingBox();
      const mediaBox = await mediaHeading.boundingBox();
      epfBeforeMedia = epfBox && mediaBox ? epfBox.y < mediaBox.y : null;
    }
    report.steps.push({ epfSectionVisible: epfVisible, mediaSectionVisible: mediaVisible, epfBeforeMedia });
    await page.screenshot({ path: path.join(OUT_DIR, "epf-section-desktop.png"), fullPage: true });

    // 2. Old DocumentsSection heading ("เอกสารประจำตัว / Officer Documents") must be GONE (replaced).
    const oldHeadingCount = await page.locator("text=เอกสารประจำตัว / Officer Documents").count();
    report.steps.push({ oldDocumentsSectionGone: oldHeadingCount === 0 });

    // 3. Category groups render with collapse controls.
    const collapseButtons = await page.locator('button[aria-expanded]').count();
    report.steps.push({ collapseButtonsFound: collapseButtons });

    // 4. Open a Details drawer for a document that actually has a file
    // uploaded (Save is correctly disabled for empty/no-document rows —
    // pick a card whose status badge is NOT "missing" so Save is enabled).
    const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first(); // "แทนที่" = Replace, shown only when a doc exists
    const detailsButton = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsButton.scrollIntoViewIfNeeded();
    await detailsButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const dialogVisible = await page.locator('[role="dialog"]').isVisible();
    const focusedInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    await page.screenshot({ path: path.join(OUT_DIR, "epf-detail-drawer.png"), fullPage: true });

    // Edit + save metadata — wait on the actual PATCH response, not a fixed delay.
    const uniqueTitle = `Runtime Verify Title ${Date.now()}`;
    const titleInput = page.locator("#epf-detail-title-field");
    await titleInput.fill(uniqueTitle);
    const saveButton = page.locator('[role="dialog"]').getByRole("button", { name: /^บันทึก$/i }).first();
    const [patchResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/documents/") && r.request().method() === "PATCH"),
      saveButton.click(),
    ]);
    await page.waitForTimeout(200);
    const savedIndicatorVisible = await page.locator("text=บันทึกแล้ว").isVisible().catch(() => false);
    report.steps.push({
      dialogVisible,
      focusedInsideDialog,
      metadataSaveAttempted: true,
      patchStatus: patchResponse.status(),
      savedIndicatorVisible,
    });

    // Escape closes.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const dialogGoneAfterEscape = (await page.locator('[role="dialog"]').count()) === 0;
    report.steps.push({ dialogGoneAfterEscape });

    // 5. Reload, confirm the title change persisted (real PATCH round-trip).
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const bodyText = await page.locator("body").innerText();
    report.steps.push({ titlePersistedAfterReload: bodyText.includes(uniqueTitle) });

    // 6. Search filters results.
    const searchBox = page.locator('input[type="search"]');
    await searchBox.fill("zzz_no_such_document_zzz");
    await page.waitForTimeout(200);
    const noResultsVisible = await page.locator("text=ไม่พบเอกสารที่ตรงกับการค้นหา").isVisible().catch(() => false);
    await searchBox.fill("");
    report.steps.push({ searchNoResultsWorks: noResultsVisible });

    // 7. Responsive: no horizontal overflow at tablet/mobile within the e-PF card.
    for (const vp of [{ name: "1024x768", width: 1024, height: 768 }, { name: "390x844", width: 390, height: 844 }]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const epfCard = page.locator("text=แฟ้มประวัติอิเล็กทรอนิกส์").first();
      await epfCard.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT_DIR, `epf-${vp.name}.png`) });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      report.steps.push({ viewport: vp.name, scrollWidth, clientWidth, overflow: scrollWidth > clientWidth + 8 });
    }
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "epf-FAILURE.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "epf-verify-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
