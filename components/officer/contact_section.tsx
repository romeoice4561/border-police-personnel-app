/**
 * ContactSection (Phase 21A — Editable Profile Foundation, Part 10).
 *
 * Read-only contact details. Phone comes from existing persisted data
 * (officer.phone + related Phone rows); email/LINE/Facebook/address have no
 * backing data source yet and always render "—" — never invented. Edit is
 * disabled (handled by EditableSectionCard).
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";

function ContactField({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

export function ContactSection({ officer }: { officer: OfficerWithRelations }) {
  const extraPhones = officer.phones.map((p) => p.number).filter((n) => n && n !== officer.phone);
  const phoneDisplay = [officer.phone, ...extraPhones].filter(Boolean).join(", ") || null;

  return (
    <EditableSectionCard title="Contact">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ContactField label="Phone" value={phoneDisplay} />
        {/* Email/LINE/Facebook/Address: no data source yet — architecture only (Part 10). */}
        <ContactField label="Email" value={null} />
        <ContactField label="LINE" value={null} />
        <ContactField label="Facebook" value={null} />
        <ContactField label="Address" value={null} />
      </dl>
    </EditableSectionCard>
  );
}
