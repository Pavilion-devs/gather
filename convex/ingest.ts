"use node";
import { v } from "convex/values";
import { internalAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHash } from "node:crypto";
import { readVenue, extractFacts, ImportError } from "../shared/providers.mjs";
export const processSource = internalAction({
  args: { sourceId: v.id("sources"), attempt: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(internal.sources.claim, args);
    if (!job || !job.event) return null;
    try {
      let text = job.source.text,
        url = job.source.url;
      if (!text && job.source.kind === "url") {
        const read = await readVenue(url!, env.FIRECRAWL_API_KEY);
        text = read.text;
        url = read.url;
      }
      if (!text.trim())
        throw new ImportError(
          "This document has no readable text. Paste the relevant text or upload a text-based document.",
          "unreadable",
        );
      const current = await ctx.runMutation(internal.sources.content, {
        ...args,
        text,
        hash: createHash("sha256").update(text).digest("hex"),
        ...(url ? { url } : {}),
      });
      if (!current) return null;
      const result = await extractFacts(text, job.event, {
        key: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || "gpt-5.6-luna",
      });
      await ctx.runMutation(internal.sources.finish, { ...args, ...result });
    } catch (error) {
      const known = error instanceof ImportError;
      await ctx.runMutation(internal.sources.fail, {
        ...args,
        error: known
          ? error.message
          : "The source import was interrupted. Your saved text is kept. Retry or add the facts manually.",
        code: known ? error.code : "interrupted",
      });
    }
    return null;
  },
});
