/**
 * Real-time phone/device reuse indicators (Phase DI-1 Round 2, Section 9/10).
 *
 * Debounced existence-only checks — never block, never create. Renders
 * "พบหมายเลขนี้ในระบบแล้ว" / "พบ IMEI นี้ในข้อมูลเดิม" while the user types, purely
 * informational (the entity is genuinely reused server-side by the create
 * flow regardless of whether the user ever sees this hint).
 */
"use client";

import { useEffect, useState } from "react";
import { drugIntelligenceClient } from "@/lib/drug_intelligence/drug_intelligence_client";

const DEBOUNCE_MS = 500;

export function usePhoneExistsIndicator(actorId: string | null, rawInput: string) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Both branches resolve through the SAME debounce timer (never a
    // synchronous setState in the effect body) — the "too short to check"
    // case just resolves to `false` instead of calling the API.
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (!actorId || rawInput.trim().length < 9) {
        setExists(false);
        return;
      }
      try {
        const result = await drugIntelligenceClient.checkPhoneExists(actorId, rawInput.trim());
        if (!cancelled) setExists(result.exists);
      } catch {
        if (!cancelled) setExists(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [actorId, rawInput]);

  return exists;
}

export function useDeviceExistsIndicator(actorId: string | null, imei1: string, serialNumber: string) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const trimmedImei = imei1.trim();
      const trimmedSerial = serialNumber.trim();
      if (!actorId || (trimmedImei.length < 10 && trimmedSerial.length < 4)) {
        setExists(false);
        return;
      }
      try {
        const result = await drugIntelligenceClient.checkDeviceExists(actorId, trimmedImei || null, trimmedSerial || null);
        if (!cancelled) setExists(result.exists);
      } catch {
        if (!cancelled) setExists(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [actorId, imei1, serialNumber]);

  return exists;
}
