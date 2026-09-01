/**
 * Canonical Drug Intelligence entity visual language.
 * Shared icon mapping for Relationship Search (and safe reuse by Network).
 * Icons supplement Thai labels — never replace them.
 */
"use client";

import { createElement } from "react";
import {
  Car,
  CreditCard,
  FileSpreadsheet,
  Fingerprint,
  Link2,
  MapPin,
  Phone,
  Search,
  Shield,
  Smartphone,
  User,
  type LucideIcon,
} from "lucide-react";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNodeType, DrugSearchMatchedField } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/ui/cn";

/** Authoritative entity → Lucide icon map (matches Network legend / graph nodes). */
export const DRUG_ENTITY_ICON: Record<DrugGraphNodeType, LucideIcon> = {
  PERSON: User,
  PHONE: Phone,
  SIM: CreditCard,
  DEVICE: Smartphone,
  VEHICLE: Car,
  CASE: FileSpreadsheet,
  LOCATION: MapPin,
};

export const DRUG_ENTITY_TYPES: DrugGraphNodeType[] = [
  "PERSON",
  "PHONE",
  "SIM",
  "DEVICE",
  "VEHICLE",
  "CASE",
  "LOCATION",
];

export function drugEntityIcon(type: DrugGraphNodeType): LucideIcon {
  return DRUG_ENTITY_ICON[type] ?? FileSpreadsheet;
}

export function drugEntityTypeLabelKey(type: DrugGraphNodeType): TranslationKey {
  return DRUG_GRAPH_NODE_TYPE_LABEL_KEY[type];
}

/** Icon for the "ค้นจาก" column — field-aware without inventing new entity types. */
export function searchedFromIcon(matchedField: DrugSearchMatchedField | undefined): LucideIcon {
  switch (matchedField) {
    case "PRIMARY_NAME":
    case "ALIAS":
      return User;
    case "IDENTIFIER":
      return Fingerprint;
    case "PHONE_NUMBER":
      return Phone;
    case "ICCID":
    case "IMSI":
      return CreditCard;
    case "IMEI":
    case "SERIAL_NUMBER":
      return Smartphone;
    case "REGISTRATION_NUMBER":
    case "VIN":
      return Car;
    case "CASE_NUMBER":
    case "CASE_TITLE":
      return FileSpreadsheet;
    default:
      return Search;
  }
}

export type DrugEntityIconSize = "sm" | "md" | "lg";

const SIZE_SHELL: Record<DrugEntityIconSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-11 w-11 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
};

const SIZE_ICON: Record<DrugEntityIconSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

/**
 * Neutral entity icon container — type is shown by glyph + adjacent Thai label,
 * not by rainbow entity colors.
 */
export function DrugEntityIconMark({
  type,
  size = "md",
  className,
  icon,
}: {
  type?: DrugGraphNodeType;
  size?: DrugEntityIconSize;
  className?: string;
  /** Override when the glyph is field-specific (e.g. identifier fingerprint). */
  icon?: LucideIcon;
}) {
  const glyph = icon ?? (type ? drugEntityIcon(type) : Search);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-border bg-neutral-bg text-foreground",
        SIZE_SHELL[size],
        className
      )}
      aria-hidden="true"
      data-entity-type={type ?? "generic"}
      data-testid="drug-entity-icon"
    >
      {createElement(glyph, { className: SIZE_ICON[size], "aria-hidden": true })}
    </span>
  );
}

/** Compact type chip: icon + mandatory Thai/EN label. */
export function DrugEntityTypeChip({
  type,
  label,
  className,
}: {
  type: DrugGraphNodeType;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-foreground",
        className
      )}
      data-testid="drug-entity-type-chip"
      data-entity-type={type}
    >
      {createElement(drugEntityIcon(type), { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true })}
      <span>{label}</span>
    </span>
  );
}

export const DRUG_RELATION_STEP_ICON: LucideIcon = Link2;
export const DRUG_EVIDENCE_SECTION_ICON: LucideIcon = Shield;
