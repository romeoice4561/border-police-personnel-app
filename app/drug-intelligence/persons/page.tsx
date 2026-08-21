/**
 * Person Directory (Phase DI-2 Round B — Section 3).
 *
 * Person-domain search only (name/alias/identifier/phone via the Round A
 * DrugPersonDirectoryService) — never DI-3's Global Search. Reuses
 * GlobalSearchBox/Pagination/LoadingState/ErrorState/EmptyState and mirrors
 * the Case List page's exact table/card structure. MERGED persons never
 * appear (excluded server-side by DrugPersonDirectoryService.list()).
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { GlobalSearchBox } from "@/components/common/global_search_box";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugPersonDirectory } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { DRUG_PERSON_IDENTIFIER_TYPE_LABELS, isValidDrugPersonIdentifierType } from "@/lib/drug_intelligence/drug_person_options";
import type { DrugPersonDirectoryRow } from "@/lib/drug_intelligence/drug_intelligence_client";

const PAGE_SIZE = 20;

function formatDate(value: string, language: "th" | "en"): string {
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
}

function identifierTypeLabel(type: string, language: "th" | "en"): string {
  if (!isValidDrugPersonIdentifierType(type)) return type;
  const meta = DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

export default function DrugPersonDirectoryPage() {
  const { user } = useAuth();
  const { t, language } = useT();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const directory = useDrugPersonDirectory(user?.id ?? null, { page, pageSize: PAGE_SIZE, query: query.trim() || undefined });

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("di.directory.title")}
        description={
          directory.data ? t("di.directory.resultCount").replace("{count}", directory.data.meta.total.toLocaleString(language === "th" ? "th-TH" : "en-US")) : t("di.directory.description")
        }
      />

      <GlobalSearchBox value={query} onChange={updateQuery} placeholder={t("di.directory.searchPlaceholder")} />

      {directory.isPending ? (
        <LoadingState />
      ) : directory.isError ? (
        <ErrorState message={(directory.error as Error).message} onRetry={() => directory.refetch()} />
      ) : directory.data.rows.length === 0 ? (
        <EmptyState title={query.trim() ? t("di.directory.emptySearchTitle") : t("di.directory.emptyTitle")} icon={<Users className="h-8 w-8" />} />
      ) : (
        <div className="space-y-4">
          <DrugPersonTable rows={directory.data.rows} />
          <Pagination
            page={directory.data.meta.page}
            totalPages={directory.data.meta.totalPages}
            total={directory.data.meta.total}
            pageSize={directory.data.meta.pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function DrugPersonTable({ rows }: { rows: DrugPersonDirectoryRow[] }) {
  const { t, language } = useT();
  const { can } = useAuth();
  const canViewFull = can("drug.edit");

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/drug-intelligence/persons/${encodeURIComponent(row.id)}`}
            className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.primaryFullName}</p>
                {row.primaryAlias ? <p className="mt-0.5 truncate text-sm text-muted">{row.primaryAlias}</p> : null}
              </div>
              {row.hasPotentialDuplicate ? (
                <Badge tone="warning">
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                  {t("di.directory.duplicateBadge")}
                </Badge>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>
                <dt className="uppercase tracking-wide">{t("di.directory.columnIdentifier")}</dt>
                <dd className="mt-0.5 font-mono text-foreground">
                  {row.identifierPreview ? presentIdentifierValue(row.identifierPreview.value, canViewFull) : "—"}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">{t("di.directory.columnCases")}</dt>
                <dd className="mt-0.5 text-foreground">{row.caseCount}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">{t("di.directory.columnFirstSeen")}</dt>
                <dd className="mt-0.5 text-foreground">{formatDate(row.firstSeenAt, language)}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">{t("di.directory.columnLastSeen")}</dt>
                <dd className="mt-0.5 text-foreground">{formatDate(row.lastSeenAt, language)}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface sm:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">{t("di.directory.columnName")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.directory.columnAlias")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.directory.columnIdentifier")}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t("di.directory.columnCases")}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t("di.directory.columnPhones")}</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">{t("di.directory.columnDevices")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.directory.columnFirstSeen")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("di.directory.columnLastSeen")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/drug-intelligence/persons/${encodeURIComponent(row.id)}`} className="flex items-center gap-2 text-accent hover:underline">
                    <span className="line-clamp-2 wrap-break-word">{row.primaryFullName}</span>
                    {row.hasPotentialDuplicate ? (
                      <Badge tone="warning">
                        <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                        {t("di.directory.duplicateBadge")}
                      </Badge>
                    ) : null}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">
                  <span className="line-clamp-2 wrap-break-word">{row.primaryAlias || "—"}</span>
                </td>
                <td className="px-4 py-3 font-mono text-muted">
                  {row.identifierPreview ? (
                    <>
                      <span className="mr-1 text-xs">{identifierTypeLabel(row.identifierPreview.type, language)}</span>
                      {presentIdentifierValue(row.identifierPreview.value, canViewFull)}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.caseCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.phoneCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.deviceCount}</td>
                <td className="px-4 py-3 text-muted">{formatDate(row.firstSeenAt, language)}</td>
                <td className="px-4 py-3 text-muted">{formatDate(row.lastSeenAt, language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
