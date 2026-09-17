/**
 * Link Compare query service (LC-2A).
 *
 * Read-only analysis over 2–3 DATABASE entities:
 *   - pairwise shortest DIRECT path via DrugNetworkGraphService.findPaths
 *     (maxDepth 3; inferred SHARED_* edges are never path hops)
 *   - independent case-membership and identifier-set intersection
 *
 * Never writes persons, cases, relationships, notes, tasks, or boards.
 * getNeighborhood is not the compare engine. Manual slots are ignored by
 * the graph/intersection engine.
 */

import type { DatabaseClient, DrugCase, DrugDevice, DrugPerson, DrugPhoneNumber, DrugSim, DrugVehicle } from "@/lib/database/database_types";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugEntityRepository } from "@/lib/database/repositories/drug_entity_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import {
  DrugGraphEntityNotFoundError,
  DrugNetworkGraphService,
  DrugPersonGraphNotFoundError,
} from "@/lib/drug_intelligence/drug_network_graph_service";
import type { DrugGraphNodeType, DrugGraphPath } from "@/lib/drug_intelligence/drug_network_graph_types";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  DRUG_LINK_COMPARE_MAX_ENTITIES,
  DRUG_LINK_COMPARE_MAX_PATH_DEPTH,
  DRUG_LINK_COMPARE_MAX_SHARED_CASES,
  DRUG_LINK_COMPARE_MAX_SHARED_ENTITIES,
  DRUG_LINK_COMPARE_MAX_VISITED,
  DRUG_LINK_COMPARE_MIN_ENTITIES,
  DRUG_LINK_COMPARE_NONE_KNOWN_KEY,
  DrugLinkCompareValidationError,
  type DrugLinkCompareConnectionKind,
  type DrugLinkCompareEntityType,
  type DrugLinkComparePair,
  type DrugLinkCompareRequest,
  type DrugLinkCompareResult,
  type DrugLinkCompareServiceOptions,
  type DrugLinkCompareSharedCase,
  type DrugLinkCompareSharedEntity,
  type DrugLinkCompareSlot,
  type DrugLinkCompareSlotInput,
  type DrugLinkCompareSlotKey,
} from "@/lib/drug_intelligence/drug_link_compare_types";

const SLOT_ORDER: DrugLinkCompareSlotKey[] = ["A", "B", "C"];
const SHARED_ENTITY_TYPE_ORDER: Array<DrugLinkCompareSharedEntity["entityType"]> = ["PHONE", "SIM", "DEVICE", "VEHICLE"];

type DatabaseRef = {
  key: DrugLinkCompareSlotKey;
  entityType: DrugLinkCompareEntityType;
  entityId: string;
};

type AssociationSets = {
  caseIds: Set<string>;
  phones: Set<string>;
  sims: Set<string>;
  devices: Set<string>;
  vehicles: Set<string>;
};

function isCompareEntityType(type: DrugGraphNodeType | DrugLinkCompareEntityType): type is DrugLinkCompareEntityType {
  return type !== "LOCATION";
}

function emptyAssociations(): AssociationSets {
  return {
    caseIds: new Set(),
    phones: new Set(),
    sims: new Set(),
    devices: new Set(),
    vehicles: new Set(),
  };
}

function slotIdentityKey(type: DrugLinkCompareEntityType, id: string): string {
  return `${type}:${id}`;
}

function pairKey(left: DrugLinkCompareSlotKey, right: DrugLinkCompareSlotKey): string {
  return `${left}:${right}`;
}

function capTruncated<T>(items: T[], max: number): { items: T[]; truncated: boolean } {
  if (items.length <= max) return { items, truncated: false };
  return { items: items.slice(0, max), truncated: true };
}

function intersectSets(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const id of a) {
    if (b.has(id)) out.push(id);
  }
  return out;
}

function intersectMany(sets: Set<string>[]): string[] {
  if (sets.length === 0) return [];
  let acc = new Set(sets[0]);
  for (const next of sets.slice(1)) {
    const keep = new Set<string>();
    for (const id of acc) {
      if (next.has(id)) keep.add(id);
    }
    acc = keep;
  }
  return [...acc];
}

