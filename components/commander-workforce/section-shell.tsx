import type { ReactNode } from "react";
import { WorkspaceSection } from "@/components/workspace/workspace_section";
import { cn } from "@/lib/ui/cn";

export function SectionShell({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <WorkspaceSection title={title} description={description} actions={actions} className={cn("min-w-0", className)}>
      <div id={id} className="min-w-0">
        {children}
      </div>
    </WorkspaceSection>
  );
}
