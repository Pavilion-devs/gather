import {
  reserveImport,
  requireWorkspace,
  requireMailOwner,
  canUseMail,
} from "./access";
import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  env,
} from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  INBOX,
  RETRY_WINDOW,
  validateDraft,
  emailAddress,
  matchReply,
} from "../shared/mail.mjs";
const base = { workspace: v.string(), id: v.id("events") };
async function eventFor(
  ctx: QueryCtx | MutationCtx,
  a: { workspace: string; id: Id<"events"> },
) {
  const e = await ctx.db.get(a.id);
  if (!e || e.workspace !== a.workspace)
    throw new ConvexError("Event unavailable.");
  return e;
}
async function mailboxFor(ctx: QueryCtx | MutationCtx, workspace: string) {
  const box = await ctx.db
    .query("mailboxes")
    .withIndex("by_inboxId", (q) => q.eq("inboxId", INBOX))
    .unique();
  if (!box || box.workspace !== workspace)
    throw new ConvexError("Connect the inbox to this workspace first.");
  return box;
}
async function draftFor(
  ctx: QueryCtx | MutationCtx,
  a: { workspace: string; draftId: Id<"mailDrafts"> },
) {
  const d = await ctx.db.get(a.draftId);
  if (!d || d.workspace !== a.workspace)
    throw new ConvexError("Draft unavailable.");
  await eventFor(ctx, { workspace: a.workspace, id: d.eventId });
  return d;
}
export const list = query({
  args: base,
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, false);
    await eventFor(ctx, a);
    const box = await ctx.db
      .query("mailboxes")
      .withIndex("by_workspace", (q) => q.eq("workspace", a.workspace))
      .first();
    const drafts = await ctx.db
      .query("mailDrafts")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
      .order("desc")
      .take(30);
    const messages = box
      ? await ctx.db
          .query("mailMessages")
          .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
          .order("desc")
          .take(30)
      : [];
    const recent = box
      ? await ctx.db
          .query("mailMessages")
          .withIndex("by_workspace", (q) => q.eq("workspace", a.workspace))
          .order("desc")
          .take(50)
      : [];
    return {
      canSend: await canUseMail(ctx, a.workspace),
      inbox: box?.inboxId || null,
      configured: Boolean(env.AGENTMAIL_API_KEY),
      connected: !!box,
      lastSync: box?.lastSync,
      syncing: !!box?.syncingAt && Date.now() - box.syncingAt < 90000,
      error: box?.error,
      hasOlder: !!box?.cursor,
      drafts,
      messages: messages
        .sort((x, y) => y.timestamp - x.timestamp)
        .map(({ text, extractedText, ...summary }) => summary),
      unassigned: recent
        .filter((m) => !m.eventId && m.labels.includes("received"))
        .sort((x, y) => y.timestamp - x.timestamp)
        .map(({ text, extractedText, ...summary }) => summary),
    };
  },
});
export const message = query({
  args: { ...base, messageId: v.id("mailMessages") },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, false);
    await eventFor(ctx, a);
    await mailboxFor(ctx, a.workspace);
    const m = await ctx.db.get(a.messageId);
    return m &&
      m.workspace === a.workspace &&
      (!m.eventId || m.eventId === a.id)
      ? m
      : null;
  },
});
export const connect = mutation({
  args: base,
  handler: async (ctx, a) => {
    await requireMailOwner(ctx, a.workspace);
    await requireWorkspace(ctx, a.workspace, true);
    await eventFor(ctx, a);
    if (!env.AGENTMAIL_API_KEY)
      throw new ConvexError("AgentMail is not configured.");
    const existing = await ctx.db
      .query("mailboxes")
      .withIndex("by_inboxId", (q) => q.eq("inboxId", INBOX))
      .unique();
    if (existing && existing.workspace !== a.workspace)
      throw new ConvexError(
        "This inbox is already connected to another workspace.",
      );
    if (!existing)
      await ctx.db.insert("mailboxes", {
        workspace: a.workspace,
        inboxId: INBOX,
      });
    return null;
  },
});
export const save = mutation({
  args: {
    ...base,
    draftId: v.optional(v.id("mailDrafts")),
    expectedRevision: v.optional(v.number()),
    planVersion: v.number(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    requestId: v.string(),
    replyMessageId: v.optional(v.id("mailMessages")),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const e = await eventFor(ctx, a);
    if (e.version !== a.planVersion)
      throw new ConvexError(
        "The plan changed. Review the current plan before saving this question.",
      );
    let clean;
    try {
      clean = validateDraft(a);
    } catch (err) {
      throw new ConvexError((err as Error).message);
    }
    if (!/^[A-Za-z0-9._~-]{10,100}$/.test(a.requestId))
      throw new ConvexError("Invalid draft request.");
    let replyTo: string | undefined;
    if (a.replyMessageId) {
      const message = await ctx.db.get(a.replyMessageId);
      if (
        !message ||
        message.workspace !== a.workspace ||
        message.eventId !== a.id ||
        !message.labels.includes("received") ||
        emailAddress(message.from) !== clean.to
      )
        throw new ConvexError(
          "The reply recipient must match the original sender.",
        );
      if (clean.subject !== "Re: " + message.subject.replace(/^Re:\s*/i, ""))
        throw new ConvexError(
          "Keep the original subject when replying in this conversation.",
        );
      replyTo = message.messageId;
    }
    if (a.draftId) {
      const d = await draftFor(ctx, {
        workspace: a.workspace,
        draftId: a.draftId,
      });
      if (
        d.eventId !== a.id ||
        d.state !== "draft" ||
        d.revision !== a.expectedRevision
      )
        throw new ConvexError(
          "This draft changed or is already approved. Reload it before editing.",
        );
      if (d.replyTo && (clean.to !== d.to || clean.subject !== d.subject))
        throw new ConvexError(
          "Keep the recipient and subject unchanged for a reply. Start a new question for a different conversation.",
        );
      await ctx.db.patch(d._id, {
        ...clean,
        planVersion: e.version,
        revision: d.revision + 1,
        replyTo: replyTo || (clean.to === d.to ? d.replyTo : undefined),
      });
      return d._id;
    }
    const all = await ctx.db
      .query("mailDrafts")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
      .take(30);
    const prior = all.find((d) => d.requestId === a.requestId);
    if (prior) return prior._id;
    if (all.length >= 30)
      throw new ConvexError("This event has reached its 30-message limit.");
    return await ctx.db.insert("mailDrafts", {
      ...clean,
      workspace: a.workspace,
      eventId: a.id,
      revision: 1,
      planVersion: e.version,
      state: "draft",
      requestId: a.requestId,
      ...(replyTo ? { replyTo } : {}),
    });
  },
});
export const approve = mutation({
  args: {
    workspace: v.string(),
    draftId: v.id("mailDrafts"),
    expectedRevision: v.number(),
    expectedVersion: v.number(),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await requireMailOwner(ctx, a.workspace);
    await mailboxFor(ctx, a.workspace);
    const d = await draftFor(ctx, a);
    const e = await eventFor(ctx, { workspace: a.workspace, id: d.eventId });
    if (
      d.revision !== a.expectedRevision ||
      e.version !== a.expectedVersion ||
      d.planVersion !== e.version
    )
      throw new ConvexError(
        "The draft or plan changed. Review the latest version before sending.",
      );
    if (d.state !== "draft") return null;
    await ctx.db.patch(d._id, {
      state: "queued",
      approvedAt: Date.now(),
      error: undefined,
    });
    await ctx.db.insert("activity", {
      eventId: e._id,
      text: `Approved email to ${d.to}: ${d.subject}. Queued for sending.`,
      kind: "mail",
    });
    await ctx.scheduler.runAfter(0, internal.mailActions.send, {
      draftId: d._id,
    });
    return null;
  },
});
export const retrySend = mutation({
  args: { workspace: v.string(), draftId: v.id("mailDrafts") },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await requireMailOwner(ctx, a.workspace);
    await mailboxFor(ctx, a.workspace);
    const d = await draftFor(ctx, a);
    const expired = Date.now() - (d.approvedAt || 0) >= RETRY_WINDOW;
    const stalled =
      d.state === "sending" && Date.now() - (d.lastAttempt || 0) > 90000;
    if ((!["uncertain", "failed"].includes(d.state) && !stalled) || expired)
      throw new ConvexError(
        expired
          ? "The safe retry window has ended. Check the sent inbox before composing another message."
          : "This message is not ready to retry.",
      );
    if (Date.now() - (d.lastAttempt || 0) < 10000)
      throw new ConvexError("Wait a few seconds before retrying.");
    await ctx.db.patch(d._id, { state: "queued", error: undefined });
    await ctx.scheduler.runAfter(0, internal.mailActions.send, {
      draftId: d._id,
    });
    return null;
  },
});
export const claimSend = internalMutation({
  args: { draftId: v.id("mailDrafts") },
  handler: async (ctx, { draftId }) => {
    const d = await ctx.db.get(draftId);
    if (!d || d.state !== "queued") return null;
    const box = await mailboxFor(ctx, d.workspace);
    await ctx.db.patch(d._id, { state: "sending", lastAttempt: Date.now() });
    return { draft: d, inbox: box.inboxId };
  },
});
export const finishSend = internalMutation({
  args: {
    draftId: v.id("mailDrafts"),
    messageId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, a) => {
    const d = await ctx.db.get(a.draftId);
    if (!d || !["sending", "uncertain"].includes(d.state)) return null;
    await ctx.db.patch(d._id, {
      state: "sent",
      messageId: a.messageId,
      threadId: a.threadId,
      error: undefined,
    });
    await ctx.db.insert("activity", {
      eventId: d.eventId,
      text: `AgentMail accepted the email to ${d.to}: ${d.subject}. Awaiting a reply.`,
      kind: "mail",
    });
    return null;
  },
});
export const failSend = internalMutation({
  args: {
    draftId: v.id("mailDrafts"),
    message: v.string(),
    uncertain: v.boolean(),
  },
  handler: async (ctx, a) => {
    const d = await ctx.db.get(a.draftId);
    if (d?.state === "sending")
      await ctx.db.patch(d._id, {
        state: a.uncertain ? "uncertain" : "failed",
        error: a.message.slice(0, 500),
      });
    return null;
  },
});
export const beginSync = internalMutation({
  args: { workspace: v.string(), older: v.boolean() },
  handler: async (ctx, a) => {
    await requireMailOwner(ctx, a.workspace);
    const box = await mailboxFor(ctx, a.workspace);
    if (box.syncingAt && Date.now() - box.syncingAt < 90000)
      throw new ConvexError("An inbox check is already running.");
    if (box.lastSync && Date.now() - box.lastSync < 5000)
      throw new ConvexError("Wait a few seconds before checking again.");
    await ctx.db.patch(box._id, { syncingAt: Date.now(), error: undefined });
    return { inbox: box.inboxId, cursor: a.older ? box.cursor : undefined };
  },
});
export const finishSync = internalMutation({
  args: {
    workspace: v.string(),
    cursor: v.optional(v.string()),
    error: v.optional(v.string()),
    older: v.boolean(),
  },
  handler: async (ctx, a) => {
    const box = await mailboxFor(ctx, a.workspace);
    await ctx.db.patch(box._id, {
      syncingAt: undefined,
      lastSync: Date.now(),
      error: a.error,
      ...(!a.error ? { cursor: a.cursor } : {}),
    });
    return null;
  },
});
export const known = internalQuery({
  args: { workspace: v.string(), messageId: v.string() },
  handler: async (ctx, a) => {
    await mailboxFor(ctx, a.workspace);
    return !!(await ctx.db
      .query("mailMessages")
      .withIndex("by_inbox_message", (q) =>
        q.eq("inboxId", INBOX).eq("messageId", a.messageId),
      )
      .unique());
  },
});
export const ingest = internalMutation({
  args: {
    workspace: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
    extractedText: v.string(),
    timestamp: v.number(),
    labels: v.array(v.string()),
    attachments: v.number(),
    truncated: v.boolean(),
  },
  handler: async (ctx, a) => {
    await mailboxFor(ctx, a.workspace);
    const exists = await ctx.db
      .query("mailMessages")
      .withIndex("by_inbox_message", (q) =>
        q.eq("inboxId", INBOX).eq("messageId", a.messageId),
      )
      .unique();
    if (exists) return exists._id;
    const drafts = await ctx.db
      .query("mailDrafts")
      .withIndex("by_threadId", (q) => q.eq("threadId", a.threadId))
      .take(100);
    const eventId = matchReply(
      { labels: a.labels, from: a.from, thread_id: a.threadId },
      drafts.filter((d) => d.workspace === a.workspace),
    );
    const id = await ctx.db.insert("mailMessages", {
      ...a,
      inboxId: INBOX,
      ...(eventId ? { eventId, assignment: "thread" } : {}),
    });
    if (eventId)
      await ctx.db.insert("activity", {
        eventId,
        text: `Reply received from ${a.from}. Review its evidence before changing the plan.`,
        kind: "reply",
      });
    return id;
  },
});
export const assign = mutation({
  args: { ...base, messageId: v.id("mailMessages") },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await eventFor(ctx, a);
    await mailboxFor(ctx, a.workspace);
    const m = await ctx.db.get(a.messageId);
    if (!m || m.workspace !== a.workspace || !m.labels.includes("received"))
      throw new ConvexError("Incoming message unavailable.");
    if (m.eventId && m.eventId !== a.id)
      throw new ConvexError("This message already belongs to another event.");
    await ctx.db.patch(m._id, { eventId: a.id, assignment: "manual" });
    return null;
  },
});
export const importReply = mutation({
  args: { ...base, messageId: v.id("mailMessages") },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await eventFor(ctx, a);
    await mailboxFor(ctx, a.workspace);
    const m = await ctx.db.get(a.messageId);
    if (
      !m ||
      m.workspace !== a.workspace ||
      m.eventId !== a.id ||
      !m.labels.includes("received")
    )
      throw new ConvexError("Attach this incoming reply to the event first.");
    if (m.sourceId) return m.sourceId;
    const text = m.extractedText || m.text;
    if (!text.trim() || text.length > 60000 || m.truncated)
      throw new ConvexError(
        "This message needs manual source capture. Paste the relevant new reply text in Sources.",
      );
    const all = await ctx.db
      .query("sources")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
      .take(30);
    if (all.length >= 30)
      throw new ConvexError("This event has reached its 30-source limit.");
    if (
      all.filter((s) =>
        ["queued", "reading", "extracting"].includes(s.status || ""),
      ).length >= 3
    )
      throw new ConvexError("Wait for the current imports to finish.");
    const sourceId = await ctx.db.insert("sources", {
      eventId: a.id,
      name: `Email: ${m.subject}`.slice(0, 150),
      text,
      kind: "email",
      mailMessageId: m._id,
      conversation: m.threadId + "|" + emailAddress(m.from),
      sentAt: m.timestamp,
      status: "queued",
      attempt: 1,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(m._id, { sourceId });
    await reserveImport(ctx, a.workspace);
    await ctx.scheduler.runAfter(0, internal.ingest.processSource, {
      sourceId,
      attempt: 1,
    });
    await ctx.db.insert("activity", {
      eventId: a.id,
      text: `Reply from ${m.from} added for fact review. Current plan unchanged.`,
      kind: "source",
    });
    return sourceId;
  },
});
