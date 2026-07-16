/**
 * WorkspaceBreadcrumb (Phase 48A — Enterprise Workspace Foundation).
 *
 * A simple, reusable breadcrumb trail for the top of a workspace page. Pure
 * presentation — the caller supplies the trail (no route-inference magic),
 * so it works the same for Server and Client page components. The final
 * (current-page) crumb renders as plain text; earlier crumbs are links when
 * they carry an `href`.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export interface WorkspaceBreadcrumbItem {
  label: string;
  href?: string;
}

export function WorkspaceBreadcrumb({ items, className }: { items: WorkspaceBreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-xs text-muted", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 text-muted/60" aria-hidden="true" /> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-foreground" : undefined} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
