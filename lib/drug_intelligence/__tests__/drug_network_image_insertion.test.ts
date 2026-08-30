/**
 * DI-9.4.1 Human QA fix — Image tool insertion focused tests (A–T).
 *
 * Covers: immediate file-picker workflow helpers, MIME/size validation,
 * viewport-centered placement, aspect-preserving initial size, blob URL
 * ref-counting for duplicates, and source-level wiring for Board Lock /
 * View Mode / no factual mutations.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createImageAnnotation,
  buildDuplicateAnnotation,
  validateImageAnnotationFile,
  computeImageAnnotationInitialSize,
  imageAnnotationCenteredPosition,
  retainBlobUrl,
  releaseBlobUrl,
  blobUrlRefCount,
  IMAGE_ANNOTATION_ALLOWED_MIME,
  IMAGE_ANNOTATION_MAX_BYTES,
  IMAGE_ANNOTATION_MAX_INITIAL,
  ANNOTATION_DEFAULT_SIZES,
} from "../drug_network_annotations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const pageSource = readFileSync(join(root, "app/drug-intelligence/network/page.tsx"), "utf8");
const nodeSource = readFileSync(
  join(root, "components/drug_intelligence/drug_network_annotation_node.tsx"),
  "utf8"
);
const floatingBarSource = readFileSync(
  join(root, "components/drug_intelligence/drug_network_annotation_floating_bar.tsx"),
  "utf8"
);
const toolbarSource = readFileSync(
  join(root, "components/drug_intelligence/drug_network_analyst_toolbar.tsx"),
  "utf8"
);

// ─── A: Image toolbar click triggers file input ───────────────────────────────
describe("A: Image toolbar click triggers file input", () => {
  test("page opens file picker via ref click, not canvas-click placement", () => {
    assert.match(pageSource, /function openImageFilePicker/);
    assert.match(pageSource, /imageInputRef\.current/);
    assert.match(pageSource, /input\.click\(\)/);
    assert.match(pageSource, /if \(tool === "IMAGE"\)/);
    assert.match(pageSource, /openImageFilePicker\(\)/);
    // Must NOT gate on stale activeTool === "IMAGE" (the Human QA root cause)
    assert.equal(/if\s*\(\s*activeTool\s*===\s*"IMAGE"/.test(pageSource), false);
  });
});

// ─── B: cancel creates nothing ────────────────────────────────────────────────
describe("B: cancel creates nothing", () => {
  test("cancel path: no file → early return; tool forced to SELECT", () => {
    assert.match(pageSource, /const file = e\.target\.files\?\.\[0\]/);
    assert.match(pageSource, /if \(!file\) return/);
    assert.match(pageSource, /setActiveTool\("SELECT"\)/);
    // Image is one-shot — openImageFilePicker also returns to SELECT before picker
    assert.match(pageSource, /function openImageFilePicker[\s\S]*setActiveTool\("SELECT"\)/);
  });
});

// ─── C: valid file creates IMAGE annotation ───────────────────────────────────
describe("C: valid file creates IMAGE annotation", () => {
  test("createImageAnnotation stores type IMAGE and imageSrc", () => {
    const ann = createImageAnnotation("blob:http://localhost/test-1");
    assert.equal(ann.type, "IMAGE");
    assert.equal(ann.imageSrc, "blob:http://localhost/test-1");
    assert.ok(ann.id.startsWith("ann-"));
  });

  test("page wires createImageAnnotation + addAnnotationToCanvas after valid file", () => {
    assert.match(pageSource, /createImageAnnotation\(objectUrl\)/);
    assert.match(pageSource, /addAnnotationToCanvas\(ann, pos, size\)/);
  });
});

// ─── D: active tool returns SELECT ────────────────────────────────────────────
describe("D: active tool returns SELECT", () => {
  test("openImageFilePicker and handleImageFileChange both return to SELECT", () => {
    const openIdx = pageSource.indexOf("function openImageFilePicker");
    const openBlock = pageSource.slice(openIdx, openIdx + 500);
    assert.match(openBlock, /setActiveTool\("SELECT"\)/);
    assert.match(pageSource, /async function handleImageFileChange[\s\S]*?setActiveTool\("SELECT"\)/);
  });
});

// ─── E: new image selected ────────────────────────────────────────────────────
describe("E: new image selected", () => {
  test("addAnnotationToCanvas selects the new annotation", () => {
    assert.match(pageSource, /const selectedFlowNode = \{ \.\.\.flowNode, selected: true \}/);
    assert.match(pageSource, /setSelectedAnnotationId\(ann\.id\)/);
  });
});

// ─── F: initial placement uses viewport center ────────────────────────────────
describe("F: initial placement uses viewport center", () => {
  test("helpers center object on viewport center", () => {
    const pos = imageAnnotationCenteredPosition({ x: 500, y: 400 }, { width: 200, height: 100 });
    assert.deepEqual(pos, { x: 400, y: 350 });
  });

  test("page uses canvas container + screenToFlowPosition for viewport center", () => {
    assert.match(pageSource, /function getVisibleViewportCenterFlow/);
    assert.match(pageSource, /canvasContainerRef/);
    assert.match(pageSource, /screenToFlowPosition/);
    assert.match(pageSource, /imageAnnotationCenteredPosition\(center, size\)/);
    // Must not hardcode graph origin
    assert.doesNotMatch(pageSource, /addAnnotationToCanvas\(ann, \{\s*x:\s*0,\s*y:\s*0/);
  });
});

// ─── G: natural aspect ratio preserved ────────────────────────────────────────
describe("G: natural aspect ratio preserved", () => {
  test("portrait stays portrait", () => {
    const size = computeImageAnnotationInitialSize(600, 1200);
    assert.ok(size.height > size.width);
    assert.equal(Number((size.width / size.height).toFixed(3)), Number((600 / 1200).toFixed(3)));
  });

  test("landscape stays landscape", () => {
    const size = computeImageAnnotationInitialSize(1600, 900);
    assert.ok(size.width > size.height);
    assert.equal(Number((size.width / size.height).toFixed(3)), Number((1600 / 900).toFixed(3)));
  });

  test("square stays square", () => {
    const size = computeImageAnnotationInitialSize(800, 800);
    assert.equal(size.width, size.height);
  });
});

// ─── H: initial size bounded ──────────────────────────────────────────────────
describe("H: initial size bounded", () => {
  test("large image fits within 320×240 max box", () => {
    const size = computeImageAnnotationInitialSize(4000, 3000);
    assert.ok(size.width <= IMAGE_ANNOTATION_MAX_INITIAL.width);
    assert.ok(size.height <= IMAGE_ANNOTATION_MAX_INITIAL.height);
  });

  test("small image is not upscaled", () => {
    const size = computeImageAnnotationInitialSize(100, 80);
    assert.deepEqual(size, { width: 100, height: 80 });
  });

  test("default IMAGE size exists as fallback", () => {
    assert.ok(ANNOTATION_DEFAULT_SIZES.IMAGE.width > 0);
    assert.ok(ANNOTATION_DEFAULT_SIZES.IMAGE.height > 0);
  });
});

// ─── I: image resize aspect ratio preserved ───────────────────────────────────
describe("I: image resize aspect ratio preserved", () => {
  test("IMAGE NodeResizer uses keepAspectRatio", () => {
    // Locate IMAGE branch and ensure keepAspectRatio is present nearby
    const imgIdx = nodeSource.indexOf('if (annotation.type === "IMAGE")');
    assert.ok(imgIdx >= 0);
    const imgBlock = nodeSource.slice(imgIdx, imgIdx + 800);
    assert.match(imgBlock, /keepAspectRatio/);
  });

  test("Rectangle/Ellipse NodeResizer do not force keepAspectRatio", () => {
    const rectIdx = nodeSource.indexOf("RECTANGLE / ELLIPSE");
    assert.ok(rectIdx >= 0);
    const shapeBlock = nodeSource.slice(rectIdx, rectIdx + 600);
    assert.doesNotMatch(shapeBlock, /keepAspectRatio/);
  });
});

// ─── J: Board Lock prevents image insertion ───────────────────────────────────
describe("J: Board Lock prevents image insertion", () => {
  test("openImageFilePicker returns early when boardLocked", () => {
    assert.match(pageSource, /function openImageFilePicker\(\) \{\s*if \(boardLocked/);
  });

  test("toolbar disables IMAGE when board locked", () => {
    assert.match(toolbarSource, /boardLocked && tool !== "SELECT" && tool !== "PAN"/);
  });
});

// ─── K: Board Lock prevents resize ────────────────────────────────────────────
describe("K: Board Lock prevents resize", () => {
  test("IMAGE NodeResizer only when analystMode && !boardLocked && selected", () => {
    assert.match(nodeSource, /const isResizable = analystMode && !boardLocked/);
    assert.match(nodeSource, /const showHandles = isResizable && selected/);
  });
});

// ─── L: View Mode no editing ──────────────────────────────────────────────────
describe("L: View Mode no editing", () => {
  test("toolbar and floating bar only in Analyst Mode", () => {
    assert.match(pageSource, /effectiveWorkspaceMode === "ANALYST" \? \(\s*<DrugNetworkAnalystToolbar/);
    assert.match(
      pageSource,
      /selectedAnnotation && effectiveWorkspaceMode === "ANALYST" \?[\s\S]*DrugNetworkAnnotationFloatingBar/
    );
  });
});

// ─── M: invalid MIME rejected ─────────────────────────────────────────────────
describe("M: invalid MIME rejected", () => {
  test("rejects svg and pdf", () => {
    assert.deepEqual(validateImageAnnotationFile({ type: "image/svg+xml", size: 100 }), {
      ok: false,
      reason: "mime",
    });
    assert.deepEqual(validateImageAnnotationFile({ type: "application/pdf", size: 100 }), {
      ok: false,
      reason: "mime",
    });
  });

  test("accepts jpeg/png/gif/webp", () => {
    for (const type of IMAGE_ANNOTATION_ALLOWED_MIME) {
      assert.deepEqual(validateImageAnnotationFile({ type, size: 100 }), { ok: true });
    }
  });
});

// ─── N: oversized file rejected ───────────────────────────────────────────────
describe("N: oversized file rejected", () => {
  test("rejects files over IMAGE_ANNOTATION_MAX_BYTES", () => {
    assert.deepEqual(
      validateImageAnnotationFile({
        type: "image/png",
        size: IMAGE_ANNOTATION_MAX_BYTES + 1,
      }),
      { ok: false, reason: "size" }
    );
    assert.deepEqual(
      validateImageAnnotationFile({
        type: "image/png",
        size: IMAGE_ANNOTATION_MAX_BYTES,
      }),
      { ok: true }
    );
  });
});

// ─── O: same file can be selected twice ───────────────────────────────────────
describe("O: same file can be selected twice", () => {
  test("input value is reset before click and after change", () => {
    assert.match(pageSource, /input\.value = ""/);
    assert.match(pageSource, /e\.target\.value = ""/);
  });
});

// ─── P: delete cleanup ────────────────────────────────────────────────────────
describe("P: delete cleanup", () => {
  test("deleteAnnotation releases blob URL via registry", () => {
    assert.match(pageSource, /releaseBlobUrl\(blobUrlRegistryRef\.current, ann\?\.imageSrc\)/);
  });

  test("releaseBlobUrl revokes only at zero refs", () => {
    const registry = new Map<string, number>();
    const revoked: string[] = [];
    const track = (u: string) => {
      revoked.push(u);
    };
    const url = "blob:http://localhost/p";
    retainBlobUrl(registry, url);
    retainBlobUrl(registry, url);
    releaseBlobUrl(registry, url, track);
    assert.equal(blobUrlRefCount(registry, url), 1);
    assert.equal(revoked.length, 0);
    releaseBlobUrl(registry, url, track);
    assert.equal(blobUrlRefCount(registry, url), 0);
    assert.deepEqual(revoked, [url]);
  });
});

// ─── Q: duplicate does not break original object URL ──────────────────────────
describe("Q: duplicate does not break original object URL", () => {
  test("buildDuplicateAnnotation shares imageSrc", () => {
    const original = createImageAnnotation("blob:http://localhost/shared");
    const dup = buildDuplicateAnnotation(original);
    assert.equal(dup.imageSrc, original.imageSrc);
    assert.notEqual(dup.id, original.id);
  });

  test("duplicate retains blob URL; deleting one leaves the other", () => {
    const registry = new Map<string, number>();
    const revoked: string[] = [];
    const track = (u: string) => {
      revoked.push(u);
    };
    const url = "blob:http://localhost/shared-2";
    retainBlobUrl(registry, url); // original
    retainBlobUrl(registry, url); // duplicate
    releaseBlobUrl(registry, url, track); // delete duplicate
    assert.equal(blobUrlRefCount(registry, url), 1);
    assert.equal(revoked.length, 0);
  });

  test("page retains blob URL on duplicate", () => {
    assert.match(pageSource, /retainBlobUrl\(blobUrlRegistryRef\.current, dupAnn\.imageSrc\)/);
  });
});

// ─── R: focus clear cleanup ───────────────────────────────────────────────────
describe("R: focus clear cleanup", () => {
  test("focus-change path releases blob URLs before clearing annotations", () => {
    assert.match(
      pageSource,
      /releaseBlobUrl\(blobUrlRegistryRef\.current, ann\.imageSrc\)[\s\S]*setAnnotations\(\[\]\)/
    );
  });
});

// ─── S: unmount cleanup ───────────────────────────────────────────────────────
describe("S: unmount cleanup", () => {
  test("unmount effect releases via annotationsRef (not stale empty array)", () => {
    assert.match(pageSource, /annotationsRef\.current = annotations/);
    assert.match(
      pageSource,
      /return \(\) => \{\s*for \(const ann of annotationsRef\.current\)/
    );
  });
});

// ─── T: no factual/API/DB mutation ────────────────────────────────────────────
describe("T: no factual/API/DB mutation", () => {
  test("image insertion path does not call fetch or mutate relationships", () => {
    const openIdx = pageSource.indexOf("function openImageFilePicker");
    const changeIdx = pageSource.indexOf("async function handleImageFileChange");
    const block = pageSource.slice(openIdx, changeIdx + 1200);
    assert.doesNotMatch(block, /\bfetch\s*\(/);
    assert.doesNotMatch(block, /DrugRelationship/);
    assert.doesNotMatch(block, /prisma/i);
    assert.doesNotMatch(block, /\/api\//);
  });

  test("floating bar for IMAGE shows only duplicate/delete (no stroke/fill)", () => {
    assert.match(floatingBarSource, /IMAGE: duplicate \+ delete only/);
    const imgIdx = floatingBarSource.indexOf("isImage ? (");
    assert.ok(imgIdx >= 0);
  });
});
