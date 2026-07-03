/**
 * DepthBasedFolderMapper
 *
 * Implements the existing `FolderMapperEngine` contract (folder_mapper.ts)
 * without any rewrite of that file. `ConfigFolderMapper` requires
 * pre-registered folder ids, which only works when the Drive folder tree
 * is already known ahead of time. For a live scan of a real Drive tree
 * whose folder ids aren't known in advance, this mapper instead assigns
 * organizational levels (region/province/battalion/company) by *depth*
 * relative to a configured root folder — the Nth folder level under the
 * root is treated as the Nth organizational level, mirroring the
 * `imports/<region>/` convention used by the filesystem batch importer
 * (Phase 9A).
 *
 * This does not replace `ConfigFolderMapper` or `FolderMapperEngine` — it
 * is an additional implementation of the same interface, selected by the
 * caller (scripts/run_drive_scan.ts) when folder ids aren't
 * pre-configured.
 */

import type { DriveFolder, OrganizationalUnit } from "@/lib/google-drive/drive_types";
import type { FolderMapperEngine } from "@/lib/google-drive/folder_mapper";

/** Organizational levels in root-to-leaf order; only as many as are present in a given chain are populated. */
const ORGANIZATIONAL_LEVELS: Array<keyof OrganizationalUnit> = ["region", "province", "battalion", "company"];

export interface DepthBasedFolderMapperConfig {
  /** The folder id considered the top of the organizational hierarchy (its own name is not itself a level). */
  rootFolderId: string;
}

/**
 * Maps a chain of ancestor folders (root-first) to an OrganizationalUnit by
 * position: the folder immediately under the root becomes `region`, the
 * next becomes `province`, then `battalion`, then `company`. Folder ids are
 * cached to names as they're encountered via `mapFolderChain`, since Drive
 * doesn't expose folder depth directly — this mapper only knows the chain
 * once a caller (FolderScanner via the scan-report walker) supplies it.
 */
export class DepthBasedFolderMapper implements FolderMapperEngine {
  private readonly unitsByFolderId = new Map<string, OrganizationalUnit>();

  constructor(private readonly config: DepthBasedFolderMapperConfig) {}

  mapFolder(folderId: string): OrganizationalUnit | undefined {
    return this.unitsByFolderId.get(folderId);
  }

  /**
   * `folderChain` must be root-first (index 0 is the outermost ancestor,
   * ending with the folder whose contents are being mapped). Folders at or
   * above `rootFolderId` in the chain are not assigned a level; each
   * folder strictly under the root is assigned the next organizational
   * level in `ORGANIZATIONAL_LEVELS`, in order.
   */
  mapFolderChain(folderChain: DriveFolder[]): OrganizationalUnit | undefined {
    const rootIndex = folderChain.findIndex((folder) => folder.id === this.config.rootFolderId);
    if (rootIndex === -1) return undefined;

    const belowRoot = folderChain.slice(rootIndex + 1);
    if (belowRoot.length === 0) return undefined;

    const unit: OrganizationalUnit = {};
    belowRoot.forEach((folder, index) => {
      const level = ORGANIZATIONAL_LEVELS[index];
      if (!level) return; // deeper than the four known levels; ignored rather than guessed
      unit[level] = folder.name;
    });

    // Cache so mapFolder(folderId) also works for anything already resolved via a chain.
    const leaf = belowRoot[belowRoot.length - 1];
    this.unitsByFolderId.set(leaf.id, unit);

    return unit;
  }
}
