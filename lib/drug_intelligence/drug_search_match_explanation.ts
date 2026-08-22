/**
 * Search match-field → Thai/English explanation labels (Phase DI-3, Section
 * 18). Pure lookup — the backend's `matchedField` already names exactly
 * what matched; this module only supplies display text, never re-derives
 * the match itself (Section 18: never an unexplained relevance score).
 */

import type { DrugSearchMatchedField } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const DRUG_SEARCH_MATCHED_FIELD_LABEL_KEY: Record<DrugSearchMatchedField, TranslationKey> = {
  PRIMARY_NAME: "di.search.matchPrimaryName",
  ALIAS: "di.search.matchAlias",
  IDENTIFIER: "di.search.matchIdentifier",
  PHONE_NUMBER: "di.search.matchPhone",
  ICCID: "di.search.matchIccid",
  IMSI: "di.search.matchImsi",
  IMEI: "di.search.matchImei",
  SERIAL_NUMBER: "di.search.matchSerial",
  REGISTRATION_NUMBER: "di.search.matchRegistration",
  VIN: "di.search.matchVin",
  CASE_NUMBER: "di.search.matchCaseNumber",
  CASE_TITLE: "di.search.matchCaseTitle",
};
