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
import { ApiClientError } from "@/lib/ui/api_client";

function openPrintView(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("popup-blocked");
  }
  opened.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function DrugCaseReportDrawer({
  open,
  onClose,
  caseId,
  caseNumber,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseNumber: string;
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
            error: err instanceof ApiClientError ? err.message : t("di.export.downloadFailed"),
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
      openPrintView(new Blob([downloaded.blob], { type: "text/html;charset=utf-8" }));
    } catch (err) {
      setResult({
        key: previewKey,
        preview,
        error: err instanceof ApiClientError ? err.message : t("di.export.downloadFailed"),
      });
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} titleId="drug-case-report-title" title={t("di.export.caseReport")}>
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-foreground">{caseNumber}</p>
        <p className="text-sm text-muted">{t("di.export.sections")}: {t("di.export.sectionCase")}, {t("di.export.sectionPeople")}, {t("di.export.sectionPhones")}, {t("di.export.sectionSeizures")}</p>
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
          <Button type="button" size="sm" onClick={generate} disabled={busy || !preview?.implemented}>
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
