import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { DrugInvestigationBoardImageService } from "@/lib/drug_intelligence/drug_investigation_board_image_service";
import { InMemoryBoardImageObjectStore } from "@/lib/drug_intelligence/drug_investigation_board_image_storage";
import { BoardConflictError, BoardForbiddenError } from "@/lib/drug_intelligence/drug_investigation_board_types";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";
import { hydrateInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_hydrate";
import { sampleLiveGraph } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";

const editor = { actorId: "mock:admin", actorName: "Administrator" };
const other = { actorId: "analyst-b", actorName: "Analyst B" };
const ROOT = join(process.cwd());

function pngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
  ]);
}

test("two-tab stale save remains 409 and does not overwrite", async () => {
  const db = new InMemoryDatabaseClient();
  const boards = new DrugInvestigationBoardService(db);
  const created = await boards.createBoard(editor, {
    title: "DI-95E-QA Conflict",
    state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
  });
  await boards.updateBoard(created.id, editor, { expectedVersion: 1, title: "tab-a-saved" });
  await assert.rejects(
    () => boards.updateBoard(created.id, editor, { expectedVersion: 1, title: "tab-b-stale" }),
    BoardConflictError
  );
  const latest = await boards.getBoard(created.id, editor);
  assert.equal(latest.title, "tab-a-saved");
  assert.equal(latest.version, 2);
});

test("conflict Save as Copy persists CURRENT local overlay not the latest server state", async () => {
  const db = new InMemoryDatabaseClient();
  const store = new InMemoryBoardImageObjectStore();
  const images = new DrugInvestigationBoardImageService(db, store);
  const boards = new DrugInvestigationBoardService(db, images);
  const created = await boards.createBoard(editor, {
    title: "DI-95E-QA Source",
    state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
  });
  await boards.updateBoard(created.id, editor, { expectedVersion: 1, title: "server-latest" });

  const local = sampleWorkspaceSnapshot();
  const moved = local.nodes.find((n) => n.id === "person-a")!;
  moved.position = { x: 333, y: 222 };
  const text = local.annotations.find((a) => a.id === "ann-text-1")!;
  text.text = "งานท้องถิ่นของแท็บ B";
  const uploaded = await images.upload(created.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  local.annotations.push({
    id: "ann-img-local",
    type: "IMAGE",
    color: "#000",
    fillColor: "transparent",
    strokeWidth: 1,
    imageId: uploaded.id,
    caption: "local-geom",
    position: { x: 44, y: 55 },
    width: 120,
    height: 80,
  });

  const copy = await boards.createBoard(editor, {
    title: "DI-95E-QA Source (สำเนา)",
    state: serializeInvestigationBoardState(local),
    sourceBoardId: created.id,
  });
  assert.notEqual(copy.id, created.id);
  assert.equal(copy.version, 2);
  assert.equal(copy.ownerActorId, editor.actorId);
  assert.equal(copy.title.includes("สำเนา"), true);
  const person = copy.state.nodeLayout.find((n) => n.entityId === "person-a");
  assert.deepEqual(person ? { x: person.x, y: person.y } : null, { x: 333, y: 222 });
  assert.equal(copy.state.annotations.find((a) => a.id === "ann-text-1")?.text, "งานท้องถิ่นของแท็บ B");
  const image = copy.state.annotations.find((a) => a.id === "ann-img-local");
  assert.ok(image?.imageId);
  assert.notEqual(image?.imageId, uploaded.id);
  assert.equal(image?.width, 120);
  assert.equal(image?.position.x, 44);
  const destAccess = await images.access(copy.id, image!.imageId!, editor);
  assert.ok(destAccess.url);
  const source = await boards.getBoard(created.id, editor);
  assert.equal(source.title, "server-latest");
  assert.equal(source.state.annotations.some((a) => a.id === "ann-img-local"), false);
});

test("failed local-state copy archives the destination and leaves the source intact", async () => {
  const db = new InMemoryDatabaseClient();
  const store = new InMemoryBoardImageObjectStore();
  const images = new DrugInvestigationBoardImageService(db, store);
  const boards = new DrugInvestigationBoardService(db, images);
  const created = await boards.createBoard(editor, {
    title: "DI-95E-QA Fail Source",
    state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
  });
  const first = await images.upload(created.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  const second = await images.upload(created.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  const local = sampleWorkspaceSnapshot();
  local.annotations.push(
    { id: "ann-img-a", type: "IMAGE", color: "#000", fillColor: "transparent", strokeWidth: 1, imageId: first.id, position: { x: 1, y: 1 }, width: 40, height: 30 },
    { id: "ann-img-b", type: "IMAGE", color: "#000", fillColor: "transparent", strokeWidth: 1, imageId: second.id, position: { x: 2, y: 2 }, width: 40, height: 30 }
  );
  const originalGet = store.get.bind(store);
  let reads = 0;
  store.get = async (path: string) => {
    reads += 1;
    if (reads > 1) throw new Error("copy failed");
    return originalGet(path);
  };
  await assert.rejects(() =>
    boards.createBoard(editor, {
      title: "DI-95E-QA Fail Copy",
      state: serializeInvestigationBoardState(local),
      sourceBoardId: created.id,
    })
  );
  const listed = await boards.listBoards(editor, "ARCHIVED");
  const dest = listed.find((b) => b.title === "DI-95E-QA Fail Copy");
  assert.ok(dest);
  assert.equal(dest.status, "ARCHIVED");
  const source = await boards.getBoard(created.id, editor);
  assert.equal(source.status, "ACTIVE");
});

test("non-owner cannot create a local copy from another actor's board", async () => {
  const db = new InMemoryDatabaseClient();
  const boards = new DrugInvestigationBoardService(db);
  const created = await boards.createBoard(editor, {
    title: "DI-95E-QA Private",
    state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
  });
  await assert.rejects(
    () =>
      boards.createBoard(other, {
        title: "stolen",
        state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
        sourceBoardId: created.id,
      }),
    BoardForbiddenError
  );
});

test("hydrate still drops missing factual nodes/edges and remaps merged persons", () => {
  const state = serializeInvestigationBoardState(sampleWorkspaceSnapshot());
  const hydrated = hydrateInvestigationBoardState(state, sampleLiveGraph({ missingPersonB: true, dropDirect: true }));
  assert.ok(hydrated.reconciliation.orphanedNodeRefs.some((o) => o.entityId === "person-b"));
  assert.ok(hydrated.reconciliation.droppedEdgeRoutes.includes("pc:link-1"));
  assert.equal(hydrated.graph.nodes.some((n) => n.id === "person-b"), false);
});

test("recovery helpers and page wiring stay local-copy / no-overwrite / no-autosave", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.match(page, /sourceBoardId: boardQuery\.data\.id/);
  assert.match(page, /shouldBlockArchiveWhileDirty/);
  assert.match(page, /uploadInFlight/);
  assert.match(page, /reloadFailed/);
  assert.match(page, /copyFailed/);
  assert.doesNotMatch(page, /force overwrite|last-write-wins|autosave/i);
  assert.match(page, /commitSavedBoardNavigation/);
  assert.match(page, /prepareAuthorizedSavedBoardNavigation/);
  const dialog = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_board_conflict_dialog.tsx"), "utf8");
  assert.doesNotMatch(dialog, /overwrite|force/i);
  assert.match(dialog, /aria-labelledby/);
});
