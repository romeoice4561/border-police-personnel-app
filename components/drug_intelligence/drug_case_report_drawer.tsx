"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { drugIntelligenceClient } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugExportPreviewV1 } from "@/lib/drug_intelligence/drug_export_types";
import { htmlPrintFailureMessage, openHtmlPrintReport } from "@/lib/export/html_print";

export function DrugCaseReportDrawer({
  open,
  onClose,
  caseId,
  caseNumber,
  personCount,
  phoneCount,
  simCount,
  deviceCount,
  vehicleCount,
  seizedCount,
  unitCount,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseNumber: string;
  personCount: number;
  phoneCount: number;
  simCount: number;
  deviceCount: number;
  vehicleCount: number;
  seizedCount: number;
  unitCount: number;
}) {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const canFull = can("drug.edit");
  const [masking, setMasking] = useState<"MASKED" | "FULL">("MASKED");
  const [result, setResult] = useState<{ key: string; preview: DrugExportPreviewV1 | null; error: string | null } | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const previewKey = `${open}:${user?.id ?? ""}:${language}:${canFull ? masking : "MASKED"}:${caseId}`;
  const preview = result?.key === previewKey ? result.preview : null;
  const error = result?.key === previewKey ? result.error : null;
  const previewBusy = open && Boolean(user) && result?.key !== previewKey;
  const busy = previewBusy || downloadBusy;

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const key = previewKey;
    drugIntelligenceClient
      .previewExport({
        actorId: user.id,
        exportType: "CASE_REPORT",
        format: "HTML_PRINT",
        masking: canFull ? masking : "MASKED",
        context: {
          schemaVersion: 1,
          locale: language,
          sourceRoute: "/drug-intelligence/cases",
          case: { caseId },
        },
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
  }, [open, user, caseId, language, masking, canFull, t, previewKey]);

  async function generate() {
    if (!user) return;
    setDownloadBusy(true);
    try {
      const downloaded = await drugIntelligenceClient.downloadExport({
        actorId: user.id,
        exportType: "CASE_REPORT",
        format: "HTML_PRINT",
        masking: canFull ? masking : "MASKED",
        context: {
          schemaVersion: 1,
          locale: language,
          sourceRoute: "/drug-intelligence/cases",
          case: { caseId },
        },
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
    <Drawer open={open} onClose={onClose} titleId="drug-case-report-title" title={t("di.export.caseReport")}>
      <div className="min-w-0 space-y-4 overflow-x-hidden px-5 py-4">
        <p className="text-sm text-foreground">{caseNumber}</p>
        <p className="text-sm text-muted">{t("di.export.caseScope")}</p>
        <p className="text-sm text-foreground">
          {t("di.export.casePersonCount")}: <span className="font-medium">{personCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.casePhoneCount")}: <span className="font-medium">{phoneCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.caseSimCount")}: <span className="font-medium">{simCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.caseDeviceCount")}: <span className="font-medium">{deviceCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.caseVehicleCount")}: <span className="font-medium">{vehicleCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.caseSeizureCount")}: <span className="font-medium">{seizedCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.caseUnitCount")}: <span className="font-medium">{unitCount}</span>
        </p>
        <p className="text-sm text-muted">{t("di.export.caseMaskingNotice")}</p>
        {preview && preview.estimatedRecordCount != null && preview.estimatedRecordCount > preview.softLimit ? (
          <p className="text-sm text-muted">{t("di.export.softLimitWarning")}</p>
        ) : null}
        {canFull ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="case-report-masking">
              {t("di.export.maskingMode")}
            </label>
            <Select
              id="case-report-masking"
              value={masking}
              onChange={(e) => setMasking(e.target.value === "FULL" ? "FULL" : "MASKED")}
              options={[
                { value: "MASKED", label: t("di.export.masked") },
                { value: "FULL", label: t("di.export.full") },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">{t("di.export.masked")}</p>
        )}
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
          <Button
            type="button"
            size="sm"
            onClick={generate}
            disabled={busy || !preview?.implemented}
            aria-label={t("di.export.printReport")}
            data-testid="case-report-print-btn"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("di.export.printReport")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} data-testid="case-report-close-btn">
            {t("di.export.close")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
