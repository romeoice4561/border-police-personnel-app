/**
 * Phone index (Phase 11A): Phone -> officer(s) with that phone.
 *
 * Usually one officer per phone; a bucket with more than one signals a
 * duplicate phone (surfaced by duplicate detection, never auto-merged).
 * Blank phones are skipped. Pure; no globals, no I/O.
 */

import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";

export function buildPhoneIndex(officers: KnowledgeOfficer[]): Map<string, KnowledgeOfficer[]> {
  const index = new Map<string, KnowledgeOfficer[]>();

  for (const officer of officers) {
    const phone = officer.career.phone.trim();
    if (phone.length === 0) continue;

    const bucket = index.get(phone);
    if (bucket) {
      bucket.push(officer);
    } else {
      index.set(phone, [officer]);
    }
  }

  return index;
}
