/**
 * Navigates via approved ViewModel drill-down hrefs only.
 */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { isApprovedWorkforceHref } from "@/lib/commander_workforce/drilldown";
import type { WorkforceDrilldownDescriptor } from "@/lib/commander_workforce/types";
import { cn } from "@/lib/ui/cn";

export function DrilldownLink({
  drilldown,
  children,
  className,
  ariaLabel,
}: {
  drilldown: WorkforceDrilldownDescriptor | null | undefined;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const href = drilldown?.relativeHref;
  if (!href || !isApprovedWorkforceHref(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
      aria-label={ariaLabel ?? `เปิดรายการ: ${drilldown.label}`}
      title={drilldown.label}
    >
      {children}
    </Link>
  );
}
