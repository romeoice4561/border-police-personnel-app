/**
 * PUT /api/officers/{id}/portrait/official — Phase 26A: pins/unpins the
 * officer's OFFICIAL portrait (Officer.officialPortraitId). Body:
 * { photoId: number | null }. Never touches the ProfilePhoto row itself —
 * the original Drive card / any prior upload is never overwritten or
 * deleted, only the officer's display pointer changes.
 *
 * Thin adapter delegating to the framework-agnostic handler. `params` is a
 * Promise in this Next.js version.
 */

import type { NextRequest } from "next/server";
import { guarded } from "@/lib/api/api_handlers";
import { OfficerRepository } from "@/lib/database/repositories/officer_repository";
import type { DatabaseClient } from "@/lib/database/database_types";
import { getProfilePhotoContainer } from "@/lib/profile_photo/profile_photo_container";
import { handleSetOfficialPortrait } from "@/lib/portrait/portrait_api_handlers";

let cachedClient: DatabaseClient | undefined;

async function officerRepository(): Promise<OfficerRepository> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as DatabaseClient;
  }
  return new OfficerRepository(cachedClient);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return guarded(async () => {
    const { id } = await params;
    const [officerRepo, { service }] = await Promise.all([officerRepository(), getProfilePhotoContainer()]);
    return handleSetOfficialPortrait(officerRepo, service, decodeURIComponent(id), request);
  });
}
