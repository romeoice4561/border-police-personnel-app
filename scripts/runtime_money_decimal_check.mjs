/**
 * One-off browser runtime evidence for decimal money inputs + gauge %.
 * Run: node scripts/runtime_money_decimal_check.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OFFICER_PATH = `/officers/${encodeURIComponent("ภาค4/20")}`;
const OUT_DIR = path.join(process.cwd(), "tmp-runtime-evidence");

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const report = { steps: [], errors: [] };

  page.on("pageerror", (err) => report.errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.errors.push(`console: ${msg.text()}`);
  });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#login-username", "admin");
    await page.fill("#login-password", "414");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
    report.steps.push({ login: "ok", url: page.url() });

    await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle" });
    report.steps.push({ officerPage: page.url(), title: await page.title() });

    // Enter edit mode
    const editBtn = page.getByRole("button", { name: /แก้ไขข้อมูล|Edit Profile/i });
    await editBtn.click();
    await page.waitForSelector("#edit-cooperativeMonthlyDeduction", { timeout: 10000 });
    report.steps.push({ editMode: true });

    // Set production-shaped whole-baht example
    await page.fill("#edit-currentSalary", "48200");
    await page.fill("#edit-otherSpecialAllowances", "4700");
    await page.fill("#edit-cooperativeMonthlyDeduction", "3773");
    await page.waitForTimeout(300);

    const expenseLegend = await page.locator('[data-testid="salary-gauge-expense-pct"]').innerText();
    const remainingLegend = await page.locator('[data-testid="salary-gauge-remaining-pct"]').innerText();
    report.steps.push({
      wholeBahtExample: {
        expenseLegend,
        remainingLegend,
        expenseOk: expenseLegend.includes("7.1"),
        remainingOk: remainingLegend.includes("92.9"),
        not71: !expenseLegend.includes("71%") && !/รายจ่ายรวม\s*71%/.test(expenseLegend),
      },
    });

    // Decimal typing evidence on deductions
    await page.fill("#edit-cooperativeMonthlyDeduction", "");
    await page.type("#edit-cooperativeMonthlyDeduction", "3773.50", { delay: 40 });
    const deductionValue = await page.inputValue("#edit-cooperativeMonthlyDeduction");
    report.steps.push({
      typedDeduction: "3773.50",
      domValue: deductionValue,
      decimalAccepted: deductionValue === "3773.50",
    });

    // Intermediate trailing-dot state
    await page.fill("#edit-cooperativeMonthlyDeduction", "");
    await page.type("#edit-cooperativeMonthlyDeduction", "3773.", { delay: 40 });
    const trailingDot = await page.inputValue("#edit-cooperativeMonthlyDeduction");
    report.steps.push({
      typedTrailingDot: "3773.",
      domValue: trailingDot,
      trailingDotKept: trailingDot === "3773.",
    });

    // Full decimal example
    await page.fill("#edit-currentSalary", "48200.25");
    await page.fill("#edit-otherSpecialAllowances", "4700.50");
    await page.fill("#edit-cooperativeMonthlyDeduction", "3773.25");
    await page.waitForTimeout(300);
    const expenseLegend2 = await page.locator('[data-testid="salary-gauge-expense-pct"]').innerText();
    const remainingLegend2 = await page.locator('[data-testid="salary-gauge-remaining-pct"]').innerText();
    report.steps.push({
      decimalExample: {
        expenseLegend: expenseLegend2,
        remainingLegend: remainingLegend2,
      },
    });

    const shot = path.join(OUT_DIR, "edit-gauge-decimal.png");
    await page.locator('[data-testid="salary-utilization-legend"]').screenshot({ path: shot });
    report.steps.push({ screenshot: shot });

    const fullShot = path.join(OUT_DIR, "edit-financial-full.png");
    await page.screenshot({ path: fullShot, fullPage: false });
    report.steps.push({ fullScreenshot: fullShot });
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "failure.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    const reportPath = path.join(OUT_DIR, "report.json");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
