/**
 * Real-time phone/device/vehicle reuse indicators (Phase DI-1 Round 2,
 * Section 9/10; enriched by Phase DI-6 Section 4 with case/person counts
 * and last-seen date instead of a bare boolean).
 *
 * Debounced — never block, never create. Renders inline intelligence cards
 * while the user types, purely informational: the entity is genuinely
 * reused server-side by the create flow regardless of whether the user
 * ever sees this hint.
 */
"use client";

import { useEffect, useState } from "react";
import { drugIntelligenceClient, type DrugAlertQuickCheckResult } from "@/lib/drug_intelligence/drug_intelligence_client";

const DEBOUNCE_MS = 500;

const EMPTY_RESULT: DrugAlertQuickCheckResult = { found: false, entityType: "PHONE", entityId: null, caseCount: 0, relatedPersonCount: 0, lastSeenAt: null };

export function usePhoneReuseSignal(actorId: string | null, rawInput: string): DrugAlertQuickCheckResult {
  const [result, setResult] = useState<DrugAlertQuickCheckResult>(EMPTY_RESULT);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (!actorId || rawInput.trim().length < 9) {
        setResult(EMPTY_RESULT);
        return;
      }
      try {
        const r = await drugIntelligenceClient.quickCheckPhone(actorId, rawInput.trim());
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setResult(EMPTY_RESULT);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [actorId, rawInput]);

  return result;
}

export function useDeviceReuseSignal(actorId: string | null, imei1: string, serialNumber: string): DrugAlertQuickCheckResult {
  const [result, setResult] = useState<DrugAlertQuickCheckResult>({ ...EMPTY_RESULT, entityType: "DEVICE" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const trimmedImei = imei1.trim();
      const trimmedSerial = serialNumber.trim();
      if (!actorId || (trimmedImei.length < 10 && trimmedSerial.length < 4)) {
        setResult({ ...EMPTY_RESULT, entityType: "DEVICE" });
        return;
      }
      try {
        const r = await drugIntelligenceClient.quickCheckDevice(actorId, trimmedImei || null, trimmedSerial || null);
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setResult({ ...EMPTY_RESULT, entityType: "DEVICE" });
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [actorId, imei1, serialNumber]);

  return result;
}

/** Section 4: vehicle-reuse signal — new in DI-6 (no boolean-only precursor existed for vehicles). */
export function useVehicleReuseSignal(actorId: string | null, registrationNumber: string, registrationProvince: string, vin: string): DrugAlertQuickCheckResult {
  const [result, setResult] = useState<DrugAlertQuickCheckResult>({ ...EMPTY_RESULT, entityType: "VEHICLE" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const trimmedReg = registrationNumber.trim();
      const trimmedProvince = registrationProvince.trim();
      const trimmedVin = vin.trim();
      const hasRegPair = trimmedReg.length >= 2 && trimmedProvince.length >= 2;
      if (!actorId || (!hasRegPair && trimmedVin.length < 5)) {
        setResult({ ...EMPTY_RESULT, entityType: "VEHICLE" });
        return;
      }
      try {
        const r = await drugIntelligenceClient.quickCheckVehicle(actorId, trimmedReg || null, trimmedProvince || null, trimmedVin || null);
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setResult({ ...EMPTY_RESULT, entityType: "VEHICLE" });
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [actorId, registrationNumber, registrationProvince, vin]);

  return result;
}
