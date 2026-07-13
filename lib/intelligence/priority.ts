import type { OfficerFlag, OfficerPriority } from "@/lib/intelligence/types";

export function scoreOfficerPriority(flags: readonly OfficerFlag[]): number {
  return flags.reduce((score, flag) => {
    switch (flag.severity) {
      case "critical":
        return score + 40;
      case "serious":
        return score + 25;
      case "warning":
        return score + 12;
      case "info":
        return score + 5;
      default:
        return score;
    }
  }, 0);
}

export function priorityFromScore(score: number): OfficerPriority {
  if (score >= 60) return "critical";
  if (score >= 35) return "high";
  if (score >= 15) return "medium";
  return "low";
}
