/**
 * Person Intelligence — relationship explanation presentation.
 * Lightweight visual chains only — no React Flow.
 */
"use client";

import type { ReactNode } from "react";
import {
  Link2,
  User,
  FolderOpen,
  Phone,
  Smartphone,
  Car,
  MapPin,
  Waypoints,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import type {
  ImportantConnectionItem,
  RelationshipEntityKind,
  RelationshipExplanationModel,
  RelationshipPathNode,
  RelationshipPathStep,
} from "@/lib/drug_intelligence/drug_person_relationship_explain";

function KindIcon({ kind, className }: { kind: RelationshipEntityKind; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0", className);
  switch (kind) {
    case "PERSON":
      return <User className={cls} aria-hidden="true" />;
    case "CASE":
      return <FolderOpen className={cls} aria-hidden="true" />;
    case "PHONE":
      return <Phone className={cls} aria-hidden="true" />;
    case "SIM":
    case "DEVICE":
      return <Smartphone className={cls} aria-hidden="true" />;
    case "VEHICLE":
      return <Car className={cls} aria-hidden="true" />;
    case "LOCATION":
      return <MapPin className={cls} aria-hidden="true" />;
    case "ROLE":
      return <Shield className={cls} aria-hidden="true" />;
    case "NETWORK_ROLE":
    case "NETWORK_GROUP":
      return <Waypoints className={cls} aria-hidden="true" />;
    default:
      return <Link2 className={cls} aria-hidden="true" />;
  }
}

function EntityNode({ node }: { node: RelationshipPathNode }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold text-foreground shadow-sm"
      data-testid="relationship-node"
      data-kind={node.kind}
    >
      <KindIcon kind={node.kind} className="text-accent" />
      <span className="truncate">{node.label}</span>
    </span>
  );
}

function VerbBridge({ verb }: { verb: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1 text-[11px] font-medium text-muted" data-testid="relationship-verb">
      <span className="hidden sm:inline">─</span>
      <span className="whitespace-nowrap">{verb}</span>
      <ArrowRight className="hidden h-3 w-3 sm:inline" aria-hidden="true" />
      <ArrowDown className="h-3 w-3 sm:hidden" aria-hidden="true" />
    </span>
  );
}

/** Horizontal on wider cards; stacks vertically on narrow/mobile. */
export function RelationshipPath({ steps, className }: { steps: RelationshipPathStep[]; className?: string }) {
  if (steps.length === 0) return null;
  const nodes: RelationshipPathNode[] = [steps[0]!.from, ...steps.map((s) => s.to)];
  const verbs = steps.map((s) => s.verb);

  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-2",
        className,
      )}
      data-testid="relationship-path"
    >
      {nodes.map((node, index) => (
        <div key={`${node.kind}-${node.label}-${index}`} className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-1">
          {index > 0 ? <VerbBridge verb={verbs[index - 1]!} /> : null}
          <EntityNode node={node} />
        </div>
      ))}
    </div>
  );
}

export function RelationshipExplanation({
  model,
  className,
  children,
}: {
  model: RelationshipExplanationModel;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useT();
  const title =
    model.titleKey === "whyRole" ? t("di.profile.whyThisRole") : t("di.profile.howRelated");
  const hasPath = model.path.length > 0;

  return (
    <div
      className={cn("mt-2 rounded-lg border border-border bg-neutral-bg/35 px-2.5 py-2.5", className)}
      data-testid="relationship-explanation"
      data-has-path={hasPath ? "true" : "false"}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </p>
      {/* Path is primary; headline only when there is no chain (avoids duplicate wording). */}
      {hasPath ? <RelationshipPath steps={model.path} /> : null}
      {!hasPath && model.headline ? (
        <p className="text-sm font-medium text-foreground" data-testid="relationship-headline">
          {model.headline}
        </p>
      ) : null}
      {model.caseChips.length > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-muted" data-testid="relationship-case-chips">
          {model.caseChips.join(" · ")}
        </p>
      ) : null}
      {model.sourceCaseLabels.length > 0 ? (
        <div className="mt-2" data-testid="relationship-source-cases">
          <p className="text-[11px] font-semibold text-accent">{t("di.profile.foundInSourceCase")}</p>
          <p className="mt-0.5 text-xs text-foreground">
            {model.sourceCaseLabels.map((label) => `📁 ${label}`).join(" · ")}
          </p>
        </div>
      ) : null}
      {model.discoveredCaseLabels.length > 0 ? (
        <div className="mt-2" data-testid="relationship-discovered-cases">
          <p className="text-[11px] font-semibold text-muted">{t("di.profile.foundRepeatedIn")}</p>
          <p className="mt-0.5 text-xs text-foreground">
            {model.discoveredCaseLabels.map((label) => `📁 ${label}`).join(" · ")}
          </p>
        </div>
      ) : null}
      {model.coAppearancePhones.length > 0 ? (
        <div className="mt-2 rounded-md border border-border bg-surface/80 px-2 py-1.5" data-testid="relationship-coappearance">
          <p className="text-[11px] font-medium text-muted">{t("di.profile.coAppearingPhones")}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-foreground">
            {model.coAppearancePhones.map((phone) => (
              <li key={phone}>• {phone}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {model.facts.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          {model.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}
      {model.insight ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            <span className="font-medium">{t("di.profile.connectionInsight")}: </span>
            {model.insight}
          </span>
        </p>
      ) : null}
      {model.caution ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden="true" />
          {model.caution}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function ImportantConnections({
  items,
  className,
  titleKey = "di.profile.importantConnections",
}: {
  items: ImportantConnectionItem[];
  className?: string;
  titleKey?: "di.profile.importantConnections" | "di.profile.rolesFoundHeading";
}) {
  const { t } = useT();
  if (items.length === 0) return null;
  const compactRoles = titleKey === "di.profile.rolesFoundHeading";
  return (
    <section
      className={cn(
        "space-y-2 rounded-xl border border-border bg-surface",
        compactRoles ? "p-3" : "p-3 sm:p-4",
        compactRoles && items.length === 1 && "w-fit max-w-full",
        compactRoles && items.length === 2 && "w-full max-w-3xl",
        className,
      )}
      data-testid="important-connections"
      data-title-key={titleKey}
      data-item-count={String(items.length)}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Link2 className="h-4 w-4 text-accent" aria-hidden="true" />
        {t(titleKey)}
      </h2>
      <ul
        className={cn(
          "grid gap-2",
          items.length === 1
            ? "grid-cols-1"
            : items.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        )}
        data-testid="important-connections-grid"
      >
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-neutral-bg/50 px-3 py-2.5"
            data-testid="important-connection-card"
          >
            <KindIcon kind={item.kind} className="mb-1.5 text-accent" />
            <p className="truncate text-sm font-semibold text-foreground">{item.primaryLabel}</p>
            <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
