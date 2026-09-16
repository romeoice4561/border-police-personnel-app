/**
 * Case-level investigating-officer contact on Case Detail.
 *
 * Administrative contact only — never links to Drug Intelligence phone
 * entities. Edit is a narrow PATCH of investigatorName / investigatorPhone.
 */
"use client";

import { useState } from "react";
import { Copy, Phone } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useUpdateInvestigatorContact } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { normalizeInvestigatorContactName, normalizeInvestigatorContactPhone } from "@/lib/drug_intelligence/investigator_contact";
import { cn } from "@/lib/ui/cn";

export function DrugCaseInvestigatorContactCard({
  caseId,
  investigatorName,
  investigatorPhone,
}: {
  caseId: string;
  investigatorName: string | null;
  investigatorPhone: string | null;
}) {
  const { t } = useT();
  const { user, can } = useAuth();
  const canEdit = can("drug.edit");
  const hasContact = Boolean(investigatorName || investigatorPhone);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(investigatorName ?? "");
  const [phoneDraft, setPhoneDraft] = useState(investigatorPhone ?? "");
  const [copied, setCopied] = useState(false);
  const save = useUpdateInvestigatorContact(user?.id ?? null, user?.displayName ?? "");

  function openEditor() {
    setNameDraft(investigatorName ?? "");
    setPhoneDraft(investigatorPhone ?? "");
    setEditing(true);
  }

  if (!hasContact && !canEdit) return null;

  async function handleSave() {
    await save.mutateAsync({
      caseId,
      investigatorName: normalizeInvestigatorContactName(nameDraft),
      investigatorPhone: normalizeInvestigatorContactPhone(phoneDraft),
    });
    setEditing(false);
  }

  async function handleCopy() {
    if (!investigatorPhone) return;
    try {
      await navigator.clipboard.writeText(investigatorPhone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the number remains visible.
    }
  }

  const telHref = investigatorPhone ? `tel:${investigatorPhone.replace(/[^0-9+]/g, "")}` : null;

  return (
    <Card data-testid="investigator-contact-card">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.investigator.sectionLabel")}</p>
            <p className="text-xs text-muted">{t("di.investigator.sectionHelper")}</p>
          </div>
          {canEdit && !editing ? (
            <Button type="button" variant="ghost" size="sm" onClick={openEditor} data-testid="investigator-contact-edit">
              {hasContact ? t("di.investigator.edit") : t("di.investigator.add")}
            </Button>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("di.investigator.name")} htmlFor="di-edit-investigatorName">
                <input
                  id="di-edit-investigatorName"
                  className={inputCls}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder={t("di.investigator.namePlaceholder")}
                />
              </Field>
              <Field label={t("di.investigator.phone")} htmlFor="di-edit-investigatorPhone">
                <input
                  id="di-edit-investigatorPhone"
                  className={inputCls}
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder={t("di.investigator.phonePlaceholder")}
                  inputMode="tel"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void handleSave()} disabled={save.isPending}>
                {t("di.investigator.save")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={save.isPending}>
                {t("di.investigator.cancel")}
              </Button>
            </div>
            {save.isError ? <p className="text-xs text-critical">{(save.error as Error).message}</p> : null}
          </div>
        ) : hasContact ? (
          <div className="space-y-2">
            {investigatorName ? (
              <p className="text-sm font-medium text-foreground" data-testid="investigator-contact-name">
                {investigatorName}
              </p>
            ) : null}
            {investigatorPhone ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-foreground" data-testid="investigator-contact-phone">
                  {t("di.investigator.phonePrefix")} {investigatorPhone}
                </p>
                {telHref ? (
                  <a
                    href={telHref}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-surface"
                    )}
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("di.investigator.call")}
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-surface"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copied ? t("di.investigator.copied") : t("di.investigator.copy")}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("di.investigator.empty")}</p>
        )}
      </CardBody>
    </Card>
  );
}
