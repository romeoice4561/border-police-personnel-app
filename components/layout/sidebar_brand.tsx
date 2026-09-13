/**
 * SidebarBrand — C-INTEL product lockup with Border Patrol Police as the
 * organization line. Official BPP emblem is a separate mark (BppisLogo).
 *
 * Product subtitle is two explicit lines so Thai wrapping cannot split
 * "ยาเสพติด". Not run through t() — this is a brand mark, not UI copy.
 */
export function SidebarBrand({ compact }: { compact?: boolean }) {
  return (
    <span className={compact ? "block min-w-0 truncate" : "block min-w-0"}>
      <span className="block truncate text-sm font-semibold leading-tight tracking-wide text-foreground">C-INTEL</span>
      {!compact ? (
        <>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">ระบบฐานข้อมูลกำลังพล</span>
          <span className="block whitespace-nowrap text-[11px] leading-snug text-muted">
            และเครือข่าย<span className="whitespace-nowrap">ยาเสพติด</span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted">ตำรวจตระเวนชายแดน</span>
        </>
      ) : null}
    </span>
  );
}
