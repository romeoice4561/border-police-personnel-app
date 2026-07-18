/**
 * Training data-quality detection (Phase 45, Task 13).
 *
 * Read-only analysis over already-loaded training evidence — never deletes
 * or mutates a record. Returns flags a commander/data steward can act on.
 * Some checks are permanently inert against the current `Training` schema
 * (no certificateNumber/expiryDate/verified columns exist — see
 * docs/TRAINING_INTELLIGENCE.md) but are implemented and tested against the
 * TrainingRecordEvidence shape so they activate automatically if a future
 * schema change populates those fields, with no logic change needed here.
 *
 * Pure — no I/O, no React.
 */
import type { TrainingDataQualityFlag, TrainingRecordEvidence } from "@/lib/intelligence/training/types";

export function detectDataQualityFlags(evidence: readonly TrainingRecordEvidence[]): TrainingDataQualityFlag[] {
  const flags: TrainingDataQualityFlag[] = [];

  const missingCourseName = evidence.filter((record) => !record.courseName.trim());
  if (missingCourseName.length > 0) {
    flags.push({
      code: "MISSING_COURSE_NAME",
      recordIds: missingCourseName.map((r) => r.recordId),
      messageTh: "มีข้อมูลหลักสูตรที่ไม่ระบุชื่อหลักสูตร",
    });
  }

  const invalidDate = evidence.filter((record) => {
    const invalidCompletion = record.completionDate != null && Number.isNaN(new Date(`${record.completionDate}T00:00:00.000Z`).getTime());
    const invalidExpiry = record.expiryDate != null && Number.isNaN(new Date(`${record.expiryDate}T00:00:00.000Z`).getTime());
    return invalidCompletion || invalidExpiry;
  });
  if (invalidDate.length > 0) {
    flags.push({
      code: "INVALID_DATE",
      recordIds: invalidDate.map((r) => r.recordId),
      messageTh: "มีข้อมูลวันที่ของหลักสูตรที่ไม่ถูกต้อง",
    });
  }

  const completionAfterExpiry = evidence.filter(
    (record) => record.completionDate != null && record.expiryDate != null && record.completionDate > record.expiryDate
  );
  if (completionAfterExpiry.length > 0) {
    flags.push({
      code: "COMPLETION_AFTER_EXPIRY",
      recordIds: completionAfterExpiry.map((r) => r.recordId),
      messageTh: "วันที่สำเร็จการอบรมอยู่หลังวันหมดอายุของหลักสูตร",
    });
  }

  const certificateGroups = new Map<string, TrainingRecordEvidence[]>();
  for (const record of evidence) {
    if (!record.certificateNumber) continue;
    const group = certificateGroups.get(record.certificateNumber) ?? [];
    group.push(record);
    certificateGroups.set(record.certificateNumber, group);
  }
  const duplicateCertificates = [...certificateGroups.values()].filter((group) => group.length > 1);
  if (duplicateCertificates.length > 0) {
    flags.push({
      code: "DUPLICATE_CERTIFICATE_NUMBER",
      recordIds: duplicateCertificates.flatMap((group) => group.map((r) => r.recordId)),
      messageTh: "พบเลขที่ใบรับรองซ้ำกันในหลายรายการ",
    });
  }

  const courseDateGroups = new Map<string, TrainingRecordEvidence[]>();
  for (const record of evidence) {
    if (!record.normalizedCourseKey) continue;
    const key = `${record.normalizedCourseKey}::${record.completionDate ?? ""}::${record.provider ?? ""}`;
    const group = courseDateGroups.get(key) ?? [];
    group.push(record);
    courseDateGroups.set(key, group);
  }
  const duplicateCourseRecords = [...courseDateGroups.values()].filter((group) => group.length > 1);
  if (duplicateCourseRecords.length > 0) {
    flags.push({
      code: "DUPLICATE_COURSE_RECORD",
      recordIds: duplicateCourseRecords.flatMap((group) => group.map((r) => r.recordId)),
      messageTh: "พบข้อมูลหลักสูตรเดียวกันซ้ำกันในวันที่และหน่วยงานเดียวกัน",
    });
  }

  const unverified = evidence.filter((record) => record.verified === false);
  if (unverified.length > 0) {
    flags.push({
      code: "UNVERIFIED_RECORD",
      recordIds: unverified.map((r) => r.recordId),
      messageTh: "มีข้อมูลหลักสูตรที่ยังไม่ผ่านการตรวจสอบ",
    });
  }

  return flags;
}
