/**
 * MembershipFinancialSection — read-only Membership & Financial display.
 *
 * Salary area uses a calculation summary + SalaryUtilizationGauge (shared
 * math via computeSalaryUtilization). Bank fields stay outside the chart.
 *
 * cooperativeMonthlyDeduction is retained as the persisted field name for
 * backward compatibility; its current business meaning is total monthly
 * deductions.
 */
"use client";

import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { SalaryUtilizationGauge } from "@/components/officer/salary_utilization_gauge";
import { BilingualLabel } from "@/components/ui/bilingual_label";
import { useBilingualText, useT } from "@/components/i18n/language_provider";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { moneyFieldToNumber } from "@/lib/officer_profile/money_draft";
import { formatMoneyTh, formatMoneyEn } from "@/lib/officer_profile/money_format";
import { computeSalaryUtilization } from "@/lib/officer_profile/salary_utilization";
import { TRI_STATE_LABELS, booleanToTriState } from "@/lib/officer_profile/tri_state";

function Field({ labelKey, value }: { labelKey: keyof typeof FIELD_LABELS; value: string | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <BilingualLabel text={FIELD_LABELS[labelKey]} className="text-xs uppercase tracking-wide text-muted" />
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  prefix,
  emphasize,
}: {
  label: string;
  value: string;
  prefix?: "+" | "−";
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${emphasize ? "pt-2 text-sm font-semibold text-foreground" : "text-sm text-foreground"}`}
    >
      <span className={emphasize ? "text-foreground" : "text-muted"}>
        {prefix ? <span className="mr-1 tabular-nums text-muted">{prefix}</span> : null}
        {label}
      </span>
      <span className={`shrink-0 tabular-nums ${emphasize ? "text-base font-semibold text-foreground" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

export interface MembershipFinancialSectionProps {
  officer: OfficerWithRelations;
}

export function MembershipFinancialSection({ officer }: MembershipFinancialSectionProps) {
  const render = useBilingualText();
  const { t } = useT();

  const hasAnyMembershipField =
    officer.isGpfMember != null ||
    officer.isPoliceFuneralWelfareMember != null ||
    officer.isCooperativeMember != null ||
    (officer.cooperativeName != null && officer.cooperativeName !== "");
  const hasAnySalaryBankField =
    officer.salaryLevel != null ||
    officer.currentSalaryStep != null ||
    officer.currentSalary != null ||
    officer.otherSpecialAllowances != null ||
    officer.cooperativeMonthlyDeduction != null ||
    officer.netSalary != null ||
    officer.bankName != null ||
    (officer.bankAccountNumber != null && officer.bankAccountNumber !== "");

  if (!hasAnyMembershipField && !hasAnySalaryBankField) return null;

  // Already masked at the server boundary (redactOfficerForClient) — never re-masked or unmasked here.
  const bankAccountDisplay = officer.bankAccountNumber != null && officer.bankAccountNumber !== "" ? officer.bankAccountNumber : null;

  function membershipDisplay(value: boolean | null | undefined): string {
    return render(TRI_STATE_LABELS[booleanToTriState(value)]);
  }

  function moneyDisplay(amount: unknown): string | null {
    const n = moneyFieldToNumber(amount);
    if (n == null) return null;
    return render({ th: formatMoneyTh(n), en: formatMoneyEn(n) });
  }

  function optionalMoneyOrNone(
    amount: unknown,
    noneKey: "officer.otherSpecialAllowancesNone" | "officer.cooperativeDeductionNone"
  ): string {
    if (amount == null) return t(noneKey);
    return moneyDisplay(amount) ?? t(noneKey);
  }

  const util = computeSalaryUtilization({
    baseSalary: officer.currentSalary,
    specialAllowances: officer.otherSpecialAllowances,
    totalDeductions: officer.cooperativeMonthlyDeduction,
  });

  const hasSalaryCalculation =
    officer.currentSalary != null ||
    officer.otherSpecialAllowances != null ||
    officer.cooperativeMonthlyDeduction != null ||
    officer.netSalary != null;

  return (
    <EditableSectionCard title={render(FIELD_LABELS.membershipAndFinancialSection)}>
      <div className="space-y-5">
        {hasAnyMembershipField ? (
          <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-accent">{render(FIELD_LABELS.membershipGroup)}</h3>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field labelKey="isGpfMember" value={membershipDisplay(officer.isGpfMember)} />
              <Field labelKey="isPoliceFuneralWelfareMember" value={membershipDisplay(officer.isPoliceFuneralWelfareMember)} />
              <Field labelKey="isCooperativeMember" value={membershipDisplay(officer.isCooperativeMember)} />
              {officer.isCooperativeMember ? <Field labelKey="cooperativeName" value={officer.cooperativeName} /> : null}
            </dl>
          </div>
        ) : null}

        {hasAnySalaryBankField ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">{render(FIELD_LABELS.salaryAndBankGroup)}</h3>
            <p className="mb-3 text-xs text-muted">{t("officer.salaryFormulaHelper")}</p>

            <dl className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field labelKey="salaryLevel" value={officer.salaryLevel} />
              <Field labelKey="currentSalaryStep" value={officer.currentSalaryStep} />
            </dl>

            {hasSalaryCalculation ? (
              <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border/70 bg-surface/40 px-3 py-3">
                  <SummaryRow
                    label={render(FIELD_LABELS.currentSalary)}
                    value={moneyDisplay(officer.currentSalary) ?? "—"}
                  />
                  <SummaryRow
                    prefix="+"
                    label={render(FIELD_LABELS.otherSpecialAllowances)}
                    value={optionalMoneyOrNone(officer.otherSpecialAllowances, "officer.otherSpecialAllowancesNone")}
                  />
                  <div className="border-t border-border/60 pt-2">
                    <SummaryRow
                      label={render(FIELD_LABELS.totalMonthlyIncome)}
                      value={
                        util.totalMonthlyIncome > 0 || officer.currentSalary != null || officer.otherSpecialAllowances != null
                          ? (moneyDisplay(util.totalMonthlyIncome) ?? "—")
                          : "—"
                      }
                    />
                  </div>
                  <SummaryRow
                    prefix="−"
                    label={render(FIELD_LABELS.cooperativeMonthlyDeduction)}
                    value={optionalMoneyOrNone(officer.cooperativeMonthlyDeduction, "officer.cooperativeDeductionNone")}
                  />
                  <div className="border-t border-border pt-2">
                    <SummaryRow
                      emphasize
                      label={render(FIELD_LABELS.netSalary)}
                      value={moneyDisplay(officer.netSalary ?? util.remainingNetSalary) ?? "—"}
                    />
                  </div>
                </div>

                <div className="flex justify-center md:justify-end">
                  <SalaryUtilizationGauge
                    baseSalary={officer.currentSalary}
                    specialAllowances={officer.otherSpecialAllowances}
                    totalDeductions={officer.cooperativeMonthlyDeduction}
                    netSalary={officer.netSalary}
                  />
                </div>
              </div>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field labelKey="bankName" value={officer.bankName} />
              <Field labelKey="bankAccountNumber" value={bankAccountDisplay} />
            </dl>
          </div>
        ) : null}
      </div>
    </EditableSectionCard>
  );
}
