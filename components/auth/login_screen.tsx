/**
 * LoginScreen (Phase 46 — Professional Login).
 *
 * The full-screen login experience: navy gradient background with a soft glow,
 * a centered glass card with a fade/scale entrance, the official BppisLogo,
 * the system name, the credentials form, and the footer. All strings are
 * bilingual via the dictionary; all colors are existing design tokens (works in
 * light and dark). No new theme.
 *
 * Auth flows through useAuth() → the provider-agnostic AuthBackend. On success
 * the user is routed by the CENTRALIZED homeRouteForUser helper (admin/commander
 * → dashboard, officer → own profile) — the login page never hardcodes routes.
 */
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useAuth } from "@/components/auth/auth_provider";
import { homeRouteForUser } from "@/lib/auth/auth_config";
import type { AuthErrorCode } from "@/lib/auth/types";
import { BppisLogo } from "@/components/auth/bppis_logo";
import { PasswordField } from "@/components/auth/password_field";
import { LanguageToggle } from "@/components/ui/language_toggle";

const ERROR_KEY: Record<AuthErrorCode, TranslationKey> = {
  INVALID_CREDENTIALS: "auth.errorInvalidCredentials",
  ACCOUNT_DISABLED: "auth.errorAccountDisabled",
  UNKNOWN: "auth.errorUnknown",
};

/** The System Architect footer block — proper nouns rendered verbatim (not translated). */
const ARCHITECT = {
  name: "พ.ต.ท.ชลัช จุมพลพักตร์",
  lines: [
    "รองผู้กำกับการตำรวจตระเวนชายแดนที่ 41",
    "หัวหน้ากองร้อยตำรวจตระเวนชายแดนที่ 414",
  ],
  phone: "086-345-4561",
};

export function LoginScreen() {
  const { t } = useT();
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await login(username, password, rememberMe);
      if (result.ok) {
        router.replace(homeRouteForUser(result.user));
      } else {
        setError(result.error);
      }
    } catch {
      setError("UNKNOWN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0b1120] via-[#0f1e3a] to-[#0b1120] px-4 py-6">
      {/* Soft accent glows (decorative). */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-warning/10 blur-3xl" aria-hidden="true" />

      {/* Language toggle — top-right. */}
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle />
      </div>

      {/* Card — glass effect + fade/scale entrance. Width ~478px (Phase 46 final polish).
          Positioned slightly ABOVE center (negative top margin ~50px) so the footer
          stays fully visible; on short viewports the outer items-center still keeps it
          from clipping. */}
      <div className="-mt-12 animate-[fadeScaleIn_0.35s_ease-out] w-full max-w-119.5 rounded-2xl border border-white/10 bg-surface/90 p-6 shadow-2xl backdrop-blur-md sm:p-7">
        {/* Brand — official logo (~136px, centered) + system title. */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 w-34 max-w-[62%]">
            <BppisLogo priority />
          </div>
          {/* BPPIS = largest */}
          <p className="text-3xl font-extrabold tracking-wide text-foreground">{t("auth.systemNameShort")}</p>
          {/* Border Patrol Police = medium */}
          <p className="mt-1 text-base font-semibold text-foreground">{t("auth.orgName")}</p>
          {/* Personnel Intelligence System = accent gold */}
          <p className="text-sm font-medium text-warning">{t("auth.systemNameFull")}</p>
          {/* (BPPIS) = muted */}
          <p className="text-xs text-muted">{t("auth.systemNameAbbrev")}</p>
          {/* Thai subtitle = muted gray, two lines */}
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t("auth.systemSubtitleLine1")}
            <br />
            {t("auth.systemSubtitleLine2")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-xs font-medium text-muted">
              {t("auth.username")}
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
              autoComplete="username"
              autoFocus
              disabled={loading}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-medium text-muted">
              {t("auth.password")}
            </label>
            <PasswordField
              id="login-password"
              value={password}
              onChange={setPassword}
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* Remember me + Forgot password (disabled) */}
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              {t("auth.rememberMe")}
            </label>
            <button
              type="button"
              disabled
              title={t("auth.contactAdministrator")}
              className="cursor-not-allowed text-xs font-medium text-muted opacity-60"
            >
              {t("auth.contactAdministrator")}
            </button>
          </div>

          {/* Error */}
          {error ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-critical/30 bg-critical-bg/50 px-3 py-2 text-xs text-critical" role="alert" aria-live="assertive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(ERROR_KEY[error])}
            </p>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
            {loading ? t("auth.loggingIn") : t("auth.login")}
          </button>
        </form>

        {/* Footer — compact block (~20% shorter): reduced top padding + tighter
            inter-line gaps. Typography sizes/weights are unchanged. */}
        <div className="mt-4 border-t border-border pt-2.5 text-center">
          <p className="text-xs font-semibold text-muted">{t("auth.versionLabel")}</p>
          <p className="text-[11px] leading-tight text-muted">{t("auth.buildLabel")}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted/80">
            {t("auth.authorizedOnly")}
            <br />
            {t("auth.unauthorizedProhibited")}
          </p>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted/80">{t("auth.systemArchitect")}</p>
          <p className="text-xs font-semibold text-foreground">{ARCHITECT.name}</p>
          {ARCHITECT.lines.map((line) => (
            <p key={line} className="text-[11px] leading-tight text-muted">{line}</p>
          ))}
          <p className="mt-0.5 text-[11px] text-muted">
            {t("auth.phoneLabel")} {ARCHITECT.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
