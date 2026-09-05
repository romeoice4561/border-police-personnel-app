import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import {
  handleInvestigationBoardArchive,
  handleInvestigationBoardCreate,
  handleInvestigationBoardDuplicate,
  handleInvestigationBoardGet,
  handleInvestigationBoardList,
  handleInvestigationBoardUpdate,
} from "@/lib/drug_intelligence/drug_investigation_board_api_handlers";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";
import { DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES } from "@/lib/drug_intelligence/drug_investigation_board_state";

function requestWithSession(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=test-session`);
  return new Request(url, { ...init, headers });
}

function requestNoCookie(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

function validState() {
  return serializeInvestigationBoardState(sampleWorkspaceSnapshot());
}

async function createAsAdmin(service: DrugInvestigationBoardService) {
  const request = requestWithSession("http://localhost/api/drug-intelligence/boards", {
    method: "POST",
    body: JSON.stringify({
      actorId: "mock:admin",
      actorName: "Administrator",
      title: "DI-95B-QA handler",
      state: validState(),
    }),
  });
  const response = await handleInvestigationBoardCreate(service, request);
  assert.equal(response.status, 201);
  const body = (await response.json()) as { data: { id: string; version: number } };
  return body.data;
}

test("unauthenticated create is 401", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const response = await handleInvestigationBoardCreate(
    service,
    requestNoCookie("http://localhost/api/drug-intelligence/boards", {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", title: "x", state: validState() }),
    })
  );
  assert.equal(response.status, 401);
});

test("commander drug.read cannot create a board", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const response = await handleInvestigationBoardCreate(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/boards", {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander BPP414", title: "nope", state: validState() }),
    })
  );
  assert.equal(response.status, 403);
});

test("officer without drug.read cannot list boards", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const response = await handleInvestigationBoardList(
    service,
    new URLSearchParams({ actorId: "mock:1101700123456" }),
    requestWithSession("http://localhost/api/drug-intelligence/boards?actorId=mock:1101700123456")
  );
  assert.equal(response.status, 403);
});

test("admin can create, list, get, save, duplicate, archive", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const created = await createAsAdmin(service);
  const list = await handleInvestigationBoardList(
    service,
    new URLSearchParams({ actorId: "mock:admin" }),
    requestWithSession("http://localhost/api/drug-intelligence/boards?actorId=mock:admin")
  );
  assert.equal(list.status, 200);
  const listed = (await list.json()) as { data: { boards: Array<{ id: string }> } };
  assert.equal(listed.data.boards.some((b) => b.id === created.id), true);

  const got = await handleInvestigationBoardGet(
    service,
    created.id,
    new URLSearchParams({ actorId: "mock:admin" }),
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}?actorId=mock:admin`)
  );
  assert.equal(got.status, 200);

  const patched = await handleInvestigationBoardUpdate(
    service,
    created.id,
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", expectedVersion: created.version, title: "renamed" }),
    })
  );
  assert.equal(patched.status, 200);
  const saved = (await patched.json()) as { data: { version: number; title: string } };
  assert.equal(saved.data.version, 2);

  const stale = await handleInvestigationBoardUpdate(
    service,
    created.id,
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", expectedVersion: 1, title: "stale" }),
    })
  );
  assert.equal(stale.status, 409);

  const dup = await handleInvestigationBoardDuplicate(
    service,
    created.id,
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator" }),
    })
  );
  assert.equal(dup.status, 201);

  const archived = await handleInvestigationBoardArchive(
    service,
    created.id,
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}/archive`, {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator" }),
    })
  );
  assert.equal(archived.status, 200);
});

test("commander cannot save another actor's board (no drug.edit)", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const created = await createAsAdmin(service);
  const response = await handleInvestigationBoardUpdate(
    service,
    created.id,
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ actorId: "mock:bpp414", actorName: "Commander BPP414", expectedVersion: 1, title: "nope" }),
    })
  );
  assert.equal(response.status, 403);
});

test("non-owner drug.read get is forbidden", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new DrugInvestigationBoardService(db);
  const created = await service.createBoard({ actorId: "analyst-a", actorName: "A" }, { title: "private", state: validState() });
  const response = await handleInvestigationBoardGet(
    service,
    created.id,
    new URLSearchParams({ actorId: "mock:bpp414" }),
    requestWithSession(`http://localhost/api/drug-intelligence/boards/${created.id}?actorId=mock:bpp414`)
  );
  assert.equal(response.status, 403);
});

test("unknown schemaVersion and owner fields in body are rejected", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const badVersion = await handleInvestigationBoardCreate(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/boards", {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", title: "x", state: { ...validState(), schemaVersion: 99 } }),
    })
  );
  assert.equal(badVersion.status, 400);

  const extraOwner = await handleInvestigationBoardCreate(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/boards", {
      method: "POST",
      body: JSON.stringify({
        actorId: "mock:admin",
        actorName: "Administrator",
        ownerActorId: "mock:bpp414",
        title: "x",
        state: validState(),
      }),
    })
  );
  assert.equal(extraOwner.status, 400);
});

test("blob/data/https image sources are rejected", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  for (const imageSrc of ["blob:http://localhost/x", "data:image/png;base64,aaaa", "https://evil.example/x.png"]) {
    const state = validState();
    state.annotations.push({
      id: "ann-bad-img",
      type: "IMAGE",
      color: "#000",
      fillColor: "transparent",
      strokeWidth: 1,
      position: { x: 1, y: 1 },
      width: 10,
      height: 10,
      imageSrc,
    } as (typeof state.annotations)[number] & { imageSrc: string });
    const response = await handleInvestigationBoardCreate(
      service,
      requestWithSession("http://localhost/api/drug-intelligence/boards", {
        method: "POST",
        body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", title: "img", state }),
      })
    );
    assert.equal(response.status, 400, imageSrc);
  }
});

test("oversized board state is 413", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const huge = validState();
  huge.annotations[2] = { ...huge.annotations[2], text: "x".repeat(DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES) };
  const response = await handleInvestigationBoardCreate(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/boards", {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", title: "huge", state: huge }),
    })
  );
  assert.equal(response.status, 413);
});

test("XSS-like annotation text is stored as data, not executed", async () => {
  const service = new DrugInvestigationBoardService(new InMemoryDatabaseClient());
  const state = validState();
  const payload = "<script>alert(1)</script>";
  state.annotations[2] = { ...state.annotations[2], text: payload };
  const created = await handleInvestigationBoardCreate(
    service,
    requestWithSession("http://localhost/api/drug-intelligence/boards", {
      method: "POST",
      body: JSON.stringify({ actorId: "mock:admin", actorName: "Administrator", title: "xss", state }),
    })
  );
  assert.equal(created.status, 201);
  const body = (await created.json()) as { data: { state: { annotations: Array<{ text?: string }> } } };
  assert.equal(body.data.state.annotations.find((a) => a.text)?.text, payload);
});
