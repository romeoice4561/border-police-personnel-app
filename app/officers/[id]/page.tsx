/**
 * Officer detail (Phase 14): full profile for one officer. Client component;
 * reads the [id] route param and fetches via the useOfficer hook. Handles
 * loading / not-found / error states.
 */
"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useOfficer } from "@/lib/ui/hooks";
import { ApiClientError } from "@/lib/ui/api_client";
import { OfficerProfile } from "@/components/common/officer_profile";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function OfficerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const officerId = decodeURIComponent(id);
  const query = useOfficer(officerId);

  const notFound = query.error instanceof ApiClientError && query.error.status === 404;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/officers">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to officers
        </Link>
      </Button>

      {query.isPending ? (
        <LoadingState rows={8} label="Loading officer…" />
      ) : notFound ? (
        <EmptyState title="Officer not found" message={`No officer with id "${officerId}".`} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <OfficerProfile profile={query.data} />
      )}
    </div>
  );
}
