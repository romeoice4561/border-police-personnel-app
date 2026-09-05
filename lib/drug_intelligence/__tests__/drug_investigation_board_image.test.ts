import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { DrugInvestigationBoardImageService } from "@/lib/drug_intelligence/drug_investigation_board_image_service";
import { InMemoryBoardImageObjectStore } from "@/lib/drug_intelligence/drug_investigation_board_image_storage";
import {
  BoardImageValidationError,
  BOARD_IMAGE_MAX_BYTES,
  buildBoardImageStoragePath,
  detectBoardImageMime,
  sanitizeOriginalFilename,
  validateBoardImageBytes,
} from "@/lib/drug_intelligence/drug_investigation_board_image_validation";
import {
  handleBoardImageAccess,
  handleBoardImageUpload,
} from "@/lib/drug_intelligence/drug_investigation_board_image_api_handlers";
import { serializeInvestigationBoardState } from "@/lib/drug_intelligence/drug_investigation_board_serialize";
import { annotationsFromPersisted, snapshotWithoutLocalImageSources } from "@/lib/drug_intelligence/drug_investigation_board_workspace";
import { sampleWorkspaceSnapshot } from "@/lib/drug_intelligence/__tests__/drug_investigation_board_fixtures";
import { BoardForbiddenError } from "@/lib/drug_intelligence/drug_investigation_board_types";

const editor = { actorId: "mock:admin", actorName: "Administrator" };
const commander = { actorId: "mock:bpp414", actorName: "Commander" };
const other = { actorId: "analyst-b", actorName: "Analyst B" };

function pngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
  ]);
}

function jpegBytes(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

async function seededBoard(store = new InMemoryBoardImageObjectStore()) {
  const db = new InMemoryDatabaseClient();
  const images = new DrugInvestigationBoardImageService(db, store);
  const boards = new DrugInvestigationBoardService(db, images);
  const board = await boards.createBoard(editor, {
    title: "DI-95D-QA Image Board",
    state: serializeInvestigationBoardState(sampleWorkspaceSnapshot()),
  });
  return { db, store, images, boards, board };
}

test("validation accepts PNG magic and rejects SVG, empty, oversized, and fake MIME", () => {
  const png = pngBytes();
  const ok = validateBoardImageBytes({ bytes: png, declaredMime: "image/png" });
  assert.equal(ok.mimeType, "image/png");
  assert.equal(ok.extension, "png");
  assert.equal(detectBoardImageMime(png), "image/png");
  assert.throws(() => validateBoardImageBytes({ bytes: new Uint8Array() }), BoardImageValidationError);
  assert.throws(() => validateBoardImageBytes({ bytes: new Uint8Array(BOARD_IMAGE_MAX_BYTES + 1) }), BoardImageValidationError);
  assert.throws(() => validateBoardImageBytes({ bytes: new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), declaredMime: "image/svg+xml" }), BoardImageValidationError);
  assert.throws(() => validateBoardImageBytes({ bytes: new TextEncoder().encode("MZ executable"), declaredMime: "image/png" }), BoardImageValidationError);
  assert.throws(() => validateBoardImageBytes({ bytes: jpegBytes(), declaredMime: "image/png" }), BoardImageValidationError);
});

test("storage path is server-generated and rejects traversal", () => {
  assert.equal(buildBoardImageStoragePath("board-1", "img-1", "png"), "boards/board-1/img-1.png");
  assert.throws(() => buildBoardImageStoragePath("../x", "img-1", "png"));
  assert.throws(() => buildBoardImageStoragePath("board-1", "../img", "png"));
  assert.equal(sanitizeOriginalFilename("../../secret.png"), "secret.png");
  assert.equal(sanitizeOriginalFilename("a/b\\c.jpg"), "abc.jpg");
});

