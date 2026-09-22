import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { FIELD_INFO } from "../shared/extraction.mjs";
import { evaluatePlan } from "../shared/plan.mjs";

export function planState(e: Doc<"events">) {
  return {
    version: e.version,
    facts: Object.fromEntries(
      Object.keys(FIELD_INFO).map((k) => [k, e[k as keyof typeof e]]),
    ),
    origins: e.origins || {},
  };
}
export async function captureRevision(
  ctx: MutationCtx,
  e: Doc<"events">,
  kind: string,
) {
  const existing = await ctx.db
    .query("planRevisions")
    .withIndex("by_event_version", (q) =>
      q.eq("eventId", e._id).eq("version", e.version),
    )
    .unique();
  if (!existing)
    await ctx.db.insert("planRevisions", {
      eventId: e._id,
      version: e.version,
      capturedAt: Date.now(),
      kind,
      state: planState(e),
    });
}
// Public reports never serialize event, mailbox or source documents wholesale.
export function redact(text: string) {
  return text
    .replace(
      /[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[A-Za-z]{2,}/g,
      "[email hidden]",
    )
    .replace(
      /(?:\+\d[\d ().-]{7,}\d|\(\d{3}\)\s*\d{3}[- .]?\d{4}|\b\d{3}[- .]\d{3}[- .]\d{4}\b|\b\d{10,15}\b)/g,
      "[phone hidden]",
    );
}
function publicUrl(value?: string) {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return undefined;
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return undefined;
  }
}
export async function buildReport(
  ctx: QueryCtx | MutationCtx,
  e: Doc<"events">,
) {
  const revisions = await ctx.db
    .query("planRevisions")
    .withIndex("by_event_version", (q) => q.eq("eventId", e._id))
    .order("asc")
    .take(50);
  const states = revisions.map((r) => ({
    ...r.state,
    at: r.capturedAt,
    kind: r.kind,
  }));
  if (!states.some((s) => s.version === e.version))
    states.push({ ...planState(e), at: Date.now(), kind: "Current plan" });
  const steps = [];
  for (const s of states) {
    const evidence = [];
    for (const field of Object.keys(FIELD_INFO)) {
      const origin = s.origins[field];
      if (!origin) continue;
      const source = await ctx.db.get(origin.sourceId as Id<"sources">);
      if (!source || source.eventId !== e._id) continue;
      evidence.push({
        field,
        method: origin.method || "unrecorded",
        reviewNote: redact(origin.reviewNote || ""),
        quote: redact(origin.quote).slice(0, 1600),
        sourceName: redact(source.name),
        kind: source.kind || "text",
        ...(publicUrl(source.url) ? { url: publicUrl(source.url) } : {}),
        ...(source.contentHash ? { hash: source.contentHash } : {}),
        ...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}),
        ...(source.sentAt ? { sentAt: source.sentAt } : {}),
      });
    }
    steps.push({
      version: s.version,
      at: s.at,
      kind: s.kind,
      facts: s.facts,
      checks: evaluatePlan(s.facts),
      evidence,
    });
  }
  const drafts = await ctx.db
    .query("mailDrafts")
    .withIndex("by_eventId", (q) => q.eq("eventId", e._id))
    .take(50);
  const messages = await ctx.db
    .query("mailMessages")
    .withIndex("by_eventId", (q) => q.eq("eventId", e._id))
    .take(50);
  return {
    name: redact(e.name),
    date: e.date,
    venue: redact(e.venue),
    guests: e.guests,
    zone: e.zone,
    version: e.version,
    capturedAt: Date.now(),
    isDemo: e.isDemo,
    steps,
    mail: {
      sent: drafts.filter((d) => d.state === "sent").length,
      received: messages.filter((m) => m.sourceId).length,
    },
    historyComplete: revisions.length > 0 && revisions[0].version === 1,
    truncated: revisions.length === 50,
  };
}
