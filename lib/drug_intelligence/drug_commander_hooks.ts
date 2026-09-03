/**
 * React Query hooks for the Commander Intelligence Dashboard (Phase 2B).
 *
 * Each hook corresponds to one dashboard section and has its own independent
 * query — sections load in parallel and failure in one does not block others.
 *
 * Follows drug_intelligence_hooks.ts exactly: hooks are disabled when
 * actorId is null (no unauthenticated requests).
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { drugCommanderClient, type CommanderQueryParams } from "@/lib/drug_intelligence/drug_commander_client";
import type {
  CommanderOverviewData,
  CommanderSeizuresData,
  CommanderTrendData,
  CommanderAreasData,
  CommanderUnitsData,
  CommanderSignalsData,
  CommanderDecisionData,
} from "@/lib/drug_intelligence/drug_commander_dashboard_types";

export const commanderQueryKeys = {
  overview: (actorId: string | null, params: Omit<CommanderQueryParams, "actorId">) =>
    ["commander-overview", actorId, params] as const,
  seizures: (actorId: string | null, params: Omit<CommanderQueryParams, "actorId">) =>
    ["commander-seizures", actorId, params] as const,
  trend: (actorId: string | null, params: Omit<CommanderQueryParams, "actorId">) =>
    ["commander-trend", actorId, params] as const,
  areas: (actorId: string | null, params: Omit<CommanderQueryParams, "actorId">) =>
    ["commander-areas", actorId, params] as const,
  units: (actorId: string | null, params: Omit<CommanderQueryParams, "actorId">) =>
    ["commander-units", actorId, params] as const,
  signals: (actorId: string | null) => ["commander-signals", actorId] as const,
  decision: (actorId: string | null, params: Omit<CommanderQueryParams, "actorId">) =>
    ["commander-decision", actorId, params] as const,
};

export function useCommanderOverview(
  actorId: string | null,
  params: Omit<CommanderQueryParams, "actorId">,
  enabled = true
): UseQueryResult<CommanderOverviewData> {
  return useQuery({
    queryKey: commanderQueryKeys.overview(actorId, params),
    queryFn: () => drugCommanderClient.getOverview({ actorId: actorId as string, ...params }),
    enabled: Boolean(actorId) && enabled,
  });
}

export function useCommanderSeizures(
  actorId: string | null,
  params: Omit<CommanderQueryParams, "actorId">,
  enabled = true
): UseQueryResult<CommanderSeizuresData> {
  return useQuery({
    queryKey: commanderQueryKeys.seizures(actorId, params),
    queryFn: () => drugCommanderClient.getSeizures({ actorId: actorId as string, ...params }),
    enabled: Boolean(actorId) && enabled,
  });
}

export function useCommanderTrend(
  actorId: string | null,
  params: Omit<CommanderQueryParams, "actorId">,
  enabled = true
): UseQueryResult<CommanderTrendData> {
  return useQuery({
    queryKey: commanderQueryKeys.trend(actorId, params),
    queryFn: () => drugCommanderClient.getTrend({ actorId: actorId as string, ...params }),
    enabled: Boolean(actorId) && enabled,
  });
}

export function useCommanderAreas(
  actorId: string | null,
  params: Omit<CommanderQueryParams, "actorId">,
  enabled = true
): UseQueryResult<CommanderAreasData> {
  return useQuery({
    queryKey: commanderQueryKeys.areas(actorId, params),
    queryFn: () => drugCommanderClient.getAreas({ actorId: actorId as string, ...params }),
    enabled: Boolean(actorId) && enabled,
  });
}

export function useCommanderUnits(
  actorId: string | null,
  params: Omit<CommanderQueryParams, "actorId">,
  enabled = true
): UseQueryResult<CommanderUnitsData> {
  return useQuery({
    queryKey: commanderQueryKeys.units(actorId, params),
    queryFn: () => drugCommanderClient.getUnits({ actorId: actorId as string, ...params }),
    enabled: Boolean(actorId) && enabled,
  });
}

export function useCommanderSignals(actorId: string | null): UseQueryResult<CommanderSignalsData> {
  return useQuery({
    queryKey: commanderQueryKeys.signals(actorId),
    queryFn: () => drugCommanderClient.getSignals(actorId as string),
    enabled: Boolean(actorId),
  });
}

export function useCommanderDecision(
  actorId: string | null,
  params: Omit<CommanderQueryParams, "actorId">,
  enabled = true
): UseQueryResult<CommanderDecisionData> {
  return useQuery({
    queryKey: commanderQueryKeys.decision(actorId, params),
    queryFn: () => drugCommanderClient.getDecision({ actorId: actorId as string, ...params }),
    enabled: Boolean(actorId) && enabled,
  });
}
