import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildThemeBootstrapScript } from "@/lib/theme/theme_bootstrap_script";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "@/lib/theme/theme_config";

describe("theme bootstrap script", () => {
  it("embeds storage key, theme list, and default theme", () => {
    const js = buildThemeBootstrapScript();
    assert.ok(js.includes(THEME_STORAGE_KEY));
    assert.ok(js.includes(DEFAULT_THEME));
    for (const theme of THEMES) {
      assert.ok(js.includes(theme), `missing theme ${theme}`);
    }
    assert.ok(js.includes("data-theme"));
    assert.ok(js.includes("localStorage.getItem"));
    assert.equal(js.includes("<script"), false, "must be script body only");
  });

  it("RootLayout does not render a raw JSX script element", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    // Strip block comments so the docstring mentioning <script> does not false-positive.
    const withoutComments = layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(
      /<script[\s>]/.test(withoutComments),
      false,
      "app/layout.tsx must not contain a JSX <script> (use ThemeBootstrap / useServerInsertedHTML)"
    );
    assert.ok(layout.includes("ThemeBootstrap"));
  });
});
