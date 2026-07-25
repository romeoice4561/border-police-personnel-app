# Personnel Search API (Phase 51.1)

Secure, read-only HTTP boundary around the Phase 51 Personnel Search Gateway.

## Endpoint

`POST /api/personnel-search`

- Authenticated only (anonymous rejected)
- `Cache-Control: no-store`
- No GET search with query strings (GET returns 405)
- No Telegram / LINE presentation logic in this layer

## Architecture

```
HTTP Request
  → Authentication (Phase 49.5 resolveIntelligenceActor)
  → Request validation (Zod)
  → Permission / organization scope
  → CommanderQueryDataset adapter (one load)
  → Optional batch enrichment (nickname / phones)
  → searchPersonnel(request, context)
  → Response sanitizer + opaque cursor
  → Structured audit event
  → HTTP response
```

Domain logic (intent, ranking, permissions, disclosure, formatting) stays in `lib/personnel_search`.

## Authentication

Reuses Phase 49.5 intelligence auth:

- Session cookie `bppis_session=1` (dev mock) **and**
- HTTP Basic credentials for a seeded mock user (e.g. `bpp414` / `414`, `admin` / `414`)

Server resolves: user id, role, permissions, linked officer id.  
Never trust `x-role`, `x-user-id`, `x-unit`, or `x-permission-scope`.

## Request

```json
{
  "query": "ร้อย 414",
  "disclosureLevel": 1,
  "intentHint": "UNIT_LOOKUP",
  "unitScope": { "companyCode": "414" },
  "cursor": null,
  "limit": 10,
  "client": "web"
}
```

| Field | Rules |
|-------|--------|
| `query` | Trimmed; max 200 chars; empty only for HELP |
| `disclosureLevel` | `1` \| `2` \| `3` (default `1`) — cannot elevate permissions |
| `intentHint` | Advisory only |
| `unitScope` | Optional codes; must not exceed authorized scope |
| `limit` | Default 10, max 25 |
| `client` | `web` \| `telegram` \| `line` \| `internal` (`internal` → gateway `api`) |
| identity / role | **Not accepted** from the client |

## Response

Success:

```json
{
  "ok": true,
  "requestId": "…",
  "result": { "intent": "UNIT_LOOKUP", "resultType": "unit_summary", "items": [], "…": "…" },
  "meta": {
    "generatedAt": "…",
    "client": "web",
    "disclosureLevel": 1,
    "nextCursor": null,
    "resultCount": 0,
    "totalCount": 0
  }
}
```

Error:

```json
{
  "ok": false,
  "requestId": "…",
  "error": { "code": "UNAUTHENTICATED", "message": "Authentication required" }
}
```

### Error codes

`UNAUTHENTICATED` · `FORBIDDEN` · `INVALID_REQUEST` · `QUERY_TOO_LONG` · `INVALID_DISCLOSURE_LEVEL` · `OUT_OF_SCOPE` · `RATE_LIMITED` · `SEARCH_UNAVAILABLE` · `INTERNAL_ERROR`

No stack traces, repository errors, or raw exception messages.

## Role / organization scope

- Directory-capable actors (commander/admin with search/dashboard capabilities): unrestricted org scope today (AuthUser has no ACL geography fields yet).
- Officers without directory aggregate capability: cannot pass `unitScope` (`OUT_OF_SCOPE`); Gateway still applies `subjectOfficerId` ownership filtering.
- Disclosure level and `intentHint` never expand ACL.
- Policy: unauthorized requested `unitScope` → **403 OUT_OF_SCOPE** (not an empty success).

## Disclosure levels

1. Summary / basic directory / safe actions  
2. Authorized intelligence (promotion, retirement, training/documents where permitted)  
3. Expanded authorized summary + secure relative deep links — never a raw personnel file  

Never returned: national ID, bank details, home address, medical data, passwords/PINs, document bytes.

## Pagination

Opaque base64url cursor `{ o, k }` (offset + search fingerprint). Invalid cursor → `INVALID_REQUEST`. First disambiguation page suppresses `nextCursor` so clarification is not skipped.

## Enrichment

Batch Prisma read of `nickname`, `Officer.phone` (duty), and `Phone[]`. Failures → empty map (search continues). Permission filtering remains inside the Gateway. Raw enrichment objects are never returned.

## Audit

Structured event with hashed query (`normalizedQueryHash`), intent, role, scope summary, outcome, duration. Raw queries are not written to ordinary application logs. No DB table in this phase.

## Rate limiting

Injectable `PersonnelSearchRateLimiter` interface; default allow-all. Production edge / gateway rate limiting remains an infrastructure requirement.

## Deep links

Actions expose approved relative paths only (`/officers/…`, `/commander-promotion`, …). Absolute/external URLs are stripped.

## Local examples (authenticated)

PowerShell:

```powershell
$pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("bpp414:414"))
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/personnel-search" `
  -Headers @{
    Authorization = "Basic $pair"
    Cookie = "bppis_session=1"
  } `
  -ContentType "application/json" `
  -Body '{"query":"ร้อย 414","disclosureLevel":1,"client":"web"}'
```

curl:

```bash
curl -X POST http://localhost:3000/api/personnel-search \
  -u bpp414:414 \
  -H "Cookie: bppis_session=1" \
  -H "Content-Type: application/json" \
  --data "{\"query\":\"ชลัช\",\"disclosureLevel\":1,\"client\":\"web\"}"
```

There is **no** authentication bypass query parameter.

## Integration contract (Telegram / LINE)

Adapters should:

1. Authenticate the bot service / map chat → app principal  
2. Call this API with `client: "telegram"` or `"line"`  
3. Map `result.actions` / relative `href`s to platform buttons  
4. Never re-implement search ranking or permission logic  

Phase 51.2 Telegram adapter: `lib/personnel_search_telegram/` + `POST /api/telegram/webhook`
(see `docs/architecture/personnel-search-telegram.md`).

## Entity resolution (Phase 51.1A)

Human queries are resolved through `lib/personnel_entities` before Gateway search:

`ร้อย414` / `414` / `ตชด.414` → public company code `414` → internal `Company.id` (e.g. 57)

Clients never need to know internal FKs. Unit responses expose `publicCode` + `displayName`. Person items expose `organizationPublic.{regionCode,divisionCode,companyCode}`.

## Known limitations

- Production-grade rate limiting is not wired (injectable allow-all policy only).
- AuthUser still has no geography ACL fields; directory-capable roles are org-unrestricted.
- Conversation context contracts exist but are not persisted yet.
- No persisted audit table in this phase (structured console/sink events only).

## Out of scope (this phase)

Telegram/LINE webhooks, AI parsing, schema migrations, public anonymous directory, result caching, production deploy.
