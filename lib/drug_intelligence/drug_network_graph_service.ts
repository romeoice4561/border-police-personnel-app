/**
 * DrugNetworkGraphService (Phase DI-5, Sections 0, 4, 5, 17, 19).
 *
 * Reads graph nodes/edges directly from the EXISTING typed junction tables
 * (DrugCasePerson, DrugCasePhone, DrugCaseSim, DrugCaseDevice,
 * DrugCaseVehicle, DrugCaseLocation, DrugPersonDevice, DrugPersonVehicle) —
 * confirmed with the user NOT to populate DrugRelationship (Section 24):
 * that table is unwired from DatabaseClient entirely, and projecting into
 * it would create a second representation that must stay in sync with the
 * junction tables (including on every future person-merge), which the
 * user chose to avoid. This mirrors DrugEntityDetailService and
 * DrugPersonProfileService's established "gather junction rows, batch
 * -resolve neighbor ids via Promise.all, hydrate via Map" pattern exactly
 * — no new query style invented for DI-5.
 *
 * Performance discipline (Section 19, DI-2's O(n²) lesson never repeats):
 * every neighborhood expansion is FOCUS-DRIVEN and bounded — never a full
 * -table scan of relationships, never a person-to-person pairwise sweep
 * over the whole active pool. The one whole-pool-once computation used here
 * (DrugPersonMatchingService.findPersonIdsWithPotentialDuplicates, for the
 * POTENTIAL_DUPLICATE_PERSON risk indicator) is called AT MOST ONCE per
 * request, exactly the same discipline DrugIntelligenceSearchService
 * already established for the identical function.
 *
 * MERGED-person safety (Section 17): every person-shaped id encountered
 * anywhere in a traversal is resolved to its live survivor via
 * resolveCanonicalPersonId() BEFORE being added as a node or used as an
 * edge endpoint — a MERGED person's id is folded into the survivor node,
 * never rendered as a second/duplicate node.
 */

import type { DatabaseClient, DrugPerson, DrugCase, DrugPhoneNumber, DrugSim, DrugDevice, DrugVehicle, DrugLocation } from "@/lib/database/database_types";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugCasePersonRepository } from "@/lib/database/repositories/drug_case_person_repository";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  DRUG_GRAPH_DEFAULT_MAX_NODES,
  DRUG_GRAPH_HARD_MAX_NODES,
  DRUG_GRAPH_MAX_DEPTH,
  DRUG_GRAPH_PATH_MAX_DEPTH,
  type DrugGraphNode,
  type DrugGraphEdge,
  type DrugGraphNodeType,
  type DrugGraphNeighborhood,
  type DrugGraphNeighborhoodRequest,
  type DrugGraphPathRequest,
  type DrugGraphPathResult,
  type DrugGraphPath,
  type DrugGraphRiskIndicator,
} from "@/lib/drug_intelligence/drug_network_graph_types";

export class DrugPersonGraphNotFoundError extends Error {
  constructor(id: string) {
    super(`Person '${id}' not found`);
    this.name = "DrugPersonGraphNotFoundError";
  }
}
export class DrugGraphEntityNotFoundError extends Error {
  constructor(entityType: string, id: string) {
    super(`${entityType} '${id}' not found`);
    this.name = "DrugGraphEntityNotFoundError";
  }
}

export interface DrugNetworkGraphServiceOptions {
  canViewFull: boolean;
}

/** One direct edge discovered while gathering a focus node's immediate neighbors — pre-node-hydration, keyed by neighbor (type,id). */
interface RawEdge {
  neighborType: DrugGraphNodeType;
  neighborId: string;
  edge: DrugGraphEdge;
}

/**
 * A node-ref key is used ONLY as a Set/Map membership key — it must never
 * be split back apart to recover the id. The InMemoryDatabaseClient test
 * fake auto-assigns a NUMERIC id to some models (e.g. DrugPhoneNumber, when
 * created without an explicit string id) while others use cuid strings —
 * String(id) here is a one-way normalization for key comparison only. Every
 * call site that needs the actual id back carries the original ref object
 * (`{type, id}`) alongside the key, never re-derives it from the key.
 */
function nodeKey(type: DrugGraphNodeType, id: string): string {
  return `${type}:${String(id)}`;
}

export class DrugNetworkGraphService {
  private readonly personRepo: DrugPersonRepository;
  private readonly entityRepo: DrugEntityRepository;
  private readonly caseRepo: DrugCaseRepository;
  private readonly casePersonRepo: DrugCasePersonRepository;
  private readonly matchingService: DrugPersonMatchingService;

