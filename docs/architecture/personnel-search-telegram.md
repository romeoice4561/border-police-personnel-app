# Telegram Commander Experience (Phase 51.2)

Presentation-only Telegram client for the Personnel Intelligence Platform.

## Architecture

```
Telegram Update
  → POST /api/telegram/webhook
  → Update dispatcher
  → Session (in-memory conversation context)
  → Personnel Search API (handlePersonnelSearchRequest)
  → Message formatter + inline keyboard
  → Telegram Bot API sendMessage
```

The Telegram layer does **not** implement search, ranking, permissions, entity resolution, promotion/retirement logic, or repository access.

## Home menu

- 🔍 ค้นหากำลังพล
- 🏢 ค้นหาหน่วย
- 📈 การเลื่อนตำแหน่ง
- 👴 การเกษียณ
- 🎓 หลักสูตร
- 📄 เอกสาร
- 📊 Dashboard
- ❓ วิธีใช้งาน

Free-text messages (e.g. `414`) call the search API directly.

## Configuration

| Env | Purpose |
|-----|---------|
| `TELEGRAM_BOT_TOKEN` | Bot API token (required to send messages) |
| `TELEGRAM_WEBHOOK_SECRET` | Optional `X-Telegram-Bot-Api-Secret-Token` |
| `TELEGRAM_SERVICE_USERNAME` | Basic auth user for Personnel Search API (default `bpp414`) |
| `TELEGRAM_SERVICE_PASSWORD` | Basic auth password (default `414`) |
| `TELEGRAM_ALLOWED_USER_IDS` | Optional comma-separated Telegram user allow-list |
| `TELEGRAM_APP_BASE_URL` | Base URL for Dashboard / profile links |
| `TELEGRAM_DISCLOSURE_LEVEL` | `1` \| `2` \| `3` (default `2`) |
| `TELEGRAM_PAGE_LIMIT` | Page size 1–25 (default `8`) |

## Webhook setup

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<host>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Conversation context

Unit lookups store `{ level, publicCode, displayName }` in the Telegram session only.  
Follow-up buttons (พร้อมเลื่อน / เกษียณ / …) call the API with `unitScope.companyCode` (etc.). Not persisted to a database.

## Out of scope

LINE, AI, OCR, voice, personnel editing, DB migrations, multi-instance session sharing.
