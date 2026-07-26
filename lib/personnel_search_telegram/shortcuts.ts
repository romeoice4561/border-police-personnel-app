/**
 * Telegram command shortcuts (Phase 51.4).
 * Presentation mapping → existing Personnel Search API queries only.
 */

import { COMMANDER_QUERIES, unitLookupQuery } from "@/lib/personnel_search_telegram/commander_queries";

export type ParsedShortcut =
  | { kind: "query"; query: string; labelTh: string }
  | { kind: "home" }
  | { kind: "dashboard" }
  | { kind: "favorites" }
  | { kind: "recent" }
  | { kind: "settings" }
  | { kind: "none" };

/**
 * Parse slash commands such as /414, /promotion, /retirement.
 * Bare numeric codes after / are treated as unit lookups.
 */
export function parseCommanderShortcut(text: string): ParsedShortcut {
  const trimmed = text.trim();
  const m = trimmed.match(/^\/([^\s@]+)(?:@\S+)?(?:\s+(.*))?$/i);
  if (!m) return { kind: "none" };

  const cmd = m[1].toLowerCase();
  const rest = (m[2] ?? "").trim();

  switch (cmd) {
    case "start":
    case "menu":
    case "home":
      return { kind: "home" };
    case "promotion":
    case "promo":
      return { kind: "query", query: COMMANDER_QUERIES.promotion, labelTh: "เลื่อนตำแหน่ง" };
    case "retirement":
    case "retire":
      return { kind: "query", query: COMMANDER_QUERIES.retirement, labelTh: "เกษียณ" };
    case "training":
      return { kind: "query", query: COMMANDER_QUERIES.training, labelTh: "หลักสูตร" };
    case "documents":
    case "docs":
      return { kind: "query", query: COMMANDER_QUERIES.documents, labelTh: "เอกสาร" };
    case "quality":
    case "data":
      return { kind: "query", query: COMMANDER_QUERIES.dataQuality, labelTh: "คุณภาพข้อมูล" };
    case "dashboard":
    case "dash":
      return { kind: "dashboard" };
    case "favorites":
    case "fav":
      return { kind: "favorites" };
    case "recent":
      return { kind: "recent" };
    case "settings":
    case "setting":
      return { kind: "settings" };
    case "help":
      return { kind: "query", query: COMMANDER_QUERIES.help, labelTh: "วิธีใช้งาน" };
    case "search":
      if (rest) return { kind: "query", query: rest, labelTh: rest };
      return { kind: "none" };
    default:
      break;
  }

  // /414 /41 /4 — unit public codes
  if (/^\d{1,4}$/.test(cmd)) {
    const query = unitLookupQuery(cmd);
    return { kind: "query", query, labelTh: `หน่วย ${cmd}` };
  }

  return { kind: "none" };
}
