import { captureRevision } from "./reportData";
import { reserveImport, requireWorkspace } from "./access";
import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  env,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  FIELD_INFO,
  locateQuote,
  validateValue,
  clockValueIsCited,
} from "../shared/extraction.mjs";
import { time, evaluatePlan } from "../shared/plan.mjs";
const eventArgs = { workspace: v.string(), id: v.id("events") };
const sourceArgs = { workspace: v.string(), sourceId: v.id("sources") };
async function eventFor(
  ctx: QueryCtx | MutationCtx,
  workspace: string,
  id: Id<"events">,
) {
  const e = await ctx.db.get(id);
  if (!e || e.workspace !== workspace)
    throw new ConvexError("Event unavailable.");
  return e;
}
async function sourceFor(
  ctx: QueryCtx | MutationCtx,
  workspace: string,
  id: Id<"sources">,
) {
  const s = await ctx.db.get(id);
  if (!s) throw new ConvexError("Source unavailable.");
  const e = await eventFor(ctx, workspace, s.eventId);
  return { s, e };
}
function display(field: string, value: unknown) {
  return value === null
    ? "Not stated"
    : field === "fee"
      ? `$${value}`
      : ["setup", "loading"].includes(field)
        ? `${value} min`
        : time(value);
}
async function room(ctx: MutationCtx, eventId: Id<"events">) {
  const all = await ctx.db
    .query("sources")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(30);
  if (all.length >= 30)
    throw new ConvexError("This event has reached its 30-source limit.");
  if (
    all.filter((s) =>
      ["queued", "reading", "extracting"].includes(s.status || ""),
    ).length >= 3
  )
    throw new ConvexError(
      "Three imports are already running. Let one finish, then add the next source.",
    );
  return all;
}
export const connection = query({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    await requireWorkspace(ctx, workspace, false);
    const existing = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .first();
    if (!existing) return null;
    return {
      firecrawl: Boolean(env.FIRECRAWL_API_KEY),
      openai: Boolean(env.OPENAI_API_KEY),
    };
  },
});
export const add = mutation({
  args: {
    ...eventArgs,
    name: v.string(),
    kind: v.union(v.literal("text"), v.literal("url")),
    text: v.optional(v.string()),
    url: v.optional(v.string()),
    requestId: v.string(),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await eventFor(ctx, a.workspace, a.id);
    if (
      !a.name.trim() ||
      a.name.length > 150 ||
      a.requestId.length < 10 ||
      a.requestId.length > 100
    )
      throw new ConvexError("Add a short source title.");
    const all = await ctx.db
      .query("sources")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
      .take(30);
    const prior = all.find(
      (s) =>
        s.requestId === a.requestId ||
        (a.kind === "text" && s.text === a.text?.trim()),
    );
    if (prior) return prior._id;
    await room(ctx, a.id);
    if (a.kind === "text" && (!a.text?.trim() || a.text.length > 60000))
      throw new ConvexError("Paste 1–60,000 characters of source text.");
    if (a.kind === "url") {
      let u;
      try {
        u = new URL(a.url || "");
      } catch {
        throw new ConvexError("Enter a public HTTPS page URL.");
      }
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        a.url!.length > 2000
      )
        throw new ConvexError(
          "Use a public HTTPS page without embedded credentials.",
        );
    }
    const id = await ctx.db.insert("sources", {
      eventId: a.id,
      name: a.name.trim(),
      text: a.kind === "text" ? a.text!.trim() : "",
      kind: a.kind,
      ...(a.kind === "url" ? { url: a.url } : {}),
      requestId: a.requestId,
      status: "queued",
      attempt: 1,
      updatedAt: Date.now(),
    });
    await reserveImport(ctx, a.workspace);
    await ctx.scheduler.runAfter(0, internal.ingest.processSource, {
      sourceId: id,
      attempt: 1,
    });
    await ctx.db.insert("activity", {
      eventId: a.id,
      text: `Source added: ${a.name}. Waiting for fact review.`,
      kind: "source",
    });
    return id;
  },
});
export const prepareUpload = mutation({
  args: eventArgs,
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await eventFor(ctx, a.workspace, a.id);
    await room(ctx, a.id);
    return await ctx.storage.generateUploadUrl();
  },
});
export const addFile = mutation({
  args: {
    ...eventArgs,
    name: v.string(),
    storageId: v.id("_storage"),
    requestId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    await eventFor(ctx, a.workspace, a.id);
    const all = await ctx.db
      .query("sources")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.id))
      .take(30);
    const previous = all.find(
      (s) => s.requestId === a.requestId || s.storageId === a.storageId,
    );
    if (previous) return previous._id;
    await room(ctx, a.id);
    const file = await ctx.db.system.get(a.storageId);
    if (!a.text.trim() || a.text.length > 60000)
      throw new ConvexError(
        "This file has no readable text, or exceeds the 60,000-character limit. Upload a shorter text-based document.",
      );
    if (
      !file ||
      file.size > 5 * 1024 * 1024 ||
      !["application/pdf", "text/plain", "text/markdown"].includes(
        file.contentType || "",
      ) ||
      !a.name.trim() ||
      a.name.length > 150
    )
      throw new ConvexError("Choose a PDF, TXT or Markdown file under 5 MB.");
    if (a.requestId.length < 10 || a.requestId.length > 100)
      throw new ConvexError("Invalid upload request.");
    const sourceId = await ctx.db.insert("sources", {
      eventId: a.id,
      name: a.name.trim(),
      text: a.text,
      kind: "file",
      storageId: a.storageId,
      fileType: file.contentType,
      requestId: a.requestId,
      status: "queued",
      attempt: 1,
      updatedAt: Date.now(),
    });
    await reserveImport(ctx, a.workspace);
    await ctx.scheduler.runAfter(0, internal.ingest.processSource, {
      sourceId,
      attempt: 1,
    });
    await ctx.db.insert("activity", {
      eventId: a.id,
      text: `Document added: ${a.name}. Waiting for fact review.`,
      kind: "source",
    });
    return sourceId;
  },
});
export const retry = mutation({
  args: sourceArgs,
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const { s } = await sourceFor(ctx, a.workspace, a.sourceId);
    if (
      ["queued", "reading", "extracting"].includes(s.status || "") &&
      Date.now() - (s.updatedAt || 0) < 180000
    )
      throw new ConvexError("This import is still running.");
    if (["accepted", "flagged"].includes(s.status || ""))
      throw new ConvexError(
        "Keep this review intact. Add a new source for a new revision.",
      );
    if (Date.now() - (s.updatedAt || 0) < 5000)
      throw new ConvexError("Wait a few seconds before retrying.");
    const current = await ctx.db
      .query("candidates")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", s._id))
      .take(32);
    if (current.some((f) => f.state === "accepted"))
      throw new ConvexError(
        "A fact from this source was already accepted. Add a new revision instead.",
      );
    for (const f of current)
      if (f.method === "extraction") await ctx.db.delete(f._id);
    const attempt = (s.attempt || 0) + 1;
    await ctx.db.patch(s._id, {
      attempt,
      status: "queued",
      error: undefined,
      errorCode: undefined,
      updatedAt: Date.now(),
    });
    await reserveImport(ctx, a.workspace);
    await ctx.scheduler.runAfter(0, internal.ingest.processSource, {
      sourceId: s._id,
      attempt,
    });
    return null;
  },
});
export const review = query({
  args: sourceArgs,
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, false);
    const { s } = await sourceFor(ctx, a.workspace, a.sourceId);
    return {
      source: s,
      candidates: await ctx.db
        .query("candidates")
        .withIndex("by_sourceId", (q) => q.eq("sourceId", s._id))
        .take(32),
      downloadUrl: s.storageId ? await ctx.storage.getUrl(s.storageId) : null,
    };
  },
});
export const addManualFact = mutation({
  args: {
    ...sourceArgs,
    field: v.string(),
    value: v.number(),
    quote: v.string(),
    note: v.string(),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const { s } = await sourceFor(ctx, a.workspace, a.sourceId);
    if (["queued", "reading", "extracting"].includes(s.status || ""))
      throw new ConvexError("Wait for this import to finish.");
    if (!validateValue(a.field, a.value))
      throw new ConvexError("Enter a valid value for this fact.");
    const cite = locateQuote(s.text, a.quote);
    if (!cite)
      throw new ConvexError("The quotation must match text in this source.");
    if (a.note.length > 500)
      throw new ConvexError("Keep the review note under 500 characters.");
    const all = await ctx.db
      .query("candidates")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", s._id))
      .take(32);
    if (all.length >= 24)
      throw new ConvexError("This source already has 24 proposed facts.");
    const old = all.find((f) => f.field === a.field && f.state === "pending");
    if (old) await ctx.db.patch(old._id, { state: "rejected" });
    if (s.status !== "flagged") await ctx.db.patch(s._id, { status: "review" });
    return await ctx.db.insert("candidates", {
      sourceId: s._id,
      field: a.field,
      value: a.value,
      ...cite,
      note: a.note,
      state: "pending",
      method: "manual",
    });
  },
});
export const flag = mutation({
  args: { ...sourceArgs, flagged: v.boolean() },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const { s } = await sourceFor(ctx, a.workspace, a.sourceId);
    if (!["review", "flagged", "error"].includes(s.status || ""))
      throw new ConvexError("This source is not awaiting review.");
    await ctx.db.patch(s._id, {
      status: a.flagged ? "flagged" : s.error ? "error" : "review",
    });
    return null;
  },
});
export const apply = mutation({
  args: {
    ...sourceArgs,
    expectedVersion: v.number(),
    facts: v.array(
      v.object({
        candidateId: v.id("candidates"),
        value: v.number(),
        reason: v.string(),
      }),
    ),
  },
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspace, true);
    const { s, e } = await sourceFor(ctx, a.workspace, a.sourceId);
    if (e.version !== a.expectedVersion)
      throw new ConvexError(
        "The plan changed during your review. Reopen the review against the latest plan.",
      );
    if (!["review", "error", undefined].includes(s.status))
      throw new ConvexError("This source is not ready for acceptance.");
    if (!a.facts.length || a.facts.length > 8)
      throw new ConvexError("Choose between one and eight facts to accept.");
    if (s.conversation && s.sentAt !== undefined) {
      const siblings = await ctx.db
        .query("sources")
        .withIndex("by_eventId", (q) => q.eq("eventId", e._id))
        .take(30);
      if (
        siblings.some(
          (other) =>
            other._id !== s._id &&
            other.conversation === s.conversation &&
            other.acceptedAt !== undefined &&
            (other.sentAt || 0) > s.sentAt!,
        )
      )
        throw new ConvexError(
          "A newer reply in this conversation has already been accepted. Review the newer source; this older message cannot overwrite it.",
        );
    }
    const patch: Record<string, number> = {},
      origins = { ...e.origins },
      changes: string[] = [];
    for (const input of a.facts) {
      const fact = await ctx.db.get(input.candidateId);
      if (
        !fact ||
        fact.sourceId !== s._id ||
        fact.state !== "pending" ||
        !validateValue(fact.field, input.value) ||
        fact.value === null
      )
        throw new ConvexError(
          "One of these facts is no longer available for review.",
        );
      if (fact.field in patch)
        throw new ConvexError("Choose only one statement per fact.");
      if (
        fact.method === "extraction" &&
        !clockValueIsCited(fact.field, fact.value, fact.quote)
      )
        throw new ConvexError(
          "This proposed time is not supported by its quotation. Re-extract this source or add a corrected cited fact manually.",
        );
      const cite = locateQuote(s.text, fact.quote);
      if (!cite)
        throw new ConvexError("A citation no longer matches its source.");
      if (
        input.reason.length > 500 ||
        (input.value !== fact.value && !input.reason.trim())
      )
        throw new ConvexError("Explain any correction to a proposed value.");
      const name = FIELD_INFO[fact.field as keyof typeof FIELD_INFO].label;
      changes.push(
        `${name}: ${display(fact.field, e[fact.field as keyof typeof e])} → ${display(fact.field, input.value)}\nSource: ${s.name}\n“${fact.quote}”${input.reason ? `\nReview: ${input.reason}` : ""}`,
      );
      patch[fact.field] = input.value;
      origins[fact.field] = {
        sourceId: s._id,
        ...cite,
        method: fact.method,
        reviewNote: [fact.note, input.reason].filter(Boolean).join(" · "),
      };
      await ctx.db.patch(fact._id, { state: "accepted" });
    }
    await captureRevision(ctx, e, "Before review");
    const next = { ...e, ...patch };
    const before = evaluatePlan(e),
      after = evaluatePlan(next);
    await ctx.db.patch(e._id, {
      ...patch,
      origins,
      version: e.version + 1,
      replyStatus: ["pending", "flagged", "accepted"].includes(e.replyStatus)
        ? "stale"
        : e.replyStatus,
    });
    await captureRevision(
      ctx,
      (await ctx.db.get(e._id))!,
      "Reviewed source accepted",
    );
    const remaining = await ctx.db
      .query("candidates")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", s._id))
      .take(32);
    await ctx.db.patch(s._id, {
      acceptedAt: Date.now(),
      status: remaining.some((f) => f.state === "pending" && f.value !== null)
        ? "review"
        : "accepted",
    });
    await ctx.db.insert("activity", {
      eventId: e._id,
      text: `Accepted ${a.facts.length} reviewed fact${a.facts.length === 1 ? "" : "s"} from ${s.name}. Timing conflicts: ${before.timing} → ${after.timing}.`,
      kind: "accepted",
      changes: changes.join("\n\n"),
    });
    return null;
  },
});
export const claim = internalMutation({
  args: { sourceId: v.id("sources"), attempt: v.number() },
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sourceId);
    if (!s || s.attempt !== a.attempt || s.status !== "queued") return null;
    await ctx.db.patch(s._id, { status: "reading", updatedAt: Date.now() });
    const event = await ctx.db.get(s.eventId);
    return { source: s, event };
  },
});
export const content = internalMutation({
  args: {
    sourceId: v.id("sources"),
    attempt: v.number(),
    text: v.string(),
    hash: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sourceId);
    if (
      !s ||
      s.attempt !== a.attempt ||
      !["reading", "extracting"].includes(s.status || "")
    )
      return false;
    await ctx.db.patch(s._id, {
      text: a.text,
      contentHash: a.hash,
      ...(a.url ? { url: a.url } : {}),
      retrievedAt: s.retrievedAt || Date.now(),
      status: "extracting",
      updatedAt: Date.now(),
    });
    return true;
  },
});
const factValidator = v.object({
  field: v.string(),
  value: v.union(v.number(), v.null()),
  quote: v.string(),
  start: v.number(),
  end: v.number(),
  note: v.string(),
});
export const finish = internalMutation({
  args: {
    sourceId: v.id("sources"),
    attempt: v.number(),
    facts: v.array(factValidator),
    notes: v.array(v.string()),
    model: v.string(),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      cachedInputTokens: v.number(),
    }),
  },
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sourceId);
    if (!s || s.attempt !== a.attempt || s.status !== "extracting") return null;
    for (const f of a.facts)
      await ctx.db.insert("candidates", {
        ...f,
        sourceId: s._id,
        state: "pending",
        method: "extraction",
      });
    await ctx.db.patch(s._id, {
      status: "review",
      notes: a.notes,
      model: a.model,
      usage: a.usage,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const fail = internalMutation({
  args: {
    sourceId: v.id("sources"),
    attempt: v.number(),
    error: v.string(),
    code: v.string(),
  },
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sourceId);
    if (
      s &&
      s.attempt === a.attempt &&
      ["queued", "reading", "extracting"].includes(s.status || "")
    )
      await ctx.db.patch(s._id, {
        status: "error",
        error: a.error.slice(0, 500),
        errorCode: a.code,
        updatedAt: Date.now(),
      });
    return null;
  },
});
