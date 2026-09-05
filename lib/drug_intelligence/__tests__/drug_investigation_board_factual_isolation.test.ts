import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";

const ROOT = join(process.cwd());

const BOARD_FILES = [
  "lib/drug_intelligence/drug_investigation_board_service.ts",
  "lib/drug_intelligence/drug_investigation_board_api_handlers.ts",
  "lib/database/repositories/drug_investigation_board_repository.ts",
  "lib/drug_intelligence/drug_investigation_board_serialize.ts",
  "lib/drug_intelligence/drug_investigation_board_hydrate.ts",
  "lib/drug_intelligence/drug_investigation_board_workspace.ts",
  "components/drug_intelligence/drug_network_saved_board_header.tsx",
  "components/drug_intelligence/drug_network_saved_boards_drawer.tsx",
  "components/drug_intelligence/drug_network_save_as_board_dialog.tsx",
  "components/drug_intelligence/drug_network_board_conflict_dialog.tsx",
  "components/drug_intelligence/drug_network_board_confirm_dialog.tsx",
];

test("board persistence modules do not call factual graph writers", () => {
  const forbidden = [
    /\.drugRelationship\b/,
    /\.drugNetworkGroup\b/,
    /\.drugCasePerson\b/,
    /\.drugCasePhone\b/,
    /\.drugCaseSim\b/,
    /\.drugCaseDevice\b/,
    /\.drugCaseVehicle\b/,
    /\.drugCaseLocation\b/,
    /\.drugPersonDevice\b/,
    /\.drugPersonVehicle\b/,
    /\.drugPersonNetworkMembership\b/,
    /\.drugPersonNetworkRole\b/,
    /\.drugPersonMerge\b/,
    /DrugPersonMergeService/,
    /drug_person_merge_service/,
    /drug_case_service/,
  ];
  for (const file of BOARD_FILES) {
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const token of forbidden) {
      assert.doesNotMatch(src, token, `${file} must not match ${token}`);
    }
  }
});

test("create/save/duplicate/archive do not write factual graph tables", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const actor = { actorId: "mock:admin", actorName: "Administrator" };
  const created = await service.createBoard(actor, {
    title: "DI-95B-QA isolation",
    state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
  });
  await service.updateBoard(created.id, actor, { expectedVersion: 1, title: "DI-95B-QA isolation 2" });
  await service.duplicateBoard(created.id, actor);
  await service.archiveBoard(created.id, actor);

  assert.equal(await db.drugNetworkGroup.count(), 0);
  assert.equal(await db.drugCasePerson.count(), 0);
  assert.equal(await db.drugCasePhone.count(), 0);
  assert.equal(await db.drugCaseSim.count(), 0);
  assert.equal(await db.drugCaseDevice.count(), 0);
  assert.equal(await db.drugCaseVehicle.count(), 0);
  assert.equal(await db.drugCaseLocation.count(), 0);
  assert.equal(await db.drugPersonDevice.count(), 0);
  assert.equal(await db.drugPersonVehicle.count(), 0);
  assert.equal(await db.drugPersonNetworkMembership.count(), 0);
  assert.equal(await db.drugPersonNetworkRole.count(), 0);
  assert.equal(await db.drugPersonMerge.count(), 0);
  assert.equal(await db.drugCase.count(), 0);
  assert.equal(await db.drugPerson.count(), 0);
  assert.ok((await db.drugInvestigationBoard.count()) >= 2);
  assert.equal(await db.drugInvestigationBoardImage.count(), 0);
  assert.ok((await db.drugAuditLog.count()) >= 4);
});
