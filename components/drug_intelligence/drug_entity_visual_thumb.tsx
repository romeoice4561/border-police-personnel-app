"use client";

import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { DrugEntityIconMark } from "@/components/drug_intelligence/drug_entity_visual";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";

export function DrugEntityVisualThumb({
  entityType,
  label,
  thumbnailUrl,
  size = "sm",
  rounded,
}: {
  entityType: DrugGraphNodeType | string;
  label: string;
  thumbnailUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  rounded?: "full" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === "xs" ? "h-7 w-7" : size === "sm" ? "h-9 w-9" : size === "md" ? "h-14 w-14" : "h-24 w-24";
  const radius = rounded ?? (entityType === "PERSON" ? "full" : "md");
  const showPhoto = Boolean(thumbnailUrl) && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-neutral-bg",
        dim,
        radius === "full" ? "rounded-full" : "rounded-md"
      )}
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
        <DrugEntityIconMark type={entityType as DrugGraphNodeType} size={size === "lg" ? "lg" : "sm"} />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
