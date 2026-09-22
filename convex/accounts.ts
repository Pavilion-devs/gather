import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();
    return {
      name: user.name || "Your account",
      email: user.email || "",
      workspace: member?.workspace || null,
      role: member?.role || null,
    };
  },
});
export const initialize = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new ConvexError("Sign in to create your workspace.");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();
    if (existing) return existing.workspace;
    const workspace = await ctx.db.insert("workspaces", {
      name: "My events",
      owner: user.subject,
    });
    await ctx.db.insert("memberships", {
      workspace,
      userId: user.subject,
      role: "owner",
    });
    return workspace;
  },
});
