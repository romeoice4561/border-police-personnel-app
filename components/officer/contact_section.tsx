/**
 * ContactSection (Phase 21A — Editable Profile Foundation, Part 10;
 * Phase 23A — real contact data + clickable links, Section 5).
 *
 * Read-only contact details, each rendered as a clickable action when
 * present: Phone -> tel:, Email -> mailto:, LINE -> line.me deep link,
 * Facebook -> the stored profile URL. A missing channel renders "—" (never
 * invented). Edit is handled by the workspace's global Edit Mode (see
 * ContactEditor, shown instead when editing).
 */
import { Phone as PhoneIcon, Mail, MessageCircle, Link2 } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";

function ContactLink({
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
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">
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
    <EditableSectionCard title="Contact">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ContactLink
          icon={PhoneIcon}
          label="Phone"
          value={phoneDisplay}
          href={primaryPhone ? `tel:${primaryPhone.replace(/[^0-9+]/g, "")}` : null}
        />
        <ContactLink icon={Mail} label="Email" value={officer.email} href={officer.email ? `mailto:${officer.email}` : null} />
        <ContactLink
          icon={MessageCircle}
          label="LINE"
          value={officer.lineId}
          href={officer.lineId ? `https://line.me/ti/p/~${encodeURIComponent(officer.lineId)}` : null}
        />
        <ContactLink icon={Link2} label="Facebook" value={officer.facebookUrl} href={officer.facebookUrl} />
      </dl>
    </EditableSectionCard>
  );
}
