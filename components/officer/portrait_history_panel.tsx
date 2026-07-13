/**
 * PortraitHistoryPanel (Phase 24B-2).
 *
 * Shows every portrait ever linked to an officer — source, upload date,
 * Drive/Storage file identity, current badge, and verification status — with
 * a "Set as Current" action that promotes an old portrait WITHOUT a new
 * upload. Never deletes anything; fetched lazily (only when opened).
 */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Star, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { AVATAR_SIZE } from "@/lib/ui/media_tokens";

interface HistoryEntry {
  id: number;
  driveFileId: string;
  thumbnailUrl: string | null;
  sourceType: string;
  matchStatus: string;
  classification: string;
  isProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortraitHistoryPanelProps {
  officerId: string;
  name: string;
  onClose: () => void;
  /** Called after a successful "Set as Current" so the caller can router.refresh(). */
  onChanged: () => void;
}

const SOURCE_LABEL: Record<string, string> = { UPLOAD: "Uploaded", DRIVE_SCAN: "Google Drive" };
const CLASSIFICATION_LABEL: Record<string, string> = {
  REAL_PERSON: "Verified portrait",
  PROFILE_CARD: "Profile card",
  ORGANIZATION: "Organization chart",
  MAP: "Map",
  DOCUMENT: "Document",
  UNKNOWN: "Not reviewed",
};

export function PortraitHistoryPanel({ officerId, name, onClose, onChanged }: PortraitHistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait/history`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load history (${res.status}).`);
        const body = (await res.json()) as { data: HistoryEntry[] };
        if (!cancelled) setEntries(body.data);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load history."));
    return () => {
      cancelled = true;
    };
  }, [officerId]);

  async function setAsCurrent(id: number) {
    setSettingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait/history/${id}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Failed to set as current (${res.status}).`);
      }
      setEntries((prev) => prev?.map((e) => ({ ...e, isProfile: e.id === id })) ?? prev);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set as current.");
    } finally {
      setSettingId(null);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Portrait history of ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-neutral-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Portrait History — {name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-border/40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <p className="mb-3 flex items-center gap-1 text-xs text-serious" role="alert">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          {entries === null ? (
            <div className="flex items-center justify-center py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No portraits yet for this officer.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-neutral-bg/40 p-2.5"
                >
                  {/* Part 4 — Portrait History uses the same circular avatar
                      style as Official Portrait (Phase 30.2 history-fix). */}
                  <OfficerPhoto
                    thumbnailUrl={entry.thumbnailUrl}
                    name={name}
                    size={AVATAR_SIZE.MD}
                    enableViewer={false}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}</span>
                      {entry.isProfile ? <Badge>Current</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {CLASSIFICATION_LABEL[entry.classification] ?? entry.classification} · {new Date(entry.updatedAt).toLocaleDateString()}
                    </p>
                    <p className="truncate text-[11px] text-muted" title={entry.driveFileId}>
                      {entry.driveFileId}
                    </p>
                  </div>

                  {!entry.isProfile ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={settingId !== null}
                      onClick={() => setAsCurrent(entry.id)}
                    >
                      {settingId === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Set as Current
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
