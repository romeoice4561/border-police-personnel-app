/**
 * ThaiTimePicker draft/commit contracts — scroll must not commit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  commitThaiTimeParts,
  createThaiTimeDraftFromValue,
  formatThaiTime,
  formatThaiTimeDraftPreview,
  isValidThaiTime,
  parseThaiTime,
  resolveThaiTimeDraftCommit,
  stepThaiTimeDraftOption,
  thaiTimeMinuteOptionsFor,
  THAI_TIME_HOURS,
  THAI_TIME_QUICK_MINUTES,
} from "@/lib/drug_intelligence/thai_time";

const picker = readFileSync(join(process.cwd(), "components/ui/thai_time_picker.tsx"), "utf8");
const panel = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_geo_filter_panel.tsx"), "utf8");

test("picker exposes inline + popover variants and draft/confirm UX", () => {
  assert.match(picker, /variant\?: "inline" \| "popover"/);
  assert.match(picker, /ThaiTimePopoverPicker/);
  assert.match(picker, /data-testid="thai-time-popover"/);
  assert.match(picker, /data-testid="thai-time-confirm"/);
  assert.match(picker, /data-testid="thai-time-clear"/);
  assert.match(picker, /setDraft/);
  assert.match(picker, /confirmDraft/);
  assert.match(picker, /resolveThaiTimeDraftCommit/);
  assert.match(picker, /createPortal/);
  assert.doesNotMatch(picker, /from "@\/components\/ui\/select"/);
  assert.doesNotMatch(picker, /<select[\s>]/i);
});

test("popover wheel/click updates draft only — onChange is not in WheelColumn onSelect path", () => {
  // WheelColumn onSelect must setDraft, not call parent onChange.
  assert.match(picker, /onSelect=\{\(h\) => setDraft\(\(d\) => \(\{ \.\.\.d, hour: h \}\)\)\}/);
  assert.match(picker, /onSelect=\{\(m\) => setDraft\(\(d\) => \(\{ \.\.\.d, minute: m \}\)\)\}/);
  // Parent onChange only from confirm/clear.
  assert.match(picker, /if \(next !== value\) onChange\(next\)/);
  assert.match(picker, /if \(value !== ""\) onChange\(""\)/);
});

test("map custom range reuses ThaiTimePicker popover, not native type=time", () => {
  assert.match(panel, /ThaiTimePicker/);
  assert.match(panel, /variant="popover"/);
  assert.doesNotMatch(panel, /type="time"/);
});

test("opening initializes draft from committed value", () => {
  assert.deepEqual(createThaiTimeDraftFromValue("20:00"), { hour: "20", minute: "00" });
  assert.deepEqual(createThaiTimeDraftFromValue("21:37"), { hour: "21", minute: "37" });
  assert.deepEqual(createThaiTimeDraftFromValue(""), { hour: "", minute: "" });
  assert.match(picker, /setDraft\(createThaiTimeDraftFromValue\(value\)\)/);
});

test("confirm commits complete HH:mm once; incomplete returns null", () => {
  assert.equal(resolveThaiTimeDraftCommit({ hour: "01", minute: "30" }, "confirm"), "01:30");
  assert.equal(resolveThaiTimeDraftCommit({ hour: "20", minute: "" }, "confirm"), null);
  assert.equal(resolveThaiTimeDraftCommit({ hour: "", minute: "30" }, "confirm"), null);
  assert.equal(resolveThaiTimeDraftCommit({ hour: "", minute: "" }, "confirm"), null);
  assert.equal(resolveThaiTimeDraftCommit({ hour: "20", minute: "00" }, "clear"), "");
});

test("Escape/outside discard path resets draft from committed value without onChange", () => {
  assert.match(picker, /Escape/);
  assert.match(picker, /setDraft\(createThaiTimeDraftFromValue\(value\)\)/);
  assert.match(picker, /setOpen\(false\)/);
});

test("off-step minute 21:37 preserved through draft options and commit", () => {
  assert.equal(isValidThaiTime("21:37"), true);
  assert.deepEqual(parseThaiTime("21:37"), { hour: "21", minute: "37" });
  assert.equal(formatThaiTime("21", "37"), "21:37");
  assert.equal(commitThaiTimeParts("21", "37"), "21:37");
  assert.equal(THAI_TIME_QUICK_MINUTES.includes("37"), false);
  const opts = thaiTimeMinuteOptionsFor("37");
  assert.ok(opts.includes("37"));
  assert.equal(formatThaiTimeDraftPreview({ hour: "22", minute: "37" }), "22:37 น.");
  assert.equal(resolveThaiTimeDraftCommit({ hour: "22", minute: "37" }, "confirm"), "22:37");
});

test("wheel step cycles options without inventing partial times", () => {
  assert.equal(stepThaiTimeDraftOption(THAI_TIME_HOURS, "23", 1), "00");
  assert.equal(stepThaiTimeDraftOption(THAI_TIME_HOURS, "00", -1), "23");
  assert.equal(stepThaiTimeDraftOption(["00", "05", "37"], "37", -1), "05");
});

test("wheel handler stops propagation; scrollIntoView is not per-step", () => {
  assert.match(picker, /e\.stopPropagation\(\)/);
  assert.match(picker, /didInitialScroll/);
  assert.match(picker, /not on every wheel step/);
});
