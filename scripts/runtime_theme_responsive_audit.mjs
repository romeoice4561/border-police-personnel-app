/**
 * Phase 45.2B — theme + responsive runtime audit for /officers/[id].
 * Captures screenshots per theme (desktop) and per required viewport, plus
 * computed-style contrast evidence for key elements. One-off audit script.
 * Run: node scripts/runtime_theme_responsive_audit.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OFFICER_PATH = `/officers/${encodeURIComponent("ภาค4/20")}`;
const OUT_DIR = path.join(process.cwd(), "tmp-runtime-evidence");

const THEMES = ["navy-command", "border-patrol-green", "classic-white", "midnight-black"];
const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "414");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
}

function relLuminance(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relLuminance(hex1);
  const l2 = relLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return null;
  return "#" + m.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { themes: {}, viewports: {}, errors: [], consoleErrors: [] };

  // ── Theme pass: desktop, read-only + edit mode, per theme ──
  for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (err) => report.errors.push(`[${theme}] ${String(err)}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") report.consoleErrors.push(`[${theme}] ${msg.text()}`);
    });
    try {
      await login(page);
      await page.evaluate((t) => window.localStorage.setItem("bpp.theme", t), theme);
      await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const dataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

      // Computed-style contrast evidence: background vs foreground, muted text vs background.
      const styles = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        return {
          background: body.backgroundColor,
          foreground: body.color,
          accent: root.getPropertyValue("--accent").trim(),
          muted: root.getPropertyValue("--muted").trim(),
          border: root.getPropertyValue("--border").trim(),
        };
      });

      await page.screenshot({ path: path.join(OUT_DIR, `theme-${theme}-readonly.png`), fullPage: true });

      // Commander Intelligence badges + gauge legend visibility.
      const badgeTexts = await page.locator("text=ยังไม่ผ่านเกณฑ์, text=เกษียณตามปกติ, text=ความสำคัญปานกลาง").allInnerTexts().catch(() => []);
      const gaugeExpenseVisible = await page.locator('[data-testid="salary-gauge-expense-pct"]').isVisible().catch(() => false);

      await page.getByRole("button", { name: /แก้ไขข้อมูล|Edit Profile/i }).click();
      await page.waitForSelector("#edit-nickname", { timeout: 10000 });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT_DIR, `theme-${theme}-edit.png`), fullPage: true });

      // Focus visibility check on nickname input.
      await page.locator("#edit-nickname").focus();
      const focusStyle = await page.locator("#edit-nickname").evaluate((el) => {
        const cs = getComputedStyle(el);
        return { outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
      });

      await page.getByRole("button", { name: /ยกเลิก|Cancel/i }).click();

      // WCAG contrast: body text vs background, muted text vs background.
      // background/foreground come back as rgb(...) from getComputedStyle;
      // accent/muted/border are already hex from the CSS custom properties.
      const bgHex = rgbToHex(styles.background);
      const fgHex = rgbToHex(styles.foreground);
      const contrast = {
        foregroundOnBackground: bgHex && fgHex ? Number(contrastRatio(bgHex, fgHex).toFixed(2)) : null,
        mutedOnBackground: bgHex ? Number(contrastRatio(bgHex, styles.muted).toFixed(2)) : null,
        accentOnBackground: bgHex ? Number(contrastRatio(bgHex, styles.accent).toFixed(2)) : null,
      };

      report.themes[theme] = {
        dataThemeAttribute: dataTheme,
        matchesExpected: dataTheme === theme,
        computedStyles: styles,
        badgeTextsFound: badgeTexts,
        gaugeExpenseLegendVisible: gaugeExpenseVisible,
        focusStyle,
        contrast,
        contrastPassesAA: {
          // WCAG AA: normal text >= 4.5, large/UI text >= 3.0
          foregroundOnBackground: contrast.foregroundOnBackground != null ? contrast.foregroundOnBackground >= 4.5 : null,
          mutedOnBackground: contrast.mutedOnBackground != null ? contrast.mutedOnBackground >= 4.5 : null,
          accentOnBackground: contrast.accentOnBackground != null ? contrast.accentOnBackground >= 3.0 : null,
        },
      };
    } catch (e) {
      report.errors.push(`[${theme}] ${String(e)}`);
      try {
        await page.screenshot({ path: path.join(OUT_DIR, `theme-${theme}-FAILURE.png`), fullPage: true });
      } catch {
        /* ignore */
      }
    } finally {
      await page.close();
    }
  }

  // ── Viewport pass: navy-command theme, each required size ──
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on("pageerror", (err) => report.errors.push(`[${vp.name}] ${String(err)}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") report.consoleErrors.push(`[${vp.name}] ${msg.text()}`);
    });
    try {
      await login(page);
      await page.evaluate(() => window.localStorage.setItem("bpp.theme", "navy-command"));
      await page.goto(`${BASE}${OFFICER_PATH}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const hasHorizontalOverflow = scrollWidth > clientWidth + 1;

      await page.screenshot({ path: path.join(OUT_DIR, `viewport-${vp.name}-readonly.png`), fullPage: true });

      await page.getByRole("button", { name: /แก้ไขข้อมูล|Edit Profile/i }).click();
      await page.waitForSelector("#edit-nickname", { timeout: 10000 });
      await page.waitForTimeout(200);

      const scrollWidthEdit = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidthEdit = await page.evaluate(() => document.documentElement.clientWidth);
      const hasHorizontalOverflowEdit = scrollWidthEdit > clientWidthEdit + 1;

      await page.screenshot({ path: path.join(OUT_DIR, `viewport-${vp.name}-edit.png`), fullPage: true });

      // Financial section screenshot specifically.
      const financialCard = page.locator("text=ข้อมูลสมาชิกและการเงิน").first();
      await financialCard.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT_DIR, `viewport-${vp.name}-financial.png`) });

      report.viewports[vp.name] = {
        width: vp.width,
        height: vp.height,
        readOnly: { scrollWidth, clientWidth, hasHorizontalOverflow },
        edit: { scrollWidth: scrollWidthEdit, clientWidth: clientWidthEdit, hasHorizontalOverflow: hasHorizontalOverflowEdit },
      };
    } catch (e) {
      report.errors.push(`[${vp.name}] ${String(e)}`);
      try {
        await page.screenshot({ path: path.join(OUT_DIR, `viewport-${vp.name}-FAILURE.png`), fullPage: true });
      } catch {
        /* ignore */
      }
    } finally {
      await page.close();
    }
  }

  await fs.writeFile(path.join(OUT_DIR, "theme-responsive-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (report.errors.length) process.exitCode = 1;
}

main();
