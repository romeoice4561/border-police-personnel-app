/**
 * Compact Telegram callback_data codes (max 64 bytes) — Phase 51.2 / 51.4.
 */

export const CALLBACK = {
  HOME: "hm",
  MENU_SEARCH: "ms",
  MENU_UNIT: "mu",
  MENU_PROMOTION: "mp",
  MENU_RETIREMENT: "mr",
  MENU_TRAINING: "mt",
  MENU_DOCUMENTS: "md",
  MENU_QUALITY: "mq",
  MENU_DASHBOARD: "mdb",
  MENU_HELP: "mh",
  MENU_FAVORITES: "mf",
  MENU_RECENT: "mrc",
  MENU_SETTINGS: "mst",
  MENU_QUICK: "mqk",
  PAGE_NEXT: "nx",
  PAGE_PREV: "pv",
  /** Unbound UX — Phase 51.3 */
  BIND_CONNECT: "bc",
  BIND_HELP: "bh",
  BIND_ADMIN: "ba",
  /** Quick actions — Phase 51.4 */
  QUICK_PROMOTION: "qp",
  QUICK_RETIREMENT: "qr",
  QUICK_TRAINING: "qt",
  QUICK_DOCUMENTS: "qd",
  QUICK_QUALITY: "qq",
  QUICK_MY_COMPANY: "qc",
  QUICK_MY_DIVISION: "qv",
  QUICK_MY_REGION: "qg",
  /** Favorite current unit/person */
  FAV_ADD_UNIT: "fa",
  FAV_ADD_PERSON: "fp",
  /** Action by index from last result: ax:0 */
  action: (index: number) => `ax:${index}`,
  /** Clarification suggestion by index: cx:0 */
  clarify: (index: number) => `cx:${index}`,
  /** Disambiguation choice by index: dx:0 */
  disambiguate: (index: number) => `dx:${index}`,
  favoriteOpen: (index: number) => `fo:${index}`,
  favoriteRemove: (index: number) => `fx:${index}`,
  recentOpen: (index: number) => `ro:${index}`,
  /** Phase DI-4: enter Drug Intelligence mode from the home menu. */
  MENU_DRUG: "mdi",
  /** Phase DI-4: open a Drug search result by its index in session.lastDrugResults. */
  drugOpen: (index: number) => `dg:${index}`,
  /** Phase DI-4: page a single-entity-type Drug drill-down. */
  drugPage: (direction: "next" | "prev") => `dp:${direction === "next" ? "n" : "p"}`,
  /** Phase DI-4: drill into one group's full "ดูทั้งหมด" list from the grouped overview. */
  drugGroup: (entityType: "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE") => `dv:${entityType}`,
} as const;

export type ParsedCallback =
  | { kind: "home" }
  | {
      kind: "menu";
      menu:
        | "search"
        | "unit"
        | "promotion"
        | "retirement"
        | "training"
        | "documents"
        | "quality"
        | "dashboard"
        | "help"
        | "favorites"
        | "recent"
        | "settings"
        | "quick";
    }
  | { kind: "page"; direction: "next" | "prev" }
  | { kind: "action"; index: number }
  | { kind: "clarify"; index: number }
  | { kind: "disambiguate"; index: number }
  | { kind: "bind"; action: "connect" | "help" | "admin" }
  | {
      kind: "quick";
      action:
        | "promotion"
        | "retirement"
        | "training"
        | "documents"
        | "quality"
        | "my_company"
        | "my_division"
        | "my_region";
    }
  | { kind: "fav_add"; target: "unit" | "person" }
  | { kind: "favorite_open"; index: number }
  | { kind: "favorite_remove"; index: number }
  | { kind: "recent_open"; index: number }
  /** Phase DI-4 */
  | { kind: "drug_menu" }
  | { kind: "drug_open"; index: number }
  | { kind: "drug_page"; direction: "next" | "prev" }
  | { kind: "drug_group"; entityType: "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE" }
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
    case CALLBACK.MENU_QUALITY:
      return { kind: "menu", menu: "quality" };
    case CALLBACK.MENU_DASHBOARD:
      return { kind: "menu", menu: "dashboard" };
    case CALLBACK.MENU_HELP:
      return { kind: "menu", menu: "help" };
    case CALLBACK.MENU_FAVORITES:
      return { kind: "menu", menu: "favorites" };
    case CALLBACK.MENU_RECENT:
      return { kind: "menu", menu: "recent" };
    case CALLBACK.MENU_SETTINGS:
      return { kind: "menu", menu: "settings" };
    case CALLBACK.MENU_QUICK:
      return { kind: "menu", menu: "quick" };
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
    case CALLBACK.QUICK_PROMOTION:
      return { kind: "quick", action: "promotion" };
    case CALLBACK.QUICK_RETIREMENT:
      return { kind: "quick", action: "retirement" };
    case CALLBACK.QUICK_TRAINING:
      return { kind: "quick", action: "training" };
    case CALLBACK.QUICK_DOCUMENTS:
      return { kind: "quick", action: "documents" };
    case CALLBACK.QUICK_QUALITY:
      return { kind: "quick", action: "quality" };
    case CALLBACK.QUICK_MY_COMPANY:
      return { kind: "quick", action: "my_company" };
    case CALLBACK.QUICK_MY_DIVISION:
      return { kind: "quick", action: "my_division" };
    case CALLBACK.QUICK_MY_REGION:
      return { kind: "quick", action: "my_region" };
    case CALLBACK.FAV_ADD_UNIT:
      return { kind: "fav_add", target: "unit" };
    case CALLBACK.FAV_ADD_PERSON:
      return { kind: "fav_add", target: "person" };
    case CALLBACK.MENU_DRUG:
      return { kind: "drug_menu" };
    default:
      break;
  }

  const action = data.match(/^ax:(\d+)$/);
  if (action) return { kind: "action", index: Number(action[1]) };

  const clarify = data.match(/^cx:(\d+)$/);
  if (clarify) return { kind: "clarify", index: Number(clarify[1]) };

  const disambiguate = data.match(/^dx:(\d+)$/);
  if (disambiguate) return { kind: "disambiguate", index: Number(disambiguate[1]) };

  const favOpen = data.match(/^fo:(\d+)$/);
  if (favOpen) return { kind: "favorite_open", index: Number(favOpen[1]) };

  const favRemove = data.match(/^fx:(\d+)$/);
  if (favRemove) return { kind: "favorite_remove", index: Number(favRemove[1]) };

  const recentOpen = data.match(/^ro:(\d+)$/);
  if (recentOpen) return { kind: "recent_open", index: Number(recentOpen[1]) };

  const drugOpen = data.match(/^dg:(\d+)$/);
  if (drugOpen) return { kind: "drug_open", index: Number(drugOpen[1]) };

  const drugPage = data.match(/^dp:(n|p)$/);
  if (drugPage) return { kind: "drug_page", direction: drugPage[1] === "n" ? "next" : "prev" };

  const drugGroup = data.match(/^dv:(PERSON|PHONE|SIM|DEVICE|VEHICLE|CASE)$/);
  if (drugGroup) return { kind: "drug_group", entityType: drugGroup[1] as "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "CASE" };

  return { kind: "unknown", raw: data };
}
