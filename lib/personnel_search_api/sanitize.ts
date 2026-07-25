/**
 * Response sanitizer — validates deep links and redacts audit query text.
 */
import type { PersonnelSearchResult, SearchAction } from "@/lib/personnel_search/contracts";
import { APPROVED_ACTION_PATH_PREFIXES } from "@/lib/personnel_search_api/contracts";
import { hashQueryForAudit } from "@/lib/personnel_search_api/audit";

const SENSITIVE_KEYS = /nationalId|citizenId|bank|password|pin|medical|homeAddress|salary|passport/i;

function isApprovedHref(href: unknown): href is string {
  if (typeof href !== "string" || !href.startsWith("/")) return false;
  if (href.startsWith("//") || href.includes("://")) return false;
  return APPROVED_ACTION_PATH_PREFIXES.some((prefix) => href === prefix || href.startsWith(prefix));
}

function sanitizeAction(action: SearchAction): SearchAction {
  const payload: SearchAction["payload"] = {};
  for (const [key, value] of Object.entries(action.payload)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (key === "href" || key.endsWith("Href")) {
      if (isApprovedHref(value)) payload[key] = value;
      continue;
    }
    payload[key] = value;
  }
  return { ...action, payload };
}

function scrubObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubObject);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(k)) continue;
      out[k] = scrubObject(v);
    }
    return out;
  }
  return value;
}

/** Sanitized gateway result safe for HTTP clients. */
export function sanitizePersonnelSearchResult(result: PersonnelSearchResult): PersonnelSearchResult {
  const scrubbed = scrubObject(result) as PersonnelSearchResult;
  return {
    ...scrubbed,
    actions: (scrubbed.actions ?? []).map(sanitizeAction),
    items: (scrubbed.items ?? []).map((item) => {
      if (item.kind === "person" && item.links) {
        return {
          ...item,
          links: {
            profileHref: isApprovedHref(item.links.profileHref) ? item.links.profileHref : "",
            promotionHref:
              item.links.promotionHref && isApprovedHref(item.links.promotionHref)
                ? item.links.promotionHref
                : null,
          },
        };
      }
      return item;
    }),
    audit: {
      ...scrubbed.audit,
      // Never return the raw query on the wire — hash only.
      query: hashQueryForAudit(result.audit.query),
    },
  };
}
