/**
 * /settings/integrations/telegram — connect / revoke Telegram (Phase 51.3).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth_provider";
import { LoadingState } from "@/components/common/states";
import type { TelegramBindingPublicView } from "@/lib/telegram_identity/types";

function basicHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

export default function TelegramIntegrationSettingsPage() {
  const { user, status } = useAuth();
  const [binding, setBinding] = useState<TelegramBindingPublicView | null>(null);
  const [password, setPassword] = useState("");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadStatus = useCallback(
    async (pwd: string) => {
      if (!user) return;
      const res = await fetch("/api/settings/telegram-binding", {
        headers: { Authorization: basicHeader(user.username, pwd) },
        credentials: "include",
      });
      if (!res.ok) {
        setError("ไม่สามารถโหลดสถานะการเชื่อมต่อได้ — ตรวจสอบรหัสผ่าน");
        return;
      }
      const data = (await res.json()) as { binding: TelegramBindingPublicView };
      setBinding(data.binding);
      setLoaded(true);
      setError(null);
    },
    [user]
  );

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    // Soft load without password fails when AUTH requires Basic — wait for user action.
    setLoaded(true);
  }, [status, user]);

  async function handleConnect(replaceExisting = false) {
    if (!user || !password) {
      setError("กรุณายืนยันรหัสผ่านก่อนเชื่อมต่อ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loadStatus(password);
      const res = await fetch("/api/settings/telegram-binding", {
        method: "POST",
        headers: {
          Authorization: basicHeader(user.username, password),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ replaceExisting }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        deepLink?: string;
        expiresAt?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "สร้างลิงก์ไม่สำเร็จ");
        return;
      }
      setDeepLink(data.deepLink ?? null);
      setExpiresAt(data.expiresAt ?? null);
      await loadStatus(password);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!user || !password) {
      setError("กรุณายืนยันรหัสผ่านก่อนยกเลิกการเชื่อมต่อ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/telegram-binding", {
        method: "DELETE",
        headers: { Authorization: basicHeader(user.username, password) },
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? "ยกเลิกไม่สำเร็จ");
        return;
      }
      setDeepLink(null);
      setExpiresAt(null);
      await loadStatus(password);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="py-10">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-muted">กรุณาเข้าสู่ระบบก่อนจัดการการเชื่อมต่อ Telegram</p>
        <Link href="/login" className="mt-4 inline-block text-accent underline">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const statusLabel =
    binding?.status === "ACTIVE"
      ? "เชื่อมต่อแล้ว"
      : binding?.status === "DISABLED"
        ? "ถูกระงับ"
        : binding?.status === "PENDING_VERIFICATION"
          ? "รอการยืนยัน"
          : "ยังไม่ได้เชื่อมต่อ";

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-sm text-muted">
        <Link href="/dashboard" className="hover:underline">
          หน้าหลัก
        </Link>
        {" / "}
        การเชื่อมต่อ Telegram
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">เชื่อมต่อ Telegram</h1>
      <p className="mt-2 text-sm text-muted">
        ผูกบัญชี Telegram ของคุณกับบัญชีในระบบกำลังพล เพื่อค้นหาตามสิทธิ์ของตนเอง
        ไม่ใช้บัญชีบริการร่วม
      </p>

      <section className="mt-8 space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-foreground">สถานะ</h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">การเชื่อมต่อ</dt>
          <dd>{loaded && binding ? statusLabel : "— กดโหลดสถานะด้านล่าง —"}</dd>
          <dt className="text-muted">ชื่อที่แสดง</dt>
          <dd>{binding?.telegramFirstName ?? "—"}</dd>
          <dt className="text-muted">Username</dt>
          <dd>{binding?.telegramUsername ? `@${binding.telegramUsername}` : "—"}</dd>
          <dt className="text-muted">เชื่อมต่อเมื่อ</dt>
          <dd>{binding?.verifiedAt ? new Date(binding.verifiedAt).toLocaleString("th-TH") : "—"}</dd>
          <dt className="text-muted">ใช้งานล่าสุด</dt>
          <dd>{binding?.lastUsedAt ? new Date(binding.lastUsedAt).toLocaleString("th-TH") : "—"}</dd>
        </dl>
        <p className="text-xs text-muted">
          Username ของ Telegram เป็นข้อมูลแสดงผลเท่านั้น ไม่ใช้ยืนยันตัวตน
        </p>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-6">
        <label className="block text-sm font-medium text-foreground" htmlFor="tg-password">
          ยืนยันรหัสผ่าน
        </label>
        <input
          id="tg-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadStatus(password)}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-neutral-bg disabled:opacity-50"
          >
            โหลดสถานะ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConnect(false)}
            className="rounded-lg bg-accent px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            เชื่อมต่อ Telegram
          </button>
          {binding?.status === "ACTIVE" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConnect(true)}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-neutral-bg disabled:opacity-50"
              >
                เชื่อมต่อบัญชีใหม่
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRevoke()}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            </>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {deepLink ? (
          <div className="rounded-lg border border-border bg-neutral-bg/40 p-3 text-sm">
            <p className="font-medium">เปิดลิงก์นี้ใน Telegram (ใช้ได้ครั้งเดียว)</p>
            <a
              href={deepLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-accent underline"
            >
              {deepLink.startsWith("token:") ? "คัดลอกโทเคนด้านล่าง (ยังไม่ได้ตั้ง TELEGRAM_BOT_USERNAME)" : deepLink}
            </a>
            {deepLink.startsWith("token:") ? (
              <code className="mt-2 block break-all text-xs">{deepLink.slice("token:".length)}</code>
            ) : null}
            {expiresAt ? (
              <p className="mt-2 text-xs text-muted">หมดอายุ: {new Date(expiresAt).toLocaleString("th-TH")}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
