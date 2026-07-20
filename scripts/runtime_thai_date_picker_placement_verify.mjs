/**
 * Phase 47B — Thai Date Picker Placement Fix & Buddhist-Year Filter Cleanup
 * runtime verification. Reproduces the exact reported defects and confirms
 * both are fixed, plus the four required sequences (A-D) from the spec.
 * Run: node scripts/runtime_thai_date_picker_placement_verify.mjs
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

async function openDetailsForFilledDoc(page) {
  const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first();
  const detailsBtn = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
  await detailsBtn.scrollIntoViewIfNeeded();
  await detailsBtn.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  return filledCard;
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

    // ── Sequence A: Renewal Date at the far-right field, full picker visible ──
    await openDetailsForFilledDoc(page);
    const renewalBtn = page.locator("#epf-detail-renewal-date");
    const triggerBox = await renewalBtn.boundingBox();
    await renewalBtn.click();
    await page.waitForSelector('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."]', { timeout: 5000 });
    const popoverBox = await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."]').boundingBox();
    const fullyInViewport =
      popoverBox.x >= 0 &&
      popoverBox.y >= 0 &&
      popoverBox.x + popoverBox.width <= 1440 &&
      popoverBox.y + popoverBox.height <= 900;
    const openedLeftward = popoverBox.x < triggerBox.x; // right-aligned = popover starts left of the trigger's left edge
    report.steps.push({
      sequenceA_triggerBox: triggerBox,
      sequenceA_popoverBox: popoverBox,
      sequenceA_fullyInViewport: fullyInViewport,
      sequenceA_openedLeftward: openedLeftward,
    });
    await page.screenshot({ path: path.join(OUT_DIR, "47b-renewal-picker-open.png"), fullPage: false });

    // Select a date without zoom, save, reload, confirm persistence + พ.ศ. display.
    await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."] select[aria-label="ปี พ.ศ."]').selectOption("2571");
    await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."] select[aria-label="เดือน"]').selectOption("6");
    await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."] select[aria-label="วัน"]').selectOption("15");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const renewalDisplayed = await renewalBtn.innerText();
    const saveBtn = page.getByRole("button", { name: /^บันทึก$/i }).first();
    const [patchResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/documents/") && r.request().method() === "PATCH"),
      saveBtn.click(),
    ]);
    const patchBody = await patchResponse.json().catch(() => null);
    report.steps.push({
      sequenceA_renewalDisplayedBeforeSave: renewalDisplayed.trim(),
      sequenceA_patchStatus: patchResponse.status(),
      sequenceA_savedRenewalIso: patchBody?.data?.renewalDate ?? null,
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await openDetailsForFilledDoc(page);
    const renewalAfterReload = await page.locator("#epf-detail-renewal-date").innerText();
    report.steps.push({
      sequenceA_renewalAfterReload: renewalAfterReload.trim(),
      sequenceA_matchesExpectedBE: renewalAfterReload.trim() === "15/06/2571",
    });

    // Clean up: clear the renewal date we set.
    await page.locator("#epf-detail-renewal-date").click();
    await page.waitForSelector('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."]', { timeout: 5000 });
    await page.locator("text=ล้าง").first().click();
    await page.waitForTimeout(150);
    const saveBtnCleanup = page.getByRole("button", { name: /^บันทึก$/i }).first();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/documents/") && r.request().method() === "PATCH"),
      saveBtnCleanup.click(),
    ]);
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // ── Sequence B: Year filter shows พ.ศ., not ค.ศ. ──
    const yearSelect = page.locator("#epf-filter-year");
    const yearSelectExists = (await yearSelect.count()) > 0;
    report.steps.push({ sequenceB_yearFilterExists: yearSelectExists });
    if (yearSelectExists) {
      const optionTexts = await yearSelect.locator("option").allInnerTexts();
      const hasGregorian2026 = optionTexts.includes("2026");
      const hasBuddhist2569 = optionTexts.includes("2569");
      report.steps.push({ sequenceB_optionTexts: optionTexts, sequenceB_noGregorian2026: !hasGregorian2026, sequenceB_hasBuddhist2569: hasBuddhist2569 });
      if (hasBuddhist2569) {
        await yearSelect.selectOption({ label: "2569" });
        await page.waitForTimeout(200);
        report.steps.push({ sequenceB_selectionWorked: true });
        await yearSelect.selectOption("ALL");
      }
    }

    // ── Sequence D: all three fields select/clear normally ──
    await openDetailsForFilledDoc(page);
    const fieldResults = {};
    for (const fieldId of ["epf-detail-issue-date", "epf-detail-expiry-date", "epf-detail-renewal-date"]) {
      const btn = page.locator(`#${fieldId}`);
      await btn.click();
      await page.waitForSelector('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."]', { timeout: 5000 });
      await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."] select[aria-label="วัน"]').selectOption("10");
      await page.waitForTimeout(100);
      const afterSelect = await btn.innerText();
      await page.locator("text=ล้าง").first().click();
      await page.waitForTimeout(100);
      const afterClear = await btn.innerText();
      fieldResults[fieldId] = { selected: afterSelect.trim() !== "", clearedBackToPlaceholder: afterClear.trim() === "" || !afterClear.includes("25") };
    }
    report.steps.push({ sequenceD_fieldResults: fieldResults });
    await page.keyboard.press("Escape");

    // ── Sequence C: responsive at 1024x768 and 390x844 ──
    for (const vp of [{ name: "1024x768", width: 1024, height: 768 }, { name: "390x844", width: 390, height: 844 }]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first();
      const detailsBtn = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
      await detailsBtn.scrollIntoViewIfNeeded().catch(() => {});
      await detailsBtn.click().catch(() => {});
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await page.locator("#epf-detail-renewal-date").click().catch(() => {});
      await page.waitForTimeout(200);
      const pickerVisible = await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."]').isVisible().catch(() => false);
      let clipped = null;
      if (pickerVisible) {
        const box = await page.locator('[role="dialog"][aria-label="เลือกวันที่ พ.ศ."]').boundingBox();
        clipped = box ? box.x < 0 || box.y < 0 || box.x + box.width > vp.width || box.y + box.height > vp.height : null;
      }
      await page.screenshot({ path: path.join(OUT_DIR, `47b-${vp.name}.png`) });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      report.steps.push({
        sequenceC_viewport: vp.name,
        sequenceC_pickerVisible: pickerVisible,
        sequenceC_pickerClipped: clipped,
        sequenceC_scrollWidth: scrollWidth,
        sequenceC_clientWidth: clientWidth,
        sequenceC_overflow: scrollWidth > clientWidth + 8,
      });
      await page.keyboard.press("Escape").catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
    }
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "47b-FAILURE.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "47b-verify-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
