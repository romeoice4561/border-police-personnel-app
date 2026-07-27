/**
 * Global filter bar — grouped for executives; public codes; Thai labels only.
 */
"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  CommanderWorkforceViewModel,
  WorkforceFilterOption,
  WorkforceFilterState,
} from "@/lib/commander_workforce/types";
import {
  countActiveWorkforceFilters,
  emptyWorkforceFilters,
  parseWorkforceFiltersFromSearchParams,
  serializeWorkforceFiltersToQuery,
} from "@/lib/commander_workforce/url_filters";
import { presentFilterOptions } from "@/components/commander-workforce/labels";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/commander-workforce/section-shell";

function parseDraftFromKey(filtersKey: string): WorkforceFilterState {
  return parseWorkforceFiltersFromSearchParams(new URLSearchParams(filtersKey));
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string | null;
  options: WorkforceFilterOption[];
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-xs text-muted sm:min-w-[11rem]">
      <span className="font-medium">{label}</span>
      <select
        id={id}
        disabled={disabled || options.length === 0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">ทั้งหมด</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.labelTh} ({opt.count.toLocaleString("th-TH")})
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted/80">{title}</p>
      <div className="flex flex-wrap gap-3 sm:gap-4">{children}</div>
    </div>
  );
}

export function WorkforceFilterBar({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<WorkforceFilterState>(viewModel.filters);

  const filtersKey = serializeWorkforceFiltersToQuery(viewModel.filters);
  useEffect(() => {
    setDraft(parseDraftFromKey(filtersKey));
  }, [filtersKey]);

  const activeCount = countActiveWorkforceFilters(draft);
  const available = viewModel.availableFilters;

  const regions = useMemo(() => presentFilterOptions("region", available.regions), [available.regions]);
  const divisions = useMemo(() => presentFilterOptions("division", available.divisions), [available.divisions]);
  const companies = useMemo(() => presentFilterOptions("company", available.companies), [available.companies]);
  const ranks = useMemo(() => presentFilterOptions("rank", available.ranks), [available.ranks]);
  const positions = useMemo(
    () => presentFilterOptions("positionLevel", available.positionLevels),
    [available.positionLevels]
  );
  const promotions = useMemo(
    () => presentFilterOptions("promotion", available.promotionStatuses),
    [available.promotionStatuses]
  );
  const retirements = useMemo(
    () => presentFilterOptions("retirement", available.retirementWindows),
    [available.retirementWindows]
  );
  const trainings = useMemo(
    () => presentFilterOptions("training", available.trainingStatuses),
    [available.trainingStatuses]
  );
  const documents = useMemo(
    () => presentFilterOptions("document", available.documentStatuses),
    [available.documentStatuses]
  );
  const dataQuality = useMemo(
    () => presentFilterOptions("dataQuality", available.dataQualityStatuses),
    [available.dataQualityStatuses]
  );

  function apply(next: WorkforceFilterState) {
    setDraft(next);
    const qs = serializeWorkforceFiltersToQuery(next);
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function patch(partial: Partial<WorkforceFilterState>) {
    const next = { ...draft, ...partial };
    if ("regionPublicCode" in partial && partial.regionPublicCode == null) {
      next.divisionPublicCode = null;
      next.companyPublicCode = null;
    }
    if ("divisionPublicCode" in partial && partial.divisionPublicCode == null) {
      next.companyPublicCode = null;
    }
    apply(next);
  }

  return (
    <SectionShell
      title="ตัวกรองร่วม"
      description="ทุกส่วนใช้ชุดตัวกรองเดียวกัน"
      actions={
        <div className="flex items-center gap-2 text-xs text-muted">
          <span aria-live="polite">ใช้งานอยู่ {activeCount} รายการ</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={activeCount === 0 || pending}
            onClick={() => apply(emptyWorkforceFilters())}
            aria-label="ล้างตัวกรองทั้งหมด"
          >
            ล้างตัวกรอง
          </Button>
        </div>
      }
    >
      <div className="space-y-6 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
        <FilterGroup title="พื้นที่">
          <SelectField
            id="wf-region"
            label="ภาค"
            value={draft.regionPublicCode}
            options={regions}
            onChange={(v) => patch({ regionPublicCode: v })}
            disabled={regions.length === 0}
          />
          <SelectField
            id="wf-division"
            label="กองกำกับการ"
            value={draft.divisionPublicCode}
            options={divisions}
            onChange={(v) => patch({ divisionPublicCode: v })}
            disabled={divisions.length === 0}
          />
          <SelectField
            id="wf-company"
            label="กองร้อย"
            value={draft.companyPublicCode}
            options={companies}
            onChange={(v) => patch({ companyPublicCode: v })}
            disabled={companies.length === 0}
          />
        </FilterGroup>

        <FilterGroup title="ตำแหน่ง">
          <SelectField
            id="wf-rank"
            label="ยศ"
            value={draft.rank}
            options={ranks}
            onChange={(v) => patch({ rank: v })}
            disabled={ranks.length === 0}
          />
          <SelectField
            id="wf-position"
            label="ระดับตำแหน่ง"
            value={draft.positionLevel}
            options={positions}
            onChange={(v) => patch({ positionLevel: v })}
            disabled={positions.length === 0}
          />
        </FilterGroup>

        <FilterGroup title="สถานะ">
          <SelectField
            id="wf-promo"
            label="การเลื่อนตำแหน่ง"
            value={draft.promotionStatus}
            options={promotions}
            onChange={(v) => patch({ promotionStatus: v })}
          />
          <SelectField
            id="wf-retire"
            label="ช่วงเกษียณ"
            value={draft.retirementWindow}
            options={retirements}
            onChange={(v) => patch({ retirementWindow: v })}
          />
          <SelectField
            id="wf-training"
            label="หลักสูตร"
            value={draft.trainingStatus}
            options={trainings}
            onChange={(v) => patch({ trainingStatus: v })}
          />
          <SelectField
            id="wf-docs"
            label="เอกสาร"
            value={draft.documentStatus}
            options={documents}
            onChange={(v) => patch({ documentStatus: v })}
          />
          <SelectField
            id="wf-dq"
            label="คุณภาพข้อมูล"
            value={draft.dataQualityStatus}
            options={dataQuality}
            onChange={(v) => patch({ dataQualityStatus: v })}
          />
        </FilterGroup>

        <FilterGroup title="ค้นหา">
          <label className="flex min-w-[14rem] flex-[2] flex-col gap-1.5 text-xs text-muted">
            <span className="font-medium">ชื่อ / ยศ / ตำแหน่ง</span>
            <input
              id="wf-search"
              type="search"
              value={draft.search ?? ""}
              onChange={(e) => setDraft({ ...draft, search: e.target.value || null })}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply(draft);
              }}
              onBlur={() => apply(draft)}
              placeholder="พิมพ์เพื่อค้นหาในขอบเขตปัจจุบัน"
              className="h-10 rounded-md border border-border bg-surface px-2.5 text-sm text-foreground"
              aria-label="ค้นหากำลังพลในขอบเขต"
            />
          </label>
        </FilterGroup>

        {!viewModel.scope.publicCodesAvailable ? (
          <p className="text-xs text-warning">ตัวกรองหน่วยยังไม่พร้อม — ไม่แสดงรหัสภายในระบบ</p>
        ) : null}
        {pending ? <p className="text-xs text-muted">กำลังอัปเดตผลการกรอง…</p> : null}
      </div>
    </SectionShell>
  );
}
