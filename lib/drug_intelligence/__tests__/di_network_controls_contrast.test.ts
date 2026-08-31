/**
 * Network React Flow controls contrast hotfix — source-string regression.
 * Protects theme-token overrides; no pixel assertions.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const globalsSrc = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const pageSrc = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");

describe("Network controls contrast hotfix", () => {
  test("controls use theme tokens — not xyflow #fefefe light-only defaults", () => {
    assert.match(globalsSrc, /--xy-controls-button-background-color-default:\s*var\(--neutral-bg\)/);
    assert.match(globalsSrc, /--xy-controls-button-color-default:\s*var\(--foreground\)/);
    assert.match(globalsSrc, /--xy-controls-button-border-color-default:\s*var\(--border\)/);
    assert.doesNotMatch(
      globalsSrc,
      /--xy-controls-button-background-color-default:\s*#fefefe/
    );
  });

  test("overrides use .di-network-board specificity (beats late xyflow CSS)", () => {
    assert.match(globalsSrc, /\.react-flow\.di-network-board\s*\{/);
    assert.match(
      globalsSrc,
      /\.react-flow\.di-network-board\s+\.react-flow__controls-button\s*\{[\s\S]*background:\s*var\(--neutral-bg\)/
    );
    assert.match(
      globalsSrc,
      /\.react-flow\.di-network-board\s+\.react-flow__controls-button\s*\{[\s\S]*color:\s*var\(--foreground\)/
    );
    assert.match(pageSrc, /className="di-network-board"/);
  });

  test("control panel has visible border surface and focus-visible", () => {
    assert.match(
      globalsSrc,
      /\.react-flow\.di-network-board\s+\.react-flow__controls\s*\{[\s\S]*border:\s*1px solid var\(--border\)/
    );
    assert.match(
      globalsSrc,
      /\.react-flow\.di-network-board\s+\.react-flow__controls\s*\{[\s\S]*background:\s*var\(--neutral-bg\)/
    );
    assert.match(
      globalsSrc,
      /\.react-flow\.di-network-board\s+\.react-flow__controls-button:focus-visible/
    );
    assert.match(globalsSrc, /outline:\s*2px solid var\(--accent\)/);
  });

  test("MiniMap DI-9.4.4 tokens remain intact", () => {
    assert.match(globalsSrc, /--xy-minimap-background-color-default:\s*var\(--surface\)/);
    assert.match(
      globalsSrc,
      /--xy-minimap-mask-background-color-default:\s*color-mix\(in srgb, var\(--foreground\) 18%, transparent\)/
    );
    assert.match(pageSrc, /bgColor="var\(--surface\)"/);
    assert.match(pageSrc, /className="hidden sm:block print:hidden"/);
  });

  test("Controls component remains present (not removed)", () => {
    assert.match(pageSrc, /<Controls\s+showInteractive=\{false\}/);
  });
});
