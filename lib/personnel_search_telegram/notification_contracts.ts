/**
 * Proactive notification contracts (Phase 51.4).
 * Contracts only — no scheduling, no background jobs, no delivery pipeline.
 */

export const COMMANDER_NOTIFICATION_EVENT_TYPES = [
  "PROMOTION_READY",
  "RETIREMENT_WINDOW",
  "DOCUMENT_EXPIRING",
  "TRAINING_EXPIRING",
  "BIRTHDAY",
  "TRANSFER",
] as const;

export type CommanderNotificationEventType = (typeof COMMANDER_NOTIFICATION_EVENT_TYPES)[number];

export type CommanderNotificationSeverity = "info" | "attention" | "urgent";

/**
 * Reusable notification envelope for a future delivery channel (Telegram / Web / etc.).
 * Payload holds only safe presentation refs — never full personnel records.
 */
export interface CommanderNotificationContract {
  /** Stable contract version for future producers/consumers. */
  schemaVersion: 1;
  eventType: CommanderNotificationEventType;
  severity: CommanderNotificationSeverity;
  /** Short Thai title for a push / bot message. */
  titleTh: string;
  /** One-line Thai body. */
  bodyTh: string;
  /** Optional public unit code or officer id display (opaque to Telegram). */
  subjectRef?: {
    kind: "officer" | "company" | "division" | "region";
    /** Public code or officerId — never internal DB FK semantics. */
    id: string;
    labelTh?: string;
  };
  /** Suggested Personnel Search API query the client may run (presentation hint). */
  suggestedQuery?: string;
  /** ISO timestamp when the event was observed / would be sent. */
  occurredAtIso: string;
  /** Channel-agnostic tags for filtering. */
  tags?: string[];
}

export function isCommanderNotificationEventType(value: string): value is CommanderNotificationEventType {
  return (COMMANDER_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

/** Factory helpers — produce contracts only; do not send. */
export function buildNotificationContract(
  partial: Omit<CommanderNotificationContract, "schemaVersion">
): CommanderNotificationContract {
  return { schemaVersion: 1, ...partial };
}

export const NOTIFICATION_EVENT_LABEL_TH: Record<CommanderNotificationEventType, string> = {
  PROMOTION_READY: "พร้อมเลื่อนตำแหน่ง",
  RETIREMENT_WINDOW: "ใกล้เกษียณ",
  DOCUMENT_EXPIRING: "เอกสารใกล้หมดอายุ",
  TRAINING_EXPIRING: "หลักสูตรใกล้หมดอายุ",
  BIRTHDAY: "วันเกิด",
  TRANSFER: "โยกย้าย",
};
