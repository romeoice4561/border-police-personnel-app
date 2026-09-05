import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAdHocNetworkHref,
  commitSavedBoardNavigation,
  prepareAuthorizedSavedBoardNavigation,
  shouldBlockDocumentActionWhileUpload,
  shouldBlockDuplicateWhileDirty,
  shouldBypassSavedBoardBeforeUnload,
  shouldConfirmLeaveSavedBoard,
} from "@/lib/drug_intelligence/drug_investigation_board_workspace";

const ROOT = join(process.cwd());

test("dirty switch Stay keeps A and Discard authorizes B once", () => {
  assert.equal(shouldConfirmLeaveSavedBoard(true), true);
  const stay = prepareAuthorizedSavedBoardNavigation("board-a");
  assert.equal(stay.destinationBoardId, "board-a");
  const discard = prepareAuthorizedSavedBoardNavigation("board-b");
  assert.equal(shouldBypassSavedBoardBeforeUnload(discard), true);
  const assigned: string[] = [];
  commitSavedBoardNavigation(discard, (href) => assigned.push(href));
  assert.deepEqual(assigned, ["/drug-intelligence/network?boardId=board-b"]);
  assert.equal(shouldBypassSavedBoardBeforeUnload(null), false);
});

test("Save as Copy and Duplicate commit the returned destination once", () => {
  let copies = 0;
  let duplicates = 0;
  const assigned: string[] = [];
  copies += 1;
  commitSavedBoardNavigation(prepareAuthorizedSavedBoardNavigation("board-c"), (href) => assigned.push(href));
  duplicates += 1;
  commitSavedBoardNavigation(prepareAuthorizedSavedBoardNavigation("board-d"), (href) => assigned.push(href));
  assert.equal(copies, 1);
  assert.equal(duplicates, 1);
  assert.deepEqual(assigned, [
    "/drug-intelligence/network?boardId=board-c",
    "/drug-intelligence/network?boardId=board-d",
  ]);
});

test("dirty Duplicate and upload-busy still block document actions", () => {
  assert.equal(shouldBlockDuplicateWhileDirty(true), true);
  assert.equal(shouldBlockDocumentActionWhileUpload(true), true);
  assert.equal(shouldBlockDuplicateWhileDirty(false), false);
  assert.equal(shouldBlockDocumentActionWhileUpload(false), false);
});

test("saved href is boardId-only and ad-hoc remains focus params", () => {
  const saved = prepareAuthorizedSavedBoardNavigation("board-e");
  assert.equal(saved.href, "/drug-intelligence/network?boardId=board-e");
  assert.equal(saved.href.includes("focusType"), false);
  const adHoc = buildAdHocNetworkHref({
    graphContext: { focusType: "PERSON", focusId: "person-a", depth: 1 },
  });
  assert.equal(adHoc.includes("boardId"), false);
  assert.match(adHoc, /focusType=PERSON/);
  assert.match(adHoc, /focusId=person-a/);
});

test("Network page uses authorized hard navigation and friendly unavailable copy", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.match(page, /prepareAuthorizedSavedBoardNavigation/);
  assert.match(page, /commitSavedBoardNavigation/);
  assert.match(page, /shouldBypassSavedBoardBeforeUnload/);
  assert.match(page, /window\.location\.assign/);
  assert.doesNotMatch(page, /function navigateToSavedBoard\([\s\S]*router\.replace/);
  assert.match(page, /di\.board\.loadError/);
  assert.doesNotMatch(page, /createInvestigationBoard\(\)|autosave/i);
  const dictionary = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
  assert.match(dictionary, /ไม่สามารถเปิดบอร์ดนี้ได้ บอร์ดอาจไม่มีอยู่หรือคุณไม่มีสิทธิ์เข้าถึง/);
  assert.match(dictionary, /This board could not be opened/);
  assert.doesNotMatch(page, /force overwrite|last-write-wins/i);
});
