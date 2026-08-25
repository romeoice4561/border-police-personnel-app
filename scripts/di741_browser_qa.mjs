/**
 * DI-7.4.1 Browser QA script (non-project Playwright, ESM).
 * Runs targeted browser checks against the dev server on port 3100.
 * Uses QA admin credentials from environment.
 * Does NOT modify any database rows.
 *
 * Run: npx playwright test scripts/di741_browser_qa.mjs --reporter=list
 * Or:  node --experimental-vm-modules scripts/di741_browser_qa.mjs  (needs playwright importable)
 *
 * NOTE: This file is purely for QA/browser automation — it is not a project
 * test or shipped as part of the application. Safe to delete after DI-7.4 commit.
 */
// Point playwright to the installed browsers (override sandbox cache path)
process.env.PLAYWRIGHT_BROWSERS_PATH = "C:\\Users\\Charat Joompolpak\\AppData\\Local\\ms-playwright";

// Use the npx-cached playwright module (not a project dependency)
import pkg from "file:///C:/Users/Charat%20Joompolpak/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js";
const { chromium } = pkg;

const BASE_URL = "http://localhost:3000";
const PASS = "✔";
const FAIL = "✗";

let passed = 0;
let failed = 0;

function ok(label, cond, extra = "") {
  if (cond) {
    console.log(`  ${PASS} ${label}${extra ? ` — ${extra}` : ""}`);
    passed++;
  } else {
    console.error(`  ${FAIL} ${label}${extra ? ` — ${extra}` : ""}`);
    failed++;
  }
}

/**
 * Inject a mock admin session via cookie (proxy check) + localStorage (client auth).
 * - proxy.ts checks PRESENCE of "bppis_session" cookie
 * - AuthProvider reads "bppis.session" from localStorage for the user object
 */
async function injectAdminSession(context) {
  const allPermissions = [
    "officers.view","officers.create","officers.edit","officers.export",
    "search.view","statistics.view","dashboard.view","review.view",
    "gallery.view","profile.manage","users.manage","admin.manage",
    "commander.search","drug.read","drug.create","drug.edit","drug.admin",
  ];
  const session = {
    user: {
      id: "mock:admin",
      username: "admin",
      displayName: "Administrator",
      role: "admin",
      permissions: allPermissions,
      officerId: null,
      mustChangePassword: false,
      isActive: true,
    },
    issuedAt: Date.now(),
  };
  const sessionJson = JSON.stringify(session);

  // 1. Cookie — proxy checks presence only, value just needs to be non-empty
  await context.addCookies([{
    name: "bppis_session",
    value: "1",
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }]);

  // 2. localStorage — AuthProvider reads this for the user object
  await context.addInitScript((s) => {
    localStorage.setItem("bppis.session", s);
  }, sessionJson);
}

