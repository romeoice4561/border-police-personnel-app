/**
 * DocumentsSection (Phase 29A — Officer Document Vault Foundation).
 *
 * Replaces the Phase 21A / 26B placeholder. Shows every official document
 * associated with an officer, organised by document type, with full action
 * buttons (Upload works; Replace/Download/History/Delete are disabled in
 * this phase per spec — buttons are visible but disabled).
 *
 * Layout mirrors the Salary History and Career Timeline sections:
 * an EditableSectionCard with a table-style list inside.
 *
 * Actions per document row:
 *   Upload   — POST /api/officers/{id}/documents (fully functional)
 *   Preview  — opens fileUrl in a new tab (fully functional; placeholder
 *               if fileUrl is null)
 *   Replace  — disabled (future phase)
 *   Download — disabled (future phase)
 *   History  — disabled (future phase)
 *   Delete   — disabled (future phase)
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Eye,
  RefreshCw,
  Download,
  History,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import { getDocumentTypes, findDocumentType } from "@/lib/document/document_types";
import { ALLOWED_DOCUMENT_MIME, MAX_DOCUMENT_BYTES } from "@/lib/document/document_validation";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ACCEPT = Object.keys(ALLOWED_DOCUMENT_MIME).join(",");

export interface DocumentsSectionProps {
  officerId: string;
  documents: OfficerDocument[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(doc: OfficerDocument | null) {
  if (!doc) {
    return (
      <Badge tone="default">
        <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
        ยังไม่มี
      </Badge>
    );
  }
  if (doc.verifiedAt) {
    return (
      <Badge tone="good">
        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
        ตรวจแล้ว
      </Badge>
    );
  }
  return (
    <Badge tone="default">
      <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
      รอตรวจ
    </Badge>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

interface DocumentRowProps {
  officerId: string;
  typeCode: string;
  doc: OfficerDocument | null;
  onUploaded: () => void;
}

function DocumentRow({ officerId, typeCode, doc, onUploaded }: DocumentRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = findDocumentType(typeCode);
  const labelEn = def?.labelEn ?? typeCode;
  const labelTh = def?.labelTh ?? typeCode;

  const handleFileSelected = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_DOCUMENT_MIME[file.type]) {
        setError("Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.");
        return;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`File too large. Maximum ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.`);
        return;
      }

      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("documentType", typeCode);
        form.append("title", labelEn);
        const res = await fetch(
          `/api/officers/${encodeURIComponent(officerId)}/documents`,
          { method: "POST", body: form }
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
        }
        onUploaded();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [officerId, typeCode, labelEn, onUploaded]
  );

  return (
    <li className="rounded-lg border border-border bg-neutral-bg p-3">
      {/* Document type header */}
      <div className="mb-2 flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{labelEn}</p>
          <p className="text-xs text-muted">{labelTh}</p>
        </div>
        <div className="shrink-0">{statusBadge(doc)}</div>
      </div>

      {/* Document metadata (when a file exists) */}
      {doc ? (
        <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-3">
          <span>
            <span className="font-medium text-foreground">อัพโหลด:</span> {formatDate(doc.uploadedAt)}
          </span>
          <span>
            <span className="font-medium text-foreground">เวอร์ชัน:</span> {doc.version}
          </span>
          {doc.originalFilename ? (
            <span className="truncate">
              <span className="font-medium text-foreground">ไฟล์:</span> {doc.originalFilename}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <p className="mb-2 flex items-center gap-1 text-xs text-serious" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Upload (or Replace when a doc exists) — fully functional */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          aria-label={doc ? `Replace ${labelEn}` : `Upload ${labelEn}`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : doc ? (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {doc ? "Replace" : "Upload"}
        </Button>

        {/* Preview — opens fileUrl; disabled when no file */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc?.fileUrl}
          onClick={() => {
            if (doc?.fileUrl) window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
          }}
          aria-label={`Preview ${labelEn}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Preview
        </Button>

        {/* Download — disabled in this phase */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          aria-label={`Download ${labelEn}`}
          title="Coming in a future phase"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </Button>

        {/* History — disabled in this phase */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          aria-label={`History for ${labelEn}`}
          title="Coming in a future phase"
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          History
        </Button>

        {/* Delete — disabled in this phase */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          aria-label={`Delete ${labelEn}`}
          title="Coming in a future phase"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
          e.target.value = "";
        }}
      />
    </li>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function DocumentsSection({ officerId, documents }: DocumentsSectionProps) {
  const router = useRouter();

  const onUploaded = useCallback(() => {
    router.refresh();
  }, [router]);

  const documentTypes = getDocumentTypes();

  // Build a lookup of the most recent active document per type.
  const activeByType = new Map<string, OfficerDocument>();
  for (const doc of documents) {
    if (doc.isActive) {
      const existing = activeByType.get(doc.documentType);
      if (!existing || doc.version > existing.version) {
        activeByType.set(doc.documentType, doc);
      }
    }
  }

  // Also collect any active documents whose type is not in the built-in registry
  // (unknown/future types) so they still appear.
  const unknownTypeCodes = new Set<string>();
  for (const doc of documents) {
    if (doc.isActive && !documentTypes.find((t) => t.code === doc.documentType)) {
      unknownTypeCodes.add(doc.documentType);
    }
  }

  const uploadedCount = activeByType.size;
  const totalTypes = documentTypes.length + unknownTypeCodes.size;

  return (
    <EditableSectionCard
      title={`เอกสารประจำตัว / Officer Documents (${uploadedCount}/${totalTypes})`}
    >
      <ul className="space-y-3">
        {documentTypes.map((typeDef) => (
          <DocumentRow
            key={typeDef.code}
            officerId={officerId}
            typeCode={typeDef.code}
            doc={activeByType.get(typeDef.code) ?? null}
            onUploaded={onUploaded}
          />
        ))}

        {/* Unknown/custom types stored in DB but not yet in registry */}
        {[...unknownTypeCodes].map((code) => (
          <DocumentRow
            key={code}
            officerId={officerId}
            typeCode={code}
            doc={activeByType.get(code) ?? null}
            onUploaded={onUploaded}
          />
        ))}
      </ul>
    </EditableSectionCard>
  );
}
