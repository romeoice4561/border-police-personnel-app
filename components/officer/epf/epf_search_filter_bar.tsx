/**
 * EpfSearchFilterBar (Phase 46 — Electronic Personnel File Foundation;
 * Phase 47 — adds Expiry Status / Expiring Within filters and Newest/Oldest
 * Expiry sort options, all client-side over documents already loaded — no
 * new API surface, no expiry calculation performed here (status comes from
 * lib/document/document_expiry.ts via the caller);
 * Phase 47B — the Year filter's visible option labels are now Buddhist Era
 * (e.g. "2569") via the existing shared `yearGregorianToBE` converter — the
 * option's underlying `value` stays the raw Gregorian year string
 * unchanged, since that's the internal contract EpfSection's filter
 * comparison (`String(new Date(doc.uploadedAt).getFullYear())`) already
 * relies on; only the label changed, not the filtering data flow.
 *
 * Search (title/category/tag/document number — scoped to e-PF only, no
 * global search change) plus Category/Status/Year/Uploaded By filters and a
 * Newest/Oldest/Alphabetical/Newest-Expiry/Oldest-Expiry sort.
 */
"use client";

import { Search } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { getDocumentCategories } from "@/lib/document/document_categories";
import { ACTIVE_DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/document/document_status";
import { EPF_STATUS_LABEL_KEY } from "@/lib/document/epf_status_copy";
import type { ExpiryStatus } from "@/lib/document/document_expiry";
import { yearGregorianToBE } from "@/lib/officer_profile/thai_date";

export type EpfSortValue = "newest" | "oldest" | "alphabetical" | "newestExpiry" | "oldestExpiry";
export type EpfExpiringWithinValue = "ALL" | "30" | "60" | "90";

const EXPIRY_STATUS_OPTIONS: readonly ExpiryStatus[] = ["valid", "expiring_soon", "expired", "unknown"];
const EXPIRY_STATUS_LABEL_KEY: Record<ExpiryStatus, TranslationKey> = {
  valid: "epf.expiry.statusValid",
  expiring_soon: "epf.expiry.statusExpiringSoon",
  expired: "epf.expiry.statusExpired",
  unknown: "epf.expiry.statusUnknown",
};

export interface EpfFilterState {
  search: string;
  category: string | "ALL";
  status: DocumentStatus | "ALL";
  year: string | "ALL";
  uploadedBy: string | "ALL";
  sort: EpfSortValue;
  expiryStatus: ExpiryStatus | "ALL";
  expiringWithin: EpfExpiringWithinValue;
}

const SORT_OPTIONS: Array<{ value: EpfSortValue; labelKey: TranslationKey }> = [
  { value: "newest", labelKey: "epf.sortNewest" },
  { value: "oldest", labelKey: "epf.sortOldest" },
  { value: "alphabetical", labelKey: "epf.sortAlphabetical" },
  { value: "newestExpiry", labelKey: "epf.expiry.sortNewestExpiry" },
  { value: "oldestExpiry", labelKey: "epf.expiry.sortOldestExpiry" },
];

function selectClassName() {
  return "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";
}

export function EpfSearchFilterBar({
  state,
  onChange,
  availableYears,
  availableUploaders,
}: {
  state: EpfFilterState;
  onChange: (next: EpfFilterState) => void;
  availableYears: readonly string[];
  availableUploaders: readonly string[];
}) {
  const { t } = useT();
  const categories = getDocumentCategories();

  function patch(partial: Partial<EpfFilterState>) {
    onChange({ ...state, ...partial });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={state.search}
          onChange={(e) => patch({ search: e.target.value })}
          placeholder={t("epf.searchPlaceholder")}
          aria-label={t("epf.searchLabel")}
          className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="epf-filter-category">{t("epf.filterCategory")}</label>
        <select
          id="epf-filter-category"
          value={state.category}
          onChange={(e) => patch({ category: e.target.value })}
          className={selectClassName()}
        >
          <option value="ALL">{t("epf.filterAllCategories")}</option>
          {categories.map((cat) => (
            <option key={cat.code} value={cat.code}>
              {t(`epf.category.${cat.code}` as TranslationKey)}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="epf-filter-status">{t("epf.filterStatus")}</label>
        <select
          id="epf-filter-status"
          value={state.status}
          onChange={(e) => patch({ status: e.target.value as DocumentStatus | "ALL" })}
          className={selectClassName()}
        >
          <option value="ALL">{t("document.filterAll")}</option>
          {ACTIVE_DOCUMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(EPF_STATUS_LABEL_KEY[status])}
            </option>
          ))}
        </select>

        {availableYears.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="epf-filter-year">{t("epf.filterYear")}</label>
            <select
              id="epf-filter-year"
              value={state.year}
              onChange={(e) => patch({ year: e.target.value })}
              className={selectClassName()}
            >
              <option value="ALL">{t("epf.filterAllYears")}</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{yearGregorianToBE(Number(year))}</option>
              ))}
            </select>
          </>
        ) : null}

        <label className="sr-only" htmlFor="epf-filter-expiry-status">{t("epf.expiry.filterExpiryStatus")}</label>
        <select
          id="epf-filter-expiry-status"
          value={state.expiryStatus}
          onChange={(e) => patch({ expiryStatus: e.target.value as EpfFilterState["expiryStatus"] })}
          className={selectClassName()}
        >
          <option value="ALL">{t("document.filterAll")}</option>
          {EXPIRY_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(EXPIRY_STATUS_LABEL_KEY[status])}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="epf-filter-expiring-within">{t("epf.expiry.filterExpiringWithin")}</label>
        <select
          id="epf-filter-expiring-within"
          value={state.expiringWithin}
          onChange={(e) => patch({ expiringWithin: e.target.value as EpfExpiringWithinValue })}
          className={selectClassName()}
        >
          <option value="ALL">{t("epf.filterAllCategories")}</option>
          <option value="30">{t("epf.expiry.filterExpiringWithin30")}</option>
          <option value="60">{t("epf.expiry.filterExpiringWithin60")}</option>
          <option value="90">{t("epf.expiry.filterExpiringWithin90")}</option>
        </select>

        {availableUploaders.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="epf-filter-uploader">{t("epf.filterUploadedBy")}</label>
            <select
              id="epf-filter-uploader"
              value={state.uploadedBy}
              onChange={(e) => patch({ uploadedBy: e.target.value })}
              className={selectClassName()}
            >
              <option value="ALL">{t("epf.filterAllUploaders")}</option>
              {availableUploaders.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </>
        ) : null}

        <label className="sr-only" htmlFor="epf-sort">{t("epf.sortLabel")}</label>
        <select
          id="epf-sort"
          value={state.sort}
          onChange={(e) => patch({ sort: e.target.value as EpfSortValue })}
          className={`${selectClassName()} ml-auto`}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
