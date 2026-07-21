/**
 * Phase 48 — Cost-Efficient OCR & Selective AI Extraction runtime
 * verification. Drives the real e-PF Detail Drawer's new Extraction panel:
 * runs OCR-only extraction (Tier 1), confirms no AI is called by default,
 * confirms duplicate/cache behavior, and confirms the optional AI button
 * only appears at medium/low confidence.
 * Run: node scripts/runtime_extraction_verify.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OFFICER_PATH = `/officers/${encodeURIComponent("ภาค4/20")}`;
const OUT_DIR = path.join(process.cwd(), "tmp-runtime-evidence");

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "414");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
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

  const aiCalls = [];
  page.on("request", (req) => {
    if (req.url().includes("/extract/ai-fallback")) aiCalls.push(req.url());
  });

  try {
    await login(page);
    await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(300);

    const filledCard = page.locator("li:has(button:has-text('แทนที่'))").first();
    const detailsBtn = filledCard.getByRole("button", { name: /Details|รายละเอียด/i });
    await detailsBtn.scrollIntoViewIfNeeded();
    await detailsBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // 1. Extraction panel renders with "Not Processed" status initially.
    const panelVisible = await page.locator("text=ประมวลผลเอกสารและตรวจสอบข้อมูล").first().isVisible().catch(() => false);
    report.steps.push({ extractionPanelVisible: panelVisible });
    await page.screenshot({ path: path.join(OUT_DIR, "phase48-panel-initial.png"), fullPage: true });

    // 2. Run OCR extraction — this is a real Tesseract pass, can take a while.
    const runBtn = page.locator('[role="dialog"]:not([aria-label="เลือกวันที่ พ.ศ."])').getByRole("button", { name: /ประมวลผลเอกสาร|Process Document/i });
    const [extractResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/extract") && !r.url().includes("ai-fallback") && r.request().method() === "POST", { timeout: 120000 }),
      runBtn.click(),
    ]);
    const extractStatus = extractResponse.status();
    const extractBody = await extractResponse.json().catch(() => null);
    report.steps.push({
      extractStatus,
      extractDocumentType: extractBody?.data?.documentType?.type ?? null,
      extractConfidenceLevel: extractBody?.data?.confidenceLevel ?? null,
      extractAiWasUsed: extractBody?.data?.aiWasUsed ?? null,
      extractProviderUsed: extractBody?.data?.providerUsed ?? null,
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "phase48-panel-after-extract.png"), fullPage: true });

    // 3. Confirm zero AI calls happened automatically.
    report.steps.push({ aiCallsMadeAutomatically: aiCalls.length });

    // 4. Confirm the "no AI used" notice or the field review renders.
    const noAiNoticeVisible = await page.locator("text=ประมวลผลด้วย OCR เท่านั้น").isVisible().catch(() => false);
    const aiOptionalButtonVisible = await page.locator("text=ใช้ AI ช่วยตรวจเพิ่มเติม").isVisible().catch(() => false);
    report.steps.push({ noAiNoticeVisible, aiOptionalButtonVisibleAfterFirstRun: aiOptionalButtonVisible });

    // 5. Re-run extraction on the SAME document — should hit cache (no new OCR).
    const runBtn2 = page.locator('[role="dialog"]:not([aria-label="เลือกวันที่ พ.ศ."])').getByRole("button", { name: /ประมวลผลใหม่|Re-process/i });
    const [secondResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/extract") && !r.url().includes("ai-fallback") && r.request().method() === "POST", { timeout: 30000 }),
      runBtn2.click(),
    ]);
    const secondBody = await secondResponse.json().catch(() => null);
    report.steps.push({
      secondRunFromCache: secondBody?.data?.fromCache ?? null,
      secondRunProviderUsed: secondBody?.data?.providerUsed ?? null,
    });
    await page.screenshot({ path: path.join(OUT_DIR, "phase48-panel-cached-rerun.png"), fullPage: true });

    await page.keyboard.press("Escape");
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "phase48-FAILURE.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "phase48-extraction-verify-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
