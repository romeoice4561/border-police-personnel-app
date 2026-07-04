/**
 * Officer Detail page (Phase 15A).
 *
 * Server Component: awaits the [id] route param, reads the officer straight
 * from the persistence layer via getOfficerProfile (which reuses the existing
 * OfficerQueryRepository — no duplicated query, no business logic in React),
 * and composes the four reusable officer components. Renders the framework
 * 404 for a missing officer.
 *
 * Displays: photo placeholder, rank, full name, position, unit, region, phone,
 * career years, quality score, AI quality summary, and the year-sorted
 * timeline. Responsive two-column layout on desktop, stacked on mobile.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOfficerProfile } from "@/lib/server/officer_service";
import { officerFullName } from "@/lib/ui/officer_summary";
import { OfficerSummaryHeader } from "@/components/officer/officer_summary_header";
import { OfficerProfileCard } from "@/components/officer/officer_profile_card";
import { OfficerQualityCard } from "@/components/officer/officer_quality_card";
import { OfficerTimeline } from "@/components/officer/officer_timeline";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await getOfficerProfile(decodeURIComponent(id));
  return { title: officer ? `${officerFullName(officer)} · Officer` : "Officer not found" };
}

export default async function OfficerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await getOfficerProfile(decodeURIComponent(id));

  if (!officer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/officers">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to officers
        </Link>
      </Button>

      <OfficerSummaryHeader officer={officer} />

      <div className="grid gap-4 lg:grid-cols-2">
        <OfficerProfileCard officer={officer} />
        <OfficerQualityCard officer={officer} />
      </div>

      <OfficerTimeline timeline={officer.timeline} />
    </div>
  );
}
