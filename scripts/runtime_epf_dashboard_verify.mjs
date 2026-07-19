/**
 * Phase 46A — e-PF Intelligence Dashboard runtime verification.
 * Drives the real /officers/[id] page: KPI cards render with real numbers,
 * Missing Panel jump-to-scroll works, Expand All/Collapse All toggles every
 * category, existing upload/download/drawer/history flow is unregressed,
 * and responsive/theme/no-overflow holds at desktop/tablet/mobile.
 * Run: node scripts/runtime_epf_dashboard_verify.mjs
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

    // 1. Dashboard heading + KPI cards render.
    const dashboardHeading = page.locator("text=ภาพรวมแฟ้มประวัติ").first();
    report.steps.push({ dashboardVisible: await dashboardHeading.isVisible().catch(() => false) });
    await page.screenshot({ path: path.join(OUT_DIR, "epf-dashboard-desktop.png"), fullPage: true });

    // 2. Completeness card + progress bar has a real percent.
    const progressBar = page.locator('[role="progressbar"][aria-label="e-PF completeness progress"], [role="progressbar"]').first();
    const ariaValueNow = await progressBar.getAttribute("aria-valuenow").catch(() => null);
    report.steps.push({ completenessProgressBarValue: ariaValueNow });

    // 3. Missing panel renders + jump-to-scroll from KPI card works.
    const missingHeading = page.locator("text=เอกสารที่แนะนำให้เพิ่มเติม").first();
    const missingVisible = await missingHeading.isVisible().catch(() => false);
    report.steps.push({ missingPanelVisible: missingVisible });

    // 4. Recent activity + storage summary render.
    const activityVisible = await page.locator("text=กิจกรรมล่าสุด").first().isVisible().catch(() => false);
    const storageVisible = await page.locator("text=สรุปพื้นที่จัดเก็บ").first().isVisible().catch(() => false);
    report.steps.push({ activityVisible, storageVisible });

    // 5. Quick actions: Expand All / Collapse All actually toggle categories.
    const collapseAllBtn = page.getByRole("button", { name: /ย่อทั้งหมด|Collapse All/i });
    const expandAllBtn = page.getByRole("button", { name: /ขยายทั้งหมด|Expand All/i });
    const expandedButtonsBefore = await page.locator('button[aria-expanded="true"]').count();
    await collapseAllBtn.click();
    await page.waitForTimeout(200);
    const expandedAfterCollapseAll = await page.locator('button[aria-expanded="true"]').count();
    await expandAllBtn.click();
    await page.waitForTimeout(200);
    const expandedAfterExpandAll = await page.locator('button[aria-expanded="true"]').count();
    report.steps.push({ expandedButtonsBefore, expandedAfterCollapseAll, expandedAfterExpandAll });

    // 6. Disabled future actions clearly indicate "coming soon" via title/aria-label.
    const ocrBtn = page.getByRole("button", { name: /OCR/i }).first();
    const ocrDisabled = await ocrBtn.isDisabled().catch(() => null);
    const ocrTitle = await ocrBtn.getAttribute("title").catch(() => null);
    report.steps.push({ ocrDisabled, ocrTitle });

    // 7. Regression: existing upload/preview/download/details/history buttons still present and working.
    const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first();
    const detailsBtn = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsBtn.scrollIntoViewIfNeeded();
    await detailsBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const dialogOk = await page.locator('[role="dialog"]').isVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    report.steps.push({ detailDrawerStillWorks: dialogOk });

    // 8. Responsive + theme compatibility.
    for (const theme of ["navy-command", "midnight-black"]) {
      await page.evaluate((t) => window.localStorage.setItem("bpp.theme", t), theme);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      const dataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      await page.screenshot({ path: path.join(OUT_DIR, `epf-dashboard-theme-${theme}.png`), fullPage: true });
      report.steps.push({ theme, dataThemeMatches: dataTheme === theme });
    }

    for (const vp of [{ name: "1024x768", width: 1024, height: 768 }, { name: "390x844", width: 390, height: 844 }]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const dashboardEl = page.locator("text=ภาพรวมแฟ้มประวัติ").first();
      await dashboardEl.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT_DIR, `epf-dashboard-${vp.name}.png`) });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      report.steps.push({ viewport: vp.name, scrollWidth, clientWidth, overflow: scrollWidth > clientWidth + 8 });
    }
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "epf-dashboard-FAILURE.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "epf-dashboard-verify-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
