/**
 * PortraitAvatar — Media Design System (Phase 30.2).
 *
 * The canonical officer portrait component. Wraps OfficerPhoto with:
 *   - Token-based sizes from `AVATAR_SIZE` (Part 9).
 *   - Enforced circular shape (rounded-full, overflow-hidden) — Part 3.
 *   - object-cover so the face always fills the frame centered — Part 3.
 *   - Graceful initials/icon placeholder when no photo is available — Part 12.
 *   - Optional full-resolution viewer on click — Part 3.
 *
 * Prefer this over using OfficerPhoto with raw pixel sizes. Use the
 * AVATAR_SIZE token constants to pick the right size:
 *
 *   AVATAR_SIZE.XS  = 24px  — inline chips, mention badges
 *   AVATAR_SIZE.SM  = 32px  — data table rows
 *   AVATAR_SIZE.MD  = 48px  — standard cards, search results
 *   AVATAR_SIZE.LG  = 72px  — profile header (mobile / compact)
 *   AVATAR_SIZE.XL  = 120px — profile header (desktop)
 *   AVATAR_SIZE.XXL = 180px — portrait management, large previews
 *
 * Usage
 * -----
 *   import { PortraitAvatar } from "@/components/ui/media";
 *   import { AVATAR_SIZE } from "@/lib/ui/media_tokens";
 *
 *   <PortraitAvatar
 *     name={officer.name}
 *     thumbnailUrl={officer.thumbnailUrl}
 *     driveFileId={officer.driveFileId}
 *     size={AVATAR_SIZE.MD}
 *   />
 *
 * This is a thin re-export wrapper; all rendering logic lives in OfficerPhoto.
 * The wrapper exists to provide the token API and document the portrait standard.
 */
"use client";

import { OfficerPhoto, type OfficerPhotoProps } from "@/components/officer/officer_photo";
import { AVATAR_SIZE, type AvatarSizePx } from "@/lib/ui/media_tokens";

export type { AvatarSizePx };
export { AVATAR_SIZE };

export interface PortraitAvatarProps extends Omit<OfficerPhotoProps, "size"> {
  /**
   * Avatar size in pixels. Use an `AVATAR_SIZE.*` token constant.
   * Defaults to AVATAR_SIZE.MD (48 px) for officer cards.
   */
  size?: AvatarSizePx | number;
}

/**
 * Circular officer portrait following the Official Portrait standard (Part 3).
 * Use AVATAR_SIZE tokens rather than arbitrary pixel values.
 */
export function PortraitAvatar({ size = AVATAR_SIZE.MD, ...rest }: PortraitAvatarProps) {
  return <OfficerPhoto size={size} {...rest} />;
}
