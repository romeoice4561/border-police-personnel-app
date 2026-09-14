/**
 * Same-route Network control updates (depth, view, filters) must change the
 * query string without scrolling the browser page to the top.
 * Real route changes (profile, case, sidebar) keep default scroll behavior.
 */

export const NETWORK_SAME_ROUTE_PATH = "/drug-intelligence/network";

export const NETWORK_SAME_ROUTE_ROUTER_OPTIONS = { scroll: false } as const;

export function buildNetworkSameRouteHref(params: URLSearchParams | string): string {
  const query = typeof params === "string" ? params : params.toString();
  return query ? `${NETWORK_SAME_ROUTE_PATH}?${query}` : NETWORK_SAME_ROUTE_PATH;
}

export function applyNetworkSearchParamPatch(
  current: URLSearchParams,
  patch: Record<string, string | undefined>
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.delete("boardId");
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next;
}
