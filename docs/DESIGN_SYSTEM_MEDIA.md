# Media Display Design System

**Version:** Phase 30.2  
**Scope:** Visual consistency for every image, avatar, gallery tile, and document thumbnail across the Border Police Personnel application.

> This design system covers **visual presentation only**. It does not change business logic, database schema, APIs, OCR pipeline, import engine, AI pipeline, or permissions.

---

## Purpose

Every officer reference, photo gallery, and document thumbnail must follow one unified design language. A reviewer should immediately understand what type of media they are looking at — a portrait, a gallery photo, a document — purely from its visual presentation.

---

## Component Hierarchy

```
components/ui/media/
├── index.ts               ← barrel export, single import point
├── PortraitAvatar.tsx     ← circular officer portrait (wraps OfficerPhoto)
├── GalleryImage.tsx       ← rectangular gallery tile
├── DocumentThumbnail.tsx  ← document/PDF thumbnail
├── MediaPlaceholder.tsx   ← empty-state icons (portrait/gallery/doc/pdf/file)
└── MediaBadge.tsx         ← overlaid informational badges (Current, Official, ✓)

lib/ui/
└── media_tokens.ts        ← shared size, radius, and spacing constants
```

Underlying components used internally:

```
components/officer/
├── officer_photo.tsx      ← OfficerPhoto — core circular portrait rendering
├── photo_viewer.tsx       ← full-screen zoom/pan viewer
└── photo_modal.tsx        ← modal chrome around the viewer
```

---

## Visual Standards

### Official Portrait (Part 3)
Represents officer identity. Used everywhere an officer is referenced.

| CSS property | Value |
|---|---|
| `border-radius` | `9999px` (Tailwind: `rounded-full`) |
| `overflow` | `hidden` |
| `object-fit` | `cover` |
| `object-position` | `center` |
| `aspect-ratio` | `1 / 1` (square) |

**Applied in:** Profile Header, Officer Card, Officer Table, Search Results, Dashboard, Assignments, Approvals, Recent Activity, Portrait History.

### Portrait History (Part 4)
Same circular style as Official Portrait. Differentiated by labels only (e.g. "Current", "v3").  
**Applied in:** `PortraitHistoryPanel` — uses `OfficerPhoto` with `AVATAR_SIZE.MD`.

### Photo Gallery (Part 5)
Gallery images are **not** officer portraits. Use rounded rectangle, never circle.

| CSS property | Value |
|---|---|
| `border-radius` | `12px` (Tailwind: `rounded-xl`) |
| `object-fit` | `cover` |
| `aspect-ratio` | `4 / 3` (default) |

Supports fullscreen preview via `PhotoModal`.

### Document Thumbnail (Part 6)
Never circular. Preserves full-page visibility for A4 documents.

| Document type | Canvas | Object-fit |
|---|---|---|
| NATIONAL_ID, OFFICER_CARD, DRIVER_LICENSE, PASSPORT | `144×96 px` (landscape) | `cover` |
| All other types (GP7, certificates, forms, letters) | `112×144 px` (portrait) | `contain` |
| History row | `56×56 px` | inherits from type |

### PDF (Part 7)
Shows `FileText` icon + "PDF" label. Never cropped into a circle.

### Other Files (Part 8)
Shows `File` or `FileText` icon via `MediaPlaceholder`. No fake thumbnails.

---

## Token Reference

### Avatar Size Scale (Part 9)

```ts
import { AVATAR_SIZE } from "@/lib/ui/media_tokens";

AVATAR_SIZE.XS  = 24   // inline chips, mention badges
AVATAR_SIZE.SM  = 32   // data table rows
AVATAR_SIZE.MD  = 48   // officer cards, search results, portrait history
AVATAR_SIZE.LG  = 72   // profile header (mobile), detail cards
AVATAR_SIZE.XL  = 120  // profile header (desktop), large previews
AVATAR_SIZE.XXL = 180  // portrait management, fullscreen
```

### Corner Radius Scale (Part 10)

