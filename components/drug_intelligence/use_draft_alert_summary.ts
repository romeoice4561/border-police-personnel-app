/**
 * Aggregates DI-6 quick-check reuse signals across an ENTIRE Create Case
 * draft (Section 6's pre-submit review-step summary — "ข้อมูลเชื่อมโยงที่
 * ระบบตรวจพบ"). Distinct from the per-field inline cards
 * (drug_alert_inline_card.tsx), which show one entity's signal under its
 * own input; this hook runs the same underlying quick-check queries once
 * per DISTINCT raw value across every person in the draft and rolls them
 * into one summary the Review step can render as a single card.
 */
"use client";

import { useQueries } from "@tanstack/react-query";
import { drugIntelligenceClient, type DrugAlertQuickCheckResult } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { PersonDraft } from "@/lib/drug_intelligence/create_case_draft";

export interface DrugDraftAlertSummary {
  isPending: boolean;
  phoneMatches: DrugAlertQuickCheckResult[];
  deviceMatches: DrugAlertQuickCheckResult[];
  vehicleMatches: DrugAlertQuickCheckResult[];
  totalCount: number;
}

export function useDraftAlertSummary(actorId: string | null, persons: PersonDraft[]): DrugDraftAlertSummary {
  const phoneInputs = [...new Set(persons.flatMap((p) => p.phones.map((ph) => ph.rawInput.trim()).filter((v) => v.length >= 9)))];
  const deviceInputs = [...new Set(persons.flatMap((p) => p.devices.map((d) => d.imei1.trim()).filter((v) => v.length >= 10)))];
  const vehicleInputs = [
    ...new Set(
      persons.flatMap((p) =>
        p.vehicles
          .filter((v) => v.registrationNumber.trim().length >= 2 && v.registrationProvince.trim().length >= 2)
          .map((v) => `${v.registrationNumber.trim()}|${v.registrationProvince.trim()}`)
      )
    ),
  ];

  const phoneQueries = useQueries({
    queries: phoneInputs.map((rawInput) => ({
      queryKey: ["drug-alert-quick-check-phone", actorId, rawInput],
      queryFn: () => drugIntelligenceClient.quickCheckPhone(actorId as string, rawInput),
      enabled: Boolean(actorId),
    })),
  });
  const deviceQueries = useQueries({
    queries: deviceInputs.map((imei1) => ({
      queryKey: ["drug-alert-quick-check-device", actorId, imei1],
      queryFn: () => drugIntelligenceClient.quickCheckDevice(actorId as string, imei1, null),
      enabled: Boolean(actorId),
    })),
  });
  const vehicleQueries = useQueries({
    queries: vehicleInputs.map((key) => {
      const [registrationNumber, registrationProvince] = key.split("|");
      return {
        queryKey: ["drug-alert-quick-check-vehicle", actorId, registrationNumber, registrationProvince],
        queryFn: () => drugIntelligenceClient.quickCheckVehicle(actorId as string, registrationNumber, registrationProvince, null),
        enabled: Boolean(actorId),
      };
    }),
  });

  const isPending = phoneQueries.some((q) => q.isPending) || deviceQueries.some((q) => q.isPending) || vehicleQueries.some((q) => q.isPending);
  const phoneMatches = phoneQueries.map((q) => q.data).filter((d): d is DrugAlertQuickCheckResult => Boolean(d?.found));
  const deviceMatches = deviceQueries.map((q) => q.data).filter((d): d is DrugAlertQuickCheckResult => Boolean(d?.found));
  const vehicleMatches = vehicleQueries.map((q) => q.data).filter((d): d is DrugAlertQuickCheckResult => Boolean(d?.found));

  return {
    isPending,
    phoneMatches,
    deviceMatches,
    vehicleMatches,
    totalCount: phoneMatches.length + deviceMatches.length + vehicleMatches.length,
  };
}
