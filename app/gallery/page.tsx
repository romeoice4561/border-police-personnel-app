/**
 * Gallery page (Phase 19D).
 *
 * Thin server component: renders the GalleryClient which manages all
 * interactive state (category selection, filters, the photo viewer modal).
 */
import { GalleryClient } from "@/components/gallery/gallery_client";

export const metadata = {
  title: "Gallery | Border Patrol Personnel",
  description: "Browse maps, organization charts, deployment maps, and location assets.",
};

export default function GalleryPage() {
  return <GalleryClient />;
}