```ts
import { RADIUS } from "@/lib/ui/media_tokens";

RADIUS.AVATAR    = "rounded-full"  // portrait circles
RADIUS.GALLERY   = "rounded-xl"   // gallery tiles (12px)
RADIUS.DOCUMENT  = "rounded-md"   // document thumbnails (8px)
RADIUS.CARD      = "rounded-2xl"  // card containers (16px)
RADIUS.MODAL     = "rounded-2xl"  // modals/dialogs (20px)
```

### Spacing Scale (Part 11)

```ts
import { SPACING } from "@/lib/ui/media_tokens";

SPACING.XS   = 4    // gap-1,  p-1
SPACING.SM   = 8    // gap-2,  p-2
SPACING.MD   = 12   // gap-3,  p-3
SPACING.LG   = 16   // gap-4,  p-4
SPACING.XL   = 24   // gap-6,  p-6
SPACING.XXL  = 32   // gap-8,  p-8
SPACING.XXXL = 48   // gap-12, p-12
```

---

## Usage Examples

### Officer Portrait (circular avatar)

```tsx
import { PortraitAvatar, AVATAR_SIZE } from "@/components/ui/media";

// Data table row
<PortraitAvatar name={officer.name} thumbnailUrl={officer.thumbnailUrl} size={AVATAR_SIZE.SM} />

// Officer card
<PortraitAvatar name={officer.name} thumbnailUrl={officer.thumbnailUrl} size={AVATAR_SIZE.MD} />

// Profile header (mobile)
<PortraitAvatar
  name={officer.name}
  thumbnailUrl={portrait.thumbnailUrl}
  driveFileId={portrait.driveFileId}
  size={AVATAR_SIZE.LG}
/>
```

### Gallery Image (rounded rectangle)

```tsx
import { GalleryImage } from "@/components/ui/media";

<div className="group relative rounded-xl overflow-hidden aspect-[4/3]">
  <GalleryImage
    src={asset.thumbnailUrl}
    alt={asset.folderName}
    fallbackSrc={asset.thumbnailUrl}
    hoverScale
    className="h-full w-full"
  />
</div>
```

### Document Thumbnail

```tsx
import { DocumentThumbnail } from "@/components/ui/media";

// Main document card
<DocumentThumbnail
  fileUrl={doc.fileUrl}
  mimeType={doc.mimeType}
  documentTypeCode={doc.documentType}
  size="md"
  altText={`${doc.documentType} thumbnail`}
/>

// History row (compact)
<DocumentThumbnail
  fileUrl={doc.fileUrl}
  mimeType={doc.mimeType}
  documentTypeCode={doc.documentType}
  size="sm"
/>
```

### Placeholder

```tsx
import { MediaPlaceholder } from "@/components/ui/media";

<MediaPlaceholder type="portrait" initials="อข" iconSize="md" />
<MediaPlaceholder type="gallery" className="h-full w-full" />
<MediaPlaceholder type="pdf" iconSize="lg" />
```

### Overlaid Badge

```tsx
import { MediaBadge } from "@/components/ui/media";

<div className="relative">
  <GalleryImage ... />
  <MediaBadge variant="current" position="top-left" />
  <MediaBadge variant="official" position="top-right" />
</div>
```

---

## Do / Don't

### Portraits

| ✅ Do | ❌ Don't |
|---|---|
| Always use `rounded-full` + `object-cover` for officer portraits | Display an officer portrait as a square or rectangle |
| Use `AVATAR_SIZE.*` token constants for sizes | Use arbitrary pixel values like `size={40}` |
| Show initials/icon placeholder when no photo exists | Show a broken-image icon |
| Use `PortraitAvatar` for new code | Inline a raw `<img>` for portrait rendering |

### Gallery

| ✅ Do | ❌ Don't |
|---|---|
| Use `rounded-xl` (12px) for gallery tiles | Crop gallery images into circles |
| Maintain `aspect-[4/3]` for gallery grids | Use irregular or inconsistent aspect ratios |
| Support fullscreen preview via PhotoModal | Open raw image URLs without navigation |
| Use `GalleryImage` for new gallery tiles | Duplicate the lazy/fade/error pattern inline |

