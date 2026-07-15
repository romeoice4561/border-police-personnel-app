/**
 * Media Display Design System — shared tokens (Phase 30.2).
 *
 * Single source of truth for every size, radius, and fit value used by
 * image-rendering components across the application. Importing from this
 * module ensures consistent visual language regardless of which component
 * or page renders a portrait, gallery tile, or document thumbnail.
 *
 * Usage
 * -----
 *   import { AVATAR_SIZE, AVATAR_LG, GALLERY_RADIUS, DOC_SIZE } from "@/lib/ui/media_tokens";
 *
 *   <OfficerPhoto size={AVATAR_LG} />  // 72px — profile header
 *   <OfficerPhoto size={AVATAR_SM} />  // 32px — table row
 */

// ── Avatar size scale (Part 9) ────────────────────────────────────────────────

/** Named avatar sizes in pixels. Use these instead of arbitrary numbers. */
export const AVATAR_SIZE = {
  /** 24 px — inline chips, mention badges. */
  XS: 24,
  /** 32 px — data table rows, compact lists. */
  SM: 32,
  /** 48 px — standard cards, search results. */
  MD: 48,
  /** 72 px — profile header (mobile), detail cards. */
  LG: 72,
  /** 120 px — profile header (desktop), large previews. */
  XL: 120,
  /** 180 px — portrait management, fullscreen controls. */
  XXL: 180,
} as const;

export type AvatarSizeKey = keyof typeof AVATAR_SIZE;
export type AvatarSizePx = (typeof AVATAR_SIZE)[AvatarSizeKey];

// Convenience aliases for the most-used sizes.
export const AVATAR_XS = AVATAR_SIZE.XS;
export const AVATAR_SM = AVATAR_SIZE.SM;
export const AVATAR_MD = AVATAR_SIZE.MD;
export const AVATAR_LG = AVATAR_SIZE.LG;
export const AVATAR_XL = AVATAR_SIZE.XL;
export const AVATAR_XXL = AVATAR_SIZE.XXL;

/**
 * Existing size→token mapping for places that used non-standard sizes before
 * Phase 30.2. Use these when migrating incrementally to avoid visual regressions.
 *
 *   size=40  (officer card) → map to AVATAR_MD (48) or keep as 40 during migration
 *   size=80  (portrait manager) → closest is AVATAR_LG (72) or XL (120)
 */
export const AVATAR_LEGACY = {
  /** Officer card / mobile list — 40px, between SM and MD. Target: MD in next cleanup. */
  OFFICER_CARD: 40,
  /** Portrait manager header — 80px, between LG and XL. Target: LG in next cleanup. */
  PORTRAIT_MANAGER: 80,
} as const;

// ── Corner radius scale (Part 10) ────────────────────────────────────────────

/** Semantic radius tokens. These map directly to Tailwind utility classes. */
export const RADIUS = {
  /** Portrait / avatar circles — always full circle. Tailwind: rounded-full */
  AVATAR: "rounded-full",
  /** Gallery images — large softened rectangle. Tailwind: rounded-xl */
  GALLERY: "rounded-xl",
  /** Document thumbnails — medium rectangle. Tailwind: rounded-md */
  DOCUMENT: "rounded-md",
  /** Document thumbnails (sm variant, history row). Tailwind: rounded */
  DOCUMENT_SM: "rounded",
  /** Card container. Tailwind: rounded-2xl */
  CARD: "rounded-2xl",
  /** Modal/dialog. Tailwind: rounded-2xl */
  MODAL: "rounded-2xl",
} as const;

// ── Spacing scale (Part 11) ───────────────────────────────────────────────────

/** Canonical spacing steps in px. Use Tailwind's gap/p/m utilities that map to these. */
export const SPACING = {
  XS: 4,   // gap-1,  p-1
  SM: 8,   // gap-2,  p-2
  MD: 12,  // gap-3,  p-3
  LG: 16,  // gap-4,  p-4
  XL: 24,  // gap-6,  p-6
  XXL: 32, // gap-8,  p-8
  XXXL: 48,// gap-12, p-12
  XXXXL: 64, // gap-16, p-16
} as const;

// ── Document thumbnail canvas sizes (Part 6; Phase 45A refinement) ─────────────

/**
 * Document SHAPE classification — drives the thumbnail canvas ASPECT only.
 * Every document thumbnail uses object-contain (Phase 45A refinement: official
 * documents must NEVER be cropped), so this only decides whether the canvas is
 * landscape (ID-card-shaped) or portrait (A4-shaped) to minimise letterboxing
 * and maximise document recognition.
 *
 * Landscape types: physical cards + the passport photo page (all wider-than-
 * tall). Everything else — house registration, GP7 (ก.พ.7), appointment
 * orders, certificates, "other", and any unknown/custom type — is treated as
 * portrait A4.
 */
export const DOCUMENT_LANDSCAPE_TYPES = new Set([
  "NATIONAL_ID",
  "OFFICER_CARD",
  "DRIVER_LICENSE",
  "PASSPORT",
  "MILITARY_RECORD", // ป.4 — a card-shaped record
]);

/** True when a document type is landscape (ID-card-shaped); false ⇒ portrait A4. */
export function isLandscapeDocumentType(code: string): boolean {
  return DOCUMENT_LANDSCAPE_TYPES.has(code);
}

/**
 * Width (in pixels) requested from the Supabase image-render endpoint for
 * document thumbnails. Larger than the displayed size to stay sharp on
 * high-DPI displays.
 */
export const DOCUMENT_THUMBNAIL_RENDER_WIDTH = 480;

/**
 * Canvas dimensions for each document thumbnail variant (Phase 45A refinement:
 * ~25% smaller than the previous card sizes, and ALWAYS object-contain so the
 * whole document shows with no cropping). The card DIMENSIONS are unchanged —
 * only the thumbnail inside is smaller — so the type/badge column gets more
 * breathing room while the document stays fully recognisable.
 *
 * Aspect ratios are chosen to match each shape so a contained image barely
 * letterboxes:
 *   • LANDSCAPE 112×72 (~3.5:2.25, close to the ID-1 card 1.585:1)
 *   • PORTRAIT  96×120 (5:4-ish A4 crop that reads as a page without going tiny)
 */
export const DOCUMENT_CANVAS = {
  /** Landscape (ID-card-shaped) main thumbnail — 112×72 px, object-contain. */
  LANDSCAPE: { w: "w-28", h: "h-[4.5rem]" }, // 112×72 px
  /** Portrait (A4-shaped) main thumbnail — 96×120 px, object-contain. */
  PORTRAIT: { w: "w-24", h: "h-[7.5rem]" },  // 96×120 px
  /** History panel thumbnail — 56×56 px. Named "sm". */
  HISTORY: { w: "w-14", h: "h-14" },         // 56×56 px
} as const;
