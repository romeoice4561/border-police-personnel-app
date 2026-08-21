/**
 * useDrugPersonDuplicateCheck (Phase DI-1 Round 2, Section 8/14).
 *
 * Debounced, real-time duplicate check against the Round 2
 * check-duplicate endpoint as the user fills in a NEW person's name/DOB/
 * identifiers. Never blocks typing, never auto-merges — reports candidates
 * for the Person section to render as a dismissible warning with explicit
 * "ใช้บุคคลเดิม" / "สร้างเป็นบุคคลใหม่" actions.
 */
"use client";

import { useEffect, useState } from "react";
import { drugIntelligenceClient, type DrugPersonDuplicateCandidate } from "@/lib/drug_intelligence/drug_intelligence_client";

const DEBOUNCE_MS = 500;

export function useDrugPersonDuplicateCheck(
  actorId: string | null,
  input: { primaryFullName: string; dateOfBirth: string | null; identifiers: Array<{ type: string; value: string }> }
) {
  const [candidates, setCandidates] = useState<DrugPersonDuplicateCandidate[]>([]);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hasSignal = input.primaryFullName.trim().length > 1 || input.identifiers.some((i) => i.value.trim().length > 3);

  useEffect(() => {
    if (!actorId || !hasSignal) {
      // No debounce needed for the "nothing to check" case — but still
      // deferred to a microtask via the timer below (0ms) rather than
      // called synchronously in the effect body, so React never sees a
      // setState during the render/effect phase itself.
      const timer = window.setTimeout(() => {
        setDismissed(false);
        setCandidates([]);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setDismissed(false);
      setChecking(true);
      try {
        const result = await drugIntelligenceClient.checkPersonDuplicate({
          actorId,
          primaryFullName: input.primaryFullName,
          dateOfBirth: input.dateOfBirth,
          identifiers: input.identifiers.filter((i) => i.value.trim()),
        });
        if (!cancelled) setCandidates(result.candidates);
      } catch {
        // A failed real-time check must never block the form — the
        // authoritative duplicate check still runs server-side at submit.
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the identity signals themselves change
  }, [actorId, input.primaryFullName, input.dateOfBirth, JSON.stringify(input.identifiers)]);

  return {
    candidates: dismissed ? [] : candidates,
    checking,
    dismiss: () => setDismissed(true),
  };
}
