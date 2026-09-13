/**
 * C-INTEL branding refresh — chrome/copy only. Auth behavior is unchanged.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translate } from "@/lib/i18n/dictionary";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("product name is C-INTEL and organization remains Border Patrol Police", () => {
  assert.equal(translate("auth.systemNameShort", "th"), "C-INTEL");
  assert.equal(translate("auth.systemNameFull", "th"), "ระบบฐานข้อมูลกำลังพลและเครือข่ายยาเสพติด");
  assert.equal(translate("auth.systemNameFullEn", "en"), "Personnel and Narcotics Network Database System");
  assert.equal(translate("auth.orgName", "th"), "ตำรวจตระเวนชายแดน");
  assert.equal(translate("auth.orgNameEn", "en"), "BORDER PATROL POLICE");
});

test("login keeps a real form and does not treat artwork as the form", () => {
  const src = read("components/auth/login_screen.tsx");
  assert.match(src, /id="login-username"/);
  assert.match(src, /id="login-password"/);
  assert.match(src, /type="submit"/);
  assert.match(src, /c-intel-login-bg\.png/);
  assert.match(src, /aria-hidden="true"/);
  assert.match(src, /pointer-events-none/);
  assert.match(src, /CIntelLogo/);
  assert.match(src, /BppisLogo/);
  assert.match(src, /await login\(/);
  assert.match(src, /homeRouteForUser/);
  assert.doesNotMatch(src, /BPPIS_BOUND_SESSION_SECRET|document\.cookie|localStorage/);
});

test("sidebar and compact header use C-INTEL product lockup", () => {
  const brand = read("components/layout/sidebar_brand.tsx");
  const shell = read("components/layout/app_shell.tsx");
  assert.match(brand, /C-INTEL/);
  assert.match(brand, /ระบบฐานข้อมูลกำลังพล/);
  assert.match(brand, /ตำรวจตระเวนชายแดน/);
  assert.match(shell, /CIntelLogo/);
  assert.doesNotMatch(shell, /BppisLogo/);
});

test("metadata and manifest use C-INTEL product names", () => {
  const layout = read("app/layout.tsx");
  const login = read("app/login/page.tsx");
  const manifest = read("public/manifest.json");
  assert.match(layout, /applicationName:\s*"C-INTEL"/);
  assert.match(layout, /C-INTEL \| ระบบฐานข้อมูลกำลังพลและเครือข่ายยาเสพติด/);
  assert.match(login, /C-INTEL \| เข้าสู่ระบบ/);
  assert.match(manifest, /"short_name": "C-INTEL"/);
  assert.match(manifest, /C-INTEL — ระบบฐานข้อมูลกำลังพลและเครือข่ายยาเสพติด/);
});

test("login credit preserves the established author and phone", () => {
  const src = read("components/auth/login_screen.tsx");
  assert.match(src, /พ\.ต\.ท\.ชลัช จุมพลพักตร์/);
  assert.match(src, /รอง ผกก\.ตชด\.41/);
  assert.match(src, /หัวหน้ากองร้อย ตชด\.414/);
  assert.match(src, /086-345-4561/);
});
