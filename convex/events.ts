import { captureRevision } from "./reportData";
import { requireWorkspace } from "./access";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { DEMO, acceptRevision, time } from "../shared/plan.mjs";
const base = { workspace: v.string(), id: v.id("events") };
async function own(
  ctx: QueryCtx | MutationCtx,
  args: { id: Id<"events">; workspace: string },
) {
  const e = await ctx.db.get(args.id);
  if (!e || e.workspace !== args.workspace)
    throw new ConvexError("Event unavailable.");
  return e;
}
function key(workspace: string) {
  if (workspace.length < 16 || workspace.length > 100)
    throw new ConvexError("Invalid workspace.");
}
export const list = query({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    await requireWorkspace(ctx, workspace, false);
    key(workspace);
    return await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .take(50);
  },
});
export const details = query({
  args: base,
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspace, false);
    const event = await own(ctx, args);
    return {
      event,
      activity: await ctx.db
        .query("activity")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.id))
        .order("desc")
        .take(30),
      sources: await ctx.db
        .query("sources")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.id))
        .take(30),
    };
  },
});
export const initialize = mutation({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    await requireWorkspace(ctx, workspace, true);
    key(workspace);
    const existing = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .first();
    if (existing) return existing._id;
    const id = await ctx.db.insert("events", { ...DEMO, workspace });
    await ctx.db.insert("activity", {
      eventId: id,
      text: "Juniper revision 3 is ready for review.",
      kind: "reply",
    });
    await ctx.db.insert("activity", {
      eventId: id,
      text: "Meadow Florals choice approved independently.",
      kind: "approval",
    });
    return id;
  },
});
export const create = mutation({
  args: {
    workspace: v.string(),
    name: v.string(),
    date: v.string(),
    venue: v.string(),
    guests: v.number(),
    zone: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    key(a.workspace);
    if (
      !a.name.trim() ||
      a.name.length > 100 ||
      a.venue.length > 150 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(a.date) ||
      !Number.isInteger(a.guests) ||
      a.guests < 1 ||
      a.guests > 100000
    )
      throw new ConvexError("Check the event details.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: a.zone || "Africa/Lagos" });
    } catch {
      throw new ConvexError("Choose a valid time zone.");
    }
    const existing = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspace", a.workspace))
      .take(50);
    if (existing.length >= 50)
      throw new ConvexError("This prototype supports 50 events.");
    return await ctx.db.insert("events", {
      ...DEMO,
      ...a,
      zone: a.zone || "Africa/Lagos",
      name: a.name.trim(),
      isDemo: false,
      version: 1,
      delivery: null,
      pickup: null,
      setup: null,
      loading: null,
      arrival: null,
      accessStart: null,
      accessEnd: null,
      fee: null,
      floristApproved: false,
      replyStatus: "none",
    });
  },
});
export const accept = mutation({
  args: { ...base, expectedVersion: v.number() },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const e = await own(ctx, a);
    try {
      if (!e.isDemo)
        throw new Error(
          "Prepared revisions are only available in fictional sample events.",
        );
      const next = acceptRevision(e, a.expectedVersion);
      await ctx.db.patch(a.id, {
        delivery: next.delivery,
        pickup: next.pickup,
        version: next.version,
        replyStatus: next.replyStatus,
      });
      await ctx.db.insert("activity", {
        eventId: a.id,
        text: "Revision 3 accepted. Two timing conflicts resolved; delivery charge remains open. Florist approval unchanged.",
        kind: "accepted",
        changes:
          "Delivery complete: 11:30 → 10:00\nPickup starts: 23:30 → 22:15\nDelivery charge: Not stated → Not stated\nMeadow Florals choice: Approved → Approved",
      });
    } catch (err) {
      throw new ConvexError((err as Error).message);
    }
    return null;
  },
});
export const flag = mutation({
  args: { ...base, flagged: v.boolean() },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const e = await own(ctx, a);
    if (!e.isDemo)
      throw new ConvexError(
        "Prepared revisions are only available in fictional sample events.",
      );
    if (!["pending", "flagged"].includes(e.replyStatus))
      throw new ConvexError("This reply is no longer pending.");
    await ctx.db.patch(a.id, {
      replyStatus: a.flagged ? "flagged" : "pending",
    });
    await ctx.db.insert("activity", {
      eventId: a.id,
      text: a.flagged
        ? "Revision 3 flagged for review. Current plan unchanged."
        : "Review flag cleared for revision 3.",
      kind: "review",
    });
    return null;
  },
});
export const saveDraft = mutation({
  args: { ...base, text: v.string() },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await own(ctx, a);
    if (a.text.length > 10000) throw new ConvexError("Draft is too long.");
    await ctx.db.patch(a.id, { draft: a.text });
    return null;
  },
});
const n = v.union(v.number(), v.null());
export const editFacts = mutation({
  args: {
    ...base,
    expectedVersion: v.number(),
    facts: v.object({
      delivery: n,
      pickup: n,
      setup: n,
      loading: n,
      arrival: n,
      accessStart: n,
      accessEnd: n,
      fee: n,
    }),
    reason: v.string(),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const e = await own(ctx, a);
    if (e.version !== a.expectedVersion)
      throw new ConvexError("The plan changed. Reopen the editor.");
    if (!a.reason.trim() || a.reason.length > 1000)
      throw new ConvexError("Add a short source or reason for the correction.");
    for (const [k, value] of Object.entries(a.facts)) {
      const max =
        k === "fee" ? 1000000 : ["setup", "loading"].includes(k) ? 1440 : 1439;
      if (
        value !== null &&
        (!Number.isFinite(value) ||
          value < 0 ||
          value > max ||
          (k !== "fee" && !Number.isInteger(value)))
      )
        throw new ConvexError("Check the time and amount values.");
    }
    await captureRevision(ctx, e, "Before correction");
    const origins = { ...e.origins };
    for (const [field, value] of Object.entries(a.facts))
      if (e[field as keyof typeof e] !== value) delete origins[field];
    await ctx.db.patch(a.id, {
      origins,
      ...a.facts,
      version: e.version + 1,
      replyStatus: ["pending", "flagged", "accepted"].includes(e.replyStatus)
        ? "stale"
        : e.replyStatus,
    });
    await captureRevision(
      ctx,
      (await ctx.db.get(a.id))!,
      "Reviewed correction",
    );
    await ctx.db.insert("activity", {
      eventId: a.id,
      text: `Facts corrected: ${a.reason.trim()}`,
      kind: "correction",
      changes: Object.entries(a.facts)
        .filter(([k, value]) => e[k as keyof typeof e] !== value)
        .map(([k, value]) => {
          const labels: Record<string, string> = {
            delivery: "Delivery complete",
            pickup: "Pickup starts",
            setup: "Setup duration",
            loading: "Loading duration",
            arrival: "Guest arrival",
            accessStart: "Access opens",
            accessEnd: "Equipment removed by",
            fee: "Delivery charge",
          };
          const fmt = (n: unknown) =>
            n === null
              ? "Not stated"
              : k === "fee"
                ? `$${n}`
                : ["setup", "loading"].includes(k)
                  ? `${n} min`
                  : time(n);
          return `${labels[k]}: ${fmt(e[k as keyof typeof e])} → ${fmt(value)}`;
        })
        .join("\n"),
    });
    return null;
  },
});
export const addSource = mutation({
  args: { ...base, name: v.string(), text: v.string() },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await own(ctx, a);
    if (
      !a.name.trim() ||
      a.name.length > 150 ||
      !a.text.trim() ||
      a.text.length > 20000
    )
      throw new ConvexError(
        "Add a title and up to 20,000 characters of source text.",
      );
    const count = await ctx.db
      .query("sources")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
      .take(30);
    if (count.length >= 30) throw new ConvexError("Source limit reached.");
    await ctx.db.insert("sources", {
      eventId: a.id,
      name: a.name.trim(),
      text: a.text,
    });
    await ctx.db.insert("activity", {
      eventId: a.id,
      text: `Source added: ${a.name}. Facts need manual review.`,
      kind: "source",
    });
    return null;
  },
});

export const freshDemo = mutation({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    await requireWorkspace(ctx, workspace, true);
    key(workspace);
    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .take(50);
    if (events.length >= 50)
      throw new ConvexError("This prototype supports 50 events.");
    const id = await ctx.db.insert("events", { ...DEMO, workspace });
    await ctx.db.insert("activity", {
      eventId: id,
      text: "Fresh demo created. Revision 3 is ready for review.",
      kind: "reply",
    });
    return id;
  },
});
