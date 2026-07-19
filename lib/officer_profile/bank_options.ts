/**
 * Bank name Combobox suggestions (Phase 45.1 UX refinement pass, Task 1).
 *
 * Curated suggestions only — matches the same "preserve free legacy value,
 * never a forced closed set" convention as Rank/Position/Religion (see
 * religion_options.ts). The Combobox this feeds always accepts free text;
 * an existing custom bank name saved before this list existed is never
 * silently replaced or rejected.
 */
export const BANK_OPTIONS = [
  "ธนาคารกรุงไทย",
  "ธนาคารกรุงเทพ",
  "ธนาคารกสิกรไทย",
  "ธนาคารไทยพาณิชย์",
  "ธนาคารกรุงศรีอยุธยา",
  "ธนาคารทหารไทยธนชาต (ttb)",
  "ธนาคารออมสิน",
  "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
  "ธนาคารอาคารสงเคราะห์",
  "ธนาคารยูโอบี",
  "ธนาคารซีไอเอ็มบีไทย",
  "LH Bank",
  "ICBC",
  "อื่น ๆ",
] as const;
