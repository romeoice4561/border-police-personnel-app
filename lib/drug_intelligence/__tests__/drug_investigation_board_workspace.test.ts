import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ApiClientError } from "@/lib/ui/api_client";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";
import {
  applyInvestigationBoardGraphContextPatch,
  boardHasUnpersistableImages,
  buildAdHocNetworkHref,
  buildInvestigationBoardGraphContext,
  buildInvestigationBoardWorkspaceSnapshot,
  buildSavedBoardNetworkHref,
  defaultInvestigationBoardTitle,
  investigationBoardDirtySignature,
  investigationBoardIsDirty,
  investigationBoardReconciliationCounts,
  isInvestigationBoardConflictError,
  shouldBlockDuplicateWhileDirty,
  shouldConfirmLeaveSavedBoard,
  snapshotFromPersistedBoardState,
} from "@/lib/drug_intelligence/drug_investigation_board_workspace";
import type { DrugNetworkAnnotation } from "@/lib/drug_intelligence/drug_network_annotations";

const ROOT = join(process.cwd());

function snapshotWith(overrides?: {
  movePersonA?: boolean;
  pinPersonB?: boolean;
  lock?: boolean;
  routeMode?: "CURVED" | "STRAIGHT";
  annotationText?: string;
  selectionOnly?: boolean;
  viewport?: { x: number; y: number; zoom: number };
}) {
  const base = sampleWorkspaceSnapshot();
  if (overrides?.movePersonA) {
    const node = base.nodes.find((n) => n.id === "person-a")!;
    node.position = { x: node.position.x + 40, y: node.position.y + 10 };
  }
  if (overrides?.pinPersonB) {
    base.pinnedNodeIds = [...base.pinnedNodeIds, "person-b"];
    const node = base.nodes.find((n) => n.id === "person-b");
    if (node) node.pinned = true;
  }
  if (overrides?.lock !== undefined) base.presentation.boardLocked = overrides.lock;
  if (overrides?.routeMode) {
    base.edgeRoutes["pc:link-1"] = {
      ...base.edgeRoutes["pc:link-1"],
      mode: overrides.routeMode,
    };
  }
  if (overrides?.annotationText) {
    const ann = base.annotations.find((a) => a.id === "ann-text-1")!;
    ann.text = overrides.annotationText;
  }
  if (overrides?.viewport) base.presentation.viewport = overrides.viewport;
  return base;
}

test("snapshot builder joins factual geometry, pins, routes, and annotation style", () => {
  const annotations: DrugNetworkAnnotation[] = [
    {
      id: "ann-text-1",
      type: "TEXT",
      color: "#111827",
      fillColor: "transparent",
      strokeWidth: 0,
      text: "อาจเป็นผู้ประสาน",
      fontSize: 16,
    },
  ];
  const snapshot = buildInvestigationBoardWorkspaceSnapshot({
    graphContext: { focusType: "PERSON", focusId: "person-a", depth: 1 },
    layoutMode: "PERSON_CENTERED",
    labelMode: "ALL",
    nodeDensity: "STANDARD",
    boardLocked: true,
    viewport: { x: 1, y: 2, zoom: 1.1 },
    flowNodes: [
      {
        id: "person-a",
        position: { x: 100, y: 80 },
        data: { graphNode: { type: "PERSON" } },
      },
      {
        id: "ann-text-1",
        position: { x: 60, y: 300 },
        width: 180,
        height: 60,
        data: { annotation: annotations[0] },
      },
    ],
    pinnedNodeIds: ["person-a"],
    edgeRoutes: {
      "pc:link-1": { mode: "CURVED", waypoints: [{ id: "wp-1", x: 10, y: 20 }] },
    },
    annotations,
  });
  assert.equal(snapshot.nodes.length, 1);
  assert.equal(snapshot.nodes[0]?.pinned, true);
  assert.equal(snapshot.annotations[0]?.text, "อาจเป็นผู้ประสาน");
  assert.deepEqual(snapshot.annotations[0]?.position, { x: 60, y: 300 });
  assert.equal(snapshot.presentation.viewport.zoom, 1.1);
  assert.equal(snapshot.edgeRoutes["pc:link-1"]?.mode, "CURVED");
});

