# Personnel Entity Resolution (Phase 51.1A)

Translates human-friendly organization language into canonical entities before the Personnel Search Gateway runs.

## Flow

```
Query
  → Intent Parser
  → Entity Resolver   (lib/personnel_entities)
  → Search Gateway
  → Formatter
```

Clients (Telegram / LINE / Web / AI Assistant) must not resolve `companyId` / `battalionId` / `regionId` themselves.

## Public vs internal

| Concept | Example |
|---------|---------|
| Public code | `414`, `41`, `4` |
| Display name | `ร้อย ตชด.414` |
| Internal id | `Company.id = 57` (repository / in-memory match only) |

## Module

`lib/personnel_entities/` — pure, no HTTP / Telegram / Prisma.

Entry: `resolvePersonnelEntities(query, { organizationTree, conversationContext })`

## Alias system

Centralized in `aliases.ts` (company / division / region). Search modules do not hard-code alias lists.

## Conversation context

`PersonnelSearchConversationContext` allows a prior unit (e.g. Company 414) to scope a later query (`พร้อมเลื่อน`). **Not persisted** in this phase — contracts only.

## Suggestions

`buildUnitSuggestionActions` returns safe action descriptors (strength, promotion-ready, retirement, training, documents, dashboard). Platform adapters map these later.
