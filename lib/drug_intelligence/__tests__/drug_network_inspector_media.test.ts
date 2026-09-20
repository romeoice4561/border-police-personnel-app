/**
 * Network Graph Inspector — compact Entity Media upload contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENTITY_MEDIA_UNSUPPORTED_TYPES,
  supportsEntityMediaAction,
} from "@/components/drug_intelligence/drug_entity_media_action";
import { networkInspectorSupportsEntityMedia } from "@/components/drug_intelligence/drug_network_inspector_media";
import { DRUG_ENTITY_MEDIA_ENTITY_TYPES } from "@/lib/drug_intelligence/drug_entity_media_types";

const ROOT = process.cwd();

test("Inspector media capability matches Entity Media backend types", () => {
  for (const type of DRUG_ENTITY_MEDIA_ENTITY_TYPES) {
    assert.equal(networkInspectorSupportsEntityMedia(type), true);
    assert.equal(supportsEntityMediaAction(type), true);
  }
  for (const type of ENTITY_MEDIA_UNSUPPORTED_TYPES) {
    assert.equal(networkInspectorSupportsEntityMedia(type), false);
  }
});

test("Network Inspector wires compact media panel for upload-capable entities", () => {
  const inspector = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_node_detail.tsx"), "utf8");
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  assert.match(inspector, /DrugNetworkInspectorMedia/);
  assert.match(media, /data-testid="network-inspector-media"/);
  assert.match(media, /data-testid="network-inspector-media-add"/);
  assert.match(media, /data-testid="network-inspector-media-empty"/);
  assert.match(media, /data-testid="network-inspector-media-strip"/);
  assert.match(media, /data-testid="network-inspector-media-delete"/);
  assert.match(media, /data-can-upload/);
  assert.match(media, /data-can-delete/);
  assert.match(media, /can\("drug\.edit"\)/);
  assert.match(media, /useUploadDrugEntityMedia/);
  assert.match(media, /useDeleteDrugEntityMedia/);
  assert.match(media, /useDrugEntityMedia/);
  assert.match(media, /di\.media\.noneYet/);
  assert.match(media, /h-\[72px\] w-\[72px\]/);
});

test("editable users get delete; read-only users do not", () => {
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  assert.match(media, /canEdit \? \(/);
  assert.match(media, /data-can-delete=\{canEdit \? "true" : "false"\}/);
  assert.match(media, /data-testid="network-inspector-media-delete"/);
  assert.match(media, /sm:opacity-0 sm:group-hover:opacity-100/);
  assert.doesNotMatch(media, /can\("drug\.admin"\)/);
});

test("delete requires confirmation dialog and cancel keeps pending id clearable", () => {
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  assert.match(media, /DrugNetworkBoardConfirmDialog/);
  assert.match(media, /pendingDeleteId/);
  assert.match(media, /di\.media\.deleteConfirm/);
  assert.match(media, /di\.media\.deleteBody/);
  assert.match(media, /di\.media\.deleteAction/);
  assert.match(media, /common\.cancel/);
  assert.match(media, /setPendingDeleteId\(item\.id\)/);
  assert.match(media, /onCancel=\{[\s\S]*setPendingDeleteId\(null\)/);
  assert.doesNotMatch(media, /window\.confirm/);
});

test("successful delete uses existing mutation and keeps selection refresh path", () => {
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  const hooks = readFileSync(join(ROOT, "lib/drug_intelligence/drug_intelligence_hooks.ts"), "utf8");
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.match(media, /remove\.mutateAsync\(\{ mediaId, entityType, entityId \}\)/);
  assert.match(hooks, /useDeleteDrugEntityMedia/);
  assert.match(hooks, /invalidateQueries\(\{ queryKey: \["drug-network-neighborhood"\] \}\)/);
  assert.match(page, /neighborhood\.data\.nodes\.find\(\(node\) => node\.id === kept\.id\)/);
  // Selection refresh after neighborhood refetch must not auto Fit View.
  const selectionRefreshBlock = page.match(
    /setSelectedNode\(\(current\) => \{[\s\S]*?nextSelectedEntityAfterNeighborhoodChange[\s\S]*?\}\);/,
  )?.[0] ?? "";
  assert.ok(selectionRefreshBlock.length > 0);
  assert.doesNotMatch(selectionRefreshBlock, /fitView\(/);
});

test("delete failure surfaces error without optimistic permanent removal", () => {
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  assert.match(media, /di\.media\.deleteFailed/);
  assert.match(media, /data-testid="network-inspector-media-error"/);
  assert.doesNotMatch(media, /setItems\(/);
  assert.doesNotMatch(media, /optimistic/);
});

test("PHONE and SIM never expose Inspector upload or delete actions", () => {
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  assert.match(media, /networkInspectorSupportsEntityMedia/);
  assert.equal(networkInspectorSupportsEntityMedia("PHONE"), false);
  assert.equal(networkInspectorSupportsEntityMedia("SIM"), false);
  assert.doesNotMatch(media, /entityType === "PHONE"/);
  assert.doesNotMatch(media, /entityType === "SIM"/);
});

test("media mutations invalidate entity media and network neighborhood for node visual refresh", () => {
  const hooks = readFileSync(join(ROOT, "lib/drug_intelligence/drug_intelligence_hooks.ts"), "utf8");
  assert.match(hooks, /useUploadDrugEntityMedia/);
  assert.match(hooks, /useDeleteDrugEntityMedia/);
  assert.match(hooks, /invalidateQueries\(\{ queryKey: \["drug-network-neighborhood"\] \}\)/);
  assert.match(hooks, /drugQueryKeys\.entityMedia\(actorId, variables\.entityType, variables\.entityId\)/);
  assert.match(hooks, /personProfile\(actorId, variables\.entityId\)/);
  assert.match(hooks, /drugQueryKeys\.case\(actorId, variables\.entityId\)/);
});

test("selected node refreshes from neighborhood payload after media refetch", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.match(page, /nextSelectedEntityAfterNeighborhoodChange\(current, currentNodeIds\)/);
  assert.match(page, /neighborhood\.data\.nodes\.find\(\(node\) => node\.id === kept\.id\)/);
});

test("primary delete and empty media rely on existing attachGraphNodeVisuals pipeline", () => {
  const handler = readFileSync(join(ROOT, "lib/drug_intelligence/drug_network_graph_api_handlers.ts"), "utf8");
  const present = readFileSync(join(ROOT, "lib/drug_intelligence/drug_entity_media_present.ts"), "utf8");
  const hooks = readFileSync(join(ROOT, "lib/drug_intelligence/drug_intelligence_hooks.ts"), "utf8");
  assert.match(handler, /attachGraphNodeVisuals/);
  assert.match(present, /visualsFor/);
  assert.match(present, /photoCountsFor/);
  assert.match(hooks, /useDeleteDrugEntityMedia[\s\S]*invalidateQueries\(\{ queryKey: \["drug-network-neighborhood"\] \}\)/);
});

test("Inspector keeps open-gallery for media-capable entity detail pages only", () => {
  const media = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_inspector_media.tsx"), "utf8");
  assert.match(media, /PERSON.*VEHICLE.*CASE.*DEVICE/);
  assert.match(media, /#media/);
  assert.doesNotMatch(media, /LOCATION.*#media/);
});
