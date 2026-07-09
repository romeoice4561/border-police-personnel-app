/**
 * Legacy Portrait Verification & Drive Cleanup (Phase 24B-2).
 *
 * Admin/reviewer tool for classifying ProfilePhoto rows discovered by the
 * Drive scan: filter by classification (Unknown/Map/Organization/Document/…),
 * search by officer id or Drive file id, and bulk verify (REAL_PERSON) or
 * bulk reject (a non-portrait classification). This is management UI only —
 * it never touches OCR and never deletes a row (spec: "Do not modify OCR").
 * The resolver (lib/server/officer_portrait_service.ts) respects a
 * classification change immediately on the next read.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { Pagination } from "@/components/common/pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortraitClassification } from "@/lib/profile_photo/profile_photo_types";

interface PhotoRow {
  id: number;
  driveFileId: string;
  thumbnailUrl: string | null;
  filename: string;
  matchedOfficerId: string | null;
  matchStatus: string;
  sourceType: string;
  classification: string;
  updatedAt: string;
}

interface ListResponse {
  data: PhotoRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

interface ClassificationCountRow {
  classification: string;
  count: number;
}

const FILTER_CHIPS: Array<{ value: PortraitClassification | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: PortraitClassification.Unknown, label: "Unknown" },
  { value: PortraitClassification.Map, label: "Map" },
  { value: PortraitClassification.Organization, label: "Organization" },
  { value: PortraitClassification.Document, label: "Document" },
  { value: PortraitClassification.ProfileCard, label: "Profile Card" },
  { value: PortraitClassification.RealPerson, label: "Verified" },
];

const CLASSIFY_ACTIONS: Array<{ value: PortraitClassification; label: string; tone: "good" | "critical" }> = [
  { value: PortraitClassification.RealPerson, label: "Real Portrait", tone: "good" },
  { value: PortraitClassification.Organization, label: "Organization", tone: "critical" },
  { value: PortraitClassification.Map, label: "Map", tone: "critical" },
  { value: PortraitClassification.ProfileCard, label: "Profile Card", tone: "critical" },
  { value: PortraitClassification.Document, label: "Document", tone: "critical" },
];

const PAGE_SIZE = 24;

export default function PortraitCleanupPage() {
  const [filter, setFilter] = useState<PortraitClassification | "ALL">(PortraitClassification.Unknown);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [result, setResult] = useState<ListResponse | null>(null);
  const [counts, setCounts] = useState<ClassificationCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (filter !== "ALL") params.set("classification", filter);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [filter, search, page]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile-photos?${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status}).`);
        const body = (await res.json()) as { data: PhotoRow[]; meta: ListResponse["meta"] };
        if (cancelled) return;
        setResult({ data: body.data, meta: body.meta });
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, reloadToken]);

  /** Every state setter that changes `query` or triggers a reload routes through
   * this so `loading` flips to true at the moment of the user action — not
   * inside the effect that performs the fetch (avoids setState-in-effect). */
  function withLoadingReset<T extends unknown[]>(fn: (...args: T) => void) {
    return (...args: T) => {
      setLoading(true);
      fn(...args);
    };
  }

  const changeFilter = withLoadingReset((value: PortraitClassification | "ALL") => {
    setFilter(value);
    setPage(1);
  });
  const changeSearch = withLoadingReset((value: string) => {
    setSearch(value);
    setPage(1);
  });
  const changePage = withLoadingReset((value: number) => setPage(value));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile-photos/counts")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { data: ClassificationCountRow[] };
        if (!cancelled) setCounts(body.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function reload() {
    setSelected(new Set());
    setLoading(true);
    setReloadToken((t) => t + 1);
  }

  function countFor(classification: PortraitClassification | "ALL"): number | null {
    if (classification === "ALL") return null;
    return counts.find((c) => c.classification === classification)?.count ?? 0;
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function classifyOne(id: number, classification: PortraitClassification) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile-photos/${id}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification }),
      });
      if (!res.ok) throw new Error(`Classify failed (${res.status}).`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classify failed.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkClassify(classification: PortraitClassification) {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile-photos/bulk-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], classification }),
      });
      if (!res.ok) throw new Error(`Bulk classify failed (${res.status}).`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk classify failed.");
    } finally {
      setBusy(false);
    }
  }

  const rows = result?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Legacy Portrait Verification"
        description="Classify Drive-scanned photos so the portrait resolver never shows a map, org chart, or document as an officer's portrait."
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_CHIPS.map(({ value, label }) => {
          const count = countFor(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => changeFilter(value)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (filter === value ? "border-accent bg-accent text-accent-fg" : "border-border bg-neutral-bg text-foreground hover:bg-border/40")
              }
            >
              {label}
              {count !== null ? <span className="ml-1 opacity-70">({count})</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder="Search by officer id or Drive file id…"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">{selected.size} selected</span>
            {CLASSIFY_ACTIONS.map((action) => (
              <Button key={action.value} type="button" size="sm" variant="outline" disabled={busy} onClick={() => bulkClassify(action.value)}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here" message="No photos match this filter." icon={<ImageOff className="h-8 w-8" />} />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggleSelected(row.id)}
                  aria-label={`Select ${row.filename}`}
                  className="h-4 w-4 shrink-0"
                />

                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-black/10">
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Drive/storage URL
                    <img src={row.thumbnailUrl} alt={row.filename} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.filename}</p>
                  <p className="truncate text-xs text-muted">
                    Officer: {row.matchedOfficerId ?? "—"} · {row.matchStatus} · {row.sourceType}
                  </p>
                  <p className="truncate text-[11px] text-muted" title={row.driveFileId}>
                    {row.driveFileId}
                  </p>
                </div>

                <Badge>{row.classification}</Badge>

                <div className="flex flex-wrap gap-1.5">
                  {CLASSIFY_ACTIONS.map((action) => (
                    <Button
                      key={action.value}
                      type="button"
                      size="sm"
                      variant={row.classification === action.value ? "accent" : "outline"}
                      disabled={busy}
                      onClick={() => classifyOne(row.id, action.value)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {result && result.meta.total > 0 ? (
        <Pagination
          page={result.meta.page}
          totalPages={result.meta.totalPages}
          total={result.meta.total}
          pageSize={result.meta.pageSize}
          onPageChange={changePage}
        />
      ) : null}
    </div>
  );
}
