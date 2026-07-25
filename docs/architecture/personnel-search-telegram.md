# Telegram Commander Experience (Phase 51.2 / 51.3)

Presentation-only Telegram client for the Personnel Intelligence Platform.

## Architecture

```
Telegram Update
  → POST /api/telegram/webhook
    → secret-token validation + body limits + update_id dedupe
    → Dispatcher
    → Telegram identity binding → application principal
    → Durable session store (per Telegram user id)
    → Personnel Search API (injected actor, client=telegram)
    → Personnel Search Gateway + permission filter
    → Formatter + inline keyboard
    → Telegram Bot API
```

The Telegram layer does **not** implement search, ranking, permissions, entity resolution, promotion/retirement logic, or repository access.

## Trust boundaries (Phase 51.3)

| Layer | Trust |
|-------|--------|
| Telegram numeric user ID | External identity key (immutable for the account) |
| Telegram username / display name | Metadata only — never authorization |
| Binding token | Short-lived, single-use, hashed at rest; opaque (no role/user/unit) |
| App principal | Existing AuthUser from AuthBackend |
| Role / org scope | Resolved server-side by Personnel Search API / Gateway |
| Shared Basic Auth service account | **Not** used for normal human Telegram searches |

Required flow:

`Telegram user ID → verified binding → AuthUser → role/scope → Personnel Search API → Gateway`

## Identity binding lifecycle

States: `PENDING_VERIFICATION` · `ACTIVE` · `REVOKED` · `DISABLED` (plus logical `UNBOUND`).

1. Authenticated Web user opens `/settings/integrations/telegram`
2. Confirms password (HTTP Basic + session cookie) and creates a binding token
3. Opens `https://t.me/<bot>?start=<opaque-token>`
4. Bot validates token (exists, unexpired, unused) and binds **Telegram numeric user ID** to that AuthUser
5. Confirmation message in Thai; audit event recorded
6. Revocation from the same Web page deletes session, invalidates outstanding tokens, and stops search

Conflicts:

- Telegram ID already ACTIVE for another app user → reject
- App user already ACTIVE for another Telegram ID → reject unless explicit “เชื่อมต่อบัญชีใหม่” (replace)

## Principal resolution

`resolveTelegramPrincipal(telegramUserId)` returns an `IntelligenceActor` or a typed failure:

`UNBOUND` · `REVOKED` · `DISABLED` · `USER_NOT_FOUND` · `USER_INACTIVE` · `SCOPE_UNAVAILABLE`

No permission rules live in this resolver.

## Session store

Interface: `get` / `set` / `delete` / `touch` with TTL, keyed by Telegram user id.

| Mode | Env | Multi-instance |
|------|-----|----------------|
| Prisma (default) | `TELEGRAM_SESSION_STORE=prisma` | Yes (Postgres) |
| Memory | `TELEGRAM_SESSION_STORE=memory` | **No** — development/tests only |

Sessions store safe interaction state only (mode, cursors, public unit codes, action stubs). Never full personnel records.

## Webhook hardening

- POST only
- `X-Telegram-Bot-Api-Secret-Token` validated (`TELEGRAM_WEBHOOK_SECRET`)
- Required when `NODE_ENV=production` or `TELEGRAM_REQUIRE_WEBHOOK_SECRET=1`
- Body size limit, JSON + update shape validation
- `update_id` dedupe before search
- `Cache-Control: no-store`
- No Bot Token or raw personal message text in ordinary error responses

Duplicate policy: second delivery of the same `update_id` returns `{ ok: true }` without re-running search. Prisma unique constraint; on storage failure the adapter fails open with a warning (documented).

## Deep links / Web handoff

Dashboard / profile actions use short-lived, single-use handoff tokens consumed at `/api/auth/telegram-handoff?token=…`.

- Destination must be allow-listed (`APPROVED_ACTION_PATH_PREFIXES`)
- No open redirects, no credentials in URLs
- Establishes only the already-bound app principal into the existing client session storage

## Rate limiting

Injectable `TelegramRateLimiter`. In-process limiter used for binding-token creation locally — **not** claimed multi-instance production-ready. Prefer edge/gateway limits in production.

## Configuration

| Env | Purpose |
|-----|---------|
| `TELEGRAM_BOT_TOKEN` | Bot API token (required to send messages) |
| `TELEGRAM_WEBHOOK_SECRET` | `X-Telegram-Bot-Api-Secret-Token` |
| `TELEGRAM_REQUIRE_WEBHOOK_SECRET` | Force secret validation outside production |
| `TELEGRAM_BOT_USERNAME` | For deep links `t.me/<bot>?start=…` |
| `TELEGRAM_SESSION_TTL_SECONDS` | Session TTL (default 3600) |
| `TELEGRAM_SESSION_STORE` | `prisma` (default) or `memory` |
| `TELEGRAM_IDENTITY_STORE` | `memory` for tests only; omit for Prisma |
| `TELEGRAM_ALLOWED_USER_IDS` | Optional Telegram user allow-list |
| `TELEGRAM_APP_BASE_URL` | Base URL for settings / handoff links |
| `TELEGRAM_DISCLOSURE_LEVEL` | `1` \| `2` \| `3` (default `2`) |
| `TELEGRAM_PAGE_LIMIT` | Page size 1–25 (default `8`) |
| `TELEGRAM_WEBHOOK_MAX_BODY_BYTES` | Body limit (default 65536) |

Do not commit real secrets.

## Local setup (safe)

1. Create a **development** bot with BotFather (never use production tokens in git)
2. Set env vars in `.env.local` (not committed)
3. Apply Prisma migration `telegram_identity_binding`
4. `npm run dev`
5. Sign in as a mock user → Settings → เชื่อมต่อ Telegram → open deep link
6. Register webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<host>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Production infrastructure still required

- Postgres (Prisma session + binding + dedupe tables) — already the preferred path
- Shared rate limiting across instances (Redis/edge) — interface ready; in-process is not enough
- Real AuthBackend / server sessions (today: mock AuthUser + Basic for Web APIs)
- TLS-terminated public webhook URL

## Out of scope

LINE, AI, OCR, voice, personnel editing, Telegram group authorization, broad admin console, production deployment.
