/**
 * Browser check: academy class placement + hero informal identity line.
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

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#login-username", "admin");
    await page.fill("#login-password", "414");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle" });

    const heroLine = page.locator('[data-testid="officer-informal-identity"]');
    const heroVisible = await heroLine.count();
    const heroText = heroVisible ? await heroLine.innerText() : null;
    report.steps.push({ readOnlyHero: { present: heroVisible > 0, text: heroText } });

    await page.getByRole("button", { name: /แก้ไขข้อมูล|Edit Profile/i }).click();
    await page.waitForSelector("#edit-nickname", { timeout: 10000 });

    const nickBox = page.locator("#edit-nickname");
    const classBox = page.locator("#edit-academyClass");
    const nickInBasic = await nickBox.count();
    const classInBasic = await classBox.count();
    const classInMembership = await page.locator("#edit-academyClass").count(); // same id — only one allowed

    const nickY = await nickBox.boundingBox();
    const classY = await classBox.boundingBox();
    report.steps.push({
      editMode: {
        nicknamePresent: nickInBasic === 1,
        academyClassPresent: classInBasic === 1,
        academyClassUnique: classInMembership === 1,
        academyAfterNickname:
          nickY != null && classY != null && (classY.y > nickY.y - 8 || classY.x > nickY.x),
      },
    });

    // Membership card should not label รุ่น นรต. as an edit control (removed).
    const membershipCard = page.getByText("ข้อมูลสมาชิกและการเงิน").first();
    await membershipCard.scrollIntoViewIfNeeded();
    const membershipSection = page.locator("text=ข้อมูลสมาชิกและการเงิน").locator("..").locator("..");
    const academyInMembershipLabels = await page.locator("label[for='edit-academyClass']").count();
    report.steps.push({ academyLabelCount: academyInMembershipLabels });

    await page.screenshot({ path: path.join(OUT_DIR, "informal-identity-edit.png") });
    await page.getByRole("button", { name: /ยกเลิก|Cancel/i }).click();
    await page.waitForTimeout(400);
    await page.locator("header").first().screenshot({ path: path.join(OUT_DIR, "informal-identity-hero.png") });
  } catch (e) {
    report.errors.push(String(e));
    try {
      await page.screenshot({ path: path.join(OUT_DIR, "informal-identity-failure.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "informal-identity-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.errors.length) process.exitCode = 1;
  }
}

main();
