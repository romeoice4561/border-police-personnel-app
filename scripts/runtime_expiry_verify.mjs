/**
 * Phase 47 — Document Expiry Intelligence runtime verification.
 * Drives the real /officers/[id] page: sets a real expiry date via the
 * Detail Drawer, confirms it persists and the derived status/countdown/
 * dashboard/timeline/alert-panel all update accordingly, confirms existing
 * upload/download/history/drawer flow is unregressed, and checks responsive
 * + theme compatibility.
 * Run: node scripts/runtime_expiry_verify.mjs
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

function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

    // 1. Expiry Intelligence section renders.
    const sectionVisible = await page.locator("text=ข้อมูลวิเคราะห์วันหมดอายุเอกสาร").first().isVisible().catch(() => false);
    report.steps.push({ expirySectionVisible: sectionVisible });
    await page.screenshot({ path: path.join(OUT_DIR, "expiry-dashboard-before.png"), fullPage: true });

    // 2. Open a filled document's Details drawer, set an expiry date 20 days out.
    const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first();
    const detailsBtn = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsBtn.scrollIntoViewIfNeeded();
    await detailsBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const expiryInput = page.locator("#epf-detail-expiry-date");
    const expiryDateVisible = await expiryInput.isVisible().catch(() => false);
    const targetDate = isoInDays(20);
    await expiryInput.fill(targetDate);
    await page.waitForTimeout(150);

    // Preview badge should now show "Expiring Soon" before even saving.
    const previewBadgeVisible = await page.locator("text=ใกล้หมดอายุ").first().isVisible().catch(() => false);

    const saveBtn = page.locator('[role="dialog"]').getByRole("button", { name: /^บันทึก$/i }).first();
    const [patchResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/documents/") && r.request().method() === "PATCH"),
      saveBtn.click(),
    ]);
    await page.waitForTimeout(300);
    report.steps.push({ expiryDateFieldVisible: expiryDateVisible, previewBadgeVisible, patchStatus: patchResponse.status() });

    await page.screenshot({ path: path.join(OUT_DIR, "expiry-detail-drawer-set.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // 3. Reload — confirm the expiry date persisted and the dashboard now reflects it.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const expiringSoonKpi = await page.locator("text=ใกล้หมดอายุ").first().isVisible().catch(() => false);
    const alertPanelVisible = await page.locator("text=ต้องดำเนินการ").first().isVisible().catch(() => false);
    const timelineVisible = await page.locator("text=ไทม์ไลน์วันหมดอายุ").first().isVisible().catch(() => false);
    report.steps.push({ expiringSoonKpiVisible: expiringSoonKpi, alertPanelVisible, timelineVisible });
    await page.screenshot({ path: path.join(OUT_DIR, "expiry-dashboard-after.png"), fullPage: true });

    // 4. Regression: existing detail drawer + history flow still works.
    const detailsBtn2 = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsBtn2.scrollIntoViewIfNeeded();
    await detailsBtn2.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const dialogOk = await page.locator('[role="dialog"]').isVisible();
    const historyHeadingVisible = await page.locator("text=ประวัติการอัปโหลด").isVisible().catch(() => false);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    report.steps.push({ detailDrawerStillWorks: dialogOk, historySectionStillPresent: historyHeadingVisible });

    // 5. Clean up: clear the expiry date we set so we don't leave test data behind.
    await detailsBtn.scrollIntoViewIfNeeded().catch(() => {});
    const detailsBtn3 = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsBtn3.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.locator("#epf-detail-expiry-date").fill("");
    const saveBtn2 = page.locator('[role="dialog"]').getByRole("button", { name: /^บันทึก$/i }).first();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/documents/") && r.request().method() === "PATCH"),
      saveBtn2.click(),
    ]);
    await page.waitForTimeout(300);
    report.steps.push({ cleanupDone: true });

    // 6. Themes.
    for (const theme of ["navy-command", "classic-white"]) {
      await page.evaluate((t) => window.localStorage.setItem("bpp.theme", t), theme);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      const dataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      await page.screenshot({ path: path.join(OUT_DIR, `expiry-theme-${theme}.png`), fullPage: true });
      report.steps.push({ theme, dataThemeMatches: dataTheme === theme });
    }

    // 7. Responsive.
    for (const vp of [{ name: "1024x768", width: 1024, height: 768 }, { name: "390x844", width: 390, height: 844 }]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const sectionEl = page.locator("text=ข้อมูลวิเคราะห์วันหมดอายุเอกสาร").first();
      await sectionEl.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT_DIR, `expiry-${vp.name}.png`) });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      report.steps.push({ viewport: vp.name, scrollWidth, clientWidth, overflow: scrollWidth > clientWidth + 8 });
    }
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "expiry-FAILURE.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "expiry-verify-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
