/**
 * Link Compare workspace (LC-2B two-box + optional LC-2C Point C).
 * Analyze is explicit. No drag-drop, AI, or manual subjects.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, GitCompare, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { DrugNetworkEntityPicker, type DrugNetworkEntitySelection } from "@/components/drug_intelligence/drug_network_entity_picker";
import { DrugLinkCompareSlot } from "@/components/drug_intelligence/drug_link_compare_slot";
import { DrugLinkCompareResult } from "@/components/drug_intelligence/drug_link_compare_result";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugLinkCompare } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import { cn } from "@/lib/ui/cn";
import {
  LINK_COMPARE_NETWORK_PATH,
  LINK_COMPARE_PICKER_TYPES,
  buildLinkCompareApiQuery,
  buildLinkCompareHref,
  canonicalEntityKey,
  clearLinkCompareSlot,
  isAnalyzeDisabled,
  isLinkCompareEntityType,
  isSameCanonicalEntity,
  pairIdentityKey,
  parseLinkCompareSearchParams,
  selectLinkCompareSlot,
  serializeLinkCompareSearchParams,
  shouldFetchLinkCompare,
  slotC,
  type LinkCompareSlotSelection,
  type LinkCompareTwoBoxState,
} from "@/lib/drug_intelligence/drug_link_compare_client_state";
import type { DrugLinkCompareQuery, DrugLinkCompareSlotDto } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugLinkCompareSlotKey } from "@/lib/drug_intelligence/drug_link_compare_types";

function toSlotSelection(selection: DrugNetworkEntitySelection): LinkCompareSlotSelection | null {
  if (!isLinkCompareEntityType(selection.entityType)) return null;
  return {
    entityType: selection.entityType,
    entityId: selection.entityId,
    label: selection.label,
    caseCount: selection.caseCount ?? null,
  };
}

function hydrateSlot(
  urlSlot: LinkCompareSlotSelection | null,
  cache: Record<string, { label: string; caseCount: number | null }>,
  dto: DrugLinkCompareSlotDto | undefined
): LinkCompareSlotSelection | null {
  if (!urlSlot) return null;
  const key = canonicalEntityKey(urlSlot.entityType, urlSlot.entityId);
  const cached = cache[key];
  if (dto && dto.entityType === urlSlot.entityType && dto.entityId === urlSlot.entityId) {
    return {
      entityType: urlSlot.entityType,
      entityId: urlSlot.entityId,
      label: dto.label ?? cached?.label ?? urlSlot.label,
      caseCount: dto.caseCount ?? cached?.caseCount ?? urlSlot.caseCount,
    };
  }
  if (cached) {
    return { ...urlSlot, label: cached.label, caseCount: cached.caseCount };
  }
  return urlSlot;
}

export function DrugLinkCompareWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { t } = useT();
  const canCompare = can("drug.read");

  const urlState = useMemo(() => parseLinkCompareSearchParams(searchParams), [searchParams]);
  const searchKey = searchParams.toString();
  const [labelCache, setLabelCache] = useState<Record<string, { label: string; caseCount: number | null }>>({});
  const [duplicateSlot, setDuplicateSlot] = useState<DrugLinkCompareSlotKey | null>(null);
  const [picking, setPicking] = useState<DrugLinkCompareSlotKey | null>(null);
  const [emptyCForSearch, setEmptyCForSearch] = useState<string | null>(null);
  const [submittedKey, setSubmittedKey] = useState<string | null>(() => pairIdentityKey(urlState));

  const writeUrl = useCallback(
    (next: LinkCompareTwoBoxState) => {
      const params = serializeLinkCompareSearchParams(next, new URLSearchParams(searchParams.toString()));
      const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(href);
    },
    [pathname, router, searchParams]
  );

  const identity = pairIdentityKey(urlState);
  const query: DrugLinkCompareQuery | null =
    canCompare && shouldFetchLinkCompare(submittedKey, urlState) ? buildLinkCompareApiQuery(urlState) : null;
  const compare = useDrugLinkCompare(user?.id ?? null, query);
  const loading = Boolean(query) && compare.isFetching;
  const cVisible = Boolean(urlState.C) || emptyCForSearch === searchKey;

  const dtoByKey = useMemo(() => {
    const map: Partial<Record<DrugLinkCompareSlotKey, DrugLinkCompareSlotDto>> = {};
    for (const slot of compare.data?.slots ?? []) {
      if (slot.key === "A" || slot.key === "B" || slot.key === "C") map[slot.key] = slot;
    }
    return map;
  }, [compare.data]);

  const slots: LinkCompareTwoBoxState = {
    A: hydrateSlot(urlState.A, labelCache, dtoByKey.A),
    B: hydrateSlot(urlState.B, labelCache, dtoByKey.B),
    C: hydrateSlot(urlState.C ?? null, labelCache, dtoByKey.C),
  };
  const c = slotC(slots);
  const showDuplicateA = duplicateSlot === "A";
  const showDuplicateB = duplicateSlot === "B" || isSameCanonicalEntity(slots.A, slots.B);
  const showDuplicateC =
    duplicateSlot === "C" || Boolean(c && (isSameCanonicalEntity(slots.A, c) || isSameCanonicalEntity(slots.B, c)));

  function applySelection(slot: DrugLinkCompareSlotKey, raw: DrugNetworkEntitySelection) {
    const selection = toSlotSelection(raw);
    if (!selection) return;
    const applied = selectLinkCompareSlot(slots, slot, selection);
    if (applied.error === "duplicate") {
      setDuplicateSlot(slot);
      return;
    }
    setDuplicateSlot(null);
    setPicking(null);
    if (slot === "C") setEmptyCForSearch(null);
    setLabelCache((prev) => ({
      ...prev,
      [canonicalEntityKey(selection.entityType, selection.entityId)]: {
        label: selection.label,
        caseCount: selection.caseCount,
      },
    }));
    writeUrl(applied.state);
    if (pairIdentityKey(applied.state) !== submittedKey) {
      setSubmittedKey(null);
    }
  }

  function removeSlot(slot: DrugLinkCompareSlotKey) {
    const next = clearLinkCompareSlot(slots, slot);
    setDuplicateSlot(null);
    if (slot === "C") setEmptyCForSearch(null);
    writeUrl(next);
    const nextKey = pairIdentityKey(next);
    setSubmittedKey(slot === "C" ? nextKey : null);
  }

  function analyze() {
    if (isAnalyzeDisabled(slots, loading)) return;
    setSubmittedKey(identity);
  }

  const backHref = getSafeReturnTo(searchParams) ?? LINK_COMPARE_NETWORK_PATH;
  const compareHref = useMemo(() => buildLinkCompareHref(urlState), [urlState]);
  const pickerTitle =
    picking === "C"
      ? t("di.linkCompare.pickerTitleC")
      : picking === "B"
        ? t("di.linkCompare.pickerTitleB")
        : t("di.linkCompare.pickerTitleA");

  if (!canCompare) {
    return <ErrorState title={t("di.linkCompare.errorForbidden")} />;
  }

  return (
    <div className="space-y-4" data-testid="link-compare-workspace">
      <PageHeader
        className="mb-2"
        title={t("di.linkCompare.title")}
        description={t("di.linkCompare.description")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={backHref} data-testid="link-compare-back">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("di.linkCompare.backToNetwork")}
            </Link>
          </Button>
        }
      />
      <p className="text-xs text-muted" data-testid="link-compare-query-helper">
        {t("di.linkCompare.queryHelper")}
      </p>

      <div
        className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", cVisible && "xl:grid-cols-3")}
        data-testid="link-compare-boxes"
        data-box-count={cVisible ? "3" : "2"}
      >
        <DrugLinkCompareSlot
          slotKey="A"
          selection={slots.A}
          duplicateError={showDuplicateA}
          onChoose={() => setPicking("A")}
          onChange={() => setPicking("A")}
          onRemove={() => removeSlot("A")}
        />
        <DrugLinkCompareSlot
          slotKey="B"
          selection={slots.B}
          duplicateError={showDuplicateB}
          onChoose={() => setPicking("B")}
          onChange={() => setPicking("B")}
          onRemove={() => removeSlot("B")}
        />
        {cVisible ? (
          <DrugLinkCompareSlot
            slotKey="C"
            selection={c}
            duplicateError={showDuplicateC}
            className="md:col-span-2 xl:col-span-1"
            showRemoveWhenEmpty
            onChoose={() => setPicking("C")}
            onChange={() => setPicking("C")}
            onRemove={() => removeSlot("C")}
          />
        ) : null}
      </div>

      {!cVisible ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setEmptyCForSearch(searchKey)} data-testid="link-compare-add-c">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("di.linkCompare.addPointC")}
        </Button>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="accent"
          disabled={isAnalyzeDisabled(slots, loading)}
          onClick={analyze}
          data-testid="link-compare-analyze"
        >
          {loading ? (
            t("di.linkCompare.analyzing")
          ) : (
            <>
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              {t("di.linkCompare.analyze")}
            </>
          )}
        </Button>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          {cVisible
            ? `${t("di.linkCompare.slotA")} · ${t("di.linkCompare.slotB")} · ${t("di.linkCompare.slotC")}`
            : `${t("di.linkCompare.slotA")} · ${t("di.linkCompare.slotB")}`}
        </span>
      </div>

      <DrugLinkCompareResult
        slots={slots}
        result={query ? compare.data : undefined}
        error={query ? compare.error : null}
        loading={loading}
        compareHref={compareHref}
        onRetry={() => {
          void compare.refetch();
        }}
        onChangeSelection={() => setPicking(slots.A ? "A" : "B")}
      />

      <Drawer open={picking !== null} onClose={() => setPicking(null)} titleId="link-compare-picker-title" title={pickerTitle}>
        {picking ? (
          <div className="space-y-3" data-testid="link-compare-picker">
            <DrugNetworkEntityPicker
              allowedTypes={[...LINK_COMPARE_PICKER_TYPES]}
              placeholder={t("di.linkCompare.searchPlaceholder")}
              autoConfirmExact
              autoFocus
              onSelect={(selection) => applySelection(picking, selection)}
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
