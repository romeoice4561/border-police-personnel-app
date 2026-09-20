/**
 * Compact Case Intelligence Summary for the Case Workspace overview.
 * Answers "what / where / who / what seized / connectivity" at a glance.
 * Uses only fields already on DrugCaseDetailResponse — no invented facts.
 */
"use client";

import {
  Users,
  Phone,
  Smartphone,
  Car,
  Package,
  MapPin,
  FolderOpen,
  Network,
} from "lucide-react";
import {
  IntelligenceSection,
  IntelligenceStat,
} from "@/components/drug_intelligence/drug_person_workspace_cards";
import { useT } from "@/components/i18n/language_provider";
import { formatThaiOperationalDateWithClock } from "@/lib/drug_intelligence/di_date_helpers";
import type { DrugCaseDetailResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { cn } from "@/lib/ui/cn";

type TabKey =
  | "overview"
  | "media"
  | "persons"
  | "phones"
  | "devices"
  | "vehicles"
  | "seized"
  | "locations"
  | "analyst-notes"
  | "investigation-tasks"
  | "notes";

export function DrugCaseIntelligenceSummary({
  data,
  onOpenTab,
  className,
}: {
  data: DrugCaseDetailResponse;
  onOpenTab: (tab: TabKey) => void;
  className?: string;
}) {
  const { t } = useT();
  const c = data.case;
  const arrest = c.arrestDate ? formatThaiOperationalDateWithClock(c.arrestDate, c.arrestTime) : "—";
  const place = [c.province, c.district, c.subdistrict].filter(Boolean).join(" · ") || "—";
  const personPreview = data.persons
    .slice(0, 3)
    .map((p) => p.person?.primaryFullName)
    .filter((name): name is string => Boolean(name));
  const seizedPreview = data.seizedItems
    .slice(0, 3)
    .map((item) => item.drugType)
    .filter((name): name is string => Boolean(name));
  const phoneCount = data.phoneCount + data.simCount;

  return (
    <div data-testid="case-intelligence-summary" className={cn(className)}>
    <IntelligenceSection
      title={t("di.workspace.intelligenceSummary")}
      icon={<FolderOpen className="h-4 w-4 text-accent" aria-hidden="true" />}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="case-intelligence-facts">
        <Fact label={t("di.field.arrestDate")} value={arrest} />
        <Fact label={t("di.field.province")} value={place} />
        <Fact label={t("di.field.reportingUnit")} value={c.reportingUnitText || "—"} />
        <Fact label={t("di.review.leadUnitLabel")} value={c.leadUnitText || "—"} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="case-intelligence-stats">
        <button type="button" className="text-left" onClick={() => onOpenTab("persons")}>
          <IntelligenceStat icon={<Users className="h-4 w-4" />} label={t("di.workspace.kpiPersons")} value={data.personCount} />
        </button>
        <button type="button" className="text-left" onClick={() => onOpenTab("phones")}>
          <IntelligenceStat icon={<Phone className="h-4 w-4" />} label={t("di.workspace.kpiPhones")} value={phoneCount} />
        </button>
        <button type="button" className="text-left" onClick={() => onOpenTab("devices")}>
          <IntelligenceStat icon={<Smartphone className="h-4 w-4" />} label={t("di.workspace.kpiDevices")} value={data.deviceCount} />
        </button>
        <button type="button" className="text-left" onClick={() => onOpenTab("vehicles")}>
          <IntelligenceStat icon={<Car className="h-4 w-4" />} label={t("di.workspace.kpiVehicles")} value={data.vehicleCount} />
        </button>
        <button type="button" className="text-left" onClick={() => onOpenTab("seized")}>
          <IntelligenceStat icon={<Package className="h-4 w-4" />} label={t("di.workspace.kpiSeized")} value={data.seizedItemCount} />
        </button>
        <button type="button" className="text-left" onClick={() => onOpenTab("locations")}>
          <IntelligenceStat icon={<MapPin className="h-4 w-4" />} label={t("di.workspace.tabLocations")} value={data.locations.length} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <PreviewBlock
          title={t("di.workspace.kpiPersons")}
          empty={t("di.workspace.emptyPersonsCompact")}
          items={personPreview}
          more={Math.max(0, data.personCount - personPreview.length)}
          onMore={() => onOpenTab("persons")}
        />
        <PreviewBlock
          title={t("di.workspace.kpiSeized")}
          empty={t("di.workspace.emptySeizedCompact")}
          items={seizedPreview}
          more={Math.max(0, data.seizedItemCount - seizedPreview.length)}
          onMore={() => onOpenTab("seized")}
        />
      </div>

      {c.narrative ? (
        <div className="rounded-lg border border-border bg-neutral-bg/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("di.workspace.narrative")}</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-foreground">{c.narrative}</p>
        </div>
      ) : (
        <p className="text-xs text-muted">{t("di.workspace.emptyNarrative")}</p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Network className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("di.workspace.networkHint")}
      </p>
    </IntelligenceSection>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-neutral-bg/40 px-2.5 py-2">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

function PreviewBlock({
  title,
  empty,
  items,
  more,
  onMore,
}: {
  title: string;
  empty: string;
  items: string[];
  more: number;
  onMore: () => void;
}) {
  const { t } = useT();
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs text-muted">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5">{empty}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item} className="truncate">
            {item}
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <button type="button" onClick={onMore} className="mt-1 text-xs font-medium text-accent hover:underline">
          {t("di.workspace.viewMoreCount").replace("{count}", String(more))}
        </button>
      ) : null}
    </div>
  );
}
