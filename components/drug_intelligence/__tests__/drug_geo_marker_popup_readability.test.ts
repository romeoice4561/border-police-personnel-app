/**
 * DI-8.1.1 Defect A — popup readability contract.
 *
 * No React rendering harness exists in this codebase (all tests are pure
 * logic/unit tests), so this asserts the CONTRACT at the source level: the
 * popup's informational content must never rely on the app's dark-theme
 * foreground/muted/border/warning tokens (which assume a dark --surface and
 * are unreadable on Leaflet's hardcoded white popup background), and the
 * scoped stylesheet must force the popup wrapper to an explicit light
 * surface regardless of which of the app's 5 themes is active.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const popupSource = readFileSync(path.join(dir, "..", "drug_geo_marker_popup.tsx"), "utf8");
const popupCss = readFileSync(path.join(dir, "..", "drug_geo_marker_popup.css"), "utf8");

test("popup content does not use theme-token foreground/muted classes (unreadable on a forced-light popup in dark theme)", () => {
  assert.equal(/\btext-foreground\b/.test(popupSource), false);
  assert.equal(/\btext-muted\b/.test(popupSource), false);
});

test("popup separator does not use the theme border token", () => {
  assert.equal(/\bborder-border\b/.test(popupSource), false);
});

test("popup alert banner does not use the theme warning tokens (dark-surface-only pairing)", () => {
  assert.equal(/\bbg-warning-bg\b/.test(popupSource), false);
  assert.equal(/\btext-warning\b/.test(popupSource), false);
});

test("popup uses explicit slate text classes for its informational content", () => {
  assert.match(popupSource, /text-slate-900/);
  assert.match(popupSource, /text-slate-600/);
});

test("popup markers are scoped with the di-geo-popup className, not a global Leaflet override", () => {
  assert.match(popupCss, /\.di-geo-popup \.leaflet-popup-content-wrapper/);
});

test("popup wrapper and tip are forced to an explicit light background", () => {
  assert.match(popupCss, /\.di-geo-popup \.leaflet-popup-content-wrapper\s*\{[^}]*background:\s*#ffffff/);
  assert.match(popupCss, /\.di-geo-popup \.leaflet-popup-tip\s*\{[^}]*background:\s*#ffffff/);
});

test("popup close button color is explicitly set, not left to inherit", () => {
  assert.match(popupCss, /\.di-geo-popup \.leaflet-popup-close-button/);
});