test("dirty signature treats move/pin/lock/route/annotation as dirty and ignores viewport", () => {
  const baseline = investigationBoardDirtySignature(sampleWorkspaceSnapshot());
  assert.equal(investigationBoardIsDirty(baseline, snapshotWith({ movePersonA: true })), true);
  assert.equal(investigationBoardIsDirty(baseline, snapshotWith({ pinPersonB: true })), true);
  assert.equal(investigationBoardIsDirty(baseline, snapshotWith({ lock: false })), true);
  assert.equal(investigationBoardIsDirty(baseline, snapshotWith({ routeMode: "STRAIGHT" })), true);
  assert.equal(investigationBoardIsDirty(baseline, snapshotWith({ annotationText: "ข้อความใหม่" })), true);
  assert.equal(
    investigationBoardIsDirty(baseline, snapshotWith({ viewport: { x: 999, y: 999, zoom: 4 } })),
    false
  );
  assert.equal(investigationBoardIsDirty(baseline, sampleWorkspaceSnapshot()), false);
});

test("image block detects blob/data/http sources before serialize", () => {
  assert.equal(boardHasUnpersistableImages([{ imageSrc: "blob:http://localhost/abc" }]), true);
  assert.equal(boardHasUnpersistableImages([{ imageSrc: "data:image/png;base64,xx" }]), true);
  assert.equal(boardHasUnpersistableImages([{ imageSrc: "https://example.com/x.png" }]), true);
  assert.equal(boardHasUnpersistableImages([{ imageSrc: undefined }]), false);
  const snap = sampleWorkspaceSnapshot();
  snap.annotations.push({
    id: "ann-img-1",
    type: "IMAGE",
    color: "#000",
    fillColor: "transparent",
    strokeWidth: 1,
    imageSrc: "blob:http://localhost/abc",
    position: { x: 1, y: 1 },
    width: 80,
    height: 60,
  });
  assert.equal(boardHasUnpersistableImages(snap.annotations), true);
  assert.throws(() => serializeInvestigationBoardState(snap));
});

test("save-as URL keeps only boardId and optional returnTo", () => {
  assert.equal(buildSavedBoardNetworkHref("board-1"), "/drug-intelligence/network?boardId=board-1");
  assert.equal(
    buildSavedBoardNetworkHref("board-1", "/drug-intelligence"),
    "/drug-intelligence/network?boardId=board-1&returnTo=%2Fdrug-intelligence"
  );
  assert.equal(buildSavedBoardNetworkHref("board-1").includes("focusType"), false);
  assert.equal(buildSavedBoardNetworkHref("board-1").includes("focusId"), false);
});

test("start-new ad-hoc href drops boardId", () => {
  const href = buildAdHocNetworkHref({
    graphContext: { focusType: "PERSON", focusId: "person-a", depth: 2 },
  });
  assert.equal(href.includes("boardId"), false);
  assert.equal(href.includes("focusType=PERSON"), true);
  assert.equal(href.includes("focusId=person-a"), true);
});

test("409 conflict helper recognizes ApiClientError status 409 only", () => {
  assert.equal(isInvestigationBoardConflictError(new ApiClientError("conflict", 409, "VERSION_CONFLICT")), true);
  assert.equal(isInvestigationBoardConflictError(new ApiClientError("nope", 400, "BAD_REQUEST")), false);
  assert.equal(isInvestigationBoardConflictError(new Error("conflict")), false);
});

test("dirty-switch and duplicate-while-dirty policies", () => {
  assert.equal(shouldConfirmLeaveSavedBoard(true), true);
  assert.equal(shouldConfirmLeaveSavedBoard(false), false);
  assert.equal(shouldBlockDuplicateWhileDirty(true), true);
  assert.equal(shouldBlockDuplicateWhileDirty(false), false);
});

test("default title uses the live focus label", () => {
  assert.equal(defaultInvestigationBoardTitle("นาย ก"), "นาย ก");
  assert.equal(defaultInvestigationBoardTitle("  "), "");
  assert.equal(defaultInvestigationBoardTitle(null), "");
});

test("graph-context filter patch marks later dirty comparison", () => {
  const current = buildInvestigationBoardGraphContext({
    focusType: "PERSON",
    focusId: "person-a",
    depth: 1,
  });
  const next = applyInvestigationBoardGraphContextPatch(current, { depth: "2" });
  const a = snapshotFromPersistedBoardState({
    ...serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
    graphContext: current,
  });
  const b = snapshotFromPersistedBoardState({
    ...serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
    graphContext: next,
  });
  assert.equal(investigationBoardIsDirty(investigationBoardDirtySignature(a), b), true);
});

