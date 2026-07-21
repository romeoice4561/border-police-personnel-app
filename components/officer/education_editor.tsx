/**
 * EducationEditor (Phase 23A — Officer Profile Workspace, Section 3).
 *
 * Editable Education card: add / remove / edit rows (year, institution,
 * degree, notes). Pure controlled component over the draft rows from
 * useOfficerWorkspace — no fetching, no save logic.
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { emptyEducationRow, type EducationDraftRow } from "@/components/officer/use_officer_workspace";
import { useT } from "@/components/i18n/language_provider";

export interface EducationEditorProps {
  rows: EducationDraftRow[];
  onChange: (rows: EducationDraftRow[]) => void;
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function EducationEditor({ rows, onChange }: EducationEditorProps) {
  const { t } = useT();

  function updateRow(key: string, patch: Partial<EducationDraftRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, emptyEducationRow()]);
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t("officer.education")}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common.add")}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("officer.educationEditorEmpty")}</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("officer.educationEditorYear")}</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น 2555"
                  value={row.year}
                  onChange={(e) => updateRow(row.key, { year: e.target.value })}
                  aria-label={t("officer.educationEditorYear")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("officer.educationEditorDegree")}</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น ปริญญาตรี"
                  value={row.degree}
                  onChange={(e) => updateRow(row.key, { degree: e.target.value })}
                  aria-label={t("officer.educationEditorDegree")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("officer.educationEditorInstitution")}</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น โรงเรียนนายร้อยตำรวจ"
                  value={row.institution}
                  onChange={(e) => updateRow(row.key, { institution: e.target.value })}
                  aria-label={t("officer.educationEditorInstitution")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("officer.educationEditorNotes")}</label>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-y`}
                  value={row.notes}
                  onChange={(e) => updateRow(row.key, { notes: e.target.value })}
                  aria-label={t("officer.educationEditorNotes")}
                />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
                  <Trash2 className="h-3.5 w-3.5 text-serious" aria-hidden="true" />
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
