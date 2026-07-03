import { test } from "node:test";
import assert from "node:assert/strict";
import { PersonnelNormalizationEngine } from "@/lib/normalize/normalization_engine";
import type { PersonnelExtraction } from "@/lib/types/vision";

function baseExtraction(overrides: Partial<PersonnelExtraction> = {}): PersonnelExtraction {
  return {
    rank: "Sergeant",
    first_name: "John",
    last_name: "Doe",
    position: "Officer",
    unit: "Unit A",
    phone: "0827548244",
    timeline: [],
    notes: "",
    confidence: 90,
    ...overrides,
  };
}

test("converts Thai numerals in the phone field and reformats it", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(baseExtraction({ phone: "๐๘๒๗๕๔๘๒๔๔" }));
  assert.equal(result.phone, "082-754-8244");
});

test("converts Thai numerals in a Buddhist-era unit/notes field", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(baseExtraction({ notes: "ปี ๒๕๕๘" }));
  assert.equal(result.notes, "ปี 2558");
});

test("mixed Thai and Arabic numerals in the same field are all converted", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(baseExtraction({ notes: "๒๕๖๗ / 2024" }));
  assert.equal(result.notes, "2567 / 2024");
});

test("cleans whitespace across scalar fields", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(baseExtraction({ first_name: "   John  ", last_name: "  Doe   " }));
  assert.equal(result.first_name, "John");
  assert.equal(result.last_name, "Doe");
});

test("full pipeline: Thai numerals, dash normalization, timeline sort and dedup together", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(
    baseExtraction({
      phone: "๐๘๒-๗๕๔-๘๒๔๔",
      timeline: [
        { year: "พ.ศ.๒๕๖๐", position: "Officer", unit: "Unit A" },
        { year: "พ.ศ.๒๕๖๔", position: "Supervisor", unit: "Unit B" },
        { year: "พ.ศ.๒๕๖๐", position: "Officer", unit: "Unit A" }, // duplicate
      ],
    })
  );

  assert.equal(result.phone, "082-754-8244");
  assert.equal(result.timeline.length, 2);
  assert.deepEqual(
    result.timeline.map((e) => e.year),
    ["2564", "2560"]
  );
});

test("does not mutate the input extraction object (pure)", () => {
  const engine = new PersonnelNormalizationEngine();
  const input = baseExtraction({ phone: "๐๘๒๗๕๔๘๒๔๔", notes: "  extra  " });
  const snapshot = JSON.parse(JSON.stringify(input));

  engine.normalize(input);

  assert.deepEqual(input, snapshot);
});

test("empty optional fields are left empty, never hallucinated", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(baseExtraction({ phone: "", notes: "" }));
  assert.equal(result.phone, "");
  assert.equal(result.notes, "");
});

test("confidence value passes through unchanged", () => {
  const engine = new PersonnelNormalizationEngine();
  const result = engine.normalize(baseExtraction({ confidence: 73 }));
  assert.equal(result.confidence, 73);
});
