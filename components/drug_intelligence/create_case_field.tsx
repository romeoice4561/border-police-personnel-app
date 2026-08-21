/**
 * Shared form-field primitives for the Create Case flow (Phase DI-1 Round
 * 2). Mirrors profile_editor.tsx's `inputCls`/`Field` convention exactly so
 * this module's forms are visually indistinguishable from Personnel's.
 */
import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function Field({ label, htmlFor, required, children }: { label: string; htmlFor?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-critical">*</span> : null}
      </label>
      {children}
    </div>
  );
}
