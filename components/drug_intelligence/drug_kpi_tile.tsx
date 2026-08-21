/**
 * DrugKpiTile (Phase DI-1 Round 2, Section 4).
 *
 * A single clickable KPI card — every landing-page/workspace KPI links
 * somewhere (Section 4: "KPI ทุกตัวที่มีหน้าปลายทางต้อง clickable"). Renders as
 * a Link when `href` is given, else a static Card (no dead click target).
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";

export function DrugKpiTile({
  label,
  value,
  icon: Icon,
  href,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <Card className={cn("flex items-center gap-3 px-4 py-4 transition-colors", (href || onClick) && "hover:border-accent/50 hover:bg-neutral-bg")}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold tabular-nums text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</span>
        <span className="block truncate text-xs text-muted">{label}</span>
      </span>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
        {content}
      </button>
    );
  }
  return content;
}
