/**
 * DocumentsSection (Phase 21A — Editable Profile Foundation, Part 5).
 *
 * Architecture + UI only: five document categories (Official Portrait, GP7,
 * Appointment Orders, Certificates, Other Documents), each rendered as a
 * "Coming Soon" card. No upload, no storage, no API — this only prepares the
 * layout for a future Documents module.
 */
import { FileText, IdCard, ScrollText, Award, FolderOpen } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { EditableSectionCard } from "@/components/officer/editable_section_card";

interface DocumentCategory {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: "officialPortrait", label: "Official Portrait", icon: IdCard },
  { id: "gp7", label: "GP7", icon: FileText },
  { id: "appointmentOrders", label: "Appointment Orders", icon: ScrollText },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "otherDocuments", label: "Other Documents", icon: FolderOpen },
];

export function DocumentsSection() {
  return (
    <EditableSectionCard title="Documents" comingSoon>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_CATEGORIES.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-neutral-bg/40 px-4 py-6 text-center"
          >
            <Icon className="h-6 w-6 text-muted" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs text-muted">Coming Soon</span>
          </div>
        ))}
      </div>
    </EditableSectionCard>
  );
}
