import { convexTest } from "convex-test";
import { test, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  vi.stubEnv("CONVEX_SITE_URL", "https://gather-test.convex.site");
  vi.stubEnv("GATHER_LOCAL_WORKSPACES", "false");
  return convexTest(schema, modules);
}
test("sign-in is required; one durable workspace per identity, even with concurrent initialization", async () => {
  const t = fixture();
  await expect(t.mutation(api.accounts.initialize, {})).rejects.toThrow(
    "Sign in",
  );
  const alice = t.withIdentity({
    subject: "alice",
    email: "alice@example.com",
  });
  const [a, b] = await Promise.all([
    alice.mutation(api.accounts.initialize, {}),
    alice.mutation(api.accounts.initialize, {}),
  ]);
  expect(a).toBe(b);
  expect((await alice.query(api.accounts.current, {}))?.workspace).toBe(a);
  const event = await alice.mutation(api.events.create, {
    workspace: a,
    name: "Alice event",
    date: "2026-10-24",
    venue: "Test",
    guests: 10,
  });
  const bob = t.withIdentity({ subject: "bob", email: "bob@example.com" });
  await expect(bob.query(api.events.list, { workspace: a })).rejects.toThrow(
    "unavailable",
  );
  await expect(
    t.query(api.events.details, { workspace: a, id: event }),
  ).rejects.toThrow("Sign in");
  await expect(
    bob.mutation(api.events.saveDraft, {
      workspace: a,
      id: event,
      text: "Foreign edit",
    }),
  ).rejects.toThrow("unavailable");
  await expect(
    bob.query(api.sources.connection, { workspace: a }),
  ).rejects.toThrow("unavailable");
  await expect(
    bob.query(api.mail.list, { workspace: a, id: event }),
  ).rejects.toThrow("unavailable");
  await expect(
    bob.action(api.mailActions.sync, { workspace: a }),
  ).rejects.toThrow("unavailable");
});
test("viewers may read but cannot alter event facts, upload, or create messages", async () => {
  const t = fixture(),
    owner = t.withIdentity({ subject: "owner" }),
    viewer = t.withIdentity({ subject: "viewer" });
  const workspace = await owner.mutation(api.accounts.initialize, {});
  const id = await owner.mutation(api.events.create, {
    workspace,
    name: "Shared event",
    date: "2026-10-24",
    venue: "Test",
    guests: 10,
  });
  await t.run((ctx) =>
    ctx.db.insert("memberships", {
      workspace,
      userId: "viewer",
      role: "viewer",
    }),
  );
  expect(
    (await viewer.query(api.events.details, { workspace, id })).event.name,
  ).toBe("Shared event");
  await expect(
    viewer.mutation(api.events.saveDraft, { workspace, id, text: "change" }),
  ).rejects.toThrow("unavailable");
  await expect(
    viewer.mutation(api.sources.prepareUpload, { workspace, id }),
  ).rejects.toThrow("unavailable");
  await expect(
    viewer.mutation(api.mail.connect, { workspace, id }),
  ).rejects.toThrow("unavailable");
});
test("local capability opt-in is never accepted by a cloud backend", async () => {
  const t = fixture();
  vi.stubEnv("GATHER_LOCAL_WORKSPACES", "true");
  await expect(
    t.query(api.events.list, { workspace: "x".repeat(64) }),
  ).rejects.toThrow("Sign in");
});
test("account ownership does not grant access to the operator mail account", async () => {
  const t = fixture(),
    user = t.withIdentity({ subject: "user" });
  const workspace = await user.mutation(api.accounts.initialize, {});
  const id = await user.mutation(api.events.create, {
    workspace,
    name: "Test",
    date: "2026-10-24",
    venue: "Test",
    guests: 10,
  });
  await expect(
    user.mutation(api.mail.connect, { workspace, id }),
  ).rejects.toThrow("not connected");
});
test("import allowances are transactional and reset on a new UTC day", async () => {
  const { reserveImport } = await import("../convex/access");
  const t = fixture();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  try {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 11 }, () =>
        t.run((ctx) => reserveImport(ctx, "workspace-one")),
      ),
    );
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    const rows = await t.run((ctx) => ctx.db.query("importUsage").collect());
    expect(rows.find((r) => r.scope === "global")?.count).toBe(10);
    await t.run((ctx) => reserveImport(ctx, "workspace-two"));
    vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
    await t.run((ctx) => reserveImport(ctx, "workspace-one"));
  } finally {
    vi.useRealTimers();
  }
});

test("the configured owner can connect the supplier inbox to their account workspace", async () => {
  const t = fixture();
  vi.stubEnv("AGENTMAIL_API_KEY", "test-key");
  vi.stubEnv("GATHER_MAIL_OWNER_EMAIL", "owner@example.com");
  const owner = t.withIdentity({
    subject: "mail-owner",
    email: "owner@example.com",
  });
  const workspace = await owner.mutation(api.accounts.initialize, {});
  const id = await owner.mutation(api.events.create, {
    workspace,
    name: "Owner event",
    date: "2026-10-24",
    venue: "Test",
    guests: 10,
  });
  await owner.mutation(api.mail.connect, { workspace, id });
  const inbox = await owner.query(api.mail.list, { workspace, id });
  expect(inbox.connected).toBe(true);
  expect(inbox.inbox).toBe("favour-7766@agentmail.to");
});

test("fresh events contain no sample facts, approvals or prepared revisions", async () => {
  const t = fixture(),
    user = t.withIdentity({
      subject: "new-organizer",
      email: "new@example.com",
    });
  const workspace = await user.mutation(api.accounts.initialize, {});
  const id = await user.mutation(api.events.create, {
    workspace,
    name: "New conference",
    date: "2026-11-18",
    venue: "New hall",
    guests: 85,
  });
  const { event, activity, sources } = await user.query(api.events.details, {
    workspace,
    id,
  });
  for (const field of [
    "delivery",
    "pickup",
    "setup",
    "loading",
    "arrival",
    "accessStart",
    "accessEnd",
    "fee",
  ])
    expect(event[field]).toBeNull();
  expect(event.isDemo).toBe(false);
  expect(event.floristApproved).toBe(false);
  expect(event.replyStatus).toBe("none");
  expect(activity).toHaveLength(0);
  expect(sources).toHaveLength(0);
  await expect(
    user.mutation(api.events.accept, { workspace, id, expectedVersion: 1 }),
  ).rejects.toThrow("fictional sample");
  const mail = await user.query(api.mail.list, { workspace, id });
  expect(mail.canSend).toBe(false);
  expect(mail.inbox).toBeNull();
});
