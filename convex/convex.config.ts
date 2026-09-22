import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "@convex-dev/better-auth/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
const app = defineApp({
  env: {
    AGENTMAIL_API_KEY: v.optional(v.string()),
    OPENAI_API_KEY: v.optional(v.string()),
    OPENAI_MODEL: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.optional(v.string()),
  },
});

app.use(betterAuth);
app.use(staticHosting);
export default app;
