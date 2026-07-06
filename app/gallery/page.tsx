/**
 * Gallery page (Phase 19D).
 *
 * Thin server component: renders the GalleryClient which manages all
 * interactive state (category selection, filters, the photo viewer modal).
 */
import { GalleryClient } from "@/components/gallery/gallery_client";

export const metadata = {
  title: "คลังรูปภาพ | ระบบข้อมูลกำลังพล ตชด.",
  description: "เรียกดูแผนที่ แผนผังโครงสร้าง แผนผังการวางกำลัง และข้อมูลภาพถ่าย",
};

export default function GalleryPage() {
  return <GalleryClient />;
}
