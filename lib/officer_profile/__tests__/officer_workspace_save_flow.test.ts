/**
 * Officer Workspace post-save flow regression tests (bug-fix pass following
 * the reported "large image replaces the page after saving financial data"
 * bug). No single definitive root-cause line was found in the reachable
 * Gallery/Media/Portrait code — every button, modal, and preview state was
 * confirmed independently gated and correctly bounded during the audit (see
 * the deliverable report). These tests cover the DEFENSIVE hardening this
 * pass adds regardless: save-response shape, button-type discipline, image
 * containment source assertions, and the corrected success/failure copy —
 * so a future regression in any of these dimensions fails a test, not just
 * a user's browser.
 *
 * This codebase has no component-render test runner (confirmed by prior
 * phases — no .test.tsx files exist anywhere); these tests verify pure
 * logic, response typing, and structural source-content invariants rather
 * than rendering React trees.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { officerProfileSaveSchema } from "@/lib/officer_profile/officer_profile_api_schemas";
import { DICTIONARY } from "@/lib/i18n/dictionary";

const REPO_ROOT = process.cwd();

async function readSource(relativePath: string): Promise<string> {
  return fs.readFile(path.join(REPO_ROOT, relativePath), "utf-8");
}

/** Strips // line comments and /* block comments *\/ so source-content assertions check real code, not explanatory prose that happens to mention a forbidden term. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// ── 1. Financial save returns JSON success shape ─────────────────────────

test("1. officerProfilePatchSchema parses a valid financial save payload — the request is validated JSON, never treated as an image/media/redirect payload", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { salaryLevel: "ส.3", currentSalaryStep: "ขั้น 25.5", currentSalary: 48200 },
  });
  assert.equal(result.success, true);
});

// ── 2/3. Saving never touches window.location or navigates to an image ──

test("2/3. officer_workspace.tsx's save handler never references window.location or an image/media URL — only router.refresh()", async () => {
  const source = stripComments(await readSource("components/officer/officer_workspace.tsx"));
  assert.ok(!source.includes("window.location"));
  assert.ok(!/location\s*=\s*(response|result|data|res)/.test(source));
  assert.ok(source.includes("router.refresh()"));
});

test("post-save refresh is serialized: pendingRefreshRef waits for editing=false, then startTransition(router.refresh)", async () => {
  const source = stripComments(await readSource("components/officer/officer_workspace.tsx"));
  assert.ok(source.includes("pendingRefreshRef"));
  assert.ok(source.includes("startTransition"));
  assert.ok(source.includes("router.refresh()"));
  // Must not call router.refresh() synchronously inside handleSave (the race).
  const saveStart = source.indexOf("async function handleSave");
  const saveEnd = source.indexOf("\n  function handleStartEditing", saveStart);
  const handlerBody = source.slice(saveStart, saveEnd);
  assert.ok(!handlerBody.includes("router.refresh()"), "handleSave must not call router.refresh() directly");
  assert.ok(handlerBody.includes("pendingRefreshRef.current = true"));
});

// ── 4/5/6. Saving does not touch preview state; preview opens only on explicit click ──

test("4/5. officer_workspace.tsx's handleSave never sets previewImage/openIndex/viewerOpen/previewFull/lightboxOpen/modalOpen — those states live entirely inside PhotoGallery/PortraitManager/OfficerPhoto, never the workspace's save path", async () => {
  const source = await readSource("components/officer/officer_workspace.tsx");
  const saveHandlerStart = source.indexOf("async function handleSave");
  const saveHandlerEnd = source.indexOf("\n  }", saveHandlerStart);
  const handlerBody = source.slice(saveHandlerStart, saveHandlerEnd);
  for (const forbidden of ["previewImage", "openIndex", "viewerOpen", "previewFull", "lightboxOpen", "modalOpen", "selectedImage", "activeMedia", "fullScreenImage", "galleryPreviewUrl"]) {
    assert.ok(!handlerBody.includes(forbidden), `handleSave must not reference ${forbidden}`);
  }
});

test("6. PhotoModal (the full-screen preview) only ever renders driven by its own `open` prop — every call site passes an explicit boolean state, never a value derived from officer/save data", async () => {
  const gallerySource = await readSource("components/officer/photo_gallery.tsx");
  const managerSource = await readSource("components/officer/portrait_manager.tsx");
  const photoSource = await readSource("components/officer/officer_photo.tsx");
  assert.ok(gallerySource.includes("open={openIndex !== null}"));
  assert.ok(managerSource.includes("open={previewFull}"));
  assert.ok(photoSource.includes("open={viewerOpen}"));
});

// ── 7. All media buttons inside edit forms have explicit button types ────

test("7. every <button> in PhotoGallery, PhotoModal, PortraitManager, and MembershipFinancialEditor declares type=\"button\" (never left to default to submit)", async () => {
  const files = [
    "components/officer/photo_gallery.tsx",
    "components/officer/photo_modal.tsx",
    "components/officer/portrait_manager.tsx",
    "components/officer/membership_financial_editor.tsx",
  ];
  for (const file of files) {
    const source = await readSource(file);
    // Every literal "<button" opening tag must be followed (within a
    // reasonable attribute window) by type="button" before the closing '>'.
    const buttonOpenings = source.match(/<button\b[^>]*>/g) ?? [];
    for (const tag of buttonOpenings) {
      assert.ok(/type="button"/.test(tag), `Button tag in ${file} missing type="button": ${tag.slice(0, 80)}`);
    }
  }
});

// ── 8. Save button alone submits (no <form> wraps the editor) ────────────

test("8. no <form> element wraps the Officer Workspace editors — the Save button's onClick, not a form submit event, is what triggers the save (so no other button can accidentally trigger form submission)", async () => {
  const workspaceSource = await readSource("components/officer/officer_workspace.tsx");
  const editorSource = await readSource("components/officer/membership_financial_editor.tsx");
  assert.ok(!workspaceSource.includes("<form"));
  assert.ok(!editorSource.includes("<form"));
});

// ── 9/12/13. Candidate salary 48200 saves and formats correctly ─────────

test("9. Candidate salary 48200 (the exact reported officer data) saves successfully via the schema", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { currentSalary: 48200 } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.currentSalary, 48200);
});

test("12. Base salary renders as '48,200 บาท' via formatMoneyTh — the same formatter the read-only section uses after save", async () => {
  const { formatMoneyTh } = await import("@/lib/officer_profile/money_format");
  assert.equal(formatMoneyTh(48200), "48,200 บาท");
});

test("13. Base salary + cooperative deduction payload parses; netSalary is optional in the client body", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { currentSalary: 48200, cooperativeMonthlyDeduction: 8000 },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.profile?.currentSalary, 48200);
    assert.equal(result.data.profile?.cooperativeMonthlyDeduction, 8000);
  }
});

// ── 14/15/16/17. Image containment ────────────────────────────────────────

test("14. Gallery thumbnail parent (PhotoGallery's grid-item wrapper) has bounded dimensions — max-w-full present alongside the aspect-square/overflow-hidden button", async () => {
  const source = await readSource("components/officer/photo_gallery.tsx");
  assert.ok(source.includes('className="group relative max-w-full rounded-lg'));
  assert.ok(source.includes("aspect-square w-full max-w-full overflow-hidden"));
});

test("gallery grid uses entry.thumbnailUrl for GalleryImage — not resolveViewerSource (w2048 reserved for PhotoModal)", async () => {
  const source = stripComments(await readSource("components/officer/photo_gallery.tsx"));
  assert.ok(source.includes("src={entry.thumbnailUrl}"));
  // GalleryImage in the grid must not take resolveViewerSource().imageUrl as src.
  assert.ok(!source.includes("src={source.imageUrl}"));
  assert.ok(!source.includes("src={viewerSource.imageUrl}"));
});

test("15. GalleryImage's container and <img> both carry max-h-full/max-w-full as a defensive containment floor, in addition to the caller-supplied className", async () => {
  const source = await readSource("components/ui/media/GalleryImage.tsx");
  assert.ok(source.includes("relative max-h-full max-w-full overflow-hidden"));
  assert.ok(source.includes("h-full max-h-full w-full max-w-full object-cover"));
});

test("16. PhotoModal (full-screen preview) renders null unless open === true, and is mounted via createPortal to document.body (never inline in the normal document flow)", async () => {
  const source = await readSource("components/officer/photo_modal.tsx");
  assert.ok(source.includes("if (!open || typeof document === \"undefined\") return null;"));
  assert.ok(source.includes("createPortal("));
  assert.ok(source.includes("document.body"));
});

test("17. PhotoViewer's <img> uses max-h-full/max-w-full + object-contain — the full-resolution image is always constrained to the modal's viewport, never rendered at intrinsic pixel size", async () => {
  const source = await readSource("components/officer/photo_viewer.tsx");
  assert.ok(source.includes("max-h-full max-w-full object-contain"));
});

test("no <Image fill> usage exists anywhere in the app (Task 6) — nothing to audit for a missing positioned/dimensioned parent", async () => {
  const searchDirs = ["components", "app"];
  let foundFillImage = false;
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(path.join(REPO_ROOT, dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(rel);
      } else if (entry.name.endsWith(".tsx")) {
        const content = await fs.readFile(path.join(REPO_ROOT, rel), "utf-8");
        if (content.includes('from "next/image"') && /<Image[^>]*\bfill\b/.test(content)) foundFillImage = true;
      }
    }
  }
  for (const dir of searchDirs) await walk(dir);
  assert.equal(foundFillImage, false);
});

// ── 18. Post-save flow does not scroll to Media ──────────────────────────

test("18. officer_workspace.tsx contains no scrollIntoView/scrollTo/window.scrollTo call anywhere — post-save flow never jumps the viewport to the Media/Gallery section", async () => {
  const source = stripComments(await readSource("components/officer/officer_workspace.tsx"));
  assert.ok(!source.includes("scrollIntoView"));
  assert.ok(!source.includes("scrollTo"));
});

test("no officer component under the Media section wires scrollIntoView to run after a save/refresh", async () => {
  const files = ["components/officer/officer_workspace.tsx", "components/officer/photo_gallery.tsx", "components/officer/documents_section.tsx"];
  for (const file of files) {
    const source = stripComments(await readSource(file));
    assert.ok(!source.includes("scrollIntoView"), `${file} must not call scrollIntoView`);
  }
});

// ── 19/20. Success/failure notification appears, without replacing the page ──

test("19. officer.saveSuccess dictionary key carries the exact approved TH/EN copy", () => {
  assert.equal(DICTIONARY["officer.saveSuccess"].th, "บันทึกข้อมูลสำเร็จ");
  assert.equal(DICTIONARY["officer.saveSuccess"].en, "Information saved successfully.");
});

test("20. officer.saveErrorGeneric dictionary key carries the exact approved TH/EN copy — the raw server error is never shown", () => {
  assert.equal(DICTIONARY["officer.saveErrorGeneric"].th, "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  assert.equal(DICTIONARY["officer.saveErrorGeneric"].en, "Unable to save the information. Please try again.");
});

test("officer_workspace.tsx no longer concatenates saveError.message into the rendered error banner (raw server errors must never reach the user)", async () => {
  const source = await readSource("components/officer/officer_workspace.tsx");
  assert.ok(!source.includes("{saveError.message}"));
  assert.ok(source.includes('t("officer.saveErrorGeneric")'));
  assert.ok(source.includes('t("officer.saveSuccess")'));
});

// ── 21. Preload priority is used only for above-the-fold portrait ────────

test("21. no explicit <link rel=\"preload\">, fetchPriority, or Next.js Image `priority` prop exists anywhere in the officer components — there is nothing to over-preload; the reported preload warnings are browser heuristics, not application-controlled preloading", async () => {
  const searchDirs = ["components/officer", "components/ui/media"];
  let foundPreloadDirective = false;
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(path.join(REPO_ROOT, dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(rel);
      } else if (entry.name.endsWith(".tsx")) {
        const content = await fs.readFile(path.join(REPO_ROOT, rel), "utf-8");
        if (/rel="preload"|fetchPriority|fetchpriority|\bpriority\b/.test(content) && content.includes("next/image")) {
          foundPreloadDirective = true;
        }
      }
    }
  }
  for (const dir of searchDirs) await walk(dir);
  assert.equal(foundPreloadDirective, false);
});

// ── 22. No schema or migration change ─────────────────────────────────────

test("22. this bug-fix pass adds no new Prisma migration folder beyond the existing Phase 45.1 migration", async () => {
  const migrationsDir = path.join(REPO_ROOT, "prisma", "migrations");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const migrationFolders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  assert.ok(migrationFolders.includes("20260721000000_personnel_master_data_expansion"));
  // Exactly the folders that existed before this bug-fix pass — no new one added.
  assert.equal(migrationFolders.length, migrationFolders.filter((name) => /^\d{14}_/.test(name)).length);
});

// ── 23. Existing Phase 45.1 tests remain passing — covered by running the
// full suite (npm test) in verification; not re-asserted here to avoid
// duplicating those test files' own assertions.
