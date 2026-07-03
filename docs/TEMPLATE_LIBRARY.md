# Template Library

Describes the naming convention for known layout templates and the initial
seed set registered in `LayoutRegistry`. This is a reference document, not
an implementation — templates listed here have no visual matching logic
behind them yet (see `docs/LAYOUT_ENGINE.md`, "Future Extension Points").

## Naming Convention

```
<category_slug>_v<version>
```

- `category_slug` — lowercase, underscore-separated short name for the
  layout family (matches a `LayoutCategory`, lowercased).
- `version` — integer, incremented whenever a region issues a visually
  distinct variant of the same family (new field positions, added/removed
  sections, different orientation).
- The literal id `unknown` is reserved for images that cannot be confidently
  matched to any registered template.

Aliases are used when the same physical template is known by more than one
name across regions (e.g. a region-specific nickname for a shared
timeline template). Aliases resolve to the same `template_id` via
`LayoutRegistry.findByAlias`.

## Category Slugs

| LayoutCategory | Slug |
|---|---|
| Timeline | `timeline` |
| ProfileCard | `profile` |
| SimpleCard | `simple` |
| OrganizationCard | `organization` |
| HistoryCard | `history` |
| BiographyCard | `biography` |
| MixedLayout | `mixed` |
| Unknown | `unknown` |

## Seed Templates (registered by default)

| template_id | category | version | notes |
|---|---|---|---|
| `timeline_v1` | Timeline | 1 | Earliest known timeline layout |
| `timeline_v2` | Timeline | 2 | Revised timeline layout |
| `timeline_v3` | Timeline | 3 | Current timeline layout, landscape-oriented |
| `profile_v1` | ProfileCard | 1 | Standard photo + basic info card |
| `history_v1` | HistoryCard | 1 | Career history-focused layout |
| `organization_v1` | OrganizationCard | 1 | Unit/organization-focused layout |
| `unknown` | Unknown | 0 | Fallback when no template matches confidently |

Additional templates (`simple_v1`, `biography_v1`, region-specific variants,
etc.) are expected to be added as real samples from each of the four regions
are reviewed. Each new template should be registered via
`LayoutRegistryStore.register` with its `expectedFields` populated once its
field layout has been characterized.

## Adding a New Template

1. Confirm the layout doesn't already match an existing template or alias.
2. Choose the correct `category_slug` from the table above.
3. Increment the version if it's a variant of an existing family, otherwise
   start at `v1`.
4. Register a `TemplateDefinition` with `template_id`, `category`,
   `version`, `aliases` (if any), and `expectedFields` (once known).
5. Document the new template in the seed table above.