test("owner can upload and resolve a signed URL; JSON never stores the URL", async () => {
  const { images, board, store } = await seededBoard();
  const uploaded = await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png", originalName: "note.png" });
  assert.equal(uploaded.boardId, board.id);
  assert.equal(uploaded.mimeType, "image/png");
  const access = await images.access(board.id, uploaded.id, editor);
  assert.match(access.url, /^memory:\/\/board-image\//);
  assert.ok(Date.parse(access.expiresAt) > Date.now());
  assert.equal(store.objects.size, 1);
  const publicUrl = images.publicObjectUrlForTest([...store.objects.keys()][0]!);
  assert.match(publicUrl, /memory:\/\/public\//);
});

test("commander and non-owner cannot upload or resolve another actor's image", async () => {
  const { images, board } = await seededBoard();
  const uploaded = await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  await assert.rejects(() => images.upload(board.id, commander, { bytes: pngBytes(), declaredMime: "image/png" }), BoardForbiddenError);
  await assert.rejects(() => images.upload(board.id, other, { bytes: pngBytes(), declaredMime: "image/png" }), BoardForbiddenError);
  await assert.rejects(() => images.access(board.id, uploaded.id, commander));
  await assert.rejects(() => images.access(board.id, uploaded.id, other));
  await assert.rejects(() => images.accessMany(board.id, [uploaded.id], commander));
  await assert.rejects(() => images.accessMany(board.id, [uploaded.id], other));
});

test("forged boardId, cross-board imageId, and missing image do not leak", async () => {
  const first = await seededBoard();
  const second = await seededBoard();
  const uploaded = await first.images.upload(first.board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  await assert.rejects(() => first.images.access("00000000-0000-0000-0000-000000000099", uploaded.id, editor));
  await assert.rejects(() => first.images.access(second.board.id, uploaded.id, editor));
  await assert.rejects(() => first.images.access(first.board.id, "00000000-0000-0000-0000-000000000099", editor));
});

test("archived board remains readable and rejects new uploads", async () => {
  const { images, boards, board } = await seededBoard();
  const uploaded = await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  await boards.archiveBoard(board.id, editor);
  const access = await images.access(board.id, uploaded.id, editor);
  assert.ok(access.url);
  await assert.rejects(() => images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" }));
});

test("duplicate copies private objects under the destination board", async () => {
  const { images, boards, board, store } = await seededBoard();
  const uploaded = await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  const snap = sampleWorkspaceSnapshot();
  snap.annotations.push({
    id: "ann-img-1",
    type: "IMAGE",
    color: "#000",
    fillColor: "transparent",
    strokeWidth: 1,
    imageId: uploaded.id,
    position: { x: 8, y: 8 },
    width: 80,
    height: 60,
  });
  await boards.updateBoard(board.id, editor, { expectedVersion: board.version, state: serializeInvestigationBoardState(snap) });
  const copy = await boards.duplicateBoard(board.id, editor);
  assert.notEqual(copy.id, board.id);
  const copiedAnn = copy.state.annotations.find((ann) => ann.type === "IMAGE");
  assert.ok(copiedAnn?.imageId);
  assert.notEqual(copiedAnn?.imageId, uploaded.id);
  const destAccess = await images.access(copy.id, copiedAnn!.imageId!, editor);
  assert.ok(destAccess.url);
  await boards.archiveBoard(board.id, editor);
  const still = await images.access(copy.id, copiedAnn!.imageId!, editor);
  assert.ok(still.url);
  assert.ok(store.objects.size >= 2);
});

test("partial duplicate copy failure archives the destination and cleans copies", async () => {
  const store = new InMemoryBoardImageObjectStore();
  const { images, boards, board } = await seededBoard(store);
  const first = await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  const second = await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png" });
  const snap = sampleWorkspaceSnapshot();
  snap.annotations.push(
    { id: "ann-img-a", type: "IMAGE", color: "#000", fillColor: "transparent", strokeWidth: 1, imageId: first.id, position: { x: 1, y: 1 }, width: 40, height: 30 },
    { id: "ann-img-b", type: "IMAGE", color: "#000", fillColor: "transparent", strokeWidth: 1, imageId: second.id, position: { x: 2, y: 2 }, width: 40, height: 30 }
  );
  await boards.updateBoard(board.id, editor, { expectedVersion: board.version, state: serializeInvestigationBoardState(snap) });
  const originalGet = store.get.bind(store);
  let reads = 0;
  store.get = async (path: string) => {
    reads += 1;
    if (reads > 1) throw new Error("copy-fail");
    return originalGet(path);
  };
  await assert.rejects(() => boards.duplicateBoard(board.id, editor));
  const listed = await boards.listBoards(editor, "ACTIVE");
  assert.equal(listed.some((row) => row.id !== board.id && /สำเนา/.test(row.title)), false);
});

test("hydration keeps imageId and missing images do not crash the overlay", () => {
  const persisted = serializeInvestigationBoardState({
    ...sampleWorkspaceSnapshot(),
    annotations: [
      {
        id: "ann-img-missing",
        type: "IMAGE",
        color: "#000",
        fillColor: "transparent",
        strokeWidth: 1,
        imageId: "missing-image",
        position: { x: 4, y: 4 },
        width: 80,
        height: 60,
      },
    ],
  });
  const runtime = annotationsFromPersisted(persisted.annotations);
  assert.equal(runtime[0]?.imageId, "missing-image");
  assert.equal(runtime[0]?.imageSrc, undefined);
  const staged = snapshotWithoutLocalImageSources({
    ...sampleWorkspaceSnapshot(),
    annotations: [
      {
        id: "ann-img-local",
        type: "IMAGE",
        color: "#000",
        fillColor: "transparent",
        strokeWidth: 1,
        imageSrc: "blob:http://localhost/local",
        position: { x: 1, y: 1 },
        width: 40,
        height: 30,
      },
    ],
  });
  assert.equal(staged.annotations[0]?.imageSrc, undefined);
  assert.doesNotThrow(() => serializeInvestigationBoardState(staged));
});

test("audit records upload without signed URL, storage path, or bytes", async () => {
  const { db, images, board } = await seededBoard();
  await images.upload(board.id, editor, { bytes: pngBytes(), declaredMime: "image/png", originalName: "secret.png" });
  const audits = await db.drugAuditLog.findMany({ where: { entityId: board.id, action: "board_image_uploaded" } });
  assert.equal(audits.length, 1);
  const detail = String(audits[0]?.detail ?? "");
  assert.match(detail, /imageId/);
  assert.match(detail, /byteSize/);
  assert.equal(detail.includes("memory://"), false);
  assert.equal(detail.includes("boards/"), false);
  assert.equal(detail.includes("secret.png"), false);
});

test("flat board-images route is registered and nested board image routes are not used", () => {
  const route = readFileSync(join(process.cwd(), "app/api/drug-intelligence/board-images/route.ts"), "utf8");
  const client = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_intelligence_client.ts"), "utf8");
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
  assert.match(client, /\/drug-intelligence\/board-images/);
  assert.doesNotMatch(client, /\/boards\/\$\{.*\}\/images/);
});

test("multipart upload handler requires a file and uses the image service", async () => {
  const { images, board } = await seededBoard();
  const empty = await handleBoardImageUpload(
    images,
    new Request("http://localhost/api/drug-intelligence/board-images", { method: "POST", body: new FormData() })
  );
  assert.equal(empty.status, 400);
  const form = new FormData();
  form.append("actorId", editor.actorId);
  form.append("actorName", editor.actorName);
  form.append("boardId", board.id);
  form.append("file", new File([pngBytes().slice().buffer], "qa.png", { type: "image/png" }));
  const uploaded = await handleBoardImageUpload(
    images,
    new Request("http://localhost/api/drug-intelligence/board-images", { method: "POST", body: form })
  );
  assert.ok([201, 401, 403].includes(uploaded.status));
  const access = await handleBoardImageAccess(
    images,
    new Request(`http://localhost/api/drug-intelligence/board-images?actorId=${editor.actorId}&boardId=${board.id}&ids=nope`)
  );
  assert.ok([200, 401, 403].includes(access.status));
});