test("reconciliation notice counts orphans and dropped routes only", () => {
  const counts = investigationBoardReconciliationCounts({
    restoredNodeIds: ["person-a"],
    orphanedNodeRefs: [{ entityType: "PERSON", entityId: "person-b", reason: "missing" }],
    remappedMergedNodeIds: [],
    droppedEdgeRoutes: ["pc:link-1"],
    restoredEdgeRoutes: [],
    restoredAnnotationIds: [],
  });
  assert.deepEqual(counts, { orphanCount: 1, droppedRouteCount: 1 });
});

test("workspace helpers do not call factual Drug Intelligence writers", () => {
  const src = readFileSync(join(ROOT, "lib/drug_intelligence/drug_investigation_board_workspace.ts"), "utf8");
  assert.doesNotMatch(src, /updatePersonProfile|addPersonAlias|mergePersons|createCase|drugRelationship/);
  assert.doesNotMatch(src, /createInvestigationBoard|updateInvestigationBoard/);
});

test("Network page document actions call board client methods only through hooks", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.match(page, /useCreateDrugInvestigationBoard/);
  assert.match(page, /useUpdateDrugInvestigationBoard/);
  assert.match(page, /useDuplicateDrugInvestigationBoard/);
  assert.match(page, /useArchiveDrugInvestigationBoard/);
  assert.doesNotMatch(page, /updatePersonProfile|mergePersons|createCase|drugRelationship/);
  assert.doesNotMatch(page, /investigationBoardService/);
  assert.match(page, /boardHasUnpersistableImages/);
  assert.match(page, /isInvestigationBoardConflictError/);
  assert.match(page, /shouldConfirmLeaveSavedBoard/);
  assert.match(page, /beforeunload/);
});

test("saved-board UI pieces stay off the analyst toolbar", () => {
  const header = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_saved_board_header.tsx"), "utf8");
  const drawer = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_saved_boards_drawer.tsx"), "utf8");
  const saveAs = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_save_as_board_dialog.tsx"), "utf8");
  const conflict = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_board_conflict_dialog.tsx"), "utf8");
  const confirm = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_board_confirm_dialog.tsx"), "utf8");
  const toolbar = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_analyst_toolbar.tsx"), "utf8");
  assert.match(header, /di\.board\.unsaved/);
  assert.match(drawer, /di\.board\.startNew/);
  assert.match(saveAs, /di\.board\.titleLabel/);
  assert.match(conflict, /di\.board\.reloadLatest/);
  assert.doesNotMatch(conflict, /overwrite|force/i);
  assert.match(confirm, /role="dialog"/);
  assert.doesNotMatch(toolbar, /di\.board\./);
});

test("duplicate and archive POST the registered board-id route with an action", () => {
  const client = readFileSync(join(ROOT, "lib/drug_intelligence/drug_intelligence_client.ts"), "utf8");
  const route = readFileSync(join(ROOT, "app/api/drug-intelligence/boards/[id]/route.ts"), "utf8");
  assert.match(client, /action: "duplicate"/);
  assert.match(client, /action: "archive"/);
  assert.doesNotMatch(client, /\/duplicate`/);
  assert.doesNotMatch(client, /\/archive`/);
  assert.match(route, /export async function POST/);
  assert.match(route, /action === "duplicate"/);
  assert.match(route, /action === "archive"/);
});

test("hooks invalidate investigation board queries after mutations", () => {
  const hooks = readFileSync(join(ROOT, "lib/drug_intelligence/drug_intelligence_hooks.ts"), "utf8");
  const start = hooks.indexOf("function invalidateInvestigationBoardQueries");
  const end = hooks.indexOf("// ── DI-6:");
  const boardHooks = hooks.slice(start, end === -1 ? undefined : end);
  assert.match(boardHooks, /useCreateDrugInvestigationBoard/);
  assert.match(boardHooks, /useUpdateDrugInvestigationBoard/);
  assert.match(boardHooks, /useDuplicateDrugInvestigationBoard/);
  assert.match(boardHooks, /useArchiveDrugInvestigationBoard/);
  assert.match(boardHooks, /invalidateQueries\(\{ queryKey: \["drug-investigation-boards"/);
  assert.doesNotMatch(boardHooks, /updatePersonProfile|mergePersons|createCase/);
});
