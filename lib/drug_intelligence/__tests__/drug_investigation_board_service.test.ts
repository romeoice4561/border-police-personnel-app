import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { BoardConflictError, BoardForbiddenError } from "@/lib/drug_intelligence/drug_investigation_board_types";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";

const editor = { actorId: "mock:admin", actorName: "Administrator" };
const other = { actorId: "analyst-b", actorName: "Analyst B" };

function state() {
  return serializeInvestigationBoardState(sampleWorkspaceSnapshot());
}

test("create board starts at version 1 and writes board_created audit without full JSON", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const board = await service.createBoard(editor, { title: "DI-95B-QA เครือข่ายนาย ก", state: state() });
  assert.equal(board.version, 1);
  assert.equal(board.schemaVersion, 1);
  assert.equal(board.status, "ACTIVE");
  assert.equal(board.ownerActorId, "mock:admin");
  assert.equal(board.focusType, "PERSON");
  const audits = await db.drugAuditLog.findMany({ where: { entityType: "DrugInvestigationBoard", entityId: board.id } });
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "board_created");
  assert.equal(String(audits[0]?.detail ?? "").includes("nodeLayout"), false);
  assert.equal(String(audits[0]?.detail ?? "").includes("อาจเป็นผู้ประสาน"), false);
});

test("successful save increments version exactly once and audits board_saved", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard(editor, { title: "DI-95B-QA save", state: state() });
  const next = { ...state(), presentation: { ...state().presentation, boardLocked: false } };
  const saved = await service.updateBoard(created.id, editor, { expectedVersion: 1, state: next });
  assert.equal(saved.version, 2);
  assert.equal(saved.state.presentation.boardLocked, false);
  const actions = (await db.drugAuditLog.findMany({ where: { entityId: created.id } })).map((a) => a.action);
  assert.ok(actions.includes("board_saved"));
});

test("rename without state change audits board_renamed", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard(editor, { title: "DI-95B-QA old", state: state() });
  const renamed = await service.updateBoard(created.id, editor, { expectedVersion: 1, title: "DI-95B-QA new" });
  assert.equal(renamed.title, "DI-95B-QA new");
  assert.equal(renamed.version, 2);
  const actions = (await db.drugAuditLog.findMany({ where: { entityId: created.id } })).map((a) => a.action);
  assert.ok(actions.includes("board_renamed"));
});

test("stale expectedVersion is a conflict and does not overwrite", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard(editor, { title: "DI-95B-QA conflict", state: state() });
  await service.updateBoard(created.id, editor, { expectedVersion: 1, title: "winner" });
  await assert.rejects(
    () => service.updateBoard(created.id, editor, { expectedVersion: 1, title: "stale" }),
    BoardConflictError
  );
  const latest = await service.getBoard(created.id, editor);
  assert.equal(latest.title, "winner");
  assert.equal(latest.version, 2);
});

test("duplicate creates a new owned board at version 1", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard(editor, { title: "DI-95B-QA source", description: "note", state: state() });
  const copy = await service.duplicateBoard(created.id, editor);
  assert.notEqual(copy.id, created.id);
  assert.equal(copy.version, 1);
  assert.equal(copy.title, "DI-95B-QA source (สำเนา)");
  assert.equal(copy.description, "note");
  assert.equal(copy.ownerActorId, editor.actorId);
  const audits = await db.drugAuditLog.findMany({ where: { entityId: copy.id } });
  assert.equal(audits[0]?.action, "board_duplicated");
  assert.ok(String(audits[0]?.detail).includes(created.id));
});

test("archive hides the board from the default ACTIVE list", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard(editor, { title: "DI-95B-QA archive", state: state() });
  const archived = await service.archiveBoard(created.id, editor);
  assert.equal(archived.status, "ARCHIVED");
  const active = await service.listBoards(editor, "ACTIVE");
  assert.equal(active.some((b) => b.id === created.id), false);
  const archivedList = await service.listBoards(editor, "ARCHIVED");
  assert.equal(archivedList.some((b) => b.id === created.id), true);
});

test("non-owner cannot get or update another actor's board", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard(editor, { title: "DI-95B-QA private", state: state() });
  await assert.rejects(() => service.getBoard(created.id, other), BoardForbiddenError);
  await assert.rejects(() => service.updateBoard(created.id, other, { expectedVersion: 1, title: "hack" }), BoardForbiddenError);
  const list = await service.listBoards(other);
  assert.equal(list.length, 0);
});