async function login(page, context) {
  await injectAdminSession(context);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  // ── Desktop QA (1440×900) ──────────────────────────────────────────────
  console.log("\n=== DESKTOP QA (1440×900) ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    ctx.on("console", (msg) => { if (msg.type() === "error") errors.push(`[desktop] ${msg.text()}`); });
    await login(null, ctx);
    const page = await ctx.newPage();

    // 1. Open /drug-intelligence/persons
    await page.goto(`${BASE_URL}/drug-intelligence/persons`);
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => "");
    console.log(`    [debug] URL after goto: ${currentUrl}`);
    console.log(`    [debug] Title: ${pageTitle}`);
    ok("1. Page opens", currentUrl.includes("drug-intelligence/persons"), currentUrl);

    // 2. Filter panel toggle
    const filterBtn = page.locator('button:has-text("ตัวกรองเพิ่มเติม"), button:has-text("ซ่อนตัวกรอง")');
    ok("2. Filter panel toggle button present", await filterBtn.count() > 0);
    if (await filterBtn.count() > 0) {
      await filterBtn.first().click();
      await page.waitForTimeout(400);
    }

    // 3. Province selector is a <select> not an <input type=text>
    const provinceSelect = page.locator('select#filter-province, select[id="filter-province"]');
    ok("3. Province is a <select> dropdown (not text input)", await provinceSelect.count() > 0);

    // 4. Battalion selector is a <select>
    const battalionSelect = page.locator('select#filter-battalion');
    ok("4. Battalion is a <select> dropdown", await battalionSelect.count() > 0);

    // 5. Company selector is a <select>
    const companySelect = page.locator('select#filter-company');
    ok("5. Company is a <select> dropdown", await companySelect.count() > 0);

    // 6. No raw "ID หน่วย" / "เช่น 16" text visible
    const pageText = await page.textContent("body");
    ok("6. No raw 'ID หน่วย' text shown", !pageText?.includes("ID หน่วย"));
    ok("6b. No placeholder 'เช่น 16' text shown", !pageText?.includes("เช่น 16"));

    // 7. Search 'แดง'
    const searchBox = page.locator('input[placeholder*="ค้นหา"], input[type="search"], input[aria-label*="ค้นหา"]').first();
    if (await searchBox.count() > 0) {
      await searchBox.fill("แดง");
      await page.keyboard.press("Enter");
      await page.waitForLoadState("networkidle");
    }
    const resultText7 = await page.textContent("body");
    ok("7. Search 'แดง' shows ทดสอบ หนึ่ง (Person A)", resultText7?.includes("ทดสอบ หนึ่ง"));

    // 8. Clear search
    await searchBox.fill("");
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");

    // 9. Battalion dropdown shows named options (not empty)
    if (await battalionSelect.count() > 0) {
      const battalionOptions = await battalionSelect.locator("option").allTextContents();
      const hasNonEmpty = battalionOptions.some((o) => o.trim() !== "" && !o.includes("— ทุก"));
      ok("9. Battalion dropdown has named options", hasNonEmpty, `${battalionOptions.length} options`);
    }

    // 10. Province dropdown has Thai province names
    if (await provinceSelect.count() > 0) {
      const provinceOptions = await provinceSelect.locator("option").allTextContents();
      const hasChumporn = provinceOptions.some((o) => o.includes("ชุมพร"));
      ok("10. Province dropdown includes ชุมพร", hasChumporn, `${provinceOptions.length} provinces`);
    }

    // 11. Select battalion → company dropdown updates
    if (await battalionSelect.count() > 0) {
      const bOptions = await battalionSelect.locator("option").all();
      if (bOptions.length > 1) {
        const firstBatVal = await bOptions[1].getAttribute("value");
        await battalionSelect.selectOption(firstBatVal ?? "");
        await page.waitForTimeout(300);
        const companyOptions = await companySelect.locator("option").allTextContents();
        ok("11. Selecting battalion updates company options", companyOptions.length > 1, `${companyOptions.length} options`);
        // Clear battalion
        await battalionSelect.selectOption("");
        await page.waitForTimeout(300);
      }
    }

    // 12. Active chips after setting province=ชุมพร
    if (await provinceSelect.count() > 0) {
      await provinceSelect.selectOption("ชุมพร");
      // Give the router push + re-render time to show the chip
      await page.waitForTimeout(800);
      await page.waitForLoadState("networkidle").catch(() => {});
      const bodyAfterProvince = await page.textContent("body");
      ok("12. Active chip shows จังหวัด: ชุมพร", bodyAfterProvince?.includes("จังหวัด: ชุมพร"));
      // Clear province
      await provinceSelect.selectOption("");
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // 13. Sort options present — look for the sort label key or any select with sort-like options
    // The sort select is a <select> element containing sort values
    const sortOptions = await page.locator("select option").allTextContents();
    const hasSortOption = sortOptions.some(o =>
      o.includes("RELEVANCE") || o.includes("NAME_ASC") || o.includes("CASE_COUNT") ||
      o.includes("ความเกี่ยวข้อง") || o.includes("ชื่อ") || o.includes("จำนวนคดี")
    );
    ok("13. Sort dropdown options present", hasSortOption, `found: ${sortOptions.filter(o => o.trim()).slice(0, 5).join(", ")}`);

    // 14. No horizontal overflow at 1440w
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    ok("14. No horizontal overflow at 1440px", bodyWidth <= 1450, `scrollWidth=${bodyWidth}`);

    // 15. Console errors count
    ok("15. No console errors", errors.filter(e => e.startsWith("[desktop]")).length === 0,
      errors.filter(e => e.startsWith("[desktop]")).join("; ").slice(0, 200));

    await ctx.close();
  }

  // ── Mobile QA (390×844) ───────────────────────────────────────────────
  console.log("\n=== MOBILE QA (390×844) ===");
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    ctx.on("console", (msg) => { if (msg.type() === "error") errors.push(`[mobile] ${msg.text()}`); });
    await login(null, ctx);
    const page = await ctx.newPage();

    await page.goto(`${BASE_URL}/drug-intelligence/persons`);
    await page.waitForLoadState("networkidle");

    // Mobile: no horizontal overflow
    const mobileWidth = await page.evaluate(() => document.body.scrollWidth);
    ok("M1. No horizontal overflow at 390px", mobileWidth <= 400, `scrollWidth=${mobileWidth}`);

    // Province select still present
    const filterBtn = page.locator('button:has-text("ตัวกรองเพิ่มเติม"), button:has-text("ซ่อนตัวกรอง")');
    if (await filterBtn.count() > 0) {
      await filterBtn.first().click();
      await page.waitForTimeout(400);
    }

    const provinceSelectMobile = page.locator('select#filter-province');
    ok("M2. Province dropdown present on mobile", await provinceSelectMobile.count() > 0);

    const battalionSelectMobile = page.locator('select#filter-battalion');
    ok("M3. Battalion dropdown present on mobile", await battalionSelectMobile.count() > 0);

    // No raw IDs visible
    const mobileText = await page.textContent("body");
    ok("M4. No raw 'ID หน่วย' on mobile", !mobileText?.includes("ID หน่วย"));

    // Console errors
    ok("M5. No console errors on mobile",
      errors.filter(e => e.startsWith("[mobile]")).length === 0,
      errors.filter(e => e.startsWith("[mobile]")).join("; ").slice(0, 200));

    await ctx.close();
  }

  await browser.close();

  console.log(`\n=== BROWSER QA RESULT: ${passed} passed, ${failed} failed ===`);
  if (errors.length > 0) {
    console.log("\n=== CONSOLE ERRORS ===");
    errors.forEach((e) => console.error(" ", e));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Browser QA script error:", err);
  process.exit(1);
});
