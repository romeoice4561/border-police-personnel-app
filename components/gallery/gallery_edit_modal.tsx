/**
 * GalleryEditModal (Phase 22A — Gallery Metadata Editor Foundation).
 *
 * A full-screen overlay modal for editing an Asset's user-managed metadata:
 * region (dropdown), battalion, company, unit name/number (text inputs),
 * keywords (chip input), description / remarks (textareas), and verified
 * (checkbox). Read-only fields (file name, folder, thumbnail, Drive link) are
 * shown in the left panel alongside the image preview.
 *
 * On save, the mutation calls PATCH /api/gallery/assets/{assetId} and
 * invalidates all gallery queries so the grid reflects the new values.
 * Press ESC or click the backdrop to cancel.
 */
"use client";

import { useState, useEffect, useCallback, useMemo, type KeyboardEvent, type FormEvent } from "react";
import { X, ExternalLink, CheckCircle2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { ImageOff } from "lucide-react";
import type { Asset } from "@/lib/gallery/asset_types";
import { useUpdateAssetMetadata } from "@/lib/gallery/gallery_hooks";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/ui/cn";
import { galleryRegionOptions } from "@/lib/organization/gallery_region_options";
import { battalionLabelsForRegion, companyLabelsForBattalion, autoFillFromCompanyLabel } from "@/lib/organization/gallery_org_helpers";
import { unitNamePrefixForCategory } from "@/lib/organization/gallery_unit_name_prefixes";
import { createGalleryUnitNames } from "@/lib/organization/gallery_generator";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";

interface GalleryEditModalProps {
  asset: Asset;
  /** Phase 27: the shared OrganizationEngine — the ONE source Battalion/Company suggestions and auto-fill read from. */
  organizationEngine: OrganizationEngine;
  onClose: () => void;
}

interface FormState {
  region:      string;
  battalion:   string;
  company:     string;
  unitName:    string;
  unitNumber:  string;
  keywords:    string[];
  description: string;
  remarks:     string;
  verified:    boolean;
}

function initialFormState(asset: Asset): FormState {
  return {
    region:      asset.region      ?? "",
    battalion:   asset.battalion   ?? "",
    company:     asset.company     ?? "",
    unitName:    asset.unitName    ?? "",
    unitNumber:  asset.unitNumber  ?? "",
    keywords:    asset.keywords    ?? [],
    description: asset.description ?? "",
    remarks:     asset.remarks     ?? "",
    verified:    asset.verified    ?? false,
  };
}

export function GalleryEditModal({ asset, organizationEngine, onClose }: GalleryEditModalProps) {
  const [form, setForm]             = useState<FormState>(() => initialFormState(asset));
  const [keywordInput, setKwInput]  = useState("");
  const [imgFailed, setImgFailed]   = useState(false);
  /* Phase 26D Part 5: image preview collapsed by default so the form gets the full width; the aside becomes a slim toggle rail when collapsed. */
  const [previewOpen, setPreviewOpen] = useState(false);

  const mutation = useUpdateAssetMetadata();

  /* ── Close on ESC ──────────────────────────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, mutation.isPending]);

  /* ── Prevent body scroll while modal is open ────────────────────────── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Form helpers ───────────────────────────────────────────────────── */
  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  /* Region suggestions: every engine-backed Border Patrol region plus
     Gallery's additional legacy regions (5-7) — never a forced/closed list,
     so existing OCR/legacy values are always preserved (Phase 26D Part 4). */
  const regionSuggestions = useMemo(() => galleryRegionOptions(organizationEngine).map((o) => o.label), [organizationEngine]);

  /* ── Cascading suggestions (Phase 27 Part 2/3/4): Battalion narrows to the
     selected Region's battalions, Company narrows to the selected Battalion's
     companies — same shared-framework data as Officer/Timeline's
     OrgHierarchyPicker, just resolved from label text instead of ids since
     Gallery's fields have no FK/id linkage. Falls back to the FULL list
     (never an empty/blocked list) when the current text doesn't resolve. */
  const battalionSuggestions = useMemo(() => battalionLabelsForRegion(organizationEngine, form.region), [organizationEngine, form.region]);
  const companySuggestions = useMemo(() => companyLabelsForBattalion(organizationEngine, form.battalion), [organizationEngine, form.battalion]);

  /* ── Auto-fill from Company (Phase 27 Part 7): selecting a recognized
     company fills Unit Number, and — if this asset's category has a
     generated-unit-name convention — suggests a Unit Name built from that
     convention. Never overwrites a value the user already edited. */
  const unitNamePrefix = unitNamePrefixForCategory(asset.category);
  const handleCompanyChange = useCallback(
    (value: string) => {
      const resolved = autoFillFromCompanyLabel(organizationEngine, value);
      setForm((f) => {
        const next: FormState = { ...f, company: value };
        if (resolved) {
          if (!f.unitNumber) next.unitNumber = resolved.companyNumber;
          if (!f.unitName && unitNamePrefix) {
            next.unitName = createGalleryUnitNames(unitNamePrefix.prefix, [resolved.companyNumber], { spaced: unitNamePrefix.spaced })[0];
          }
        }
        return next;
      });
    },
    [organizationEngine, unitNamePrefix]
  );

  const addKeyword = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setForm((f) => ({
      ...f,
      keywords: f.keywords.includes(trimmed) ? f.keywords : [...f.keywords, trimmed],
    }));
    setKwInput("");
  }, []);

  const removeKeyword = useCallback((kw: string) => {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }));
  }, []);

  const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
    } else if (e.key === "Backspace" && !keywordInput && form.keywords.length > 0) {
      removeKeyword(form.keywords[form.keywords.length - 1]);
    }
  };

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      {
        assetId: asset.assetId,
        patch: {
          region:      form.region      || null,
          battalion:   form.battalion   || null,
          company:     form.company     || null,
          unitName:    form.unitName    || null,
          unitNumber:  form.unitNumber  || null,
          keywords:    form.keywords,
          description: form.description || null,
          remarks:     form.remarks     || null,
          verified:    form.verified,
        },
      },
      { onSuccess: onClose }
    );
  };

  /* ── Derived display values ─────────────────────────────────────────── */
  const fileName    = asset.relativePath.split("/").pop() ?? asset.assetId;
  const folderName  = asset.folderName ?? "–";
  const hasThumbnail = Boolean(asset.thumbnailUrl) && !imgFailed;
  const driveLink   = asset.webViewUrl ?? null;

  /* ── Shared input class ──────────────────────────────────────────────── */
  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !mutation.isPending) onClose(); }}
    >
      {/* Dialog panel */}
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="edit-modal-title" className="text-base font-semibold text-foreground">
            แก้ไขข้อมูล
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md p-1 text-muted hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <form id="edit-metadata-form" onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-y-auto">

            {/* Left: collapsible image preview + read-only info. Collapsed by
                default (Phase 26D Part 5) so the form gets the full width;
                expanding reveals the thumbnail + read-only fields. */}
            <aside
              className={cn(
                "hidden shrink-0 flex-col border-r border-border bg-neutral-bg/30 sm:flex",
                previewOpen ? "w-64 gap-4 p-5" : "w-12 items-center py-5"
              )}
            >
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                className="flex items-center gap-1.5 self-start rounded-md p-1 text-xs font-medium text-muted hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-expanded={previewOpen}
                aria-label={previewOpen ? "ย่อภาพตัวอย่าง" : "แสดงภาพตัวอย่าง"}
              >
                {previewOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                {previewOpen ? "ภาพตัวอย่าง" : null}
              </button>

              {previewOpen ? (
                <>
                  {/* Thumbnail */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-bg">
                    {hasThumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailUrl as string}
                        alt={folderName}
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted" aria-hidden="true">
                        <ImageOff className="h-10 w-10 opacity-30" />
                      </div>
                    )}
                    {asset.verified ? (
                      <span
                        className="absolute right-2 top-2 rounded-md bg-good-bg px-1.5 py-0.5 text-[10px] font-semibold text-good"
                        title="ยืนยันแล้ว"
                      >
                        ✓ ยืนยัน
                      </span>
                    ) : null}
                  </div>

                  {/* Read-only info */}
                  <dl className="space-y-3 text-xs">
                    <ReadOnlyField label="ชื่อไฟล์" value={fileName} />
                    <ReadOnlyField label="โฟลเดอร์" value={folderName} />
                    {asset.thumbnailUrl ? (
                      <div>
                        <dt className="font-medium text-muted">Thumbnail</dt>
                        <dd className="mt-0.5">
                          <a
                            href={asset.thumbnailUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            เปิดภาพ <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    {driveLink ? (
                      <div>
                        <dt className="font-medium text-muted">Drive</dt>
                        <dd className="mt-0.5">
                          <a
                            href={driveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            เปิดใน Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </>
              ) : null}
            </aside>

            {/* Right: editable fields — expands to fill the width freed by the collapsed preview */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">

              {/* Mobile: compact read-only summary */}
              <div className="flex items-start gap-3 rounded-xl border border-border bg-neutral-bg/50 p-3 sm:hidden">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-bg">
                  {hasThumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.thumbnailUrl as string}
                      alt={folderName}
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center" aria-hidden="true">
                      <ImageOff className="h-6 w-6 opacity-30 text-muted" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{folderName}</p>
                  <p className="truncate text-[10px] text-muted">{fileName}</p>
                </div>
              </div>

              {/* ── Region (กองบังคับการ ตชด.ภาค) — suggestions from the shared framework, custom values preserved ── */}
              <FormField label="ภาค (กองบังคับการ ตชด.ภาค)" htmlFor="edit-region">
                <Combobox
                  id="edit-region"
                  value={form.region}
                  onChange={(v) => set("region", v)}
                  suggestions={regionSuggestions}
                  placeholder="เลือกหรือพิมพ์ภาค"
                  aria-label="ภาค"
                />
              </FormField>

              {/* ── Battalion (กองกำกับ) — suggestions narrowed to the selected Region (Phase 27 Part 3), custom values preserved ── */}
              <FormField label="กองกำกับ" htmlFor="edit-battalion">
                <Combobox
                  id="edit-battalion"
                  value={form.battalion}
                  onChange={(v) => set("battalion", v)}
                  suggestions={battalionSuggestions}
                  placeholder="เลือกหรือพิมพ์กองกำกับ"
                  aria-label="กองกำกับ"
                />
              </FormField>

              {/* ── Company (กองร้อย) — suggestions narrowed to the selected Battalion (Phase 27 Part 4), custom values preserved. Selecting a recognized company auto-fills Unit Number/Unit Name below (Part 7). ── */}
              <FormField label="กองร้อย" htmlFor="edit-company">
                <Combobox
                  id="edit-company"
                  value={form.company}
                  onChange={handleCompanyChange}
                  suggestions={companySuggestions}
                  placeholder="เลือกหรือพิมพ์กองร้อย"
                  aria-label="กองร้อย"
                />
              </FormField>

              {/* ── Unit Name + Unit Number (side by side on md+) ── */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="ชื่อหน่วย" htmlFor="edit-unit-name">
                  <input
                    id="edit-unit-name"
                    type="text"
                    className={inputCls}
                    placeholder="เช่น มว.ตชด.2264"
                    value={form.unitName}
                    onChange={(e) => set("unitName", e.target.value)}
                  />
                </FormField>
                <FormField label="หมายเลขหน่วย" htmlFor="edit-unit-number">
                  <input
                    id="edit-unit-number"
                    type="text"
                    className={inputCls}
                    placeholder="เช่น 144"
                    value={form.unitNumber}
                    onChange={(e) => set("unitNumber", e.target.value)}
                  />
                </FormField>
              </div>

              {/* ── Keywords chips ── */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="edit-keywords">
                  คีย์เวิร์ด
                </label>
                <div
                  className={cn(
                    "flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5",
                    "focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
                  )}
                >
                  {form.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="rounded hover:text-foreground focus-visible:outline-none"
                        aria-label={`ลบคีย์เวิร์ด ${kw}`}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="edit-keywords"
                    type="text"
                    className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder-muted outline-none"
                    placeholder={form.keywords.length === 0 ? "พิมพ์แล้วกด Enter..." : "เพิ่มคีย์เวิร์ด..."}
                    value={keywordInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    onBlur={() => addKeyword(keywordInput)}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted">กด Enter หรือ , เพื่อเพิ่ม · กด Backspace เพื่อลบอันล่าสุด</p>
              </div>

              {/* ── Description ── */}
              <FormField label="คำอธิบาย" htmlFor="edit-description">
                <textarea
                  id="edit-description"
                  rows={3}
                  className={cn(inputCls, "resize-y")}
                  placeholder="คำอธิบายเนื้อหาของภาพ..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </FormField>

              {/* ── Remarks ── */}
              <FormField label="หมายเหตุ" htmlFor="edit-remarks">
                <textarea
                  id="edit-remarks"
                  rows={2}
                  className={cn(inputCls, "resize-y")}
                  placeholder="หมายเหตุเพิ่มเติม..."
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                />
              </FormField>

              {/* ── Verified ── */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-neutral-bg/40 px-4 py-3">
                <input
                  id="edit-verified"
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-accent"
                  checked={form.verified}
                  onChange={(e) => set("verified", e.target.checked)}
                />
                <label htmlFor="edit-verified" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2
                    className={cn("h-4 w-4", form.verified ? "text-good" : "text-muted")}
                    aria-hidden="true"
                  />
                  ยืนยันข้อมูลแล้ว
                </label>
              </div>

              {/* Error display */}
              {mutation.isError ? (
                <p className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error" role="alert">
                  บันทึกไม่สำเร็จ: {(mutation.error as Error).message}
                </p>
              ) : null}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className="min-w-[80px]"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "บันทึก"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────────────── */

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{value || "–"}</dd>
    </div>
  );
}
