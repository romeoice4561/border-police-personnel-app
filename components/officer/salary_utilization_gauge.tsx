/**
 * Compact semicircle showing remaining net salary (green) vs total
 * deductions (red) as shares of total monthly income. Presentation only —
 * percentages come exclusively from computeSalaryUtilization.
 */
"use client";

import { useId } from "react";
import { useT } from "@/components/i18n/language_provider";
import { formatMoneyTh } from "@/lib/officer_profile/money_format";
import {
  computeSalaryUtilization,
  formatUtilizationPercent,
  type SalaryUtilizationInput,
} from "@/lib/officer_profile/salary_utilization";

export interface SalaryUtilizationGaugeProps extends SalaryUtilizationInput {
  /** Smaller chart for the edit-mode live preview. */
  compact?: boolean;
  className?: string;
}

const CX = 100;
const CY = 96;
const R = 72;
const STROKE = 14;

/** Semicircle left → right through the top. pathLength=100 maps 1 unit = 1%. */
const ARC_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

export function SalaryUtilizationGauge({
  baseSalary,
  specialAllowances,
  totalDeductions,
  netSalary,
  compact = false,
  className,
}: SalaryUtilizationGaugeProps) {
  const { t } = useT();
  const uid = useId();
  const util = computeSalaryUtilization({ baseSalary, specialAllowances, totalDeductions, netSalary });

  const expensePct = util.expensePercentage;
  const remainingPct = util.remainingPercentage;
  // Percentage POINTS from computeSalaryUtilization only — append "%" once, never ×100.
  const expenseLabel = formatUtilizationPercent(expensePct);
  const remainingLabel = formatUtilizationPercent(remainingPct);
  const remainingLegend = `${remainingLabel}%`;

  const ariaLabel = util.isEmpty
    ? t("officer.salaryGaugeEmpty")
    : t("officer.salaryGaugeAria")
        .replace("{income}", formatMoneyTh(util.totalMonthlyIncome))
        .replace("{expenses}", formatMoneyTh(util.totalMonthlyExpenses))
        .replace("{expensePct}", expenseLabel)
        .replace("{net}", formatMoneyTh(util.remainingNetSalary))
        .replace("{remainingPct}", remainingLabel);

  const sizeClass = compact ? "max-w-[200px]" : "max-w-[260px]";

  return (
    <div className={`mx-auto w-full ${sizeClass} ${className ?? ""}`} role="img" aria-label={ariaLabel}>
      <div className="relative">
        <svg viewBox="0 0 200 118" className="h-auto w-full" aria-hidden="true">
          {/* Neutral track — pathLength 100 so dash lengths are literal percents */}
          <path
            d={ARC_PATH}
            pathLength={100}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {!util.isEmpty ? (
            <>
              {expensePct > 0 ? (
                <path
                  d={ARC_PATH}
                  pathLength={100}
                  fill="none"
                  stroke="var(--serious)"
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  strokeDasharray={`${expensePct} ${100 - expensePct}`}
                  strokeDashoffset={0}
                />
              ) : null}
              {remainingPct > 0 ? (
                <path
                  d={ARC_PATH}
                  pathLength={100}
                  fill="none"
                  stroke="var(--good)"
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  strokeDasharray={`${remainingPct} ${100 - remainingPct}`}
                  strokeDashoffset={-expensePct}
                />
              ) : null}
            </>
          ) : null}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-2 pb-0.5 text-center">
          {util.isEmpty ? (
            <p className={`font-medium text-muted ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>
              {t("officer.salaryGaugeEmpty")}
            </p>
          ) : (
            <>
              <p className={`font-medium text-muted ${compact ? "text-[10px]" : "text-xs"}`}>
                {t("officer.salaryGaugeNetLabel")}
              </p>
              <p
                className={`font-semibold tabular-nums text-foreground ${compact ? "text-sm" : "text-base"}`}
                id={`${uid}-net`}
              >
                {formatMoneyTh(util.remainingNetSalary)}
              </p>
              <p className={`whitespace-nowrap tabular-nums text-muted ${compact ? "text-[10px]" : "text-xs"}`}>
                {remainingLegend}
              </p>
            </>
          )}
        </div>
      </div>

      {!util.isEmpty ? (
        <ul
          className={`mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-foreground ${compact ? "text-[10px]" : "text-xs"}`}
          data-testid="salary-utilization-legend"
        >
          <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-good" aria-hidden="true" />
            <span data-testid="salary-gauge-remaining-pct">
              {t("officer.salaryGaugeLegendRemaining").replace("{pct}", remainingLabel)}
            </span>
          </li>
          <li className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-serious" aria-hidden="true" />
            <span data-testid="salary-gauge-expense-pct">
              {t("officer.salaryGaugeLegendExpenses").replace("{pct}", expenseLabel)}
            </span>
          </li>
        </ul>
      ) : null}

      <p className="sr-only">{ariaLabel}</p>
    </div>
  );
}
