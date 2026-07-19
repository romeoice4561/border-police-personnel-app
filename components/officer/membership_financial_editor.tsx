/**
 * MembershipFinancialEditor (Phase 45.1 — Task 7; refinement pass — Parts
 * 1/4/5/6; cooperative monthly deduction).
 *
 * The editable "ข้อมูลสมาชิกและการเงิน" section: Academy Class dropdown,
 * three tri-state membership controls (GPF/Police Funeral Welfare/
 * Cooperative — เป็น/ไม่เป็น/ไม่ระบุ, never a plain checkbox that would
 * silently coerce "unknown" to false), Cooperative Name (enabled only when
 * Cooperative Member = เป็น), and the Salary/Bank group. Pure controlled
 * component over the ProfileDraft from useOfficerWorkspace — no fetching,
 * no save logic.
 *
 * Salary level/step/current-salary are Comboboxes (free-text + suggestions,
 * never a forced closed set — legacy/custom values always preserved). See
 * lib/officer_profile/salary_rate_options.ts's doc comment for why current
 * salary is CANDIDATE-assisted manual entry, never an auto-derived value —
 * no authoritative level->step->amount mapping exists in the source data.
 *
 * netSalary is read-only and live-calculated as
 * base + other special allowances − total expenses (server recalculates
 * on save; client value is not trusted).
 *
 * Bank account number is only editable when `canViewFinancial` is true —
 * matching the read-only section's masking rule so a user who can't SEE the
 * full number can't blind-overwrite it either.
 */
"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { BilingualLabel } from "@/components/ui/bilingual_label";
import { useBilingualText, useT } from "@/components/i18n/language_provider";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { TRI_STATE_OPTIONS, TRI_STATE_LABELS, type TriState } from "@/lib/officer_profile/tri_state";
import {
  SALARY_LEVEL_OPTIONS,
  SALARY_STEP_SCALE_OPTIONS,
  formatSalaryStepScale,
  candidateSalariesForStep,
  stepDisplayToKey,
  looksLikeFormattedMoney,
  parseFormattedMoneyDigits,
} from "@/lib/officer_profile/salary_rate_options";
import { formatMoneyTh, formatMoneyEn } from "@/lib/officer_profile/money_format";
import { parseMoneyDraft, sanitizeMoneyDraftInput } from "@/lib/officer_profile/money_draft";
import { displayNetSalary, isExpensesExceedingIncome } from "@/lib/officer_profile/net_salary";
import { BANK_OPTIONS } from "@/lib/officer_profile/bank_options";
import { SalaryUtilizationGauge } from "@/components/officer/salary_utilization_gauge";
import type { ProfileDraft } from "@/components/officer/use_officer_workspace";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const readOnlyInputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground";

function BilingualField({ labelKey, htmlFor, children }: { labelKey: keyof typeof FIELD_LABELS; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <BilingualLabel text={FIELD_LABELS[labelKey]} htmlFor={htmlFor} />
      {children}
    </div>
  );
}

export interface MembershipFinancialEditorProps {
  profile: ProfileDraft;
  onChange: (profile: ProfileDraft) => void;
  /** Phase 45.1 Task 14: bank account number is only editable to a viewer authorized to see it unmasked (see officer_workspace.tsx's canViewFinancial). */
  canViewFinancial: boolean;
  /**
   * Phase 45.1 hardening pass: true when the officer already has a bank
   * account number saved — `profile.bankAccountNumber` is ALWAYS seeded
   * blank (write-only field, see use_officer_workspace.ts's
   * toProfileDraft/hasStoredBankAccountNumber), so this flag is the only
   * way the editor can tell "empty because nothing's saved yet" apart from
   * "empty because the value is being withheld," and shows the right
   * placeholder for each case.
   */
  hasStoredBankAccountNumber: boolean;
}

