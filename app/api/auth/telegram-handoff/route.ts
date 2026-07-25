/**
 * Consume a short-lived Telegram → Web handoff token (Phase 51.3).
 * Sets client session via HTML bridge; destination is allow-listed server-side.
 */
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_STORAGE_KEY } from "@/lib/auth/auth_config";
import {
  consumeWebHandoff,
  isApprovedHandoffDestination,
  TelegramHandoffError,
} from "@/lib/telegram_identity/handoff";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loginRedirect(): Response {
  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE, Location: "/login" },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return loginRedirect();

  try {
    const result = await consumeWebHandoff({ rawToken: token });
    if (!isApprovedHandoffDestination(result.destination)) {
      return loginRedirect();
    }

    const destination = result.destination;
    const sessionJson = result.userJson;
    // Bridge page: write session then navigate. Token already consumed (single-use).
    const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"/><title>กำลังเข้าสู่ระบบ…</title>
<meta http-equiv="Cache-Control" content="no-store"/>
</head><body>
<p>กำลังเปิดหน้าเว็บ…</p>
<script>
(function(){
  try {
    var raw = ${JSON.stringify(sessionJson)};
    var session = JSON.parse(raw);
    var payload = JSON.stringify({ user: session.user, issuedAt: session.issuedAt || Date.now() });
    localStorage.setItem(${JSON.stringify(SESSION_STORAGE_KEY)}, payload);
    document.cookie = ${JSON.stringify(SESSION_COOKIE_NAME)} + "=1; path=/; SameSite=Lax";
  } catch (e) {}
  location.replace(${JSON.stringify(destination)});
})();
</script>
</body></html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof TelegramHandoffError) {
      const msg = escapeHtml("ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาเข้าสู่ระบบปกติ");
      return new Response(
        `<!DOCTYPE html><html lang="th"><body><p>${msg}</p><p><a href="/login">เข้าสู่ระบบ</a></p></body></html>`,
        {
          status: 400,
          headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }
    throw error;
  }
}
