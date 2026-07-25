/**
 * Compact Telegram callback_data codes (max 64 bytes) — Phase 51.2.
 */

export const CALLBACK = {
  HOME: "hm",
  MENU_SEARCH: "ms",
  MENU_UNIT: "mu",
  MENU_PROMOTION: "mp",
  MENU_RETIREMENT: "mr",
  MENU_TRAINING: "mt",
  MENU_DOCUMENTS: "md",
  MENU_DASHBOARD: "mdb",
  MENU_HELP: "mh",
  PAGE_NEXT: "nx",
  PAGE_PREV: "pv",
  /** Unbound UX — Phase 51.3 */
  BIND_CONNECT: "bc",
  BIND_HELP: "bh",
  BIND_ADMIN: "ba",
  /** Action by index from last result: ax:0 */
  action: (index: number) => `ax:${index}`,
  /** Clarification suggestion by index: cx:0 */
  clarify: (index: number) => `cx:${index}`,
  /** Disambiguation choice by index: dx:0 */
  disambiguate: (index: number) => `dx:${index}`,
} as const;

export type ParsedCallback =
  | { kind: "home" }
  | { kind: "menu"; menu: "search" | "unit" | "promotion" | "retirement" | "training" | "documents" | "dashboard" | "help" }
  | { kind: "page"; direction: "next" | "prev" }
  | { kind: "action"; index: number }
  | { kind: "clarify"; index: number }
  | { kind: "disambiguate"; index: number }
  | { kind: "bind"; action: "connect" | "help" | "admin" }
  | { kind: "unknown"; raw: string };

export function parseCallbackData(data: string | undefined): ParsedCallback {
  if (!data) return { kind: "unknown", raw: "" };
  switch (data) {
    case CALLBACK.HOME:
      return { kind: "home" };
    case CALLBACK.MENU_SEARCH:
      return { kind: "menu", menu: "search" };
    case CALLBACK.MENU_UNIT:
      return { kind: "menu", menu: "unit" };
    case CALLBACK.MENU_PROMOTION:
      return { kind: "menu", menu: "promotion" };
    case CALLBACK.MENU_RETIREMENT:
      return { kind: "menu", menu: "retirement" };
    case CALLBACK.MENU_TRAINING:
      return { kind: "menu", menu: "training" };
    case CALLBACK.MENU_DOCUMENTS:
      return { kind: "menu", menu: "documents" };
    case CALLBACK.MENU_DASHBOARD:
      return { kind: "menu", menu: "dashboard" };
    case CALLBACK.MENU_HELP:
      return { kind: "menu", menu: "help" };
    case CALLBACK.PAGE_NEXT:
      return { kind: "page", direction: "next" };
    case CALLBACK.PAGE_PREV:
      return { kind: "page", direction: "prev" };
    case CALLBACK.BIND_CONNECT:
      return { kind: "bind", action: "connect" };
    case CALLBACK.BIND_HELP:
      return { kind: "bind", action: "help" };
    case CALLBACK.BIND_ADMIN:
      return { kind: "bind", action: "admin" };
    default:
      break;
  }

  const action = data.match(/^ax:(\d+)$/);
  if (action) return { kind: "action", index: Number(action[1]) };

  const clarify = data.match(/^cx:(\d+)$/);
  if (clarify) return { kind: "clarify", index: Number(clarify[1]) };

  const disambiguate = data.match(/^dx:(\d+)$/);
  if (disambiguate) return { kind: "disambiguate", index: Number(disambiguate[1]) };

  return { kind: "unknown", raw: data };
}
