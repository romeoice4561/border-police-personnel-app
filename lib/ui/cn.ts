/**
 * `cn` — className merge helper (Phase 14 UI).
 *
 * Combines clsx (conditional class composition) with tailwind-merge (last
 * Tailwind utility wins on conflicts), the standard shadcn/ui convention.
 * Pure; no side effects.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
