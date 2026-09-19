/**
 * Origin-first investigation context — partition, badges, returnTo safety.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  caseOriginBadge,
  partitionEntityCasesByOrigin,
  sourceRelativeConnectionDetail,
} from "@/lib/drug_intelligence/drug_person_investigation_origin";
import {
  buildImportantConnections,
  explainPersonPhone,
  assertNeverClaimsOwnership,
  assertNeverClaimsUsage,
} from "@/lib/drug_intelligence/drug_person_relationship_explain";
import {
  readPersonCaseContextParam,
  resolvePersonProfileCaseContext,
  withPersonSourceCase,
} from "@/lib/drug_intelligence/person_case_context";
import { drugPersonProfilePath as profilePath, casePersonInvestigationHref } from "@/lib/drug_intelligence/drug_entity_routes";
import { getSafeReturnTo, withReturnTo, isSafeInternalReturnPath } from "@/lib/ui/return_context";
import { returnToBackLabelKey } from "@/lib/ui/return_to_back_label";

const ROOT = process.cwd();

test("partitionEntityCasesByOrigin separates source from discovered", () => {
  const cases = [
    { caseId: "c-source", caseNumber: "DI-TEST-003" },
    { caseId: "c-a", caseNumber: "DI-TEST-001" },
    { caseId: "c-b", caseNumber: "DI-TEST-002" },
  ];
  const part = partitionEntityCasesByOrigin(cases, "c-source");
  assert.equal(part.inSource, true);
  assert.deepEqual(part.sourceLabels, ["DI-TEST-003"]);
  assert.deepEqual(part.discoveredLabels, ["DI-TEST-001", "DI-TEST-002"]);
  assert.equal(part.discoveredCount, 2);
});

test("partition without sourceCaseId stays aggregate (no invented origin)", () => {
  const cases = [
    { caseId: "c-a", caseNumber: "DI-TEST-001" },
    { caseId: "c-b", caseNumber: "DI-TEST-002" },
  ];
  const part = partitionEntityCasesByOrigin(cases, null);
  assert.equal(part.inSource, false);
  assert.deepEqual(part.sourceLabels, []);
  assert.deepEqual(part.discoveredLabels, ["DI-TEST-001", "DI-TEST-002"]);
});

test("caseOriginBadge marks only the URL origin as SOURCE", () => {
  assert.equal(caseOriginBadge({ caseId: "c1", sourceCaseId: "c1", personIsOnCase: true }), "SOURCE");
  assert.equal(caseOriginBadge({ caseId: "c2", sourceCaseId: "c1", personIsOnCase: true }), "LINKED");
  assert.equal(caseOriginBadge({ caseId: "c2", sourceCaseId: null, personIsOnCase: true }), null);
  assert.equal(caseOriginBadge({ caseId: "c2", sourceCaseId: "c1", personIsOnCase: false }), null);
});

test("sourceRelativeConnectionDetail is origin-aware", () => {
  assert.match(
    sourceRelativeConnectionDetail({ language: "th", inSource: true, totalCaseCount: 3, discoveredCount: 2 }),
    /พบในคดีต้นทาง.*พบซ้ำอีก 2/,
  );
  assert.match(
    sourceRelativeConnectionDetail({ language: "th", inSource: false, totalCaseCount: 3, discoveredCount: 3 }),
    /เชื่อม 3 คดี/,
  );
  assert.equal(
    sourceRelativeConnectionDetail({ language: "th", inSource: true, totalCaseCount: 1, discoveredCount: 0 }),
    "พบในคดีต้นทาง",
  );
});

test("important connections use source-relative wording when origin present", () => {
  const withOrigin = buildImportantConnections({
    language: "th",
    sourceCaseId: "c-source",
    phones: [{ id: "p1", label: "66900001001", caseCount: 3, caseIds: ["c-source", "c-a", "c-b"] }],
    devices: [],
    vehicles: [],
    networkRoles: [],
  });
  assert.match(withOrigin[0]!.detail, /พบในคดีต้นทาง/);
  assert.match(withOrigin[0]!.detail, /2/);

  const aggregate = buildImportantConnections({
    language: "th",
    sourceCaseId: null,
    phones: [{ id: "p1", label: "66900001001", caseCount: 3, caseIds: ["c-a", "c-b", "c-c"] }],
    devices: [],
    vehicles: [],
    networkRoles: [],
  });
  assert.match(aggregate[0]!.detail, /3/);
  assert.doesNotMatch(aggregate[0]!.detail, /คดีต้นทาง/);
});

test("phone explanation with origin partitions does not invent ownership", () => {
  const model = explainPersonPhone({
    personName: "นายกิตติศักดิ์",
    phoneLabel: "66900001001",
    caseLabels: ["DI-TEST-003", "DI-TEST-001", "DI-TEST-002"],
    language: "th",
    sourceCaseLabels: ["DI-TEST-003"],
    discoveredCaseLabels: ["DI-TEST-001", "DI-TEST-002"],
  });
  assert.deepEqual(model.sourceCaseLabels, ["DI-TEST-003"]);
  assert.deepEqual(model.discoveredCaseLabels, ["DI-TEST-001", "DI-TEST-002"]);
  assert.deepEqual(model.caseChips, []);
  assert.match(model.insight ?? "", /พบในคดีต้นทาง/);
  const blob = [model.insight ?? "", ...model.path.map((p) => p.verb)].join(" ");
  assert.ok(assertNeverClaimsOwnership(blob));
  assert.ok(assertNeverClaimsUsage(blob));
});

test("sourceCaseId is preserved on person profile path (not invented)", () => {
  const withOrigin = profilePath("04d2ac30-976a-460d-b77d-31e74153e59f", {
    sourceCaseId: "11111111-1111-4111-8111-111111111111",
  });
  assert.match(withOrigin, /sourceCaseId=11111111-1111-4111-8111-111111111111/);
  assert.match(withOrigin, /caseId=11111111-1111-4111-8111-111111111111/);
  assert.equal(profilePath("04d2ac30-976a-460d-b77d-31e74153e59f").includes("sourceCaseId="), false);
  assert.equal(profilePath("04d2ac30-976a-460d-b77d-31e74153e59f").includes("caseId="), false);
});

test("readPersonCaseContextParam prefers sourceCaseId over caseId", () => {
  assert.equal(
    readPersonCaseContextParam(
      new URLSearchParams({
        sourceCaseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        caseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ),
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(
    readPersonCaseContextParam(new URLSearchParams({ caseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })),
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  assert.equal(readPersonCaseContextParam(new URLSearchParams()), null);
});

test("legacy caseId alone still resolves when person is linked (compat)", () => {
  const linked = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
  const raw = readPersonCaseContextParam(
    new URLSearchParams({ caseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
  );
  assert.equal(resolvePersonProfileCaseContext(raw, linked), "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
});

test("canonical Case → Person href writes sourceCaseId first", () => {
  const href = casePersonInvestigationHref(
    "04d2ac30-976a-460d-b77d-31e74153e59f",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  const q = href.indexOf("?");
  assert.ok(q >= 0);
  const query = href.slice(q + 1);
  assert.ok(query.indexOf("sourceCaseId=") < query.indexOf("caseId="));
});

test("resolvePersonProfileCaseContext rejects unrelated case ids (no invented origin)", () => {
  assert.equal(
    resolvePersonProfileCaseContext("cccccccc-cccc-4ccc-8ccc-cccccccccccc", [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]),
    null,
  );
  assert.equal(
    resolvePersonProfileCaseContext("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]),
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
});

test("returnTo accepts only internal paths; back labels are contextual", () => {
  assert.equal(isSafeInternalReturnPath("/drug-intelligence/persons/x"), true);
  assert.equal(isSafeInternalReturnPath("https://evil.example"), false);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "https://evil.example" })), null);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "//evil.example/x" })), null);
  assert.equal(
    getSafeReturnTo(new URLSearchParams({ returnTo: "/drug-intelligence/persons/p1" })),
    "/drug-intelligence/persons/p1",
  );
  assert.equal(returnToBackLabelKey("/drug-intelligence/persons/p1"), "di.profile.backToPerson");
  assert.equal(returnToBackLabelKey("/drug-intelligence/cases/c1"), "di.rel.backToCase");
  assert.equal(returnToBackLabelKey("/drug-intelligence/network?focusType=PERSON"), "di.rel.backToNetwork");
  const nested = withReturnTo("/drug-intelligence/timeline?personId=p1", "/drug-intelligence/persons/p1?sourceCaseId=c1");
  assert.match(nested, /returnTo=/);
  assert.equal(
    getSafeReturnTo(new URLSearchParams(nested.split("?")[1]!)),
    "/drug-intelligence/persons/p1?sourceCaseId=c1",
  );
});

test("Person page + Timeline wire origin banner, badges, and returnTo fallback", () => {
  const personPage = readFileSync(join(ROOT, "app/drug-intelligence/persons/[id]/page.tsx"), "utf8");
  assert.match(personPage, /person-investigation-origin|DrugPersonContextBanner/);
  assert.match(personPage, /caseOriginBadge/);
  assert.match(personPage, /partitionEntityCasesByOrigin/);
  assert.match(personPage, /sourceCaseId=\{currentCaseId\}/);
  assert.match(personPage, /di\.networkGroup\.unnamed/);
  assert.match(personPage, /selfHref \?\? returnTo/);

  const timeline = readFileSync(join(ROOT, "app/drug-intelligence/timeline/page.tsx"), "utf8");
  assert.match(timeline, /timeline-person-context/);
  assert.match(timeline, /di\.profile\.timelinePersonContext/);
  assert.match(timeline, /di\.profile\.backToPersonProfile/);
  assert.match(timeline, /readPersonCaseContextParam/);

  const banner = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_provenance.tsx"), "utf8");
  assert.match(banner, /di\.profile\.startedFromCase/);
  assert.match(banner, /di\.profile\.aggregateNoOriginNotice/);
  assert.match(banner, /DrugPersonInvestigationStory/);
  assert.match(banner, /di\.profile\.foundInThisCase/);
  assert.match(banner, /di\.profile\.additionalLinksFoundHeading|di\.profile\.systemDiscoveredLinks/);
  assert.match(banner, /di\.profile\.scanTransitionLine1/);
  assert.match(banner, /di\.profile\.noRepeatCompact/);
  assert.doesNotMatch(banner, /person-origin-entity-counts/);
});

test("Case → Person investigation entry ALWAYS writes sourceCaseId (real link generation)", () => {
  const personId = "04d2ac30-976a-460d-b77d-31e74153e59f";
  const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const caseReturn = `/drug-intelligence/cases/${caseId}`;

  const href = casePersonInvestigationHref(personId, caseId, caseReturn);
  assert.match(href, new RegExp(`/drug-intelligence/persons/${personId}`));
  assert.match(href, /sourceCaseId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.match(href, /caseId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  const qs = new URLSearchParams(href.split("?")[1]);
  assert.equal(qs.get("sourceCaseId"), caseId);
  assert.equal(qs.get("caseId"), caseId);
  assert.equal(getSafeReturnTo(qs), caseReturn);

  // No invented origin when caseId absent
  assert.equal(casePersonInvestigationHref(personId, null, caseReturn).includes("sourceCaseId="), false);
  assert.equal(casePersonInvestigationHref(personId, undefined).includes("caseId="), false);

  // Case page + drawer actually use the helper
  const casePage = readFileSync(join(ROOT, "app/drug-intelligence/cases/[id]/page.tsx"), "utf8");
  const drawer = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_drawer.tsx"), "utf8");
  assert.match(casePage, /casePersonInvestigationHref\(p\.personId,\s*caseId,\s*returnTo\)/);
  assert.match(casePage, /data-testid="case-person-profile-link"/);
  assert.match(drawer, /casePersonInvestigationHref\(personId,\s*caseId,\s*returnTo\)/);
  assert.match(drawer, /data-testid="open-person-profile"/);
});

test("withPersonSourceCase appends both aliases", () => {
  const path = withPersonSourceCase("/drug-intelligence/phones/p1", "11111111-1111-4111-8111-111111111111");
  assert.match(path, /sourceCaseId=11111111-1111-4111-8111-111111111111/);
  assert.match(path, /caseId=11111111-1111-4111-8111-111111111111/);
  assert.ok(path.indexOf("sourceCaseId=") < path.indexOf("caseId="));
});
