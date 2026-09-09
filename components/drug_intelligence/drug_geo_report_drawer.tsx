"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { drugGeoFilterStateToExportContext } from "@/lib/drug_intelligence/drug_export_geo_context";
import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import { drugIntelligenceClient } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugExportMaskingMode, DrugExportPreviewV1 } from "@/lib/drug_intelligence/drug_export_types";
import { htmlPrintFailureMessage, openHtmlPrintReport } from "@/lib/export/html_print";

function textOrAll(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}

export function DrugGeoReportDrawer({
  open,
  onClose,
  filters,
}: {
  open: boolean;
  onClose: () => void;
  filters: DrugGeoFilterState;
}) {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const canFull = can("drug.edit");
  const [masking, setMasking] = useState<DrugExportMaskingMode>("MASKED");
  const [result, setResult] = useState<{ key: string; preview: DrugExportPreviewV1 | null; error: string | null } | null>(
    null
  );
  const [downloadBusy, setDownloadBusy] = useState(false);
  const appliedMasking: DrugExportMaskingMode = canFull ? masking : "MASKED";
  const previewKey = `${open}:${user?.id ?? ""}:${language}:${appliedMasking}:${JSON.stringify(filters)}`;
  const preview = result?.key === previewKey ? result.preview : null;
  const error = result?.key === previewKey ? result.error : null;
  const previewBusy = open && Boolean(user) && result?.key !== previewKey;
  const busy = previewBusy || downloadBusy;
  const context = useMemo(() => drugGeoFilterStateToExportContext(filters, language), [filters, language]);
  const summary = preview?.geographicSummary;

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const key = previewKey;
    drugIntelligenceClient
      .previewExport({
        actorId: user.id,
        exportType: "MAP_DATA",
        format: "HTML_PRINT",
        masking: appliedMasking,
        context,
      })
      .then((data) => {
        if (!cancelled) setResult({ key, preview: data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            key,
            preview: null,
            error: htmlPrintFailureMessage(err, t),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, user, language, t, previewKey, appliedMasking, context]);

  async function refreshPreview() {
    if (!user) return;
    const key = previewKey;
    try {
      const data = await drugIntelligenceClient.previewExport({
        actorId: user.id,
        exportType: "MAP_DATA",
        format: "HTML_PRINT",
        masking: appliedMasking,
        context,
      });
      setResult({ key, preview: data, error: null });
    } catch (err) {
      setResult({
        key,
        preview,
        error: htmlPrintFailureMessage(err, t),
      });
    }
  }

  async function generate() {
    if (!user) return;
    setDownloadBusy(true);
    try {
      const downloaded = await drugIntelligenceClient.downloadExport({
        actorId: user.id,
        exportType: "MAP_DATA",
        format: "HTML_PRINT",
        masking: appliedMasking,
        context,
      });
      openHtmlPrintReport(new Blob([downloaded.blob], { type: "text/html;charset=utf-8" }));
      setResult({
        key: previewKey,
        preview,
        error: null,
      });
    } catch (err) {
      setResult({
        key: previewKey,
        preview,
        error: htmlPrintFailureMessage(err, t),
      });
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} titleId="drug-geo-report-title" title={t("di.export.geographicReport")}>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-xs font-medium text-muted">{t("di.export.currentFilters")}</p>
          <p className="mt-1 text-sm text-foreground">
            {t("di.export.periodScope")}:{" "}
            {filters.dateFrom && filters.dateTo
              ? `${filters.dateFrom} – ${filters.dateTo}`
              : t("di.export.geoUnrestrictedPeriod")}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.organizationScope")}:{" "}
            {textOrAll(
              [filters.headquartersText, filters.regionText, filters.battalionText, filters.companyText]
                .filter(Boolean)
                .join(" / "),
              t("di.command.scopeAllReportingUnits")
            )}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.geoLeadOrgScope")}:{" "}
            {textOrAll(
              [filters.leadHeadquartersText, filters.leadRegionText, filters.leadBattalionText, filters.leadCompanyText]
                .filter(Boolean)
                .join(" / "),
              t("di.export.geoLeadOrgAll")
            )}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.provinceScope")}: {textOrAll(filters.province, t("di.command.scopeAllProvinces"))}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.geoDistrictScope")}: {textOrAll(filters.district, t("di.export.geoAllDistricts"))}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.geoStatusScope")}: {textOrAll(filters.status, t("di.export.geoAllStatuses"))}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.geoCategoryScope")}: {textOrAll(filters.drugCategory, t("di.export.geoAllCategories"))}
          </p>
          <p className="text-sm text-foreground">
            {t("di.export.geoPersonScope")}:{" "}
            {filters.personId.trim() ? t("di.export.geoPersonFilterActive") : t("di.export.geoPersonFilterNone")}
          </p>
        </div>
        {canFull ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="geo-report-masking">
              {t("di.export.maskingMode")}
            </label>
            <select
              id="geo-report-masking"
              value={masking}
              onChange={(e) => setMasking(e.target.value === "FULL" ? "FULL" : "MASKED")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="MASKED">{t("di.export.masked")}</option>
              <option value="FULL">{t("di.export.full")}</option>
            </select>
          </div>
        ) : null}
        <p className="text-sm text-muted">{t("di.export.geoMaskingNotice")}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>
            {t("di.export.geoKpiTotal")}:{" "}
            <span className="font-medium">{summary?.totalCases ?? preview?.estimatedRecordCount ?? (busy ? "…" : "—")}</span>
          </p>
          <p>
            {t("di.export.geoKpiWithCoords")}: <span className="font-medium">{summary?.casesWithCoordinates ?? (busy ? "…" : "—")}</span>
          </p>
          <p>
            {t("di.export.geoKpiWithoutCoords")}:{" "}
            <span className="font-medium">{summary?.casesWithoutCoordinates ?? (busy ? "…" : "—")}</span>
          </p>
          <p>
            {t("di.export.geoKpiProvinces")}: <span className="font-medium">{summary?.distinctProvinceCount ?? (busy ? "…" : "—")}</span>
          </p>
          <p>
            {t("di.export.geoKpiDistricts")}: <span className="font-medium">{summary?.distinctDistrictCount ?? (busy ? "…" : "—")}</span>
          </p>
          <p>
            {t("di.export.geoPrintedCases")}: <span className="font-medium">{summary?.printedCaseCount ?? (busy ? "…" : "—")}</span>
          </p>
        </div>
        {summary && summary.totalCases === 0 ? <p className="text-sm text-muted">{t("di.export.geoNoMatch")}</p> : null}
        {preview?.warnings.map((warning) => (
          <p key={warning} className="text-sm text-muted">
            {warning}
          </p>
        ))}
        {error ? (
          <p className="text-sm text-serious" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={refreshPreview} disabled={busy}>
            {t("di.export.preview")}
          </Button>
          <Button type="button" size="sm" onClick={generate} disabled={busy || !preview?.implemented} data-testid="geo-report-print">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("di.export.printReport")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {t("di.export.close")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