export function MembershipFinancialEditor({ profile, onChange, canViewFinancial, hasStoredBankAccountNumber }: MembershipFinancialEditorProps) {
  const render = useBilingualText();
  const { t } = useT();
  // Task 4: "show a confirmation before clearing an existing cooperative
  // name" — tracks a pending "switch to No" that needs the user to confirm
  // before cooperativeName is actually cleared, rather than silently losing
  // entered data on a single click.
  const [pendingClearConfirm, setPendingClearConfirm] = useState(false);

  function set<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    onChange({ ...profile, [key]: value });
  }

  function triStateOptions() {
    return TRI_STATE_OPTIONS.map((v) => ({ value: v, label: render(TRI_STATE_LABELS[v]) }));
  }

  // Part 5: "ขั้น 43.5" display strings, descending 43.5 -> 1.0 (Combobox
  // suggestions are plain strings — SALARY_STEP_SCALE_OPTIONS is the
  // source of truth for the numeric values).
  const salaryStepSuggestions = useMemo(() => SALARY_STEP_SCALE_OPTIONS.map(formatSalaryStepScale), []);

  // Part 6: candidate amounts for the CURRENTLY SELECTED step only — never
  // auto-selected, never overwrites a saved value on step change (the
  // Combobox only offers suggestions; onChange for currentSalary is wired
  // independently of currentSalaryStep's onChange below).
  const stepKey = stepDisplayToKey(profile.currentSalaryStep);
  const candidateAmounts = useMemo(() => candidateSalariesForStep(stepKey), [stepKey]);
  // Suggestions are the FORMATTED display strings ("40,560 บาท") shown in
  // the dropdown LIST — Combobox treats a clicked suggestion as both label
  // and value, so selecting one calls onChange with that formatted string;
  // onCurrentSalaryChange below normalizes it back to a raw numeric string
  // before storing it (required by the save mapping's
  // Number(profile.currentSalary) — see use_officer_workspace.ts).
  //
  // Bug fix: the INPUT's bound `value` is profile.currentSalary VERBATIM —
  // never reformatted on every render. An earlier version derived a
  // "currentSalaryDisplayValue" by reformatting any all-digit string as
  // "N บาท" on every keystroke, which corrupted manual typing (the
  // controlled input's text would jump to "4 บาท" after the first
  // keystroke, so a second keystroke landed after "บาท" instead of
  // extending the number) and could leave a non-numeric string in
  // profile.currentSalary that silently became null at save time. The
  // formatted form is now ONLY ever produced by the suggestion list
  // (currentSalarySuggestions) and by selecting one of those suggestions —
  // never by reformatting the user's in-progress typing.
  const currentSalarySuggestions = useMemo(() => candidateAmounts.map((amount) => formatMoneyTh(amount)), [candidateAmounts]);

  function onCurrentSalaryChange(nextValue: string) {
    // Suggestion click ("N,NNN บาท") → raw digits; free typing keeps a decimal draft.
    if (looksLikeFormattedMoney(nextValue)) {
      set("currentSalary", parseFormattedMoneyDigits(nextValue));
      return;
    }
    set("currentSalary", sanitizeMoneyDraftInput(nextValue));
  }

  function onMoneyDraftChange(
    key: "currentSalary" | "otherSpecialAllowances" | "cooperativeMonthlyDeduction",
    nextValue: string
  ) {
    // Keep "." while typing ("3773." / "3773.50"). Never strip to digits-only.
    set(key, sanitizeMoneyDraftInput(nextValue));
  }

  const parsedCurrentSalary = parseMoneyDraft(profile.currentSalary);
  const parsedAllowances = parseMoneyDraft(profile.otherSpecialAllowances);
  const parsedExpenses = parseMoneyDraft(profile.cooperativeMonthlyDeduction);
  const expensesExceed = isExpensesExceedingIncome({
    currentSalary: parsedCurrentSalary,
    otherSpecialAllowances: parsedAllowances,
    totalExpenses: parsedExpenses,
  });
  const liveNet = displayNetSalary({
    currentSalary: parsedCurrentSalary,
    otherSpecialAllowances: parsedAllowances,
    totalExpenses: parsedExpenses,
  });
  const liveNetDisplay =
    liveNet == null ? "" : render({ th: formatMoneyTh(liveNet), en: formatMoneyEn(liveNet) });

  // Part 6: guidance text depends on whether a step is selected and
  // whether it has known candidates, or the current value is a manual
  // entry outside the candidate set — never silently blank.
  const currentSalaryHelperText = useMemo(() => {
    if (!stepKey) {
      return t("officer.baseSalaryNoStepHelper");
    }
    if (candidateAmounts.length > 1) {
      return t("officer.baseSalaryHelper");
    }
    const trimmedSalary = profile.currentSalary.trim();
    const isKnownCandidate = trimmedSalary !== "" && candidateAmounts.includes(Number(trimmedSalary));
    if (trimmedSalary !== "" && !isKnownCandidate) {
      return t("officer.baseSalaryManualHelper");
    }
    return "";
  }, [stepKey, candidateAmounts, profile.currentSalary, t]);

  function onCooperativeMemberChange(value: string) {
    const next = value as TriState;
    if (next !== "yes" && profile.cooperativeName.trim()) {
      setPendingClearConfirm(true);
      set("isCooperativeMember", next);
      return;
    }
    setPendingClearConfirm(false);
    set("isCooperativeMember", next);
  }

  function confirmClearCooperativeName() {
    setPendingClearConfirm(false);
    set("cooperativeName", "");
  }

  function keepCooperativeName() {
    setPendingClearConfirm(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{render(FIELD_LABELS.membershipAndFinancialSection)}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-6">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">{render(FIELD_LABELS.membershipGroup)}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BilingualField labelKey="isGpfMember" htmlFor="edit-isGpfMember">
              <Select
                id="edit-isGpfMember"
                options={triStateOptions()}
                value={profile.isGpfMember}
                onChange={(e) => set("isGpfMember", e.target.value as TriState)}
                aria-label={t("officer.membershipStatusPlaceholder")}
              />
            </BilingualField>
            <BilingualField labelKey="isPoliceFuneralWelfareMember" htmlFor="edit-isPoliceFuneralWelfareMember">
              <Select
                id="edit-isPoliceFuneralWelfareMember"
                options={triStateOptions()}
                value={profile.isPoliceFuneralWelfareMember}
                onChange={(e) => set("isPoliceFuneralWelfareMember", e.target.value as TriState)}
                aria-label={t("officer.membershipStatusPlaceholder")}
              />
            </BilingualField>
            <BilingualField labelKey="isCooperativeMember" htmlFor="edit-isCooperativeMember">
              <Select
                id="edit-isCooperativeMember"
                options={triStateOptions()}
                value={profile.isCooperativeMember}
                onChange={(e) => onCooperativeMemberChange(e.target.value)}
                aria-label={t("officer.membershipStatusPlaceholder")}
              />
            </BilingualField>
            <BilingualField labelKey="cooperativeName" htmlFor="edit-cooperativeName">
              <input
                id="edit-cooperativeName"
                type="text"
                className={inputCls}
                disabled={profile.isCooperativeMember !== "yes"}
                placeholder={t("officer.cooperativeNamePlaceholder")}
                value={profile.cooperativeName}
                onChange={(e) => set("cooperativeName", e.target.value)}
              />
            </BilingualField>
          </div>
          {pendingClearConfirm ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-serious/40 bg-serious/5 px-3 py-2 text-sm text-serious sm:flex-row sm:items-center sm:justify-between">
              <span>ยืนยันการล้างชื่อสหกรณ์ที่กรอกไว้หรือไม่? / Clear the entered cooperative name?</span>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md border border-serious/40 px-2 py-1 text-xs font-medium" onClick={confirmClearCooperativeName}>
                  ล้างข้อมูล / Clear
                </button>
                <button type="button" className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground" onClick={keepCooperativeName}>
                  เก็บไว้ / Keep
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">{render(FIELD_LABELS.salaryAndBankGroup)}</h3>
          <p className="mb-3 text-xs text-muted">{t("officer.salaryFormulaHelper")}</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <BilingualField labelKey="salaryLevel" htmlFor="edit-salaryLevel">
                <Combobox
                  id="edit-salaryLevel"
                  value={profile.salaryLevel}
                  onChange={(value) => set("salaryLevel", value)}
                  suggestions={SALARY_LEVEL_OPTIONS}
                  placeholder={t("officer.salaryLevelPlaceholder")}
                  aria-label={render(FIELD_LABELS.salaryLevel)}
                />
                <p className="mt-1 text-xs text-muted">{t("officer.salaryLevelHelper")}</p>
              </BilingualField>
              <BilingualField labelKey="currentSalaryStep" htmlFor="edit-currentSalaryStep">
                <Combobox
                  id="edit-currentSalaryStep"
                  value={profile.currentSalaryStep}
                  onChange={(value) => set("currentSalaryStep", value)}
                  suggestions={salaryStepSuggestions}
                  placeholder={t("officer.salaryStepPlaceholder")}
                  aria-label={render(FIELD_LABELS.currentSalaryStep)}
                />
                <p className="mt-1 text-xs text-muted">{t("officer.salaryStepHelper")}</p>
              </BilingualField>
              <BilingualField labelKey="currentSalary" htmlFor="edit-currentSalary">
                <Combobox
                  id="edit-currentSalary"
                  value={profile.currentSalary}
                  onChange={onCurrentSalaryChange}
                  suggestions={currentSalarySuggestions}
                  placeholder={t("officer.baseSalaryPlaceholder")}
                  inputMode="decimal"
                  aria-label={render(FIELD_LABELS.currentSalary)}
                />
                <p className="mt-1 text-xs text-muted">{currentSalaryHelperText}</p>
              </BilingualField>
              <BilingualField labelKey="otherSpecialAllowances" htmlFor="edit-otherSpecialAllowances">
                <input
                  id="edit-otherSpecialAllowances"
                  type="text"
                  inputMode="decimal"
                  className={inputCls}
                  placeholder={t("officer.otherSpecialAllowancesPlaceholder")}
                  value={profile.otherSpecialAllowances}
                  onChange={(e) => onMoneyDraftChange("otherSpecialAllowances", e.target.value)}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted">{t("officer.otherSpecialAllowancesHelper")}</p>
              </BilingualField>
              <BilingualField labelKey="cooperativeMonthlyDeduction" htmlFor="edit-cooperativeMonthlyDeduction">
                <input
                  id="edit-cooperativeMonthlyDeduction"
                  type="text"
                  inputMode="decimal"
                  className={inputCls}
                  placeholder={t("officer.cooperativeDeductionPlaceholder")}
                  value={profile.cooperativeMonthlyDeduction}
                  onChange={(e) => onMoneyDraftChange("cooperativeMonthlyDeduction", e.target.value)}
                  aria-invalid={expensesExceed || undefined}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted">{t("officer.cooperativeDeductionHelper")}</p>
                {expensesExceed ? (
                  <p className="mt-1 text-xs text-serious">{t("officer.cooperativeDeductionExceedsSalary")}</p>
                ) : null}
              </BilingualField>
              <BilingualField labelKey="netSalary" htmlFor="edit-netSalary">
                <input
                  id="edit-netSalary"
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className={readOnlyInputCls}
                  value={liveNetDisplay}
                  aria-readonly="true"
                />
                <p className="mt-1 text-xs text-muted">{t("officer.netSalaryHelper")}</p>
              </BilingualField>
              <BilingualField labelKey="bankName" htmlFor="edit-bankName">
                <Combobox
                  id="edit-bankName"
                  value={profile.bankName}
                  onChange={(value) => set("bankName", value)}
                  suggestions={BANK_OPTIONS}
                  placeholder={t("officer.bankNamePlaceholder")}
                  aria-label={render(FIELD_LABELS.bankName)}
                />
              </BilingualField>
              {canViewFinancial ? (
                <BilingualField labelKey="bankAccountNumber" htmlFor="edit-bankAccountNumber">
                  <input
                    id="edit-bankAccountNumber"
                    type="text"
                    inputMode="numeric"
                    className={inputCls}
                    placeholder={hasStoredBankAccountNumber ? t("officer.bankAccountNumberOnFileHelper") : t("officer.bankAccountNumberPlaceholder")}
                    value={profile.bankAccountNumber}
                    onChange={(e) => set("bankAccountNumber", e.target.value)}
                  />
                </BilingualField>
              ) : null}
            </div>
            <div className="flex items-start justify-center border-t border-border/60 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
              <SalaryUtilizationGauge
                compact
                baseSalary={parsedCurrentSalary}
                specialAllowances={parsedAllowances}
                totalDeductions={parsedExpenses}
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
