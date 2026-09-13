/**
 * C-INTEL Purple — additive theme only. Existing ids, default, and
 * persistence key stay unchanged. Login styling is not part of this theme.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_THEME, THEME_LABELS, THEME_STORAGE_KEY, THEMES, isTheme } from "@/lib/theme/theme_config";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("existing themes and default remain; C-INTEL Purple is additive", () => {
  assert.deepEqual(THEMES, [
    "navy-command",
    "border-patrol-green",
    "classic-white",
    "midnight-black",
    "c-intel-purple",
  ]);
  assert.equal(DEFAULT_THEME, "navy-command");
  assert.equal(THEME_STORAGE_KEY, "bpp.theme");
  assert.equal(isTheme("c-intel-purple"), true);
  assert.equal(isTheme("navy-command"), true);
  assert.equal(THEME_LABELS["c-intel-purple"].en, "C-INTEL Purple");
  assert.equal(THEME_LABELS["c-intel-purple"].th, "C-INTEL ม่วงดำ");
});

test("globals.css defines C-INTEL Purple tokens without recoloring status", () => {
  const css = read("app/globals.css");
  const block = css.split('[data-theme="c-intel-purple"]')[1]?.split("[data-theme=")[0] ?? "";
  assert.ok(block.includes("--background: #070612"));
  assert.ok(block.includes("--surface: #12101f"));
  assert.ok(block.includes("--accent: #7c3aed"));
  assert.ok(block.includes("--accent-fg: #ffffff"));
  assert.match(block, /--good:\s*#5fce88/);
  assert.match(block, /--warning:\s*#e0b64d/);
  assert.match(block, /--critical:\s*#ef7c76/);
  assert.doesNotMatch(block, /--good:\s*#7c3aed/);
  assert.doesNotMatch(block, /--critical:\s*#7c3aed/);
});

test("appearance switcher lists the new theme via the existing catalog", () => {
  const src = read("components/theme/appearance_switcher.tsx");
  assert.match(src, /THEMES\.map/);
  assert.match(src, /"c-intel-purple":\s*\{\s*bg:\s*"#070612"/);
  assert.doesNotMatch(src, /localStorage\.setItem\(/);
});

test("sidebar selected state stays token-driven", () => {
  const shell = read("components/layout/app_shell.tsx");
  assert.match(shell, /highlighted \? "bg-accent text-accent-fg"/);
  assert.doesNotMatch(shell, /#7c3aed|#d98a3d|bg-orange|bg-violet-600/);
});

test("login screen is not restyled by the application theme change", () => {
  const src = read("components/auth/login_screen.tsx");
  assert.match(src, /bg-\[#070612\]/);
  assert.match(src, /bg-violet-600/);
  assert.match(src, /c-intel-login-bg\.png/);
  assert.match(src, /id="login-username"/);
});
