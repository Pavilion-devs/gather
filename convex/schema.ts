import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const n = v.union(v.number(), v.null());
export default defineSchema({
  planRevisions: defineTable({
    eventId: v.id("events"),
    version: v.number(),
    capturedAt: v.number(),
    kind: v.string(),
    state: v.any(),
  }).index("by_event_version", ["eventId", "version"]),
  reports: defineTable({
    eventId: v.id("events"),
    workspace: v.string(),
    token: v.string(),
    revoked: v.boolean(),
    featured: v.boolean(),
    createdAt: v.number(),
    snapshot: v.any(),
  })
    .index("by_event", ["eventId"])
    .index("by_token", ["token"])
    .index("by_featured", ["featured"]),
  importUsage: defineTable({
    scope: v.string(),
    day: v.string(),
    count: v.number(),
  }).index("by_scope_day", ["scope", "day"]),
  workspaces: defineTable({ name: v.string(), owner: v.string() }),
  memberships: defineTable({
    workspace: v.string(),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  })
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspace", "userId"]),
  events: defineTable({
    workspace: v.string(),
    name: v.string(),
    date: v.string(),
    venue: v.string(),
    guests: v.number(),
    zone: v.string(),
    isDemo: v.boolean(),
    version: v.number(),
    delivery: n,
    pickup: n,
    setup: n,
    loading: n,
    arrival: n,
    accessStart: n,
    accessEnd: n,
    fee: n,
    floristApproved: v.boolean(),
    replyStatus: v.string(),
    draft: v.string(),
    origins: v.optional(
      v.record(
        v.string(),
        v.object({
          sourceId: v.id("sources"),
          method: v.optional(v.string()),
          reviewNote: v.optional(v.string()),
          quote: v.string(),
          start: v.number(),
          end: v.number(),
        }),
      ),
    ),
  }).index("by_workspace", ["workspace"]),
  activity: defineTable({
    eventId: v.id("events"),
    text: v.string(),
    kind: v.string(),
    changes: v.optional(v.string()),
  }).index("by_eventId", ["eventId"]),
  sources: defineTable({
    mailMessageId: v.optional(v.id("mailMessages")),
    conversation: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    eventId: v.id("events"),
    name: v.string(),
    text: v.string(),
    kind: v.optional(v.string()),
    status: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileType: v.optional(v.string()),
    requestId: v.optional(v.string()),
    attempt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    notes: v.optional(v.array(v.string())),
    model: v.optional(v.string()),
    usage: v.optional(
      v.object({
        inputTokens: v.number(),
        outputTokens: v.number(),
        cachedInputTokens: v.number(),
      }),
    ),
    contentHash: v.optional(v.string()),
    retrievedAt: v.optional(v.number()),
  }).index("by_eventId", ["eventId"]),
  mailboxes: defineTable({
    workspace: v.string(),
    inboxId: v.string(),
    lastSync: v.optional(v.number()),
    syncingAt: v.optional(v.number()),
    cursor: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_inboxId", ["inboxId"])
    .index("by_workspace", ["workspace"]),
  mailDrafts: defineTable({
    workspace: v.string(),
    eventId: v.id("events"),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    revision: v.number(),
    planVersion: v.number(),
    state: v.string(),
    requestId: v.string(),
    replyTo: v.optional(v.string()),
    messageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    lastAttempt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_workspace", ["workspace"])
    .index("by_threadId", ["threadId"]),
  mailMessages: defineTable({
    workspace: v.string(),
    inboxId: v.string(),
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
    eventId: v.optional(v.id("events")),
    sourceId: v.optional(v.id("sources")),
    assignment: v.optional(v.string()),
  })
    .index("by_inbox_message", ["inboxId", "messageId"])
    .index("by_workspace", ["workspace"])
    .index("by_eventId", ["eventId"]),
  candidates: defineTable({
    sourceId: v.id("sources"),
    field: v.string(),
    value: n,
    quote: v.string(),
    start: v.number(),
    end: v.number(),
    note: v.string(),
    state: v.string(),
    method: v.string(),
  }).index("by_sourceId", ["sourceId"]),
});
