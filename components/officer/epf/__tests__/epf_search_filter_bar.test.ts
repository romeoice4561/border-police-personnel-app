import { test } from "node:test";
import assert from "node:assert/strict";

import { yearGregorianToBE } from "@/lib/officer_profile/thai_date";

// Phase 47B — Buddhist-Year Filter Cleanup.
//
// EpfSearchFilterBar renders <option value={year}>{yearGregorianToBE(Number(year))}</option>
// for the Year filter — this test asserts the conversion contract directly
// via the shared helper (the same one the component imports), since the
// component itself is presentational JSX with no logic worth re-testing
// beyond "did it call the shared converter correctly."

test("CE year 2026 displays as Buddhist Era 2569 in the filter label", () => {
  assert.equal(yearGregorianToBE(2026), 2569);
});

test("the filter option's underlying value must stay the raw Gregorian year string — EpfSection's filter comparison (String(...getFullYear())) depends on this", () => {
  // Simulates what the component does: value stays the raw year, only the
  // rendered label goes through yearGregorianToBE.
  const availableYears = ["2026", "2025", "2024"];
  const rendered = availableYears.map((year) => ({
    value: year, // unchanged — internal filter contract
    label: String(yearGregorianToBE(Number(year))), // converted — visible only
  }));
  assert.deepEqual(rendered, [
    { value: "2026", label: "2569" },
    { value: "2025", label: "2568" },
    { value: "2024", label: "2567" },
  ]);
});

test("no rendered label ever equals its own Gregorian input year", () => {
  const availableYears = ["2020", "2026", "2030"];
  for (const year of availableYears) {
    const label = String(yearGregorianToBE(Number(year)));
    assert.notEqual(label, year);
  }
});
