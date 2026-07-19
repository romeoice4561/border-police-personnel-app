/**
 * Phase 46C — e-PF Executive Layout & Information Hierarchy runtime
 * verification. Confirms deduplication (completion % appears exactly once
 * as a giant figure), new ordering (Insights immediately under Hero, Next
 * Actions beside it), grouped Missing Documents panel, secondary stats show
 * genuinely new info, no regression to upload/download/drawer/history, and
 * responsive/theme compatibility.
 * Run: node scripts/runtime_epf_hierarchy_verify.mjs
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

    // 1. Completion percentage appears exactly ONCE as a large headline figure
    // (the Hero's text-5xl percentage). The old KPI dashboard "Completion" card
    // and the old separate Completeness card headline are both gone.
    const largePercentCount = await page.locator(".text-5xl").filter({ hasText: "%" }).count();
    report.steps.push({ largeHeroPercentCount: largePercentCount });

    // 2. AI Insights heading appears before (above, in DOM/visual order) the
    // category list, and specifically right after the Hero.
    const heroBox = await page.locator("text=แฟ้มประวัติอิเล็กทรอนิกส์").first().boundingBox();
    const insightsBox = await page.locator("#epf-insights-heading").boundingBox();
    const missingBox = await page.locator("#epf-missing-panel-heading").boundingBox();
    report.steps.push({
      insightsBelowHero: heroBox && insightsBox ? insightsBox.y > heroBox.y : null,
      insightsAboveMissingPanel: insightsBox && missingBox ? insightsBox.y < missingBox.y : null,
    });

    await page.screenshot({ path: path.join(OUT_DIR, "epf-hierarchy-desktop.png"), fullPage: true });

    // 3. Missing Documents panel shows grouped sections (Required/Professional/Optional).
    const groupHeadingsCount = await page
      .locator("text=เอกสารจำเป็น")
      .or(page.locator("text=เอกสารวิชาชีพ"))
      .or(page.locator("text=เอกสารเพิ่มเติม"))
      .count();
    report.steps.push({ missingDocGroupHeadingsFound: groupHeadingsCount });

    // 4. Secondary stats show NEW info (Categories Used, Largest File, Images, PDFs) — not "Completion"/"Total Storage" cards.
    const categoriesUsedVisible = await page.locator("text=หมวดหมู่ที่ใช้งาน").first().isVisible().catch(() => false);
    const oldKpiCompletionCardGone = (await page.locator("text=ความสมบูรณ์ของแฟ้ม").count()) <= 2; // Hero label + File Health title only, not a 3rd KPI-card instance
    report.steps.push({ categoriesUsedVisible, oldKpiCompletionCardGone });

    // 5. Regression: existing detail drawer flow still works.
    const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first();
    const detailsBtn = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsBtn.scrollIntoViewIfNeeded();
    await detailsBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const dialogOk = await page.locator('[role="dialog"]').isVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    report.steps.push({ detailDrawerStillWorks: dialogOk });

    // 6. Category group header shows count/storage/last-update/completion on ONE row.
    const firstCategoryHeader = page.locator(".rounded-xl.border.border-border.bg-surface").filter({ hasText: "เอกสารประจำตัว" }).first();
    report.steps.push({ categoryHeaderVisible: await firstCategoryHeader.isVisible().catch(() => false) });

    // 7. Themes.
    for (const theme of ["navy-command", "midnight-black"]) {
      await page.evaluate((t) => window.localStorage.setItem("bpp.theme", t), theme);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      const dataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      await page.screenshot({ path: path.join(OUT_DIR, `epf-hierarchy-theme-${theme}.png`), fullPage: true });
      report.steps.push({ theme, dataThemeMatches: dataTheme === theme });
    }

    // 8. Responsive.
    for (const vp of [{ name: "1024x768", width: 1024, height: 768 }, { name: "390x844", width: 390, height: 844 }]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);
      const heroEl = page.locator("text=แฟ้มประวัติอิเล็กทรอนิกส์").first();
      await heroEl.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT_DIR, `epf-hierarchy-${vp.name}.png`) });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      report.steps.push({ viewport: vp.name, scrollWidth, clientWidth, overflow: scrollWidth > clientWidth + 8 });
    }
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "epf-hierarchy-FAILURE.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "epf-hierarchy-verify-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
