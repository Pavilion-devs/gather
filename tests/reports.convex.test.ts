import { convexTest } from "convex-test";
import { test, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  vi.stubEnv("CONVEX_SITE_URL", "https://gather-test.convex.site");
  const t = convexTest(schema, modules),
    alice = t.withIdentity({ subject: "alice", email: "alice@example.com" }),
    bob = t.withIdentity({ subject: "bob" });
  const workspace = await alice.mutation(api.accounts.initialize, {});
  const id = await alice.mutation(api.events.create, {
    workspace,
    name: "Private plan alice@example.com",
    date: "2026-11-21",
    venue: "Hall",
    guests: 85,
    zone: "Europe/London",
  });
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      eventId: id,
      name: "Proposal alice@example.com",
      text: "SECRET FULL BODY",
      kind: "email",
      contentHash: "hash",
      sentAt: 123,
    }),
  );
  await t.run(async (ctx) => {
    await ctx.db.patch(id, {
      delivery: 1035,
      pickup: 1360,
      setup: 75,
      loading: 35,
      arrival: 1080,
      accessStart: 540,
      accessEnd: 1380,
      origins: {
        delivery: {
          sourceId,
          quote: "Delivery complete 17:15. alice@example.com +234 803 123 4567",
          start: 0,
          end: 30,
        },
      },
    });
  });
  return { t, alice, bob, workspace, id };
}
test("reports require owner approval, reject stale plans, and expose only reviewed snapshots", async () => {
  const { t, alice, bob, workspace, id } = await fixture();
  const a = {
    workspace,
    id,
    expectedVersion: 1,
    disclosure: "Controlled fictional test",
    confirmed: true,
  };
  await expect(t.mutation(api.reports.publish, a)).rejects.toThrow("Sign in");
  await expect(bob.mutation(api.reports.publish, a)).rejects.toThrow(
    "unavailable",
  );
  await expect(
    alice.mutation(api.reports.publish, { ...a, confirmed: false }),
  ).rejects.toThrow("confirm");
  await expect(
    alice.mutation(api.reports.publish, { ...a, expectedVersion: 99 }),
  ).rejects.toThrow("changed");
  const token = await alice.mutation(api.reports.publish, a);
  const snapshot = await t.query(api.reports.read, { token });
  expect(snapshot.zone).toBe("Europe/London");
  expect(snapshot.steps[0].checks.timing).toBe(2);
  const text = JSON.stringify(snapshot);
  for (const secret of [
    "SECRET FULL BODY",
    "alice@example.com",
    "234 803",
    "workspace",
    "sourceId",
    "origins",
  ]) {
    expect(text).not.toContain(secret);
  }
  expect(text).toContain("[email hidden]");
  await t.run((ctx) => ctx.db.patch(id, { delivery: 990, version: 2 }));
  expect(
    (await t.query(api.reports.read, { token })).steps[0].facts.delivery,
  ).toBe(1035);
  const preview = await alice.query(api.reports.preview, { workspace, id });
  await t.mutation(internal.reports.feature, { token });
  expect((await t.query(api.reports.example, {}))?.token).toBe(token);
  await alice.mutation(api.reports.revoke, {
    workspace,
    reportId: preview.links[0].id,
  });
  expect(await t.query(api.reports.read, { token })).toBeNull();
  expect(await t.query(api.reports.example, {})).toBeNull();
});
test("captured corrections preserve before/after arithmetic without leaking reasons", async () => {
  const { t, alice, workspace, id } = await fixture();
  await alice.mutation(api.events.editFacts, {
    workspace,
    id,
    expectedVersion: 1,
    facts: {
      delivery: 990,
      pickup: 1330,
      setup: 75,
      loading: 35,
      arrival: 1080,
      accessStart: 540,
      accessEnd: 1380,
      fee: 0,
    },
    reason: "private telephone conversation",
  });
  const { snapshot } = await alice.query(api.reports.preview, {
    workspace,
    id,
  });
  expect(snapshot.steps.map((s: any) => s.checks.timing)).toEqual([2, 0]);
  expect(snapshot.steps[0].evidence[0].quote).toContain("17:15");
  expect(snapshot.steps[1].evidence).toHaveLength(0);
  expect(JSON.stringify(snapshot)).not.toContain("private telephone");
  expect(snapshot.historyComplete).toBe(true);
});
test("workspace editors can work on plans but cannot publish them", async () => {
  const { t, bob, workspace, id } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert("memberships", { workspace, userId: "bob", role: "editor" }),
  );
  await expect(
    bob.query(api.reports.preview, { workspace, id }),
  ).rejects.toThrow("Only the workspace owner");
});

test("manual assumptions keep their review caveat beside the public quote", async () => {
  const { t, alice, workspace, id } = await fixture();
  await t
    .run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        eventId: id,
        name: "Venue policy",
        kind: "url",
        url: "https://venue.example/rules?private=omit",
        text: "Setup starts at 8AM.",
        status: "review",
      });
      const candidateId = await ctx.db.insert("candidates", {
        sourceId,
        field: "accessStart",
        value: 480,
        quote: "Setup starts at 8AM.",
        start: 0,
        end: 19,
        note: "Scenario assumption, not booking confirmation. Contact (707) 555-1234",
        state: "pending",
        method: "manual",
      });
      return { sourceId, candidateId };
    })
    .then(async ({ sourceId, candidateId }) => {
      await alice.mutation(api.sources.apply, {
        workspace,
        sourceId,
        expectedVersion: 1,
        facts: [{ candidateId, value: 480, reason: "" }],
      });
    });
  const { snapshot } = await alice.query(api.reports.preview, {
    workspace,
    id,
  });
  const fact = snapshot.steps
    .at(-1)
    .evidence.find((e: any) => e.field === "accessStart");
  expect(fact.method).toBe("manual");
  expect(fact.reviewNote).toContain("not booking confirmation");
  expect(fact.reviewNote).toContain("[phone hidden]");
  expect(fact.url).toBe("https://venue.example/rules");
});
