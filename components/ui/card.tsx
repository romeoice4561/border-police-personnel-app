/** Card surface primitive (Phase 14 UI). Simple bordered surface used across the dashboard. */
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ children, className, ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-b border-border px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-base font-semibold text-foreground", className)} {...props}>
      {children}
    </h2>
  );
}

export function CardBody({ children, className, ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}
