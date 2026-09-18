"use client";

import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { DRUG_ENTITY_ICON } from "@/components/drug_intelligence/drug_entity_visual";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";

const SIZE_CLASS = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  search: "h-11 w-11",
  graph: "h-12 w-12",
  md: "h-14 w-14",
  graphCard: "h-14 w-14",
  graphFocus: "h-14 w-14",
  graphCardFocus: "h-[72px] w-[72px]",
  lg: "h-24 w-24",
  portrait: "h-[136px] w-[136px]",
} as const;

export type DrugEntityVisualThumbSize = keyof typeof SIZE_CLASS;

export function DrugEntityVisualThumb({
  entityType,
  label,
  thumbnailUrl,
  size = "sm",
  rounded,
  className,
}: {
  entityType: DrugGraphNodeType | string;
  label: string;
  thumbnailUrl?: string | null;
  size?: DrugEntityVisualThumbSize;
  rounded?: "full" | "md";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const radius = rounded ?? (entityType === "PERSON" ? "full" : "md");
  const showPhoto = Boolean(thumbnailUrl) && !failed;
  const portrait = size === "portrait" || size === "lg";
  const FallbackIcon = DRUG_ENTITY_ICON[(entityType as DrugGraphNodeType)] ?? DRUG_ENTITY_ICON.PERSON;
  const fallbackIconClass =
    size === "portrait" ? "h-14 w-14" : size === "lg" || size === "graphFocus" || size === "graphCardFocus" || size === "graphCard" || size === "md" ? "h-6 w-6" : "h-4 w-4";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-neutral-bg text-muted",
        SIZE_CLASS[size],
        radius === "full" ? "rounded-full" : "rounded-md",
        portrait || size === "graph" || size === "graphFocus" || size === "graphCard" || size === "graphCardFocus" || size === "search"
          ? "border-2 border-border shadow-sm ring-1 ring-black/10 dark:ring-white/20"
          : "border border-border",
        className
      )}
      data-testid="entity-visual-thumb"
      data-thumb-size={size}
      aria-hidden={!showPhoto}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <FallbackIcon className={fallbackIconClass} aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