function classifyPath(path: DrugGraphPath | null): { connectionKind: DrugLinkCompareConnectionKind; hopCount: number | null } {
  if (!path) return { connectionKind: "NONE_KNOWN", hopCount: null };
  if (path.hopCount === 1) return { connectionKind: "DIRECT", hopCount: 1 };
  if (path.hopCount >= 2 && path.hopCount <= DRUG_LINK_COMPARE_MAX_PATH_DEPTH) {
    return { connectionKind: "INDIRECT", hopCount: path.hopCount };
  }
  return { connectionKind: "NONE_KNOWN", hopCount: null };
}

export class DrugLinkCompareService {
  private readonly graph: DrugNetworkGraphService;
  private readonly personRepo: DrugPersonRepository;
  private readonly entityRepo: DrugEntityRepository;
  private readonly caseRepo: DrugCaseRepository;

  constructor(
    private readonly db: DatabaseClient,
    graphService?: DrugNetworkGraphService
  ) {
    this.graph = graphService ?? new DrugNetworkGraphService(db);
    this.personRepo = new DrugPersonRepository(db);
    this.entityRepo = new DrugEntityRepository(db);
    this.caseRepo = new DrugCaseRepository(db);
  }

  async compare(request: DrugLinkCompareRequest, options: DrugLinkCompareServiceOptions): Promise<DrugLinkCompareResult> {
    const normalized = this.normalizeSlots(request.slots);
    const databaseRefs = await this.resolveDatabaseRefs(normalized);

    const [hydratedSlots, associations, pairPaths] = await Promise.all([
      this.hydrateSlots(normalized, databaseRefs, options),
      this.loadAssociations(databaseRefs),
      this.findPairPaths(databaseRefs, options),
    ]);

    const allSharedCaseIds = new Set<string>();
    const allSharedEntityRefs: Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }> = [];

    const pairSpecs: Array<[DrugLinkCompareSlotKey, DrugLinkCompareSlotKey]> = [];
    if (databaseRefs.length === 2) {
      pairSpecs.push([databaseRefs[0].key, databaseRefs[1].key]);
    } else {
      pairSpecs.push(["A", "B"], ["A", "C"], ["B", "C"]);
    }

    const pairDrafts = pairSpecs.map(([left, right]) => {
      const leftRef = databaseRefs.find((r) => r.key === left)!;
      const rightRef = databaseRefs.find((r) => r.key === right)!;
      const leftAssoc = associations.get(left)!;
      const rightAssoc = associations.get(right)!;
      const path = pairPaths.get(pairKey(left, right)) ?? null;
      const { connectionKind, hopCount } = classifyPath(path);
      const excluded = new Set([leftRef.entityId, rightRef.entityId]);
      const sharedCaseIds = intersectSets(leftAssoc.caseIds, rightAssoc.caseIds);
      const sharedEntityIds = this.collectSharedEntityIds(leftAssoc, rightAssoc, excluded);
      for (const id of sharedCaseIds) allSharedCaseIds.add(id);
      allSharedEntityRefs.push(...sharedEntityIds);
      return { left, right, path, connectionKind, hopCount, sharedCaseIds, sharedEntityIds };
    });

