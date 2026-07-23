# Personnel Intelligence Service (Phase 49.5)

## Purpose

Stable, governed **application-facing facade** for personnel intelligence. Future consumers (Dashboard, Commander Intelligence Center, Executive Reports, Phase 50 AI tools, bots, mobile) call this layer instead of importing deep engine modules.

This phase does **not** rewrite Promotion / Retirement / Document / Training / Priority engines. It composes existing Commander dataset outputs into safe DTOs.

## Architecture

```
request
→ authenticate (API: session cookie + Basic Auth via AuthBackend)
→ resolve IntelligenceActor + authorized scope
→ orchestrateCommanderDashboardPageData()  // ONE load
→ buildCommanderIntelligenceCenter()
→ createPersonnelIntelligenceContext()
→ createPersonnelIntelligenceService()
→ filter / sort / paginate / serialize DTOs
→ response
```

Primary module: `lib/personnel_intelligence_service/`  
Server adapter: `lib/server/personnel_intelligence_service.ts`  
API handlers: `lib/server/personnel_intelligence_api_handlers.ts`

## Data flow

1. **One dataset per request** via `orchestrateCommanderDashboardPageData` (same sequence as CIC page data).
2. Request-scoped context holds `dataset`, `dashboard`, `viewModel`, `center`, `actor`.
3. No global mutable personnel cache; no second Prisma round-trip for service methods on that context.

## Service contracts

`PersonnelIntelligenceService`:

| Method | Capability (mapped) |
|--------|---------------------|
| `getCommanderSummary` | `dashboard.view` |
| `searchOfficers` | `commander.search` or `officers.view` |
| `getOfficerIntelligence` | `officers.view` or own `officer.viewOwn` |
| `getPromotionSummary` | `dashboard.view` |
| `getRetirementSummary` | `dashboard.view` |
| `getDocumentSummary` | `dashboard.view` |
| `getTrainingSummary` | `dashboard.view` |
| `getExecutiveBrief` | `dashboard.view` |
| `getReportProjection` | `dashboard.view` (delegates to Phase 49C `buildExecutiveReport`) |

Logical capability names (`intelligence.*.view`) are **not** new RBAC entries — they map onto existing permissions in `permissions.ts`.

## DTOs

Serializable allowlisted types in `types.ts` / `serializers.ts`:

- `CommanderSummaryDto`
- `OfficerIntelligenceSummaryDto` / `OfficerIntelligenceDetailDto`
- domain summary DTOs
- `ExecutiveBriefDto`
- `ReportProjectionDto`
- `PaginationDto` / `FilterOptionsDto`

Dates on the wire are ISO strings. No functions, class instances, or Prisma rows.

## Authorization

- Commander/Admin with `dashboard.view` → aggregates + reports.
- Commander/Admin with `commander.search` / `officers.view` → officer search.
- Officer role → **cannot** browse all personnel; may view **own** officer intelligence only.
- Organization scope fields exist for future ACL; today authorized commanders are unrestricted (matching current product — no per-region ACL on `AuthUser` yet).

## Sensitive-data policy

Serializers **allowlist** fields. Explicitly excluded (and tested):

- national ID, passport
- raw OCR text / confidence
- fingerprints
- storage paths / buckets / signed URLs
- auth tokens
- private/admin notes
- bank/salary history payloads
- `driveFileId`, `webViewUrl`, `thumbnailUrl`

`officialPortraitUrl` is retained when already resolved for authorized commander surfaces (same as CIC/Search).

## Filtering semantics

Aligned with Commander Search / Executive Reports:

- Org: `regionId` / `battalionId` / `companyId` equality
- `rank`, `positionLevel`, `priority`, `readiness`, `trainingStatus`
- `documentStatus`: missing | expired | warning | complete
- `retirementWithin`: within-1-year | within-3-years | within-5-years
- Convenience: `readyForPromotion`, `promotionOverdue`, `birthdayWindow`, `searchText`

Unknown filter values → `INVALID_QUERY`. Filters never mutate the source array.

## Sorting and pagination

Allowed sorts: `name`, `rank`, `organization`, `priority`, `promotionStatus`, `retirementYear`, `readiness`, `birthday`.  
Tie-breaker: `officerId`.  
`pageSize` max = **100** (same bound as existing officer APIs).

## API routes

| Method | Path |
|--------|------|
| GET | `/api/intelligence/summary` |
| GET | `/api/intelligence/officers` |
| GET | `/api/intelligence/officers/[officerId]` |

Auth:

1. `bppis_session` cookie required when `AUTH_ENFORCED`
2. HTTP Basic credentials validated via existing `AuthBackend` (mock accounts)

Envelope: existing `{ data, meta? }` / `{ error: { code, message } }` (`jsonOk` / `jsonError`).

No POST/PUT/DELETE. No public CORS expansion.

Example:

```bash
curl -u admin:414 -H "Cookie: bppis_session=1" \
  "http://localhost:3000/api/intelligence/summary"
```

## Phase 50 tool readiness

`lib/personnel_intelligence_service/tools.ts` registers nine tool names and parameter schemas for future AI tool calling. **No LLM, prompts, or execution runtime** in this phase.

## Limitations

- Server actor identity for browser SPAs still needs a real HttpOnly session (Basic Auth is the interim API convention).
- Organization ACL is not yet stored on `AuthUser` (unrestricted for authorized commanders).
- Portrait URLs may be external CDN/Drive URLs already used by commander UI — not private storage paths.
- Existing pages are not migrated to the facade yet (adapters exist for proof).

## Internal caller example

```ts
const { service } = await createPersonnelIntelligenceServiceForRequest({
  actor: actorFromAuthUser(user),
});
const summary = service.getCommanderSummary({ scope: { regionId: 1 } });
const page = service.searchOfficers({ filters: { priority: "critical" }, page: 1, pageSize: 20 });
```
