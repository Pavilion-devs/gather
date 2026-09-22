import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireWorkspace } from "./access";
import { buildReport, redact } from "./reportData";
const args = { workspace: v.string(), id: v.id("events") };
async function owner(ctx: any, workspace: string, id: any) {
  const member = await requireWorkspace(ctx, workspace, true);
  if (member && member.role !== "owner")
    throw new ConvexError("Only the workspace owner can share reports.");
  const e = await ctx.db.get(id);
  if (!e || e.workspace !== workspace)
    throw new ConvexError("Event unavailable.");
  return e;
}
export const preview = query({
  args,
  handler: async (ctx, a) => {
    const e = await owner(ctx, a.workspace, a.id);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_event", (q) => q.eq("eventId", a.id))
      .order("desc")
      .take(20);
    return {
      snapshot: await buildReport(ctx, e),
      links: reports.map((r) => ({
        id: r._id,
        token: r.token,
        revoked: r.revoked,
        createdAt: r.createdAt,
        version: r.snapshot.version,
      })),
    };
  },
});
export const publish = mutation({
  args: {
    ...args,
    expectedVersion: v.number(),
    disclosure: v.string(),
    confirmed: v.boolean(),
  },
  handler: async (ctx, a) => {
    const e = await owner(ctx, a.workspace, a.id);
    if (!a.confirmed)
      throw new ConvexError(
        "Review the preview and confirm what you want to share.",
      );
    if (e.version !== a.expectedVersion)
      throw new ConvexError(
        "The plan changed. Review the updated preview first.",
      );
    if (!a.disclosure.trim() || a.disclosure.length > 1000)
      throw new ConvexError(
        "Describe the context of this report in up to 1,000 characters.",
      );
    const count = await ctx.db
      .query("reports")
      .withIndex("by_event", (q) => q.eq("eventId", a.id))
      .take(20);
    if (count.length >= 20)
      throw new ConvexError("This event has reached its 20-report limit.");
    const token = crypto.randomUUID();
    await ctx.db.insert("reports", {
      eventId: a.id,
      workspace: a.workspace,
      token,
      revoked: false,
      featured: false,
      createdAt: Date.now(),
      snapshot: {
        ...(await buildReport(ctx, e)),
        disclosure: redact(a.disclosure.trim()),
      },
    });
    return token;
  },
});
export const revoke = mutation({
  args: { workspace: v.string(), reportId: v.id("reports") },
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.reportId);
    if (!r || r.workspace !== a.workspace)
      throw new ConvexError("Report unavailable.");
    await owner(ctx, a.workspace, r.eventId);
    await ctx.db.patch(r._id, { revoked: true, featured: false });
  },
});
export const read = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length > 100) return null;
    const r = await ctx.db
      .query("reports")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    return r && !r.revoked ? r.snapshot : null;
  },
});
export const example = query({
  args: {},
  handler: async (ctx) => {
    const r = await ctx.db
      .query("reports")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .first();
    return r && !r.revoked ? { token: r.token, snapshot: r.snapshot } : null;
  },
});
// Deployment operator may feature an already explicitly published report.
export const feature = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const r = await ctx.db
      .query("reports")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!r || r.revoked) throw new Error("Publish the reviewed example first.");
    for (const old of await ctx.db
      .query("reports")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .collect())
      await ctx.db.patch(old._id, { featured: false });
    await ctx.db.patch(r._id, { featured: true });
  },
});
