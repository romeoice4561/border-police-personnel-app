/**
 * LoginScreen — C-INTEL product branding.
 *
 * Artwork (`c-intel-login-bg.png`) is atmosphere only. It contains a mock
 * login form that is NOT interactive; a dark crop/overlay hides those fake
 * fields. The real HTML form below is the only sign-in control.
 *
 * Auth behavior is unchanged: useAuth() → AuthBackend → homeRouteForUser.
 */
"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useAuth } from "@/components/auth/auth_provider";
import { homeRouteForUser } from "@/lib/auth/auth_config";
import type { AuthErrorCode } from "@/lib/auth/types";
import { BppisLogo } from "@/components/auth/bppis_logo";
import { CIntelLogo } from "@/components/auth/c_intel_logo";
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
  lines: ["รอง ผกก.ตชด.41", "หัวหน้ากองร้อย ตชด.414"],
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
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#070612] px-4 py-4 sm:py-5">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src="/assets/branding/c-intel-login-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_8%] opacity-45 sm:object-[center_12%] sm:opacity-58"
        />
        <div className="absolute inset-0 bg-[#070612]/55 sm:bg-[#070612]/42" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,6,18,0.78)_0%,rgba(7,6,18,0.42)_48%,rgba(7,6,18,0.62)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070612]/35 via-[#070612]/50 to-[#070612]" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#070612] via-[#070612]/80 to-transparent" />
      </div>

      <div className="absolute right-4 top-4 z-10 rounded-lg bg-black/40">
        <LanguageToggle />
      </div>

      <div className="relative z-10 w-full max-w-[26rem] animate-[fadeScaleIn_0.35s_ease-out] rounded-2xl border border-violet-400/22 bg-[#0b0a16]/82 p-4 shadow-[0_0_28px_rgba(88,40,160,0.16)] backdrop-blur-sm sm:p-5">
        <div className="flex flex-col items-center text-center">
          <div className="mb-1 w-24 max-w-[46%] sm:w-32">
            <CIntelLogo priority />
          </div>
          <p className="text-xl font-extrabold tracking-[0.2em] text-white sm:text-2xl">{t("auth.systemNameShort")}</p>
          <p className="mt-1 text-xs leading-snug text-violet-100/90">{t("auth.systemNameFull")}</p>
          <p className="mt-0.5 hidden text-[10px] uppercase tracking-wide text-violet-200/60 sm:block">
            {t("auth.systemNameFullEn")}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <div className="w-6 shrink-0 sm:w-7">
              <BppisLogo />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-medium leading-tight text-white/90">{t("auth.orgName")}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/55">{t("auth.orgNameEn")}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-xs font-medium text-violet-100/80">
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
            <label htmlFor="login-password" className="block text-xs font-medium text-violet-100/80">
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

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-violet-50">
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
              className="cursor-not-allowed text-xs font-medium text-violet-200/50"
            >
              {t("auth.contactAdministrator")}
            </button>
          </div>

          {error ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-critical/30 bg-critical-bg/50 px-3 py-2 text-xs text-critical" role="alert" aria-live="assertive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(ERROR_KEY[error])}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a16] disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
            {loading ? t("auth.loggingIn") : t("auth.login")}
          </button>
        </form>

        <div className="mt-3 border-t border-white/10 pt-1.5 text-center">
          <p className="text-[10px] leading-tight text-violet-100/55">
            {t("auth.versionLabel")} · {t("auth.buildLabel")}
          </p>
          <p className="text-[10px] leading-tight text-violet-100/45">
            {t("auth.authorizedOnly")} · {t("auth.unauthorizedProhibited")}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-violet-100/45">{t("auth.systemArchitect")}</p>
          <p className="text-[11px] font-semibold text-white">{ARCHITECT.name}</p>
          {ARCHITECT.lines.map((line) => (
            <p key={line} className="text-[10px] leading-tight text-violet-100/60">
              {line}
            </p>
          ))}
          <p className="text-[10px] leading-tight text-violet-100/50">
            {t("auth.phoneLabel")} {ARCHITECT.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
