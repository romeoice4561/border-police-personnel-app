/**
 * Shared form-field primitives for the Create Case flow (Phase DI-1 Round
 * 2; DI-7.1: added HelperText for UX guidance).
 * Mirrors profile_editor.tsx's `inputCls`/`Field` convention exactly so
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

/** DI-7.1: non-intrusive helper text shown below a field — same styling as
 *  `text-xs text-muted` used by placeholder text in Personnel profile fields. */
export function HelperText({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}