  constructor(private readonly db: DatabaseClient) {
    this.personRepo = new DrugPersonRepository(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.caseRepo = new DrugCaseRepository(db);
    this.casePersonRepo = new DrugCasePersonRepository(db);
    this.matchingService = new DrugPersonMatchingService(db);
  }

  /** Section 17: resolves a MERGED person id to its live survivor's id — every person id must pass through this before becoming a node/edge endpoint. */
  private async resolveCanonicalPersonId(personId: string, cache: Map<string, string>): Promise<string | null> {
    const cached = cache.get(personId);
    if (cached) return cached;
    const person = await this.personRepo.findById(personId);
    if (!person) return null;
    const canonicalId = person.status === "MERGED" && person.mergedIntoPersonId ? person.mergedIntoPersonId : person.id;
    cache.set(personId, canonicalId);
    if (canonicalId !== personId) cache.set(canonicalId, canonicalId);
    return canonicalId;
  }

  // ── Section 4: bounded neighborhood expansion ─────────────────────────

  async getNeighborhood(request: DrugGraphNeighborhoodRequest, options: DrugNetworkGraphServiceOptions): Promise<DrugGraphNeighborhood> {
    const depth = Math.min(request.depth, DRUG_GRAPH_MAX_DEPTH) as 1 | 2;
    const maxNodes = Math.min(request.maxNodes ?? DRUG_GRAPH_DEFAULT_MAX_NODES, DRUG_GRAPH_HARD_MAX_NODES);
    const mergeCache = new Map<string, string>();

    let focusId = request.entityId;
    if (request.entityType === "PERSON") {
      const canonical = await this.resolveCanonicalPersonId(focusId, mergeCache);
      if (!canonical) throw new DrugPersonGraphNotFoundError(focusId);
      focusId = canonical;
    } else {
      const exists = await this.entityExists(request.entityType, focusId);
      if (!exists) throw new DrugGraphEntityNotFoundError(request.entityType, focusId);
    }

    const visited = new Map<string, { type: DrugGraphNodeType; id: string }>([[nodeKey(request.entityType, focusId), { type: request.entityType, id: focusId }]]);
    const expanded = new Set<string>();
    const edgesById = new Map<string, DrugGraphEdge>();
    let frontier: Array<{ type: DrugGraphNodeType; id: string }> = [{ type: request.entityType, id: focusId }];
    let truncated = false;

    const collectEdgesFrom = (node: { type: DrugGraphNodeType; id: string }, rawEdges: RawEdge[]): Array<{ type: DrugGraphNodeType; id: string }> => {
      const discovered: Array<{ type: DrugGraphNodeType; id: string }> = [];
      for (const raw of rawEdges) {
        if (request.nodeTypes && !request.nodeTypes.includes(raw.neighborType)) continue;
        if (request.relationshipTypes && !request.relationshipTypes.includes(raw.edge.relationshipType)) continue;
        if (!this.withinDateRange(raw.edge, request.dateFrom, request.dateTo)) continue;

        const key = nodeKey(raw.neighborType, raw.neighborId);
        // Only keep this edge if its neighbor is already visited OR there's still room to add it —
        // an edge to a node we can't afford to add is dropped along with that node (Section 4/19).
        if (!visited.has(key) && visited.size >= maxNodes) {
          truncated = true;
          continue;
        }
        edgesById.set(raw.edge.id, raw.edge);
        if (!visited.has(key)) {
          const ref = { type: raw.neighborType, id: raw.neighborId };
          visited.set(key, ref);
          discovered.push(ref);
        }
      }
      return discovered;
    };

    for (let hop = 0; hop < depth; hop++) {
      const nextFrontier: Array<{ type: DrugGraphNodeType; id: string }> = [];
      for (const node of frontier) {
        if (visited.size >= maxNodes) {
          truncated = true;
          break;
        }
        const nodeVisitKey = nodeKey(node.type, node.id);
        if (expanded.has(nodeVisitKey)) continue;
        expanded.add(nodeVisitKey);
        const rawEdges = await this.gatherDirectEdges(node.type, node.id, mergeCache);
        nextFrontier.push(...collectEdgesFrom(node, rawEdges));
        if (visited.size >= maxNodes) {
          truncated = true;
          break;
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    // Closing pass (Section 3's "never a mysterious line" — an edge between two nodes that are
    // BOTH already in this neighborhood must always be included, even if neither side happened to
    // be the one whose expansion originally discovered the other, e.g. two persons who each
    // reached the same Case/Phone from different directions). Only re-expands CASE/PHONE/SIM/
    // DEVICE/VEHICLE/LOCATION nodes that were added as leaves and never got their own turn to
    // expand — never re-scans the whole visited set redundantly.
    for (const [key, ref] of visited) {
      if (expanded.has(key)) continue;
      expanded.add(key);
      const rawEdges = await this.gatherDirectEdges(ref.type, ref.id, mergeCache);
      for (const raw of rawEdges) {
        if (request.nodeTypes && !request.nodeTypes.includes(raw.neighborType)) continue;
        if (request.relationshipTypes && !request.relationshipTypes.includes(raw.edge.relationshipType)) continue;
        if (!this.withinDateRange(raw.edge, request.dateFrom, request.dateTo)) continue;
        const neighborKey = nodeKey(raw.neighborType, raw.neighborId);
        if (visited.has(neighborKey)) edgesById.set(raw.edge.id, raw.edge);
      }
    }

    const nodeRefs = [...visited.values()];
    const nodes = await this.hydrateNodes(nodeRefs, options);
    const inferredEdges = this.deriveInferredPersonEdges(nodes, [...edgesById.values()]);
    for (const edge of inferredEdges) edgesById.set(edge.id, edge);

    return {
      focus: { entityType: request.entityType, entityId: focusId },
      nodes,
      edges: [...edgesById.values()],
      truncated,
    };
  }

  private withinDateRange(edge: DrugGraphEdge, dateFrom?: Date, dateTo?: Date): boolean {
    if (!dateFrom && !dateTo) return true;
    const reference = edge.lastSeenAt ?? edge.firstSeenAt;
    if (!reference) return true;
    if (dateFrom && reference < dateFrom) return false;
    if (dateTo && reference > dateTo) return false;
    return true;
  }

  private async entityExists(type: DrugGraphNodeType, id: string): Promise<boolean> {
    switch (type) {
      case "PHONE":
        return Boolean(await this.entityRepo.findPhoneNumberById(id));
      case "SIM":
        return Boolean(await this.entityRepo.findSimById(id));
      case "DEVICE":
        return Boolean(await this.entityRepo.findDeviceById(id));
      case "VEHICLE":
        return Boolean(await this.entityRepo.findVehicleById(id));
      case "CASE":
        return Boolean(await this.caseRepo.findById(id));
      case "LOCATION":
        return Boolean(await this.entityRepo.findLocationById(id));
      case "PERSON":
        return Boolean(await this.personRepo.findById(id));
    }
  }

  /** Section 2: gathers every DIRECT edge for one node, one hop out, from the canonical junction tables — never DrugRelationship. */
  private async gatherDirectEdges(type: DrugGraphNodeType, id: string, mergeCache: Map<string, string>): Promise<RawEdge[]> {
    switch (type) {
      case "PERSON":
        return this.gatherFromPerson(id);
      case "CASE":
        return this.gatherFromCase(id, mergeCache);
      case "PHONE":
        return this.gatherFromPhone(id, mergeCache);
      case "SIM":
        return this.gatherFromSim(id, mergeCache);
      case "DEVICE":
        return this.gatherFromDevice(id, mergeCache);
      case "VEHICLE":
        return this.gatherFromVehicle(id, mergeCache);
      case "LOCATION":
        return this.gatherFromLocation(id);
    }
  }

  private async gatherFromPerson(personId: string): Promise<RawEdge[]> {
    const [caseLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks] = await Promise.all([
      this.casePersonRepo.forPerson(personId),
      this.personRepo.casePhonesForPerson(personId),
      this.personRepo.caseSimsForPerson(personId),
      this.entityRepo.personDevicesForPerson(personId),
      this.entityRepo.personVehiclesForPerson(personId),
    ]);

    const edges: RawEdge[] = [];
    for (const link of caseLinks) {
      edges.push({
        neighborType: "CASE",
        neighborId: link.caseId,
        edge: {
          id: `pc:${link.id}`,
          source: personId,
          target: link.caseId,
          relationshipType: "PERSON_CASE",
          edgeKind: "DIRECT",
          evidenceCount: 1,
          firstSeenAt: null,
          lastSeenAt: null,
          sourceCaseIds: [link.caseId],
          explanation: { kind: "DIRECT_ROLE", role: link.role },
        },
      });
    }
    for (const link of phoneLinks) {
      edges.push(this.directEdge({ id: `pp:${link.id}`, source: personId, target: link.phoneNumberId, relationshipType: "PERSON_PHONE", neighborType: "PHONE", neighborId: link.phoneNumberId, link }));
    }
    for (const link of simLinks) {
      if (link.personId !== personId) continue;
      edges.push(this.directEdge({ id: `ps:${link.id}`, source: personId, target: link.simId, relationshipType: "PERSON_SIM", neighborType: "SIM", neighborId: link.simId, link }));
    }
    for (const link of deviceLinks) {
      edges.push(this.directEdge({ id: `pd:${link.id}`, source: personId, target: link.deviceId, relationshipType: "PERSON_DEVICE", neighborType: "DEVICE", neighborId: link.deviceId, link }));
    }
    for (const link of vehicleLinks) {
      edges.push(this.directEdge({ id: `pv:${link.id}`, source: personId, target: link.vehicleId, relationshipType: "PERSON_VEHICLE", neighborType: "VEHICLE", neighborId: link.vehicleId, link }));
    }
    return edges;
  }

  private async gatherFromCase(caseId: string, mergeCache: Map<string, string>): Promise<RawEdge[]> {
    const [personLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks, locationLinks] = await Promise.all([
      this.casePersonRepo.forCase(caseId),
      this.caseRepo.casePhonesForCase(caseId),
      this.caseRepo.caseSimsForCase(caseId),
      this.caseRepo.caseDevicesForCase(caseId),
      this.caseRepo.caseVehiclesForCase(caseId),
      this.caseRepo.caseLocationsForCase(caseId),
    ]);

    const edges: RawEdge[] = [];
    for (const link of personLinks) {
      const canonicalPersonId = await this.resolveCanonicalPersonId(link.personId, mergeCache);
      if (!canonicalPersonId) continue;
      edges.push({
        neighborType: "PERSON",
        neighborId: canonicalPersonId,
        edge: {
          id: `pc:${link.id}`,
          source: canonicalPersonId,
          target: caseId,
          relationshipType: "PERSON_CASE",
          edgeKind: "DIRECT",
          evidenceCount: 1,
          firstSeenAt: null,
          lastSeenAt: null,
          sourceCaseIds: [caseId],
          explanation: { kind: "DIRECT_ROLE", role: link.role },
        },
      });
    }
    for (const link of phoneLinks) {
      edges.push(this.directEdge({ id: `cp:${link.id}`, source: caseId, target: link.phoneNumberId, relationshipType: "CASE_PHONE", neighborType: "PHONE", neighborId: link.phoneNumberId, link }));
    }
    for (const link of simLinks) {
      edges.push(this.directEdge({ id: `cs:${link.id}`, source: caseId, target: link.simId, relationshipType: "CASE_SIM", neighborType: "SIM", neighborId: link.simId, link }));
    }
    for (const link of deviceLinks) {
      edges.push(this.directEdge({ id: `cd:${link.id}`, source: caseId, target: link.deviceId, relationshipType: "CASE_DEVICE", neighborType: "DEVICE", neighborId: link.deviceId, link }));
    }
    for (const link of vehicleLinks) {
      edges.push(this.directEdge({ id: `cv:${link.id}`, source: caseId, target: link.vehicleId, relationshipType: "CASE_VEHICLE", neighborType: "VEHICLE", neighborId: link.vehicleId, link }));
    }
    for (const link of locationLinks) {
      edges.push({
        neighborType: "LOCATION",
        neighborId: link.locationId,
        edge: {
          id: `cl:${link.caseId}:${link.locationId}`,
          source: caseId,
          target: link.locationId,
          relationshipType: "CASE_LOCATION",
          edgeKind: "DIRECT",
          evidenceCount: 1,
          firstSeenAt: null,
          lastSeenAt: null,
          sourceCaseIds: [caseId],
          explanation: { kind: "DIRECT_LINK" },
        },
      });
    }
    return edges;
  }

  private async gatherFromPhone(phoneNumberId: string, mergeCache: Map<string, string>): Promise<RawEdge[]> {
    const links = await this.entityRepo.casePhonesForPhoneNumber(phoneNumberId);
    const edges: RawEdge[] = [];
    for (const link of links as CaseScopedLink[]) {
      edges.push(this.directEdge({ id: `cp:${link.id}`, source: link.caseId, target: phoneNumberId, relationshipType: "CASE_PHONE", neighborType: "CASE", neighborId: link.caseId, link }));
      if (link.personId) {
        const canonicalPersonId = await this.resolveCanonicalPersonId(link.personId, mergeCache);
        if (canonicalPersonId) {
          edges.push(this.directEdge({ id: `pp:${link.id}`, source: canonicalPersonId, target: phoneNumberId, relationshipType: "PERSON_PHONE", neighborType: "PERSON", neighborId: canonicalPersonId, link }));
        }
      }
    }
    return edges;
  }

  private async gatherFromSim(simId: string, mergeCache: Map<string, string>): Promise<RawEdge[]> {
    const links = await this.entityRepo.caseSimsForSim(simId);
    const edges: RawEdge[] = [];
    for (const link of links as CaseScopedLink[]) {
      edges.push(this.directEdge({ id: `cs:${link.id}`, source: link.caseId, target: simId, relationshipType: "CASE_SIM", neighborType: "CASE", neighborId: link.caseId, link }));
      if (link.personId) {
        const canonicalPersonId = await this.resolveCanonicalPersonId(link.personId, mergeCache);
        if (canonicalPersonId) {
          edges.push(this.directEdge({ id: `ps:${link.id}`, source: canonicalPersonId, target: simId, relationshipType: "PERSON_SIM", neighborType: "PERSON", neighborId: canonicalPersonId, link }));
        }
      }
    }
    return edges;
  }

  private async gatherFromDevice(deviceId: string, mergeCache: Map<string, string>): Promise<RawEdge[]> {
    const [caseLinks, personLinks] = await Promise.all([this.entityRepo.caseDevicesForDevice(deviceId), this.entityRepo.personDevicesForDevice(deviceId)]);
    const edges: RawEdge[] = [];
    for (const link of caseLinks as CaseScopedLink[]) {
      edges.push(this.directEdge({ id: `cd:${link.id}`, source: link.caseId, target: deviceId, relationshipType: "CASE_DEVICE", neighborType: "CASE", neighborId: link.caseId, link }));
    }
    for (const link of personLinks as Array<{ id: string; personId: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null }>) {
      const canonicalPersonId = await this.resolveCanonicalPersonId(link.personId, mergeCache);
      if (!canonicalPersonId) continue;
      edges.push(this.directEdge({ id: `pd:${link.id}`, source: canonicalPersonId, target: deviceId, relationshipType: "PERSON_DEVICE", neighborType: "PERSON", neighborId: canonicalPersonId, link }));
    }
    return edges;
  }

  private async gatherFromVehicle(vehicleId: string, mergeCache: Map<string, string>): Promise<RawEdge[]> {
    const [caseLinks, personLinks] = await Promise.all([this.entityRepo.caseVehiclesForVehicle(vehicleId), this.entityRepo.personVehiclesForVehicle(vehicleId)]);
    const edges: RawEdge[] = [];
    for (const link of caseLinks as CaseScopedLink[]) {
      edges.push(this.directEdge({ id: `cv:${link.id}`, source: link.caseId, target: vehicleId, relationshipType: "CASE_VEHICLE", neighborType: "CASE", neighborId: link.caseId, link }));
    }
    for (const link of personLinks as Array<{ id: string; personId: string; firstSeenAt: Date | null; lastSeenAt: Date | null; sourceCaseId: string | null }>) {
      const canonicalPersonId = await this.resolveCanonicalPersonId(link.personId, mergeCache);
      if (!canonicalPersonId) continue;
      edges.push(this.directEdge({ id: `pv:${link.id}`, source: canonicalPersonId, target: vehicleId, relationshipType: "PERSON_VEHICLE", neighborType: "PERSON", neighborId: canonicalPersonId, link }));
    }
    return edges;
  }

  private async gatherFromLocation(locationId: string): Promise<RawEdge[]> {
    const links = await this.entityRepo.caseLocationsForLocation(locationId);
    return (links as Array<{ caseId: string; locationId: string }>).map((link) =>
      this.directEdge({ id: `cl:${link.caseId}:${link.locationId}`, source: link.caseId, target: locationId, relationshipType: "CASE_LOCATION", neighborType: "CASE", neighborId: link.caseId, link: {} })
    );
  }

  /**
   * Builds one DIRECT edge with an EXPLICIT, caller-specified neighbor
   * (type + id) — never inferred by comparing endpoint ids to a caseId or
   * to "which side is self", which was the source of a real edge-direction
   * bug caught while writing this service (an earlier version silently
   * produced edges pointing the wrong way when discovered from a Phone/SIM/
   * Device/Vehicle rather than from a Person/Case). `source`/`target` are
   * the edge's own directionality (documentation/consistency only — this
   * module never treats direction as meaningful for traversal, both ends
   * are always walked); `neighborType`/`neighborId` is what the CALLER uses
   * to know which node was newly discovered and should be added to the
   * frontier.
   */
  private directEdge(args: {
    id: string;
    source: string;
    target: string;
    relationshipType: DrugGraphEdge["relationshipType"];
    neighborType: DrugGraphNodeType;
    neighborId: string;
    link: { firstSeenAt?: Date | null; lastSeenAt?: Date | null; caseId?: string; sourceCaseId?: string | null };
  }): RawEdge {
    const sourceCaseIds = args.link.caseId ? [args.link.caseId] : args.link.sourceCaseId ? [args.link.sourceCaseId] : [];
    return {
      neighborType: args.neighborType,
      neighborId: args.neighborId,
      edge: {
        id: args.id,
        source: args.source,
        target: args.target,
        relationshipType: args.relationshipType,
        edgeKind: "DIRECT",
        evidenceCount: 1,
        firstSeenAt: args.link.firstSeenAt ?? null,
        lastSeenAt: args.link.lastSeenAt ?? null,
        sourceCaseIds,
        explanation: { kind: "DIRECT_LINK" },
      },
    };
  }

  // ── Section 1: node hydration ──────────────────────────────────────────

  private async hydrateNodes(refs: Array<{ type: DrugGraphNodeType; id: string }>, options: DrugNetworkGraphServiceOptions): Promise<DrugGraphNode[]> {
    const byType = new Map<DrugGraphNodeType, string[]>();
    for (const ref of refs) {
      const list = byType.get(ref.type) ?? [];
      list.push(ref.id);
      byType.set(ref.type, list);
    }

    const [persons, phones, sims, devices, vehicles, cases, locations, duplicateIds] = await Promise.all([
      Promise.all((byType.get("PERSON") ?? []).map((id) => this.personRepo.findById(id))),
      Promise.all((byType.get("PHONE") ?? []).map((id) => this.entityRepo.findPhoneNumberById(id))),
      Promise.all((byType.get("SIM") ?? []).map((id) => this.entityRepo.findSimById(id))),
      Promise.all((byType.get("DEVICE") ?? []).map((id) => this.entityRepo.findDeviceById(id))),
      Promise.all((byType.get("VEHICLE") ?? []).map((id) => this.entityRepo.findVehicleById(id))),
      Promise.all((byType.get("CASE") ?? []).map((id) => this.caseRepo.findById(id))),
      Promise.all((byType.get("LOCATION") ?? []).map((id) => this.entityRepo.findLocationById(id))),
      (byType.get("PERSON") ?? []).length > 0 ? this.matchingService.findPersonIdsWithPotentialDuplicates() : Promise.resolve(new Set<string>()),
    ]);

    const caseCounts = await this.batchCaseCounts(byType);

    const nodes: DrugGraphNode[] = [];
    for (const person of persons) {
      if (!person) continue;
      nodes.push(this.buildPersonNode(person, duplicateIds, caseCounts.get(nodeKey("PERSON", person.id)) ?? 0));
    }
    for (const phone of phones) {
      if (!phone) continue;
      nodes.push(this.buildPhoneNode(phone, options, caseCounts.get(nodeKey("PHONE", phone.id)) ?? 0));
    }
    for (const sim of sims) {
      if (!sim) continue;
      nodes.push(this.buildSimNode(sim, options, caseCounts.get(nodeKey("SIM", sim.id)) ?? 0));
    }
    for (const device of devices) {
      if (!device) continue;
      nodes.push(this.buildDeviceNode(device, options, caseCounts.get(nodeKey("DEVICE", device.id)) ?? 0));
    }
    for (const vehicle of vehicles) {
      if (!vehicle) continue;
      nodes.push(this.buildVehicleNode(vehicle, options, caseCounts.get(nodeKey("VEHICLE", vehicle.id)) ?? 0));
    }
    for (const drugCase of cases) {
      if (!drugCase) continue;
      nodes.push(this.buildCaseNode(drugCase));
    }
    for (const location of locations) {
      if (!location) continue;
      nodes.push(this.buildLocationNode(location, caseCounts.get(nodeKey("LOCATION", location.id)) ?? 0));
    }
    return nodes;
  }

  private async batchCaseCounts(byType: Map<DrugGraphNodeType, string[]>): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const jobs: Array<Promise<void>> = [];

    for (const id of byType.get("PERSON") ?? []) {
      jobs.push(this.casePersonRepo.forPerson(id).then((links) => void counts.set(nodeKey("PERSON", id), links.length)));
    }
    for (const id of byType.get("PHONE") ?? []) {
      jobs.push(this.entityRepo.countCasePhonesForPhoneNumber(id).then((n) => void counts.set(nodeKey("PHONE", id), n)));
    }
    for (const id of byType.get("SIM") ?? []) {
      jobs.push(this.entityRepo.countCaseSimsForSim(id).then((n) => void counts.set(nodeKey("SIM", id), n)));
    }
    for (const id of byType.get("DEVICE") ?? []) {
      jobs.push(this.entityRepo.countCaseDevicesForDevice(id).then((n) => void counts.set(nodeKey("DEVICE", id), n)));
    }
    for (const id of byType.get("VEHICLE") ?? []) {
      jobs.push(this.entityRepo.countCaseVehiclesForVehicle(id).then((n) => void counts.set(nodeKey("VEHICLE", id), n)));
    }
    for (const id of byType.get("LOCATION") ?? []) {
      jobs.push(this.entityRepo.caseLocationsForLocation(id).then((links) => void counts.set(nodeKey("LOCATION", id), (links as unknown[]).length)));
    }
    await Promise.all(jobs);
    return counts;
  }

  private buildPersonNode(person: DrugPerson, duplicateIds: Set<string>, caseCount: number): DrugGraphNode {
    const hasPotentialDuplicate = duplicateIds.has(person.id);
    const riskIndicators: DrugGraphRiskIndicator[] = [];
    if (hasPotentialDuplicate) riskIndicators.push("POTENTIAL_DUPLICATE_PERSON");
    if (caseCount >= 3) riskIndicators.push("HIGH_CASE_COUNT");
    return {
      id: person.id,
      type: "PERSON",
      label: person.primaryFullName,
      secondaryLabel: null,
      maskedLabel: null,
      metadata: { type: "PERSON", status: person.status, canonicalTarget: null, hasPotentialDuplicate },
      firstSeenAt: person.createdAt,
      lastSeenAt: person.updatedAt,
      caseCount,
      riskIndicators,
    };
  }

  private buildPhoneNode(phone: DrugPhoneNumber, options: DrugNetworkGraphServiceOptions, caseCount: number): DrugGraphNode {
    const label = presentPhoneNumber(phone.normalizedNumber, options.canViewFull);
    return {
      id: phone.id,
      type: "PHONE",
      label,
      secondaryLabel: null,
      maskedLabel: label,
      metadata: { type: "PHONE", carrier: null },
      firstSeenAt: phone.createdAt,
      lastSeenAt: null,
      caseCount,
      riskIndicators: caseCount >= 3 ? ["HIGH_CASE_COUNT"] : [],
    };
  }

  private buildSimNode(sim: DrugSim, options: DrugNetworkGraphServiceOptions, caseCount: number): DrugGraphNode {
    const label = sim.iccid ? presentIdentifierValue(sim.iccid, options.canViewFull) : "SIM";
    return {
      id: sim.id,
      type: "SIM",
      label,
      secondaryLabel: sim.carrier,
      maskedLabel: label,
      metadata: { type: "SIM", imsi: sim.imsi ? presentIdentifierValue(sim.imsi, options.canViewFull) : null, carrier: sim.carrier },
      firstSeenAt: sim.createdAt,
      lastSeenAt: null,
      caseCount,
      riskIndicators: caseCount >= 3 ? ["HIGH_CASE_COUNT"] : [],
    };
  }

  private buildDeviceNode(device: DrugDevice, options: DrugNetworkGraphServiceOptions, caseCount: number): DrugGraphNode {
    const brandModel = [device.brand, device.model].filter(Boolean).join(" ") || null;
    const label = brandModel ?? (device.imei1 ? presentIdentifierValue(device.imei1, options.canViewFull) : "Device");
    return {
      id: device.id,
      type: "DEVICE",
      label,
      secondaryLabel: device.imei1 ? presentIdentifierValue(device.imei1, options.canViewFull) : null,
      maskedLabel: device.imei1 ? presentIdentifierValue(device.imei1, options.canViewFull) : label,
      metadata: { type: "DEVICE", brand: device.brand, model: device.model },
      firstSeenAt: device.createdAt,
      lastSeenAt: null,
      caseCount,
      riskIndicators: caseCount >= 3 ? ["HIGH_CASE_COUNT"] : [],
    };
  }

  private buildVehicleNode(vehicle: DrugVehicle, options: DrugNetworkGraphServiceOptions, caseCount: number): DrugGraphNode {
    const label = vehicle.registrationNumber ? presentIdentifierValue(vehicle.registrationNumber, options.canViewFull) : "Vehicle";
    return {
      id: vehicle.id,
      type: "VEHICLE",
      label,
      secondaryLabel: vehicle.registrationProvince,
      maskedLabel: label,
      metadata: { type: "VEHICLE", registrationProvince: vehicle.registrationProvince, brand: vehicle.brand, model: vehicle.model, color: vehicle.color },
      firstSeenAt: vehicle.createdAt,
      lastSeenAt: null,
      caseCount,
      riskIndicators: caseCount >= 3 ? ["HIGH_CASE_COUNT"] : [],
    };
  }

  private buildCaseNode(drugCase: DrugCase): DrugGraphNode {
    return {
      id: drugCase.id,
      type: "CASE",
      label: drugCase.caseNumber,
      secondaryLabel: drugCase.title,
      maskedLabel: null,
      metadata: {
        type: "CASE",
        caseNumber: drugCase.caseNumber,
        status: drugCase.status,
        arrestDate: drugCase.arrestDate,
        province: drugCase.province,
        reportingUnitText: drugCase.reportingUnitText,
      },
      firstSeenAt: drugCase.arrestDate ?? drugCase.createdAt,
      lastSeenAt: null,
      caseCount: 1,
      riskIndicators: [],
    };
  }

  private buildLocationNode(location: DrugLocation, caseCount: number): DrugGraphNode {
    return {
      id: location.id,
      type: "LOCATION",
      label: location.name ?? location.addressText ?? "Location",
      secondaryLabel: location.province,
      maskedLabel: null,
      metadata: { type: "LOCATION", province: location.province, district: location.district },
      firstSeenAt: location.createdAt,
      lastSeenAt: null,
      caseCount,
      riskIndicators: caseCount >= 3 ? ["HIGH_CASE_COUNT"] : [],
    };
  }

  // ── Section 2: inferred Person↔Person edges ────────────────────────────

  /**
   * Derives Person↔Person INFERRED edges from the DIRECT edges already
   * gathered in this neighborhood — never a separate whole-pool pairwise
   * scan (Section 19). Two persons sharing a neighbor CASE/PHONE/SIM/
   * DEVICE/VEHICLE node (both already present in `nodes`, both already
   * connected via a DIRECT edge in this same response) get one INFERRED
   * edge, explanation naming the shared entity type/count. Never fabricates
   * a connection between two persons who are not both already nodes in
   * this response.
   */
  private deriveInferredPersonEdges(nodes: DrugGraphNode[], directEdges: DrugGraphEdge[]): DrugGraphEdge[] {
    const personIds = new Set(nodes.filter((n) => n.type === "PERSON").map((n) => n.id));
    if (personIds.size < 2) return [];

    // neighborId -> Set of personIds directly connected to it (via PERSON_CASE/PHONE/SIM/DEVICE/VEHICLE — always source=PERSON, target=neighbor, per directEdge's canonical direction).
    const personsByNeighbor = new Map<string, Set<string>>();
    const relTypeByNeighbor = new Map<string, DrugGraphEdge["relationshipType"]>();
    for (const edge of directEdges) {
      if (!edge.relationshipType.startsWith("PERSON_") || !personIds.has(edge.source)) continue;
      const set = personsByNeighbor.get(edge.target) ?? new Set();
      set.add(edge.source);
      personsByNeighbor.set(edge.target, set);
      relTypeByNeighbor.set(edge.target, edge.relationshipType);
    }

    // pairKey -> { relType -> Set of shared neighbor ids }
    const pairSharedByType = new Map<string, Map<string, Set<string>>>();
    for (const [neighborId, persons] of personsByNeighbor) {
      if (persons.size < 2) continue;
      const relType = relTypeByNeighbor.get(neighborId)!;
      const ids = [...persons].sort();
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pairKey = `${ids[i]}|${ids[j]}`;
          const byType = pairSharedByType.get(pairKey) ?? new Map<string, Set<string>>();
          const sharedSet = byType.get(relType) ?? new Set<string>();
          sharedSet.add(neighborId);
          byType.set(relType, sharedSet);
          pairSharedByType.set(pairKey, byType);
        }
      }
    }

    const inferred: DrugGraphEdge[] = [];
    for (const [pairKey, byType] of pairSharedByType) {
      const [personA, personB] = pairKey.split("|");
      for (const [relType, sharedIds] of byType) {
        const inferredType = relType === "PERSON_CASE" ? "SHARED_CASE" : relType === "PERSON_PHONE" ? "SHARED_PHONE" : relType === "PERSON_SIM" ? "SHARED_SIM" : relType === "PERSON_DEVICE" ? "SHARED_DEVICE" : "SHARED_VEHICLE";
        const explanation =
          inferredType === "SHARED_CASE"
            ? ({ kind: "SHARED_CASES", count: sharedIds.size } as const)
            : inferredType === "SHARED_PHONE"
              ? ({ kind: "SHARED_PHONE" } as const)
              : inferredType === "SHARED_SIM"
                ? ({ kind: "SHARED_SIM" } as const)
                : inferredType === "SHARED_DEVICE"
                  ? ({ kind: "SHARED_DEVICE" } as const)
                  : ({ kind: "SHARED_VEHICLE" } as const);
        inferred.push({
          id: `inf:${inferredType}:${personA}:${personB}`,
          source: personA,
          target: personB,
          relationshipType: inferredType,
          edgeKind: "INFERRED",
          evidenceCount: sharedIds.size,
          firstSeenAt: null,
          lastSeenAt: null,
          sourceCaseIds: relType === "PERSON_CASE" ? [...sharedIds] : [],
          explanation,
        });
      }
    }
    return inferred;
  }

  // ── Section 5: bounded path finding ────────────────────────────────────

  async findPaths(request: DrugGraphPathRequest, options: DrugNetworkGraphServiceOptions): Promise<DrugGraphPathResult> {
    const maxDepth = Math.min(request.maxDepth ?? DRUG_GRAPH_PATH_MAX_DEPTH, DRUG_GRAPH_PATH_MAX_DEPTH);
    const mergeCache = new Map<string, string>();

    let fromId = request.fromId;
    let toId = request.toId;
    if (request.fromType === "PERSON") {
      const canonical = await this.resolveCanonicalPersonId(fromId, mergeCache);
      if (!canonical) throw new DrugPersonGraphNotFoundError(fromId);
      fromId = canonical;
    }
    if (request.toType === "PERSON") {
      const canonical = await this.resolveCanonicalPersonId(toId, mergeCache);
      if (!canonical) throw new DrugPersonGraphNotFoundError(toId);
      toId = canonical;
    }

    const startKey = nodeKey(request.fromType, fromId);
    const targetKey = nodeKey(request.toType, toId);
    if (startKey === targetKey) return { paths: [], found: false };

    // Bounded BFS — each frontier node expanded via the same gatherDirectEdges used by getNeighborhood, capped by DRUG_GRAPH_HARD_MAX_NODES total visits to prevent runaway traversal on a densely-connected graph.
    const cameFrom = new Map<string, { fromKey: string; edge: DrugGraphEdge }>();
    const visited = new Map<string, { type: DrugGraphNodeType; id: string }>([[startKey, { type: request.fromType, id: fromId }]]);
    let frontier: Array<{ type: DrugGraphNodeType; id: string }> = [{ type: request.fromType, id: fromId }];
    let found = false;

    for (let hop = 0; hop < maxDepth && !found; hop++) {
      const nextFrontier: Array<{ type: DrugGraphNodeType; id: string }> = [];
      for (const node of frontier) {
        if (visited.size >= DRUG_GRAPH_HARD_MAX_NODES) break;
        const rawEdges = await this.gatherDirectEdges(node.type, node.id, mergeCache);
        for (const raw of rawEdges) {
          const key = nodeKey(raw.neighborType, raw.neighborId);
          if (visited.has(key)) continue;
          const ref = { type: raw.neighborType, id: raw.neighborId };
          visited.set(key, ref);
          cameFrom.set(key, { fromKey: nodeKey(node.type, node.id), edge: raw.edge });
          if (key === targetKey) {
            found = true;
            break;
          }
          nextFrontier.push(ref);
        }
        if (found || visited.size >= DRUG_GRAPH_HARD_MAX_NODES) break;
      }
      frontier = nextFrontier;
    }

    if (!found) return { paths: [], found: false };

    const keyChain: string[] = [targetKey];
    let cursor = targetKey;
    while (cursor !== startKey) {
      const step = cameFrom.get(cursor);
      if (!step) break;
      keyChain.push(step.fromKey);
      cursor = step.fromKey;
    }
    keyChain.reverse();

    const nodeRefs = keyChain.map((key) => visited.get(key)!);
    const nodes = await this.hydrateNodes(nodeRefs, options);
    const nodeByKey = new Map(nodes.map((n) => [nodeKey(n.type, n.id), n]));

    const steps = keyChain.map((key, index) => {
      const node = nodeByKey.get(key)!;
      const viaEdge = index === 0 ? null : cameFrom.get(key)!.edge;
      return { node, viaEdge };
    });

    const path: DrugGraphPath = { steps, hopCount: steps.length - 1 };
    return { paths: [path], found: true };
  }
}

interface CaseScopedLink {
  id: string;
  caseId: string;
  personId: string | null;
  firstSeenAt?: Date | null;
  lastSeenAt?: Date | null;
}
