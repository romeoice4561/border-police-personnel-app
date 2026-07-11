/**
 * ContactSection (Phase 21A — Editable Profile Foundation, Part 10;
 * Phase 23A — real contact data + clickable links, Section 5; Phase 26B Part
 * 6 Part D — card layout polish + Emergency Contact).
 *
 * Read-only contact details, each rendered as a clickable action when
 * present: Phone -> tel:, Email -> mailto:, LINE -> line.me deep link,
 * Facebook -> the stored profile URL, Emergency Contact -> tel: on its own
 * phone number. A missing channel renders "—" (never invented). Edit is
 * handled by the workspace's global Edit Mode (see ProfileEditor/
 * PersonalInformationEditor, shown instead when editing).
 *
 * Phase 26B Part 6 Part D: no new "Website" column exists in the schema (see
 * AGENTS.md — additive-only migrations, and this phase's spec explicitly
 * scopes to UX/UI refinement, not new fields) — Facebook remains the one
 * social/web link field. Laid out as individual tiles (icon + label + value)
 * in a responsive grid rather than a plain 2-column <dl>, so each channel
 * reads as its own scannable unit.
 */
import { Phone as PhoneIcon, Mail, MessageCircle, Link2, UserRound } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";

function ContactTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof PhoneIcon;
  label: string;
  value: string | null;
  href: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-neutral-bg/40 p-3">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium wrap-break-word">
        {value && href ? (
          <a href={href} className="text-accent hover:underline">
            {value}
          </a>
        ) : (
          <span className="text-foreground">{value || "—"}</span>
        )}
      </dd>
    </div>
  );
}

export function ContactSection({ officer }: { officer: OfficerWithRelations }) {
  const extraPhones = officer.phones.map((p) => p.number).filter((n) => n && n !== officer.phone);
  const phoneDisplay = [officer.phone, ...extraPhones].filter(Boolean).join(", ") || null;
  const primaryPhone = officer.phone;

  return (
    <EditableSectionCard title="ติดต่อ / Contact">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ContactTile
          icon={PhoneIcon}
          label="Phone"
          value={phoneDisplay}
          href={primaryPhone ? `tel:${primaryPhone.replace(/[^0-9+]/g, "")}` : null}
        />
        <ContactTile icon={Mail} label="Email" value={officer.email} href={officer.email ? `mailto:${officer.email}` : null} />
        <ContactTile
          icon={MessageCircle}
          label="LINE"
          value={officer.lineId}
          href={officer.lineId ? `https://line.me/ti/p/~${encodeURIComponent(officer.lineId)}` : null}
        />
        <ContactTile icon={Link2} label="Facebook" value={officer.facebookUrl} href={officer.facebookUrl} />
        <ContactTile
          icon={UserRound}
          label="Emergency Contact"
          value={[officer.emergencyContact, officer.emergencyPhone].filter(Boolean).join(" — ") || null}
          href={officer.emergencyPhone ? `tel:${officer.emergencyPhone.replace(/[^0-9+]/g, "")}` : null}
        />
      </dl>
    </EditableSectionCard>
  );
}
