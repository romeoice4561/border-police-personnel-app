/**
 * Pure Thai time draft helpers (popover commit gate).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createThaiTimeDraftFromValue,
  resolveThaiTimeDraftCommit,
  formatThaiTimeDraftPreview,
  thaiTimeMinuteOptionsFor,
  stepThaiTimeDraftOption,
} from "@/lib/drug_intelligence/thai_time";

test("draft from committed 20:00; hour scroll keeps complete draft HH:mm", () => {
  let draft = createThaiTimeDraftFromValue("20:00");
  for (const h of ["21", "22", "23", "00", "01"]) {
    draft = { ...draft, hour: h };
    assert.equal(resolveThaiTimeDraftCommit(draft, "confirm"), `${h}:00`);
  }
  assert.equal(resolveThaiTimeDraftCommit({ hour: "01", minute: "" }, "confirm"), null);
});

test("overnight signal uses committed strings only; incomplete draft is not commitable", () => {
  assert.ok("20:00" > "02:00");
  assert.equal(formatThaiTimeDraftPreview({ hour: "02", minute: "00" }), "02:00 น.");
  assert.equal(resolveThaiTimeDraftCommit({ hour: "02", minute: "" }, "confirm"), null);
});

test("minute options keep off-step 37 without rounding", () => {
  const opts = thaiTimeMinuteOptionsFor("37");
  assert.ok(opts.includes("37"));
  assert.equal(stepThaiTimeDraftOption(opts, "37", 1), "40");
  assert.equal(stepThaiTimeDraftOption(opts, "37", -1), "35");
});
