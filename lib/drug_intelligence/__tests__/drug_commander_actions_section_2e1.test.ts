/**
 * Phase 2E.1 — runtime regression for CommanderActionsSection.
 *
 * Phase 2E added grouped Action Center JSX that referenced ActionGroup.
 * Source-string tests and `next build` passed because the helper existed in
 * the file, but the Next/Turbopack client runtime still evaluated
 * `<ActionGroup />` against an unbound identifier
 * (`ReferenceError: ActionGroup is not defined`).
 *
 * This test actually renders the section so a missing/unbound helper throws.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_commander_actions_section_2e1.test.ts
 */

import Module from "node:module";
import { createElement, type ReactNode } from "react";

const loaded = Module as typeof Module & {
  _load: (request: string, parent: NodeModule, isMain: boolean) => unknown;
};
const originalLoad = loaded._load.bind(loaded);
loaded._load = function patchedLoad(request: string, parent: NodeModule, isMain: boolean) {
  if (request === "next/link") {
    return function MockLink({
      href,
      children,
      ...rest
    }: {
      href: string;
      children?: ReactNode;
      className?: string;
    }) {
      return createElement("a", { href, ...rest }, children);
    };
  }
  return originalLoad(request, parent, isMain);
};

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CommanderActionsSection } from "@/components/drug_intelligence/drug_commander_actions_section";

const ITEMS = [
  {
    id: "new-alerts",
    href: "/drug-intelligence/alerts?status=NEW",
    label: "สัญญาณใหม่ที่รอตรวจสอบ",
    why: "ควรตรวจสอบเพื่อยืนยันความเชื่อมโยงของข้อมูล",
    actionLabel: "ตรวจสอบสัญญาณ",
    count: 9,
    queueScope: true,
    group: "review" as const,
  },
  {
    id: "missing-coords",
    href: "/drug-intelligence/cases?completeness=missingCoordinates",
    label: "คดีที่ยังไม่มีพิกัด",
    why: "ควรเพิ่มพิกัดเพื่อใช้ในการวิเคราะห์เชิงพื้นที่",
    actionLabel: "ดูคดี",
    count: 5,
    group: "complete" as const,
  },
  {
    id: "duplicates",
    href: "/drug-intelligence/review/duplicates",
    label: "ข้อมูลบุคคลซ้ำที่รอตรวจสอบ",
    why: "ควรตรวจสอบเพื่อยืนยันว่าเป็นบุคคลเดียวกัน",
    count: 0,
    queueScope: true,
    group: "review" as const,
  },
];

test("CommanderActionsSection renders grouped Action Center without an unbound helper", () => {
  const html = renderToStaticMarkup(createElement(CommanderActionsSection, { items: ITEMS }));
  assert.match(html, /commander-action-center/);
  assert.match(html, /สัญญาณใหม่ที่รอตรวจสอบ/);
  assert.match(html, /คดีที่ยังไม่มีพิกัด/);
  assert.match(html, /alerts\?status=NEW/);
  assert.match(html, /completeness=missingCoordinates/);
  assert.doesNotMatch(html, /ข้อมูลบุคคลซ้ำที่รอตรวจสอบ/);
  assert.doesNotMatch(html, /ActionGroup is not defined/);
});

test("CommanderActionsSection empty state does not throw", () => {
  const html = renderToStaticMarkup(createElement(CommanderActionsSection, { items: [] }));
  assert.match(html, /commander-action-center/);
});
