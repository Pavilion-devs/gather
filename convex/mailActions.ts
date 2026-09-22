"use node";
import { v, ConvexError } from "convex/values";
import { action, internalAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  agentMail,
  MailError,
  mailBody,
  sendPayload,
  sendEndpoint,
} from "../shared/mail.mjs";
export const send = internalAction({
  args: { draftId: v.id("mailDrafts") },
  handler: async (ctx, a) => {
    const job = await ctx.runMutation(internal.mail.claimSend, a);
    if (!job) return null;
    try {
      const result = await agentMail(
        sendEndpoint(job.inbox, job.draft),
        env.AGENTMAIL_API_KEY,
        {
          method: "POST",
          body: sendPayload(job.draft),
          idempotencyKey: "gather-" + job.draft._id + "-" + job.draft.revision,
        },
      );
      if (!result.message_id || !result.thread_id)
        throw new MailError(
          "AgentMail accepted the request but did not return message tracking. Check before retrying.",
          true,
        );
      await ctx.runMutation(internal.mail.finishSend, {
        draftId: a.draftId,
        messageId: result.message_id,
        threadId: result.thread_id,
      });
    } catch (error) {
      await ctx.runMutation(internal.mail.failSend, {
        draftId: a.draftId,
        message:
          error instanceof MailError
            ? error.message
            : "The send result could not be recorded. Check status before retrying.",
        uncertain: error instanceof MailError ? error.uncertain : true,
      });
    }
    return null;
  },
});
export const sync = action({
  args: { workspace: v.string(), older: v.optional(v.boolean()) },
  handler: async (ctx, a): Promise<null> => {
    const job = await ctx.runMutation(internal.mail.beginSync, {
      workspace: a.workspace,
      older: !!a.older,
    });
    try {
      const root = "inboxes/" + encodeURIComponent(job.inbox) + "/messages";
      const list = await agentMail(
        root +
          "?limit=20&labels=received" +
          (job.cursor ? "&page_token=" + encodeURIComponent(job.cursor) : ""),
        env.AGENTMAIL_API_KEY,
      );
      if (!Array.isArray(list.messages))
        throw new MailError("The inbox returned an unreadable message list.");
      for (const item of list.messages.slice(0, 20)) {
        if (!item.labels?.includes("received") || !item.message_id) continue;
        if (
          await ctx.runQuery(internal.mail.known, {
            workspace: a.workspace,
            messageId: item.message_id,
          })
        )
          continue;
        const m = await agentMail(
          root + "/" + encodeURIComponent(item.message_id),
          env.AGENTMAIL_API_KEY,
        );
        if (
          !m.labels?.includes("received") ||
          m.labels?.some((l: string) => ["spam", "blocked"].includes(l))
        )
          continue;
        const timestamp = Date.parse(m.timestamp);
        if (!Number.isFinite(timestamp)) continue;
        await ctx.runMutation(internal.mail.ingest, {
          workspace: a.workspace,
          messageId: m.message_id,
          threadId: m.thread_id,
          from: String(m.from || "").slice(0, 500),
          to: (Array.isArray(m.to) ? m.to : []).slice(0, 50),
          subject: String(m.subject || "(No subject)").slice(0, 500),
          ...mailBody(m),
          timestamp,
          labels: m.labels.slice(0, 30),
        });
      }
      await ctx.runMutation(internal.mail.finishSync, {
        workspace: a.workspace,
        older: !!a.older,
        ...(list.next_page_token ? { cursor: list.next_page_token } : {}),
      });
    } catch (error) {
      const message =
        error instanceof MailError
          ? error.message
          : "The inbox check was interrupted. Already saved messages are kept.";
      await ctx.runMutation(internal.mail.finishSync, {
        workspace: a.workspace,
        older: !!a.older,
        error: message,
      });
      throw new ConvexError(message);
    }
    return null;
  },
});
