import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const pageSrc = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
const drawerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_investigation_board_report_drawer.tsx"), "utf8");

test("Network report action is permission-gated and keeps Print Board", () => {
  assert.match(pageSrc, /can\("drug.export"\)/);
  assert.match(pageSrc, /data-testid="investigation-board-report-btn"/);
  assert.match(pageSrc, /di\.export\.boardReportAction/);
  assert.match(pageSrc, /di\.export\.boardEmpty/);
  assert.match(pageSrc, /DrugInvestigationBoardReportDrawer/);
  assert.match(pageSrc, /data-testid="print-board-btn"/);
  assert.match(pageSrc, /window\.print\(\)/);
  assert.match(pageSrc, /dirty=\{isBoardDirty\}/);
});

test("preview drawer follows Commander report UX and accessibility", () => {
  assert.match(drawerSrc, /titleId="drug-board-report-title"/);
  assert.match(drawerSrc, /intent: "PREVIEW"|previewExport/);
  assert.match(drawerSrc, /downloadExport/);
  assert.match(drawerSrc, /di\.export\.printReport/);
  assert.match(drawerSrc, /di\.export\.close/);
  assert.match(drawerSrc, /di\.export\.boardDirtyNote/);
  assert.match(drawerSrc, /di\.export\.boardMaskingNotice/);
  assert.match(drawerSrc, /di\.export\.boardSourceWorkspace/);
  assert.match(drawerSrc, /di\.export\.boardSourceSaved/);
  assert.match(drawerSrc, /aria-label=\{t\("di.export.printReport"\)\}/);
  assert.doesNotMatch(drawerSrc, /window\.print\(\)/);
  assert.doesNotMatch(drawerSrc, /createInvestigationBoard|updateInvestigationBoard/);
  assert.match(drawerSrc, /openHtmlPrintReport/);
  assert.match(drawerSrc, /htmlPrintFailureMessage/);
  assert.doesNotMatch(drawerSrc, /noopener,noreferrer/);
});
