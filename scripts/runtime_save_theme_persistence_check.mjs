/**
 * Phase 45.2B Sequences B/D: decimal persistence + theme persistence across
 * reload, and 3 consecutive saves with no runtime error / stale UI.
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { steps: [], errors: [], consoleErrors: [] };
  page.on("pageerror", (err) => report.errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });

  try {
    await login(page);
    await page.evaluate(() => window.localStorage.setItem("bpp.theme", "midnight-black"));
    await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle" });

    // Sequence D: save 3 consecutive times with different fields.
    for (let i = 1; i <= 3; i++) {
      await page.getByRole("button", { name: /แก้ไขข้อมูล|Edit Profile/i }).click();
      await page.waitForSelector("#edit-cooperativeMonthlyDeduction", { timeout: 10000 });
      await page.fill("#edit-cooperativeMonthlyDeduction", `377${i}.30`);
      await page.getByRole("button", { name: /^บันทึก$|^Save$/i }).click();
      await page.waitForTimeout(600);

      const stylesheetsPresent = await page.evaluate(() => document.querySelectorAll('link[rel="stylesheet"]').length > 0 || document.querySelectorAll("style").length > 0);
      const logoBox = await page.locator("img[alt*='BPPIS'], img[alt*='โลโก้']").first().boundingBox().catch(() => null);
      const dataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

      report.steps.push({
        save: i,
        stylesheetsPresent,
        logoBoxWidth: logoBox?.width ?? null,
        logoOversized: logoBox ? logoBox.width > 200 : null,
        dataThemeStillMidnightBlack: dataTheme === "midnight-black",
      });
    }

    // Sequence B: reload, confirm decimal + theme persistence.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const dataThemeAfterReload = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const bodyText = await page.locator("body").innerText();
    const hasDecimalValue = /3,773\.30|3773\.30/.test(bodyText);

    report.steps.push({
      afterReload: {
        dataTheme: dataThemeAfterReload,
        themePersisted: dataThemeAfterReload === "midnight-black",
        decimalValueVisible: hasDecimalValue,
      },
    });

    await page.screenshot({ path: path.join(OUT_DIR, "save-sequence-after-reload.png"), fullPage: true });
  } catch (e) {
    report.errors.push(String(e));
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "save-theme-persistence-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}
main();
