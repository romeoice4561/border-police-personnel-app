/**
 * DI-10E.6C — Map popup detail hook.
 *
 * Fetches only when enabled (explicit selected marker on MAP view).
 * In-session memory cache. Abort + token guard against stale responses.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { createDrugMapCaseDetailSession, fetchDrugMapCaseDetail, type DrugMapCaseDetailResult } from "@/lib/drug_intelligence/drug_map_case_detail_client";

export interface DrugMapCaseDetailState {
  data: DrugMapCaseDetailResult | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

export function useDrugMapCaseDetail(actorId: string | null, caseId: string | null, enabled: boolean): DrugMapCaseDetailState {
  const [session] = useState(() => createDrugMapCaseDetailSession());
  const [data, setData] = useState<DrugMapCaseDetailResult | null>(null);
  const [errorCaseId, setErrorCaseId] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const active = Boolean(enabled && actorId && caseId);
  const cached = active && caseId ? session.cache.get(caseId) ?? null : null;
  const visibleData = data?.case.id === caseId ? data : cached;
  const isError = Boolean(active && caseId && errorCaseId === caseId && !visibleData);
  const isLoading = Boolean(active && !visibleData && !isError);

  useEffect(() => {
    if (!enabled || !actorId || !caseId) {
      session.close();
      return () => {
        session.close();
      };
    }
    if (session.cache.has(caseId)) return undefined;

    let cancelled = false;
    const requestActorId = actorId;
    session
      .load(caseId, (id, signal) => fetchDrugMapCaseDetail(requestActorId, id, signal))
      .then((result) => {
        if (cancelled || result.aborted || result.stale) return;
        setData(result.data);
        setErrorCaseId(null);
      })
      .catch(() => {
        if (cancelled) return;
        setErrorCaseId(caseId);
      });

    return () => {
      cancelled = true;
      session.close();
    };
  }, [actorId, caseId, enabled, retryToken, session]);

  const retry = useCallback(() => {
    if (caseId) session.invalidate(caseId);
    setData((current) => (current?.case.id === caseId ? null : current));
    setErrorCaseId(null);
    setRetryToken((n) => n + 1);
  }, [caseId, session]);

  return {
    data: active ? visibleData : null,
    isLoading,
    isError,
    retry,
  };
}