### Documents

| ✅ Do | ❌ Don't |
|---|---|
| Use `DocumentThumbnail` for all document thumbnails | Render documents in circles |
| Use `object-cover` for card-shaped IDs | Crop ID cards to tiny contain thumbnails |
| Use `object-contain` on a taller canvas for A4 docs | Crop certificates/forms |
| Always show a PDF icon for PDFs | Show a broken icon for unsupported formats |

---

## Migration Notes

### Pre-existing sizes that don't map exactly to tokens

Some components introduced before Phase 30.2 use sizes outside the canonical token scale. These are documented in `AVATAR_LEGACY` in `media_tokens.ts` and should be migrated to the nearest token in a future cleanup:

| Component | Current size | Migration target |
|---|---|---|
| `OfficerCard` | 40 px | `AVATAR_SIZE.MD` (48 px) |
| `PortraitManager` header | 80 px | `AVATAR_SIZE.LG` (72 px) |

---

## Accessibility (Part 13)

Every media component must:
- Provide meaningful `alt` text (not empty, not "image").
- Use `loading="lazy"` on all thumbnails to defer off-screen network requests.
- Never show a broken browser image icon (always a graceful fallback).
- Where an image is interactive (opens a viewer), use a `<button>` with an `aria-label`.
- Mark purely decorative icons with `aria-hidden="true"`.

---

## Dark Mode (Part 14)

All media components use CSS custom properties (`--background`, `--surface`, `--border`, `--neutral-bg`, `--muted`) defined in `app/globals.css`. These automatically switch in `@media (prefers-color-scheme: dark)`. No separate dark-mode variants are needed.

---

## Responsive (Part 15)

- Avatar sizes scale via the token constants — use `AVATAR_SIZE.SM` on mobile/table and `AVATAR_SIZE.LG`/`XL` on desktop via Tailwind's responsive variants if needed.
- Gallery grids use Tailwind `grid-cols-3 sm:grid-cols-4 md:grid-cols-6` patterns already present in `PhotoGallery`.
- Document thumbnails maintain fixed pixel dimensions; the section card wraps them appropriately.

---

## Animation (Part 16)

| Animation | Implementation |
|---|---|
| Fade-in on image load | `opacity-0 → opacity-100` with `transition-opacity duration-300` |
| Gallery tile hover | `group-hover:scale-105` with `transition-all duration-300` |
| Document image replace | Cross-fade: new image fades in over old (200 ms) in `DocumentThumbnail` |
| Delete optimistic | Fade-out in `DocumentRow` (managed by `fadingOut` state) |
| Badge transition | `transition-colors duration-300` on `Badge` component |

All animations are subtle. Do not add additional transforms, bounces, or delays.

---

## Performance (Part 17)

- `loading="lazy"` on all thumbnails (no off-screen fetch).
- `decoding="async"` on gallery images (non-blocking decode).
- `PhotoModal` and `PhotoViewer` are mounted only on click (lazy viewer init).
- `DocumentThumbnail` fetches only when the component scrolls into view.
- `useCallback`/`useMemo` used where the component creates stable callbacks passed to child effects.

---

## Future Extensions

- **FileThumbnail component**: Use file-type icons (ZIP, DOCX, XLSX, PPTX, CSV, RAR) for any document type that isn't an image or PDF. The `FileThumbnail` slot is reserved in `components/ui/media/` and `index.ts` can be extended when the document vault supports those MIME types.
- **PdfThumbnail component**: When the API exposes a rendered page preview for PDFs (e.g. via PDF.js or a server-side render endpoint), extract PDF preview rendering into `PdfThumbnail.tsx`. The current `DocumentThumbnail` already handles the PDF-icon fallback.
- **PortraitHistoryAvatar**: If portrait history needs additional UI controls beyond what `OfficerPhoto` provides (e.g. hover actions, overlay animations), promote the history avatar into a named `PortraitHistoryAvatar.tsx` component.
- **Migrate legacy sizes**: Update `OfficerCard` (40→48 px) and `PortraitManager` (80→72 px) to canonical token values once the visual impact has been reviewed.
