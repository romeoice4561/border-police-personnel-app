/**
 * Create Personnel (Manual Personnel Entry — Phase XX, Admin Only).
 *
 * A hand-typed officer-create form for cases the Drive/AI import hasn't
 * covered yet. Admin-only (gated by `officers.create` — see
 * lib/auth/auth_config.ts's ROUTE_PERMISSIONS and this page's own `can()`
 * check, matching the app's established belt-and-suspenders pattern: the
 * route is registered so AuthGate redirects a non-admin before this even
 * renders, and the page still checks locally so a stale client render never
 * shows the form). Independent of the AI/Drive import pipeline — this path
 * never touches lib/import/*, never reuses OfficerRepository.upsert.
 *
 * On submit: POSTs to /api/officers. A 409 response (duplicate candidate
 * found) is shown inline with the matching officer(s) so the admin can open
 * the existing profile instead of creating a new one — creation is BLOCKED,
 * never silently proceeds. On success, redirects to the new officer's
 * profile, where the rest of the Officer Profile Workspace (photo upload,
 * remaining fields) is filled in exactly like any other officer.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { PageHeader } from "@/components/common/page_header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { RANK_OPTIONS } from "@/lib/officer_profile/rank_options";
import { POSITION_OPTIONS } from "@/lib/officer_profile/position_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { ACADEMY_CLASS_OPTIONS } from "@/lib/officer_profile/academy_class_options";
import { EMPLOYMENT_STATUS_OPTIONS } from "@/lib/manual_entry/employment_status_options";
import { apiClient, ApiClientError, type ManualEntryDuplicateCandidate } from "@/lib/ui/api_client";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Field({ label, htmlFor, required, children }: { label: string; htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-critical">*</span> : null}
      </label>
      {children}
    </div>
  );
}

interface FormState {
  rank: string;
  firstName: string;
  lastName: string;
  nickname: string;
  policeServiceNumber: string;
  citizenId: string;
  academyClass: string;
  currentPosition: string;
  currentUnit: string;
  region: string;
  dateOfBirth: string;
  appointmentDate: string;
  phone: string;
  email: string;
  employmentStatus: string;
}

const EMPTY_FORM: FormState = {
  rank: "",
  firstName: "",
  lastName: "",
  nickname: "",
  policeServiceNumber: "",
  citizenId: "",
  academyClass: "",
  currentPosition: "",
  currentUnit: "",
  region: "",
  dateOfBirth: "",
  appointmentDate: "",
  phone: "",
  email: "",
  employmentStatus: "",
};

const REASON_LABEL: Record<string, string> = {
  policeServiceNumber: "เลขประจำตัวตำรวจตรงกัน",
  citizenId: "เลขบัตรประชาชนตรงกัน",
  nameAndDateOfBirth: "ชื่อ-นามสกุล และวันเกิดตรงกัน",
};

export default function CreateOfficerPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const { t } = useT();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<ManualEntryDuplicateCandidate[] | null>(null);

  // Belt-and-suspenders: AuthGate/proxy already keep a non-admin from ever
  // reaching this route; this local check additionally covers a stale
  // client-side render (e.g. permissions changed mid-session).
  if (!can("officers.create")) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted">{t("manualEntry.noPermission")}</p>
      </div>
    );
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setDuplicates(null);

    if (!form.rank.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setFieldError(t("manualEntry.requiredFieldsMissing"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiClient.createOfficer({
        rank: form.rank.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nickname: form.nickname.trim() || null,
        policeServiceNumber: form.policeServiceNumber.trim() || null,
        citizenId: form.citizenId.trim() || null,
        academyClass: form.academyClass ? Number(form.academyClass) : null,
        currentPosition: form.currentPosition.trim() || null,
        currentUnit: form.currentUnit.trim() || null,
        region: form.region.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        appointmentDate: form.appointmentDate || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        employmentStatus: form.employmentStatus.trim() || null,
        actorId: user?.id ?? "",
        actorName: user?.displayName ?? "",
      });
      router.push(`/officers/${encodeURIComponent(result.officerId)}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        const candidates = (error.details as { candidates?: ManualEntryDuplicateCandidate[] } | undefined)?.candidates;
        setDuplicates(candidates ?? []);
      } else if (error instanceof ApiClientError) {
        setFieldError(error.message);
      } else {
        setFieldError(t("manualEntry.saveErrorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t("manualEntry.pageTitle")}
        description={t("manualEntry.pageDescription")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/officers">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("common.cancel")}
            </Link>
          </Button>
        }
      />

      {duplicates && duplicates.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-serious/40 bg-serious/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-serious">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("manualEntry.duplicateFoundTitle")}
          </p>
          <ul className="space-y-1.5">
            {duplicates.map((c) => (
              <li key={c.officerId} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <Link href={`/officers/${encodeURIComponent(c.officerId)}`} className="font-medium text-accent hover:underline">
                  {c.rank} {c.firstName} {c.lastName}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {c.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fieldError ? (
        <div className="rounded-xl border border-critical/40 bg-critical/5 p-4 text-sm text-critical">{fieldError}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("manualEntry.rank")} htmlFor="me-rank" required>
              <Combobox id="me-rank" value={form.rank} onChange={(v) => set("rank", v)} suggestions={RANK_OPTIONS} placeholder={t("manualEntry.rankPlaceholder")} />
            </Field>
            <Field label={t("manualEntry.academyClass")} htmlFor="me-academyClass">
              <Select
                id="me-academyClass"
                options={ACADEMY_CLASS_OPTIONS.map((c) => ({ value: String(c), label: String(c) }))}
                placeholder={t("manualEntry.notSpecified")}
                value={form.academyClass}
                onChange={(e) => set("academyClass", e.target.value)}
              />
            </Field>
            <Field label={t("manualEntry.firstName")} htmlFor="me-firstName" required>
              <input id="me-firstName" type="text" className={inputCls} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
            </Field>
            <Field label={t("manualEntry.lastName")} htmlFor="me-lastName" required>
              <input id="me-lastName" type="text" className={inputCls} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </Field>
            <Field label={t("manualEntry.nickname")} htmlFor="me-nickname">
              <input id="me-nickname" type="text" className={inputCls} value={form.nickname} onChange={(e) => set("nickname", e.target.value)} />
            </Field>
            <Field label={t("manualEntry.dateOfBirth")} htmlFor="me-dateOfBirth">
              <ThaiDatePicker id="me-dateOfBirth" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} placeholder="DD/MM/YYYY" rejectFuture />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("manualEntry.policeServiceNumber")} htmlFor="me-policeServiceNumber">
              <input id="me-policeServiceNumber" type="text" className={inputCls} value={form.policeServiceNumber} onChange={(e) => set("policeServiceNumber", e.target.value)} />
            </Field>
            <Field label={t("manualEntry.citizenId")} htmlFor="me-citizenId">
              <input id="me-citizenId" type="text" className={inputCls} value={form.citizenId} onChange={(e) => set("citizenId", e.target.value)} />
            </Field>
            <Field label={t("manualEntry.currentPosition")} htmlFor="me-currentPosition">
              <Combobox id="me-currentPosition" value={form.currentPosition} onChange={(v) => set("currentPosition", v)} suggestions={POSITION_OPTIONS} placeholder={t("manualEntry.currentPositionPlaceholder")} />
            </Field>
            <Field label={t("manualEntry.currentUnit")} htmlFor="me-currentUnit">
              <input id="me-currentUnit" type="text" className={inputCls} value={form.currentUnit} onChange={(e) => set("currentUnit", e.target.value)} />
            </Field>
            <Field label={t("manualEntry.region")} htmlFor="me-region">
              <Combobox id="me-region" value={form.region} onChange={(v) => set("region", v)} suggestions={THAI_PROVINCE_OPTIONS} placeholder={t("manualEntry.regionPlaceholder")} />
            </Field>
            <Field label={t("manualEntry.appointmentDate")} htmlFor="me-appointmentDate">
              <ThaiDatePicker id="me-appointmentDate" value={form.appointmentDate} onChange={(v) => set("appointmentDate", v)} placeholder="DD/MM/YYYY" rejectFuture />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("manualEntry.phone")} htmlFor="me-phone">
              <input id="me-phone" type="tel" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label={t("manualEntry.email")} htmlFor="me-email">
              <input id="me-email" type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={t("manualEntry.employmentStatus")} htmlFor="me-employmentStatus">
              <Combobox id="me-employmentStatus" value={form.employmentStatus} onChange={(v) => set("employmentStatus", v)} suggestions={EMPLOYMENT_STATUS_OPTIONS} placeholder={t("manualEntry.employmentStatusPlaceholder")} />
            </Field>
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/officers")} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
