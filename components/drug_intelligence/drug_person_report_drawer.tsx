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

export function DrugPersonReportDrawer({
  open,
  onClose,
  personId,
  personName,
  caseCount,
  phoneCount,
  simCount,
  deviceCount,
  vehicleCount,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  caseCount: number;
  phoneCount: number;
  simCount: number;
  deviceCount: number;
  vehicleCount: number;
}) {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const canFull = can("drug.edit");
  const [masking, setMasking] = useState<"MASKED" | "FULL">("MASKED");
  const [result, setResult] = useState<{ key: string; preview: DrugExportPreviewV1 | null; error: string | null } | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const previewKey = `${open}:${user?.id ?? ""}:${language}:${canFull ? masking : "MASKED"}:${personId}`;
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
        exportType: "PERSON_DATA",
        format: "HTML_PRINT",
        masking: canFull ? masking : "MASKED",
        context: {
          schemaVersion: 1,
          locale: language,
          sourceRoute: "/drug-intelligence/persons",
          person: { personId },
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
  }, [open, user, personId, language, masking, canFull, t, previewKey]);

  async function generate() {
    if (!user) return;
    setDownloadBusy(true);
    try {
      const downloaded = await drugIntelligenceClient.downloadExport({
        actorId: user.id,
        exportType: "PERSON_DATA",
        format: "HTML_PRINT",
        masking: canFull ? masking : "MASKED",
        context: {
          schemaVersion: 1,
          locale: language,
          sourceRoute: "/drug-intelligence/persons",
          person: { personId },
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
    <Drawer open={open} onClose={onClose} titleId="drug-person-report-title" title={t("di.export.personReportTitle")}>
      <div className="min-w-0 space-y-4 overflow-x-hidden px-5 py-4">
        <p className="text-sm text-foreground">{personName}</p>
        <p className="text-sm text-muted">{t("di.export.personScope")}</p>
        <p className="text-sm text-foreground">
          {t("di.export.personCaseCount")}: <span className="font-medium">{caseCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.personPhoneCount")}: <span className="font-medium">{phoneCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.personSimCount")}: <span className="font-medium">{simCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.personDeviceCount")}: <span className="font-medium">{deviceCount}</span>
        </p>
        <p className="text-sm text-foreground">
          {t("di.export.personVehicleCount")}: <span className="font-medium">{vehicleCount}</span>
        </p>
        <p className="text-sm text-muted">{t("di.export.personMaskingNotice")}</p>
        {canFull ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="person-report-masking">
              {t("di.export.maskingMode")}
            </label>
            <Select
              id="person-report-masking"
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
            data-testid="person-report-print-btn"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("di.export.printReport")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} data-testid="person-report-close-btn">
            {t("di.export.close")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