    let tripleCaseIds: string[] = [];
    let tripleEntityIds: Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }> = [];
    if (databaseRefs.length === 3) {
      tripleCaseIds = intersectMany(databaseRefs.map((ref) => associations.get(ref.key)!.caseIds));
      const excluded = new Set(databaseRefs.map((ref) => ref.entityId));
      tripleEntityIds = this.collectTripleEntityIds(
        databaseRefs.map((ref) => associations.get(ref.key)!),
        excluded
      );
      for (const id of tripleCaseIds) allSharedCaseIds.add(id);
      allSharedEntityRefs.push(...tripleEntityIds);
    }

    const caseSummaries = await this.hydrateCases([...allSharedCaseIds]);
    const entitySummaries = await this.hydrateSharedEntities(allSharedEntityRefs, options);

    const pairs: DrugLinkComparePair[] = pairDrafts.map((draft) => {
      const cases = this.takeSharedCases(draft.sharedCaseIds, caseSummaries);
      const entities = this.takeSharedEntities(draft.sharedEntityIds, entitySummaries);
      return {
        left: draft.left,
        right: draft.right,
        connectionKind: draft.connectionKind,
        hopCount: draft.hopCount,
        shortestPath: draft.path,
        sharedCases: cases.items,
        sharedEntities: entities.items,
        truncated: cases.truncated || entities.truncated,
        absenceExplanationKey: draft.connectionKind === "NONE_KNOWN" ? DRUG_LINK_COMPARE_NONE_KNOWN_KEY : null,
      };
    });

    let tripleIntersection: DrugLinkCompareResult["tripleIntersection"] = null;
    if (databaseRefs.length === 3) {
      const cases = this.takeSharedCases(tripleCaseIds, caseSummaries);
      const entities = this.takeSharedEntities(tripleEntityIds, entitySummaries);
      if (cases.items.length > 0 || entities.items.length > 0) {
        tripleIntersection = { cases: cases.items, entities: entities.items };
      }
    }

    return {
      interpretation: { kind: "QUERY" },
      slots: hydratedSlots,
      pairs,
      tripleIntersection,
      bounds: {
        maxEntities: DRUG_LINK_COMPARE_MAX_ENTITIES,
        maxPathDepth: DRUG_LINK_COMPARE_MAX_PATH_DEPTH,
        maxVisited: DRUG_LINK_COMPARE_MAX_VISITED,
      },
    };
  }

  private normalizeSlots(slots: DrugLinkCompareSlotInput[]): DrugLinkCompareSlotInput[] {
    if (slots.length > DRUG_LINK_COMPARE_MAX_ENTITIES) {
      throw new DrugLinkCompareValidationError("TOO_MANY_ENTITIES", "Link Compare accepts at most 3 entities");
    }
    const seenKeys = new Set<DrugLinkCompareSlotKey>();
    for (const slot of slots) {
      if (!SLOT_ORDER.includes(slot.key)) {
        throw new DrugLinkCompareValidationError("INVALID_SLOT", "Slot key must be A, B, or C");
      }
      if (seenKeys.has(slot.key)) {
        throw new DrugLinkCompareValidationError("INVALID_SLOT", "Duplicate slot key");
      }
      seenKeys.add(slot.key);
    }
    return [...slots].sort((a, b) => SLOT_ORDER.indexOf(a.key) - SLOT_ORDER.indexOf(b.key));
  }

  private async resolveDatabaseRefs(slots: DrugLinkCompareSlotInput[]): Promise<DatabaseRef[]> {
    const refs: DatabaseRef[] = [];
    const seen = new Set<string>();

    for (const slot of slots) {
      if (slot.kind === "EMPTY") continue;
      if (slot.kind === "MANUAL") continue;
      if (slot.kind !== "DATABASE") {
        throw new DrugLinkCompareValidationError("INVALID_SLOT", "Unknown slot kind");
      }
      const type = slot.entityType ?? null;
      const id = slot.entityId == null ? "" : String(slot.entityId).trim();
      if (!type || !id) {
        throw new DrugLinkCompareValidationError("INVALID_SLOT", "Database slots require type and id");
      }
      if (!isCompareEntityType(type)) {
        throw new DrugLinkCompareValidationError("UNSUPPORTED_TYPE", "LOCATION is not a Link Compare endpoint");
      }
      const identity = slotIdentityKey(type, id);
      if (seen.has(identity)) {
        throw new DrugLinkCompareValidationError("DUPLICATE_ENTITY", "The same entity cannot occupy multiple boxes");
      }
      seen.add(identity);
      refs.push({ key: slot.key, entityType: type, entityId: id });
    }

    if (refs.length < DRUG_LINK_COMPARE_MIN_ENTITIES) {
      throw new DrugLinkCompareValidationError(
        "INSUFFICIENT_DATABASE_ENTITIES",
        "Link Compare requires at least 2 database entities"
      );
    }
    if (refs.length > DRUG_LINK_COMPARE_MAX_ENTITIES) {
      throw new DrugLinkCompareValidationError("TOO_MANY_ENTITIES", "Link Compare accepts at most 3 entities");
    }

    for (const ref of refs) {
      await this.assertEntityExists(ref);
    }

    const canonicalSeen = new Set<string>();
    for (const ref of refs) {
      const identity = slotIdentityKey(ref.entityType, ref.entityId);
      if (canonicalSeen.has(identity)) {
        throw new DrugLinkCompareValidationError("DUPLICATE_ENTITY", "The same entity cannot occupy multiple boxes");
      }
      canonicalSeen.add(identity);
    }
    return refs;
  }

  private async assertEntityExists(ref: DatabaseRef): Promise<void> {
    if (ref.entityType === "PERSON") {
      const person = await this.findPerson(ref.entityId);
      if (!person) throw new DrugPersonGraphNotFoundError(ref.entityId);
      ref.entityId = person.status === "MERGED" && person.mergedIntoPersonId ? person.mergedIntoPersonId : person.id;
      return;
    }
    const storedId = await this.resolveNonPersonId(ref.entityType, ref.entityId);
    if (!storedId) throw new DrugGraphEntityNotFoundError(ref.entityType, ref.entityId);
    ref.entityId = storedId;
  }

  private lookupCandidates(id: string): Array<string | number> {
    const candidates: Array<string | number> = [id];
    if (/^\d+$/.test(id)) candidates.push(Number(id));
    return candidates;
  }

  private async findPerson(id: string) {
    for (const candidate of this.lookupCandidates(id)) {
      const person = await this.personRepo.findById(candidate as string);
      if (person) return person;
    }
    return null;
  }

  private async resolveNonPersonId(type: Exclude<DrugLinkCompareEntityType, "PERSON">, id: string): Promise<string | null> {
    for (const candidate of this.lookupCandidates(id)) {
      const exists = await this.nonPersonExists(type, candidate as string);
      if (exists) return candidate as string;
    }
    return null;
  }

  private async nonPersonExists(type: Exclude<DrugLinkCompareEntityType, "PERSON">, id: string): Promise<boolean> {
    switch (type) {
      case "CASE":
        return Boolean(await this.caseRepo.findById(id));
      case "PHONE":
        return Boolean(await this.entityRepo.findPhoneNumberById(id));
      case "SIM":
        return Boolean(await this.entityRepo.findSimById(id));
      case "DEVICE":
        return Boolean(await this.entityRepo.findDeviceById(id));
      case "VEHICLE":
        return Boolean(await this.entityRepo.findVehicleById(id));
    }
  }

  private async hydrateSlots(
    slots: DrugLinkCompareSlotInput[],
    refs: DatabaseRef[],
    options: DrugLinkCompareServiceOptions
  ): Promise<DrugLinkCompareSlot[]> {
    const labels = await this.loadEndpointLabels(refs, options);
    return slots.map((input) => {
      if (input.kind === "EMPTY") {
        return { key: input.key, kind: "EMPTY" as const, entityType: null, entityId: null, label: null, caseCount: null };
      }
      if (input.kind === "MANUAL") {
        return { key: input.key, kind: "MANUAL" as const, entityType: null, entityId: null, label: null, caseCount: null };
      }
      const ref = refs.find((r) => r.key === input.key);
      if (!ref) {
        return { key: input.key, kind: "EMPTY" as const, entityType: null, entityId: null, label: null, caseCount: null };
      }
      const meta = labels.get(ref.key);
      return {
        key: input.key,
        kind: "DATABASE" as const,
        entityType: ref.entityType,
        entityId: ref.entityId,
        label: meta?.label ?? null,
        caseCount: meta?.caseCount ?? null,
      };
    });
  }

  private async loadEndpointLabels(
    refs: DatabaseRef[],
    options: DrugLinkCompareServiceOptions
  ): Promise<Map<DrugLinkCompareSlotKey, { label: string; caseCount: number }>> {
    const byType = this.groupIdsByType(refs);
    const [persons, cases, phones, sims, devices, vehicles, caseCounts] = await Promise.all([
      this.personRepo.findByIds(byType.PERSON),
      this.caseRepo.findByIds(byType.CASE),
      this.entityRepo.findByIdsPhones(byType.PHONE),
      this.entityRepo.findByIdsSims(byType.SIM),
      this.entityRepo.findByIdsDevices(byType.DEVICE),
      this.entityRepo.findByIdsVehicles(byType.VEHICLE),
      this.loadCaseCounts(byType),
    ]);

    const labels = new Map<DrugLinkCompareSlotKey, { label: string; caseCount: number }>();
    const personById = new Map(persons.map((p) => [p.id, p]));
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const phoneById = new Map(phones.map((p) => [p.id, p]));
    const simById = new Map(sims.map((s) => [s.id, s]));
    const deviceById = new Map(devices.map((d) => [d.id, d]));
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

    for (const ref of refs) {
      const count = caseCounts.get(slotIdentityKey(ref.entityType, ref.entityId)) ?? 0;
      labels.set(ref.key, {
        label: this.labelFor(ref, { personById, caseById, phoneById, simById, deviceById, vehicleById }, options),
        caseCount: ref.entityType === "CASE" ? 1 : count,
      });
    }
    return labels;
  }

  private labelFor(
    ref: DatabaseRef,
    maps: {
      personById: Map<string, DrugPerson>;
      caseById: Map<string, DrugCase>;
      phoneById: Map<string, DrugPhoneNumber>;
      simById: Map<string, DrugSim>;
      deviceById: Map<string, DrugDevice>;
      vehicleById: Map<string, DrugVehicle>;
    },
    options: DrugLinkCompareServiceOptions
  ): string {
    switch (ref.entityType) {
      case "PERSON":
        return maps.personById.get(ref.entityId)?.primaryFullName ?? ref.entityId;
      case "CASE":
        return maps.caseById.get(ref.entityId)?.caseNumber ?? ref.entityId;
      case "PHONE": {
        const phone = maps.phoneById.get(ref.entityId);
        return phone ? presentPhoneNumber(phone.normalizedNumber, options.canViewFull) : ref.entityId;
      }
      case "SIM": {
        const sim = maps.simById.get(ref.entityId);
        return sim?.iccid ? presentIdentifierValue(sim.iccid, options.canViewFull) : "SIM";
      }
      case "DEVICE": {
        const device = maps.deviceById.get(ref.entityId);
        if (!device) return ref.entityId;
        const brandModel = [device.brand, device.model].filter(Boolean).join(" ");
        if (brandModel) return brandModel;
        return device.imei1 ? presentIdentifierValue(device.imei1, options.canViewFull) : "Device";
      }
      case "VEHICLE": {
        const vehicle = maps.vehicleById.get(ref.entityId);
        return vehicle?.registrationNumber
          ? presentIdentifierValue(vehicle.registrationNumber, options.canViewFull)
          : "Vehicle";
      }
    }
  }

  private groupIdsByType(refs: DatabaseRef[]): Record<DrugLinkCompareEntityType, string[]> {
    const grouped: Record<DrugLinkCompareEntityType, string[]> = {
      PERSON: [],
      CASE: [],
      PHONE: [],
      SIM: [],
      DEVICE: [],
      VEHICLE: [],
    };
    for (const ref of refs) grouped[ref.entityType].push(ref.entityId);
    return grouped;
  }

  private async loadCaseCounts(byType: Record<DrugLinkCompareEntityType, string[]>): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const [personLinks, phoneLinks, simLinks, deviceLinks, vehicleLinks] = await Promise.all([
      byType.PERSON.length ? this.db.drugCasePerson.findMany({ where: { personId: { in: byType.PERSON } } }) : Promise.resolve([]),
      byType.PHONE.length ? this.db.drugCasePhone.findMany({ where: { phoneNumberId: { in: byType.PHONE } } }) : Promise.resolve([]),
      byType.SIM.length ? this.db.drugCaseSim.findMany({ where: { simId: { in: byType.SIM } } }) : Promise.resolve([]),
      byType.DEVICE.length ? this.db.drugCaseDevice.findMany({ where: { deviceId: { in: byType.DEVICE } } }) : Promise.resolve([]),
      byType.VEHICLE.length ? this.db.drugCaseVehicle.findMany({ where: { vehicleId: { in: byType.VEHICLE } } }) : Promise.resolve([]),
    ]);
    const bump = (type: DrugLinkCompareEntityType, id: string) => {
      const key = slotIdentityKey(type, id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (const link of personLinks as Array<{ personId: string }>) bump("PERSON", link.personId);
    for (const link of phoneLinks as Array<{ phoneNumberId: string }>) bump("PHONE", link.phoneNumberId);
    for (const link of simLinks as Array<{ simId: string }>) bump("SIM", link.simId);
    for (const link of deviceLinks as Array<{ deviceId: string }>) bump("DEVICE", link.deviceId);
    for (const link of vehicleLinks as Array<{ vehicleId: string }>) bump("VEHICLE", link.vehicleId);
    return counts;
  }

  private async findPairPaths(
    refs: DatabaseRef[],
    options: DrugLinkCompareServiceOptions
  ): Promise<Map<string, DrugGraphPath | null>> {
    const pairs: Array<[DatabaseRef, DatabaseRef]> = [];
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        pairs.push([refs[i], refs[j]]);
      }
    }
    const results = await Promise.all(
      pairs.map(async ([from, to]) => {
        const found = await this.graph.findPaths(
          {
            fromType: from.entityType,
            fromId: from.entityId,
            toType: to.entityType,
            toId: to.entityId,
            maxDepth: DRUG_LINK_COMPARE_MAX_PATH_DEPTH,
          },
          { canViewFull: options.canViewFull }
        );
        const path = found.found && found.paths[0] ? found.paths[0] : null;
        if (path) {
          for (const step of path.steps) {
            if (step.viaEdge && step.viaEdge.edgeKind !== "DIRECT") {
              return [pairKey(from.key, to.key), null] as const;
            }
            if (step.viaEdge && String(step.viaEdge.relationshipType).startsWith("SHARED_")) {
              return [pairKey(from.key, to.key), null] as const;
            }
          }
          if (path.hopCount < 1 || path.hopCount > DRUG_LINK_COMPARE_MAX_PATH_DEPTH) {
            return [pairKey(from.key, to.key), null] as const;
          }
        }
        return [pairKey(from.key, to.key), path] as const;
      })
    );
    return new Map(results);
  }

  private async loadAssociations(refs: DatabaseRef[]): Promise<Map<DrugLinkCompareSlotKey, AssociationSets>> {
    const byType = this.groupIdsByType(refs);
    const [
      personCases,
      personPhones,
      personSims,
      personDevices,
      personVehicles,
      casePhones,
      caseSims,
      caseDevices,
      caseVehicles,
      phoneCaseLinks,
      simCaseLinks,
      deviceCaseLinks,
      vehicleCaseLinks,
    ] = await Promise.all([
      byType.PERSON.length ? this.personRepo.casePersonsForPersons(byType.PERSON) : Promise.resolve([]),
      byType.PERSON.length ? this.personRepo.casePhonesForPersons(byType.PERSON) : Promise.resolve([]),
      byType.PERSON.length ? this.db.drugCaseSim.findMany({ where: { personId: { in: byType.PERSON } } }) : Promise.resolve([]),
      byType.PERSON.length ? this.personRepo.devicesForPersons(byType.PERSON) : Promise.resolve([]),
      byType.PERSON.length ? this.db.drugPersonVehicle.findMany({ where: { personId: { in: byType.PERSON } } }) : Promise.resolve([]),
      byType.CASE.length ? this.db.drugCasePhone.findMany({ where: { caseId: { in: byType.CASE } } }) : Promise.resolve([]),
      byType.CASE.length ? this.db.drugCaseSim.findMany({ where: { caseId: { in: byType.CASE } } }) : Promise.resolve([]),
      byType.CASE.length ? this.db.drugCaseDevice.findMany({ where: { caseId: { in: byType.CASE } } }) : Promise.resolve([]),
      byType.CASE.length ? this.db.drugCaseVehicle.findMany({ where: { caseId: { in: byType.CASE } } }) : Promise.resolve([]),
      byType.PHONE.length ? this.db.drugCasePhone.findMany({ where: { phoneNumberId: { in: byType.PHONE } } }) : Promise.resolve([]),
      byType.SIM.length ? this.db.drugCaseSim.findMany({ where: { simId: { in: byType.SIM } } }) : Promise.resolve([]),
      byType.DEVICE.length ? this.db.drugCaseDevice.findMany({ where: { deviceId: { in: byType.DEVICE } } }) : Promise.resolve([]),
      byType.VEHICLE.length ? this.db.drugCaseVehicle.findMany({ where: { vehicleId: { in: byType.VEHICLE } } }) : Promise.resolve([]),
    ]);

    const assoc = new Map<DrugLinkCompareSlotKey, AssociationSets>();
    for (const ref of refs) assoc.set(ref.key, emptyAssociations());

    const byPerson = new Map<string, DrugLinkCompareSlotKey[]>();
    const byCase = new Map<string, DrugLinkCompareSlotKey[]>();
    const byPhone = new Map<string, DrugLinkCompareSlotKey[]>();
    const bySim = new Map<string, DrugLinkCompareSlotKey[]>();
    const byDevice = new Map<string, DrugLinkCompareSlotKey[]>();
    const byVehicle = new Map<string, DrugLinkCompareSlotKey[]>();
    for (const ref of refs) {
      const add = (map: Map<string, DrugLinkCompareSlotKey[]>, id: string) => {
        const list = map.get(id) ?? [];
        list.push(ref.key);
        map.set(id, list);
      };
      if (ref.entityType === "PERSON") add(byPerson, ref.entityId);
      if (ref.entityType === "CASE") {
        add(byCase, ref.entityId);
        assoc.get(ref.key)!.caseIds.add(ref.entityId);
      }
      if (ref.entityType === "PHONE") {
        add(byPhone, ref.entityId);
        assoc.get(ref.key)!.phones.add(ref.entityId);
      }
      if (ref.entityType === "SIM") {
        add(bySim, ref.entityId);
        assoc.get(ref.key)!.sims.add(ref.entityId);
      }
      if (ref.entityType === "DEVICE") {
        add(byDevice, ref.entityId);
        assoc.get(ref.key)!.devices.add(ref.entityId);
      }
      if (ref.entityType === "VEHICLE") {
        add(byVehicle, ref.entityId);
        assoc.get(ref.key)!.vehicles.add(ref.entityId);
      }
    }

    const apply = (keys: DrugLinkCompareSlotKey[] | undefined, fn: (sets: AssociationSets) => void) => {
      if (!keys) return;
      for (const key of keys) fn(assoc.get(key)!);
    };

    for (const link of personCases as Array<{ personId: string; caseId: string }>) {
      apply(byPerson.get(link.personId), (sets) => sets.caseIds.add(link.caseId));
    }
    for (const link of personPhones as Array<{ personId: string | null; phoneNumberId: string }>) {
      if (!link.personId) continue;
      apply(byPerson.get(link.personId), (sets) => sets.phones.add(link.phoneNumberId));
    }
    for (const link of personSims as Array<{ personId: string | null; simId: string }>) {
      if (!link.personId) continue;
      apply(byPerson.get(link.personId), (sets) => sets.sims.add(link.simId));
    }
    for (const link of personDevices as Array<{ personId: string; deviceId: string }>) {
      apply(byPerson.get(link.personId), (sets) => sets.devices.add(link.deviceId));
    }
    for (const link of personVehicles as Array<{ personId: string; vehicleId: string }>) {
      apply(byPerson.get(link.personId), (sets) => sets.vehicles.add(link.vehicleId));
    }

    for (const link of casePhones as Array<{ caseId: string; phoneNumberId: string }>) {
      apply(byCase.get(link.caseId), (sets) => sets.phones.add(link.phoneNumberId));
    }
    for (const link of caseSims as Array<{ caseId: string; simId: string }>) {
      apply(byCase.get(link.caseId), (sets) => sets.sims.add(link.simId));
    }
    for (const link of caseDevices as Array<{ caseId: string; deviceId: string }>) {
      apply(byCase.get(link.caseId), (sets) => sets.devices.add(link.deviceId));
    }
    for (const link of caseVehicles as Array<{ caseId: string; vehicleId: string }>) {
      apply(byCase.get(link.caseId), (sets) => sets.vehicles.add(link.vehicleId));
    }

    for (const link of phoneCaseLinks as Array<{ phoneNumberId: string; caseId: string }>) {
      apply(byPhone.get(link.phoneNumberId), (sets) => sets.caseIds.add(link.caseId));
    }
    for (const link of simCaseLinks as Array<{ simId: string; caseId: string }>) {
      apply(bySim.get(link.simId), (sets) => sets.caseIds.add(link.caseId));
    }
    for (const link of deviceCaseLinks as Array<{ deviceId: string; caseId: string }>) {
      apply(byDevice.get(link.deviceId), (sets) => sets.caseIds.add(link.caseId));
    }
    for (const link of vehicleCaseLinks as Array<{ vehicleId: string; caseId: string }>) {
      apply(byVehicle.get(link.vehicleId), (sets) => sets.caseIds.add(link.caseId));
    }

    return assoc;
  }

  private collectSharedEntityIds(
    left: AssociationSets,
    right: AssociationSets,
    excludedIds: Set<string>
  ): Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }> {
    const out: Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }> = [];
    for (const type of SHARED_ENTITY_TYPE_ORDER) {
      const ids = intersectSets(this.setFor(left, type), this.setFor(right, type));
      for (const id of ids) {
        if (excludedIds.has(id)) continue;
        out.push({ type, id });
      }
    }
    return out;
  }

  private collectTripleEntityIds(
    sets: AssociationSets[],
    excludedIds: Set<string>
  ): Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }> {
    const out: Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }> = [];
    for (const type of SHARED_ENTITY_TYPE_ORDER) {
      const ids = intersectMany(sets.map((s) => this.setFor(s, type)));
      for (const id of ids) {
        if (excludedIds.has(id)) continue;
        out.push({ type, id });
      }
    }
    return out;
  }

  private setFor(sets: AssociationSets, type: DrugLinkCompareSharedEntity["entityType"]): Set<string> {
    switch (type) {
      case "PHONE":
        return sets.phones;
      case "SIM":
        return sets.sims;
      case "DEVICE":
        return sets.devices;
      case "VEHICLE":
        return sets.vehicles;
    }
  }

  private async hydrateCases(ids: string[]): Promise<Map<string, DrugLinkCompareSharedCase>> {
    const unique = [...new Set(ids)];
    const rows = unique.length ? await this.caseRepo.findByIds(unique) : [];
    const map = new Map<string, DrugLinkCompareSharedCase>();
    for (const row of rows) {
      map.set(row.id, { caseId: row.id, caseNumber: row.caseNumber, label: row.caseNumber });
    }
    return map;
  }

  private async hydrateSharedEntities(
    refs: Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }>,
    options: DrugLinkCompareServiceOptions
  ): Promise<Map<string, DrugLinkCompareSharedEntity>> {
    const phones = [...new Set(refs.filter((r) => r.type === "PHONE").map((r) => r.id))];
    const sims = [...new Set(refs.filter((r) => r.type === "SIM").map((r) => r.id))];
    const devices = [...new Set(refs.filter((r) => r.type === "DEVICE").map((r) => r.id))];
    const vehicles = [...new Set(refs.filter((r) => r.type === "VEHICLE").map((r) => r.id))];
    const [phoneRows, simRows, deviceRows, vehicleRows] = await Promise.all([
      this.entityRepo.findByIdsPhones(phones),
      this.entityRepo.findByIdsSims(sims),
      this.entityRepo.findByIdsDevices(devices),
      this.entityRepo.findByIdsVehicles(vehicles),
    ]);
    const map = new Map<string, DrugLinkCompareSharedEntity>();
    for (const phone of phoneRows) {
      map.set(`PHONE:${phone.id}`, {
        entityType: "PHONE",
        entityId: phone.id,
        label: presentPhoneNumber(phone.normalizedNumber, options.canViewFull),
      });
    }
    for (const sim of simRows) {
      map.set(`SIM:${sim.id}`, {
        entityType: "SIM",
        entityId: sim.id,
        label: sim.iccid ? presentIdentifierValue(sim.iccid, options.canViewFull) : "SIM",
      });
    }
    for (const device of deviceRows) {
      const brandModel = [device.brand, device.model].filter(Boolean).join(" ");
      map.set(`DEVICE:${device.id}`, {
        entityType: "DEVICE",
        entityId: device.id,
        label: brandModel || (device.imei1 ? presentIdentifierValue(device.imei1, options.canViewFull) : "Device"),
      });
    }
    for (const vehicle of vehicleRows) {
      map.set(`VEHICLE:${vehicle.id}`, {
        entityType: "VEHICLE",
        entityId: vehicle.id,
        label: vehicle.registrationNumber
          ? presentIdentifierValue(vehicle.registrationNumber, options.canViewFull)
          : "Vehicle",
      });
    }
    return map;
  }

  private takeSharedCases(
    ids: string[],
    summaries: Map<string, DrugLinkCompareSharedCase>
  ): { items: DrugLinkCompareSharedCase[]; truncated: boolean } {
    const items = ids
      .map((id) => summaries.get(id))
      .filter((row): row is DrugLinkCompareSharedCase => Boolean(row))
      .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, "th") || a.caseId.localeCompare(b.caseId));
    return capTruncated(items, DRUG_LINK_COMPARE_MAX_SHARED_CASES);
  }

  private takeSharedEntities(
    refs: Array<{ type: DrugLinkCompareSharedEntity["entityType"]; id: string }>,
    summaries: Map<string, DrugLinkCompareSharedEntity>
  ): { items: DrugLinkCompareSharedEntity[]; truncated: boolean } {
    const items = refs
      .map((ref) => summaries.get(`${ref.type}:${ref.id}`))
      .filter((row): row is DrugLinkCompareSharedEntity => Boolean(row))
      .sort(
        (a, b) =>
          SHARED_ENTITY_TYPE_ORDER.indexOf(a.entityType) - SHARED_ENTITY_TYPE_ORDER.indexOf(b.entityType) ||
          a.entityId.localeCompare(b.entityId)
      );
    return capTruncated(items, DRUG_LINK_COMPARE_MAX_SHARED_ENTITIES);
  }
}
