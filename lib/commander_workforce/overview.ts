/**
 * Personnel overview — counts existing officer fields only.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import { resolveOfficerPublicOrg } from "@/lib/commander_workforce/org";
import type {
  WorkforceMetric,
  WorkforceOrgPublicIndex,
  WorkforceOverviewSection,
} from "@/lib/commander_workforce/types";

function pct(n: number, d: number): number | null {
  if (d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function metric(
  key: string,
  labelTh: string,
  count: number,
  total: number,
  filters: Record<string, string | boolean> = {}
): WorkforceMetric {
  return {
    key,
    labelTh,
    count,
    percentage: pct(count, total),
    availability: { status: "available" },
    drilldown: buildWorkforceDrilldown({ id: key, label: labelTh, filters }),
  };
}

function groupMetrics(
  prefix: string,
  groups: Map<string, number>,
  total: number,
  filterKey: string,
  labels?: Readonly<Record<string, string>>
): WorkforceMetric[] {
  return [...groups.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
    .map(([value, count]) =>
      metric(`${prefix}:${value}`, labels?.[value] ?? value, count, total, { [filterKey]: value })
    );
}

export function buildOverviewSection(
  officers: readonly CommanderQueryOfficer[],
  orgPublicIndex: WorkforceOrgPublicIndex | undefined
): WorkforceOverviewSection {
  const total = officers.length;
  const knownRank = officers.filter((o) => o.rank && o.rank.trim() && o.rank !== "Unknown").length;
  const knownPosition = officers.filter((o) => Boolean(o.currentPosition)).length;
  const knownOrg = officers.filter(
    (o) => o.regionId != null || o.battalionId != null || o.companyId != null
  ).length;

  // Commissioned vs NCO is not a canonical personnel-category field — approximate
  // only when rank text clearly indicates; otherwise leave as available counts of known ranks.
  const commissioned = officers.filter((o) => /ว่าที่|ร\.ต\.|พ\.ต\.|น\.ต\.|พ\.อ\.|พ\.ต\.อ\.|พ\.ต\.ท\.|พ\.ต\.ต\.|ร\.ต\.อ\.|ร\.ต\.ท\.|ร\.ต\.ต\./.test(o.rank)).length;

  const byRegion = new Map<string, number>();
  const byDivision = new Map<string, number>();
  const byCompany = new Map<string, number>();
  const byRank = new Map<string, number>();
  const byLevel = new Map<string, number>();

  for (const officer of officers) {
    const org = resolveOfficerPublicOrg(officer, orgPublicIndex);
    if (org.regionPublicCode) byRegion.set(org.regionPublicCode, (byRegion.get(org.regionPublicCode) ?? 0) + 1);
    if (org.divisionPublicCode) {
      byDivision.set(org.divisionPublicCode, (byDivision.get(org.divisionPublicCode) ?? 0) + 1);
    }
    if (org.companyPublicCode) {
      byCompany.set(org.companyPublicCode, (byCompany.get(org.companyPublicCode) ?? 0) + 1);
    } else if (officer.companyLabel) {
      // Label-only fallback when public code missing — key prefixed to avoid colliding with codes.
      const key = `label:${officer.companyLabel}`;
      byCompany.set(key, (byCompany.get(key) ?? 0) + 1);
    }
    if (officer.rank) byRank.set(officer.rank, (byRank.get(officer.rank) ?? 0) + 1);
    const level = officer.positionLevel ?? "Unknown";
    byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
  }

  const metrics: WorkforceMetric[] = [
    metric("total_personnel", "กำลังพลทั้งหมด", total, total),
    metric("known_rank", "มียศที่ทราบ", knownRank, total),
    metric("known_position", "มีตำแหน่งที่ทราบ", knownPosition, total, {
      flagCode: "PROFILE_INCOMPLETE",
    }),
    metric("known_organization", "มีสังกัดองค์กร", knownOrg, total),
    {
      key: "commissioned_approx",
      labelTh: "ประมาณการนายตำรวจสัญญาบัตร (จากข้อความยศ)",
      count: commissioned,
      percentage: pct(commissioned, total),
      availability: { status: "available" },
      drilldown: null,
      descriptionTh: "ไม่ใช่ personnel category อย่างเป็นทางการ — ประมาณจากข้อความยศเท่านั้น",
    },
  ];

  return {
    metrics,
    byRegion: groupMetrics(
      "region",
      byRegion,
      total,
      "regionPublicCode",
      orgPublicIndex?.regionLabelByCode
    ),
    byDivision: groupMetrics(
      "division",
      byDivision,
      total,
      "divisionPublicCode",
      orgPublicIndex?.divisionLabelByCode
    ),
    byCompany: [...byCompany.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
      .map(([value, count]) => {
        const isLabel = value.startsWith("label:");
        const label = isLabel ? value.slice("label:".length) : orgPublicIndex?.companyLabelByCode?.[value] ?? value;
        return {
          key: `company:${value}`,
          labelTh: label,
          count,
          percentage: pct(count, total),
          availability: isLabel
            ? { status: "unavailable", reason: "INSUFFICIENT_DATA" }
            : { status: "available" },
          drilldown: isLabel
            ? null
            : buildWorkforceDrilldown({
                id: `company:${value}`,
                label,
                filters: { companyPublicCode: value },
              }),
          descriptionTh: isLabel ? "แสดงด้วยชื่อหน่วย — ยังไม่มีรหัสสาธารณะ" : undefined,
        };
      }),
    byRank: groupMetrics("rank", byRank, total, "rank"),
    byPositionLevel: groupMetrics("positionLevel", byLevel, total, "currentPositionLevel"),
    vacancy: {
      key: "vacancy_authorized_strength",
      labelTh: "อัตราว่าง / กำลังพลตามอัตรา",
      count: 0,
      percentage: null,
      availability: { status: "unavailable", reason: "SOURCE_NOT_IMPLEMENTED" },
      drilldown: null,
      descriptionTh: "ไม่มีแหล่งข้อมูล authorized-strength / vacancy ในระบบปัจจุบัน",
    },
    personnelCategory: {
      key: "personnel_category",
      labelTh: "ประเภทกำลังพล (สัญญาบัตร / ประทวน)",
      count: 0,
      percentage: null,
      availability: { status: "unavailable", reason: "NOT_APPLICABLE" },
      drilldown: null,
      descriptionTh: "ไม่มีฟิลด์ personnel category บน CommanderQueryOfficer",
    },
  };
}
