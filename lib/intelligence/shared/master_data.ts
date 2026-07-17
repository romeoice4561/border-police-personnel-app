/**
 * OfficerMasterData — the Master Data layer's public shape (Phase 40A
 * foundation, Task 3).
 *
 * ONLY factual, persisted data: identity, current assignment, contact,
 * personal information, and the raw relation arrays (timeline, salary
 * history, documents, education, training, skills). Never a calculated
 * value — no retirement age, no promotion eligibility, no years-in-position,
 * no years-of-service, no document score. Those belong to the Intelligence
 * Engine (lib/intelligence/{retirement,age,service,promotion,salary,
 * document}) and are composed separately as OfficerIntelligence.
 *
 * `toOfficerMasterData` is a pure, lossless PROJECTION of OfficerWithRelations
 * — it does not fetch, does not calculate, and drops nothing that is factual.
 * The one existing stored field that reads as "calculated" — Officer.
 * careerYears — is intentionally OMITTED here: it is a legacy stored column
 * superseded by the Service Engine's live calculation (lib/intelligence/
 * service, calculateCareerYearsSimple) and documented as a known
 * data-model tension in docs/Personnel_Intelligence_Architecture.md, not
 * something this phase silently re-exposes as "master data".
 *
 * Note on "service start date": the schema has NO stored
 * serviceStartDate/governmentServiceStartDate column on Officer — there is
 * only the raw `timeline` array below, which IS the factual source. The
 * Service Intelligence facade (lib/intelligence/service, via
 * firstServiceLikeDate) derives "earliest service-like date" FROM this
 * timeline at read time; that derivation is calculated data and stays out
 * of this type. If a real serviceStartDate column is ever added to the
 * schema, it belongs here as a plain field — it does not exist today, so
 * it is not fabricated here.
 */

import type {
  OfficerWithRelations,
  Timeline,
  Phone,
  Education,
  Training,
  SalaryHistory,
  OfficerDocument,
  OfficerSkillWithRelations,
} from "@/lib/database/query_types";

export interface OfficerMasterData {
  id: number;
  officerId: string;

  rank: string;
  firstName: string;
  lastName: string;
  currentPosition: string | null;
  currentUnit: string | null;
  region: string | null;

  phone: string | null;
  email: string | null;
  lineId: string | null;
  facebookUrl: string | null;
  nickname: string | null;

  dateOfBirth: Date | null;
  bloodGroup: string | null;
  rh: string | null;
  maritalStatus: string | null;
  children: number | null;
  homeProvince: string | null;
  currentProvince: string | null;
  religion: string | null;
  nationality: string | null;
  educationLevel: string | null;

  thumbnailUrl: string | null;
  webViewUrl: string | null;

  timeline: Timeline[];
  phones: Phone[];
  education: Education[];
  training: Training[];
  salaryHistory: SalaryHistory[];
  documents: OfficerDocument[];
  skills: OfficerSkillWithRelations[];
}

/** Pure projection: OfficerWithRelations (full DB read shape) -> OfficerMasterData (factual-only view). No calculation, no I/O. */
export function toOfficerMasterData(officer: OfficerWithRelations): OfficerMasterData {
  return {
    id: officer.id,
    officerId: officer.officerId,

    rank: officer.rank,
    firstName: officer.firstName,
    lastName: officer.lastName,
    currentPosition: officer.currentPosition,
    currentUnit: officer.currentUnit,
    region: officer.region,

    phone: officer.phone,
    email: officer.email,
    lineId: officer.lineId,
    facebookUrl: officer.facebookUrl,
    nickname: officer.nickname,

    dateOfBirth: officer.dateOfBirth,
    bloodGroup: officer.bloodGroup,
    rh: officer.rh,
    maritalStatus: officer.maritalStatus,
    children: officer.children,
    homeProvince: officer.homeProvince,
    currentProvince: officer.currentProvince,
    religion: officer.religion,
    nationality: officer.nationality,
    educationLevel: officer.educationLevel,

    thumbnailUrl: officer.thumbnailUrl,
    webViewUrl: officer.webViewUrl,

    timeline: officer.timeline,
    phones: officer.phones,
    education: officer.education,
    training: officer.training,
    salaryHistory: officer.salaryHistory,
    documents: officer.documents,
    skills: officer.skills,
  };
}
