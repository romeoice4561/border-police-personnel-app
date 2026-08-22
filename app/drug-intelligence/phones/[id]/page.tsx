/**
 * Phone entity detail (Phase DI-3 — Section 13). Never says "owner" — uses
 * "พบเกี่ยวข้องกับ" (found associated with), matching Section 17's wording rule.
 */
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone as PhoneIcon, Users, FileSpreadsheet, Network } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugPhoneDetail } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { ApiClientError } from "@/lib/drug_intelligence/drug_intelligence_client";

export default function DrugPhoneDetailPage() {
  const params = useParams<{ id: string }>();
  const phoneNumberId = decodeURIComponent(params.id);
  const { user, can } = useAuth();
  const { t, language } = useT();

  const detail = useDrugPhoneDetail(user?.id ?? null, phoneNumberId);

  if (detail.isPending) return <LoadingState />;
  if (detail.isError) {
    const isNotFound = detail.error instanceof ApiClientError && detail.error.status === 404;
    return <ErrorState title={isNotFound ? t("di.entity.notFound") : undefined} message={isNotFound ? undefined : (detail.error as Error).message} onRetry={isNotFound ? undefined : () => detail.refetch()} />;
  }

  const data = detail.data;
  const canViewFull = can("drug.edit");

  return (
    <div className="space-y-5">
      <PageHeader
        title={presentPhoneNumber(data.phone.normalizedNumber, canViewFull)}
        description={t("di.entity.phoneTitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/drug-intelligence/network?focusType=PHONE&focusId=${encodeURIComponent(phoneNumberId)}`}>
                <Network className="h-4 w-4" aria-hidden="true" />
                {t("di.network.openNetwork")}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/drug-intelligence/search">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("di.entity.backToSearch")}
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-muted">
            {t("di.entity.firstSeen")}: <span className="text-foreground">{new Date(data.firstSeenAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}</span>
          </span>
          <span className="text-muted">
            {t("di.entity.lastSeen")}: <span className="text-foreground">{new Date(data.lastSeenAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}</span>
          </span>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.entity.relatedPersons")}</h2>
        {data.relatedPersons.length === 0 ? (
          <EmptyState title={t("di.entity.emptyRelatedPersons")} icon={<Users className="h-8 w-8" />} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.relatedPersons.map((person) => (
              <Link key={person.id} href={`/drug-intelligence/persons/${encodeURIComponent(person.id)}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/50">
                <p className="font-medium text-foreground">{person.primaryFullName}</p>
                <p className="mt-1 text-xs text-muted">{t("di.entity.foundAssociatedWith")}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.entity.sourceCases")}</h2>
        {data.sourceCases.length === 0 ? (
          <EmptyState title={t("di.entity.emptySourceCases")} icon={<FileSpreadsheet className="h-8 w-8" />} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.sourceCases.map((drugCase) => (
              <Link key={drugCase.id} href={`/drug-intelligence/cases/${encodeURIComponent(drugCase.id)}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/50">
                <p className="font-medium text-foreground">{drugCase.caseNumber}</p>
                <p className="mt-1 text-sm text-muted">{drugCase.title}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        <PhoneIcon className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        {t("di.entity.relatedPersons")}: {data.relatedPersonCount} · {t("di.entity.sourceCases")}: {data.caseCount}
      </p>
    </div>
  );
}
