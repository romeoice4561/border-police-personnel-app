/**
 * DI-9.4.3A: sidebar pending-navigation highlight helper.
 *
 * Pure pathname/href logic so click feedback can light the destination
 * before App Router soft navigation finishes updating usePathname().
 */
export function isNavItemHighlighted(pathname: string, href: string, pendingHref: string | null): boolean {
  if (pendingHref === href) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
