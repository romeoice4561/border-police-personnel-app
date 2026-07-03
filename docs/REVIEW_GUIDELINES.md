# Review Guidelines

Practical guidance for a human reviewer working through a `ReviewSession`
produced by the Phase 8 review layer. This is a process document, not an
API reference — see `docs/HUMAN_REVIEW.md` for architecture.

## Before You Start

Every session comes with:
- The AI's extraction (`aiResult.normalized_extraction`).
- A list of flagged `concerns` (confidence issues surfaced automatically).
- The source image reference and detected template
  (`aiResult.processing_metadata`).

Read the `concerns` list first — it tells you where the AI itself is least
confident, so you know where to look closely before rubber-stamping.

## What to Check

1. **Name** — does `first_name`/`last_name` match the image exactly,
   including spelling and any suffixes?
2. **Rank and Position** — do these match the organization's known rank
   titles? Watch for OCR-style confusions (e.g. "Corporal" vs
   "Colonel").
3. **Unit** — is this the officer's *current* unit, or could the AI have
   picked up a unit mentioned elsewhere on the card (e.g. in the
   timeline)?
4. **Phone** — verify the digit count and format look like a real number;
   a `missing_phone` concern means the field was empty, not necessarily
   wrong.
5. **Timeline** — check chronological order and that each entry's
   `year`/`position`/`unit` triple is internally consistent. A
   `timeline_uncertainty` concern means at least one year didn't look
   like a 4-digit year.

## When to Approve

Approve when the extraction (as edited, if you made corrections) is a
faithful representation of what's on the source image, and any flagged
concerns have been checked and are not actually errors (e.g. the officer's
card genuinely has no listed phone number).

## When to Reject

Reject when the image itself is unusable for extraction — wrong document
entirely, illegible, corrupted, or not a personnel profile at all. Include
a reason; `exportRejected` accepts an optional `reason` string specifically
for this.

## When to Mark "Needs Correction"

Use `NeedsCorrection` when you've made edits but want a second reviewer
(or yourself, later) to confirm before final approval — for example, when
you had to infer a value that wasn't clearly legible on the image. A
`NeedsCorrection` session can move back to `Pending` for another review
pass, or on to `Approved`/`Rejected` once resolved.

## Editing

Use `ReviewSessionManager.applyEdit` to record a correction. Always
include a `note` explaining *why* you changed something — this is what
makes the exported `CorrectionExport.changes` useful for future training
data or audits, rather than just a diff with no context.

## Confidence Concern Severity

| Severity | Meaning |
|---|---|
| `critical` | Overall confidence very low — treat the whole extraction as suspect, re-check every field against the image. |
| `warning` | A specific signal (field confidence, timeline uncertainty, missing unit) that needs a deliberate check, not necessarily an error. |
| `info` | Worth noting but often expected/benign (e.g. a card that legitimately has no phone listed). |

## Multiple Reviewers

The `Reviewer` type is a plain `{ id, name }` pair — there is no
authentication or permission system in this phase. When more than one
person reviews the same session (e.g. an initial reviewer marks
`NeedsCorrection`, a second approves), both appear in `session.history`
with their own timestamped entries, so the full review trail is visible in
the generated report.
