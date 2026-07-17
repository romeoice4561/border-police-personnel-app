/**
 * SidebarBrand (Phase 48A.1 — Official Border Patrol Police Branding).
 *
 * The fixed three-line brand lockup next to the official logo:
 *   ตำรวจตระเวนชายแดน
 *   Border Patrol Police
 *   Personnel Intelligence System
 *
 * Deliberately NOT run through the language dictionary/t() — this is an
 * official brand mark (like a logo's own wordmark), not translatable UI
 * copy, so it reads identically regardless of the active TH/EN toggle. The
 * logo itself (BppisLogo) is reused as-is; this component only supplies the
 * text lockup next to it.
 */
export function SidebarBrand({ compact }: { compact?: boolean }) {
  return (
    <span className={compact ? "block truncate text-sm font-semibold leading-tight" : "block min-w-0"}>
      <span className="block truncate text-sm font-semibold leading-tight text-foreground">ตำรวจตระเวนชายแดน</span>
      {!compact ? (
        <>
          <span className="block truncate text-xs font-medium leading-tight text-foreground">Border Patrol Police</span>
          <span className="block truncate text-[11px] leading-tight text-muted">Personnel Intelligence System</span>
        </>
      ) : null}
    </span>
  );
}
