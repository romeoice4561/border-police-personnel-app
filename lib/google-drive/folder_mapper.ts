/**
 * FolderMapper
 *
 * Maps a Drive folder id (or path through the folder hierarchy) to an
 * OrganizationalUnit (region/province/battalion/company). Configuration is
 * a plain data structure so it can be sourced from a config file, env var,
 * or (in a future phase) a database table — without changing this module's
 * interface.
 */

import type { DriveFolder, OrganizationalUnit } from "@/lib/google-drive/drive_types";

/** One configured mapping from a folder id to its organizational placement. */
export interface FolderMappingEntry {
  folderId: string;
  unit: OrganizationalUnit;
}

/** Contract for folder-to-organization mapping. Allows swapping in a persisted/dynamic mapping source later. */
export interface FolderMapperEngine {
  mapFolder(folderId: string): OrganizationalUnit | undefined;
  /** Resolves a unit by walking up a chain of ancestor folders, closest match wins. */
  mapFolderChain(folderChain: DriveFolder[]): OrganizationalUnit | undefined;
}

/**
 * Static, config-driven folder mapper.
 *
 * Future extension point: load `FolderMappingEntry[]` from a persisted
 * configuration source (e.g. a database table or admin-managed config file)
 * instead of an in-memory array, behind the same `FolderMapperEngine`
 * interface.
 */
export class ConfigFolderMapper implements FolderMapperEngine {
  private readonly byFolderId = new Map<string, OrganizationalUnit>();

  constructor(entries: FolderMappingEntry[] = []) {
    for (const entry of entries) {
      this.byFolderId.set(entry.folderId, entry.unit);
    }
  }

  mapFolder(folderId: string): OrganizationalUnit | undefined {
    return this.byFolderId.get(folderId);
  }

  mapFolderChain(folderChain: DriveFolder[]): OrganizationalUnit | undefined {
    // Closest ancestor (last in the chain, i.e. the file's direct parent)
    // takes priority; fall back to broader ancestors if unmapped.
    for (let i = folderChain.length - 1; i >= 0; i -= 1) {
      const match = this.byFolderId.get(folderChain[i].id);
      if (match) return match;
    }
    return undefined;
  }

  /** Registers or overwrites a mapping entry. Supports future dynamic configuration updates. */
  setMapping(folderId: string, unit: OrganizationalUnit): void {
    this.byFolderId.set(folderId, unit);
  }
}

/**
 * Example configuration shape for the four Border Patrol regions, each
 * with its own root folder id. See docs/GOOGLE_DRIVE_ARCHITECTURE.md,
 * "Folder Mapping Examples," for a full worked example including
 * province/battalion/company nesting.
 */
export const EXAMPLE_REGION_ROOTS: FolderMappingEntry[] = [
  { folderId: "region-north-root", unit: { region: "North" } },
  { folderId: "region-south-root", unit: { region: "South" } },
  { folderId: "region-east-root", unit: { region: "East" } },
  { folderId: "region-west-root", unit: { region: "West" } },
];
