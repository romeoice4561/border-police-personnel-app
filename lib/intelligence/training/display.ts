/**
 * Training Intelligence Thai display labels (Phase 45, Task 7).
 *
 * The ONE place TrainingStatus/TrainingRequirementStatus Thai text is
 * defined — Dashboard, Commander Search, and Officer Workspace all import
 * from here so the same status always renders the same words.
 */
import type { TrainingRequirementStatus, TrainingStatus } from "@/lib/intelligence/training/types";

export const TRAINING_STATUS_DISPLAY_TH: Record<TrainingStatus, string> = {
  Complete: "หลักสูตรครบตามนโยบาย",
  MissingRequired: "ขาดหลักสูตรที่จำเป็น",
  ExpiringSoon: "มีหลักสูตรใกล้หมดอายุ",
  Expired: "มีหลักสูตรหมดอายุ",
  Unverified: "มีข้อมูลหลักสูตรที่ยังไม่ผ่านการตรวจสอบ",
  NoPolicy: "ยังไม่ได้กำหนดนโยบายหลักสูตร",
  NoData: "ยังไม่มีข้อมูลการฝึกอบรม",
  Unknown: "ยังไม่สามารถวิเคราะห์ได้",
};

export const TRAINING_REQUIREMENT_STATUS_DISPLAY_TH: Record<TrainingRequirementStatus, string> = {
  Completed: "ผ่านการอบรมแล้ว",
  Missing: "ยังไม่ผ่านการอบรม",
  ExpiringSoon: "ใกล้หมดอายุ",
  Expired: "หมดอายุแล้ว",
  Unverified: "ยังไม่ตรวจสอบ",
  Unknown: "ไม่สามารถประเมินได้",
};
