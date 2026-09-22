import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
// Legacy capabilities are accepted only on a loopback backend with an explicit opt-in.
export function localWorkspaceMode() {
  const url = process.env.CONVEX_SITE_URL || "";
  return (
    process.env.GATHER_LOCAL_WORKSPACES === "true" &&
    /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)
  );
}
export async function requireWorkspace(
  ctx: QueryCtx | MutationCtx,
  workspace: string,
  write = false,
) {
  if (localWorkspaceMode() && workspace.length >= 40 && workspace.length <= 100)
    return null;
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new ConvexError("Sign in to open your events.");
  const member = await ctx.db
    .query("memberships")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspace", workspace).eq("userId", user.subject),
    )
    .unique();
  if (!member || (write && member.role === "viewer"))
    throw new ConvexError("This workspace is unavailable to your account.");
  return member;
}
export async function canUseMail(
  ctx: QueryCtx | MutationCtx,
  workspace: string,
) {
  if (localWorkspaceMode() && workspace.length >= 40 && workspace.length <= 100)
    return true;
  const member = await requireWorkspace(ctx, workspace);
  const identity = await ctx.auth.getUserIdentity();
  return (
    member?.role === "owner" &&
    Boolean(process.env.GATHER_MAIL_OWNER_EMAIL) &&
    identity?.email?.toLowerCase() ===
      process.env.GATHER_MAIL_OWNER_EMAIL?.toLowerCase()
  );
}
export async function requireMailOwner(
  ctx: QueryCtx | MutationCtx,
  workspace: string,
) {
  await requireWorkspace(ctx, workspace, true);
  if (!(await canUseMail(ctx, workspace)))
    throw new ConvexError(
      "Supplier email is not connected for this workspace.",
    );
}

export async function reserveImport(ctx: MutationCtx, workspace: string) {
  if (localWorkspaceMode() && workspace.length >= 40) return;
  const day = new Date().toISOString().slice(0, 10);
  for (const [scope, limit] of [
    ["global", 50],
    [workspace, 10],
  ] as const) {
    const row = await ctx.db
      .query("importUsage")
      .withIndex("by_scope_day", (q) => q.eq("scope", scope).eq("day", day))
      .unique();
    if ((row?.count || 0) >= limit)
      throw new ConvexError(
        "Today’s preview import allowance is used. You can still review saved sources and add cited facts manually.",
      );
    if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
    else await ctx.db.insert("importUsage", { scope, day, count: 1 });
  }
}
