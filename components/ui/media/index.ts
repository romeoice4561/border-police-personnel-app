/**
 * Media Display Design System — barrel export (Phase 30.2).
 *
 * Import all shared media components from this single entry point:
 *
 *   import {
 *     PortraitAvatar,
 *     GalleryImage,
 *     DocumentThumbnail,
 *     MediaPlaceholder,
 *     MediaBadge,
 *   } from "@/components/ui/media";
 *
 * See docs/DESIGN_SYSTEM_MEDIA.md for the full design system documentation.
 */

export { PortraitAvatar, AVATAR_SIZE } from "./PortraitAvatar";
export type { PortraitAvatarProps, AvatarSizePx } from "./PortraitAvatar";

export { GalleryImage } from "./GalleryImage";
export type { GalleryImageProps } from "./GalleryImage";

export { DocumentThumbnail, deriveDocumentThumbnailUrl, getThumbnailFit } from "./DocumentThumbnail";
export type { DocumentThumbnailProps } from "./DocumentThumbnail";

export { MediaPlaceholder } from "./MediaPlaceholder";
export type { MediaPlaceholderProps, MediaPlaceholderType } from "./MediaPlaceholder";

export { MediaBadge } from "./MediaBadge";
export type { MediaBadgeProps, MediaBadgeVariant, MediaBadgePosition } from "./MediaBadge";
