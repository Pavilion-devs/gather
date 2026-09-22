import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const url = process.env.VITE_CONVEX_URL;
if (!url?.startsWith("http://127.0.0.1:"))
  throw new Error(
    "Integration checks run only against a local development backend.",
  );
const client = new ConvexHttpClient(url, { logger: false });
const workspace = randomUUID() + randomUUID();
const id = await client.mutation(api.events.initialize, { workspace });
const base = { workspace, id };
assert.equal(
  await client.mutation(api.events.initialize, { workspace }),
  id,
  "initialization is idempotent",
);
assert.equal((await client.query(api.events.list, { workspace })).length, 1);
await assert.rejects(
  client.query(api.events.details, {
    ...base,
    workspace: randomUUID() + randomUUID(),
  }),
);
await client.mutation(api.events.flag, { ...base, flagged: true });
await assert.rejects(
  client.mutation(api.events.accept, { ...base, expectedVersion: 2 }),
);
await client.mutation(api.events.flag, { ...base, flagged: false });
const concurrent = await Promise.allSettled([
  client.mutation(api.events.accept, { ...base, expectedVersion: 2 }),
  client.mutation(api.events.accept, { ...base, expectedVersion: 2 }),
]);
assert.equal(
  concurrent.filter((r) => r.status === "fulfilled").length,
  1,
  "only one concurrent acceptance succeeds",
);
let state = await client.query(api.events.details, base);
assert.equal(state.event.delivery, 600);
assert.equal(state.event.pickup, 1335);
assert.equal(state.event.fee, null);
assert.equal(state.event.floristApproved, true);
assert.equal(state.activity.filter((a) => a.kind === "accepted").length, 1);
await client.mutation(api.events.saveDraft, {
  ...base,
  text: "Please confirm the delivery charge.",
});
assert.equal(
  (await client.query(api.events.details, base)).event.draft,
  "Please confirm the delivery charge.",
);
const newId = await client.mutation(api.events.create, {
  workspace,
  name: "Integration example",
  date: "2026-12-01",
  venue: "Test venue",
  guests: 50,
});
const blank = await client.query(api.events.details, { workspace, id: newId });
assert.equal(blank.event.delivery, null);
assert.equal(blank.event.isDemo, false);
await client.mutation(api.events.addSource, {
  workspace,
  id: newId,
  name: "Access email",
  text: "Access opens at 08:00.",
});
await client.mutation(api.events.editFacts, {
  workspace,
  id: newId,
  expectedVersion: 1,
  facts: {
    delivery: 600,
    pickup: 1320,
    setup: 60,
    loading: 30,
    arrival: 720,
    accessStart: 480,
    accessEnd: 1380,
    fee: 0,
  },
  reason: "Reviewed source text.",
});
const corrected = await client.query(api.events.details, {
  workspace,
  id: newId,
});
assert.equal(corrected.event.version, 2);
assert.equal(corrected.event.fee, 0);
assert.equal(corrected.sources.length, 1);
await assert.rejects(
  client.mutation(api.events.editFacts, {
    workspace,
    id: newId,
    expectedVersion: 1,
    facts: {
      delivery: 500,
      pickup: null,
      setup: null,
      loading: null,
      arrival: null,
      accessStart: null,
      accessEnd: null,
      fee: null,
    },
    reason: "Stale edit.",
  }),
);
console.log(
  "PASS: initialization, workspace isolation, review flag, concurrent acceptance, preserved unknowns/approval, saved draft, blank event, source capture, reviewed correction and stale-edit rejection.",
);

// These source-review tests make no external AI calls.
await client.mutation(api.events.addSource, {
  ...base,
  name: "Reviewed supplier revision",
  text: "Delivery complete at 09:30. Pickup starts at 22:00. Loading takes 30 minutes.",
});
state = await client.query(api.events.details, base);
const sourceId = state.sources.find(
  (s) => s.name === "Reviewed supplier revision",
)._id;
const sourceBase = { workspace, sourceId };
await assert.rejects(
  client.query(api.sources.review, {
    ...sourceBase,
    workspace: randomUUID() + randomUUID(),
  }),
);
await assert.rejects(
  client.mutation(api.sources.addManualFact, {
    ...sourceBase,
    field: "delivery",
    value: 570,
    quote: "Delivery complete at 08:00.",
    note: "",
  }),
);
const candidateId = await client.mutation(api.sources.addManualFact, {
  ...sourceBase,
  field: "delivery",
  value: 570,
  quote: "Delivery complete at 09:30.",
  note: "Verified against supplier revision.",
});
assert.equal(
  (await client.query(api.events.details, base)).event.delivery,
  600,
  "proposing does not change the plan",
);
await client.mutation(api.sources.flag, { ...sourceBase, flagged: true });
await assert.rejects(
  client.mutation(api.sources.apply, {
    ...sourceBase,
    expectedVersion: state.event.version,
    facts: [{ candidateId, value: 570, reason: "" }],
  }),
);
await client.mutation(api.sources.flag, { ...sourceBase, flagged: false });
await assert.rejects(
  client.mutation(api.sources.apply, {
    ...sourceBase,
    expectedVersion: state.event.version,
    facts: [{ candidateId, value: 560, reason: "" }],
  }),
);
await client.mutation(api.sources.apply, {
  ...sourceBase,
  expectedVersion: state.event.version,
  facts: [{ candidateId, value: 570, reason: "" }],
});
let reviewed = await client.query(api.events.details, base);
assert.equal(reviewed.event.delivery, 570);
assert.equal(reviewed.event.pickup, 1335);
assert.equal(reviewed.event.fee, null);
assert.equal(reviewed.event.floristApproved, true);
assert.equal(reviewed.event.origins.delivery.sourceId, sourceId);
assert.equal(
  reviewed.event.origins.delivery.quote,
  "Delivery complete at 09:30.",
);
assert.equal(reviewed.event.replyStatus, "stale");
await assert.rejects(
  client.mutation(api.sources.apply, {
    ...sourceBase,
    expectedVersion: state.event.version,
    facts: [{ candidateId, value: 570, reason: "" }],
  }),
);
// An additional cited fact may be reviewed after a previous acceptance.
const pickupCandidate = await client.mutation(api.sources.addManualFact, {
  ...sourceBase,
  field: "pickup",
  value: 1320,
  quote: "Pickup starts at 22:00.",
  note: "",
});
assert.equal(
  (await client.query(api.sources.review, sourceBase)).source.status,
  "review",
);
await client.mutation(api.sources.apply, {
  ...sourceBase,
  expectedVersion: reviewed.event.version,
  facts: [{ candidateId: pickupCandidate, value: 1320, reason: "" }],
});
reviewed = await client.query(api.events.details, base);
assert.equal(reviewed.event.pickup, 1320);
assert.equal(reviewed.event.delivery, 570);
assert.ok(
  reviewed.activity.some((a) =>
    a.changes?.includes("Delivery complete at 09:30."),
  ),
);
console.log(
  "PASS: source ownership, exact citations, explicit acceptance, review flags, correction reasons, selective updates, unknown fees, unrelated approvals, provenance, stale reviews and subsequent acceptance.",
);
