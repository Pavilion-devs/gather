import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { agentMail, INBOX } from "../shared/mail.mjs";
export const authComponent = createClient<DataModel>(components.betterAuth);
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL || "http://127.0.0.1:5180";
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      siteUrl,
      ...(process.env.GATHER_PREVIOUS_SITE_URL
        ? [process.env.GATHER_PREVIOUS_SITE_URL]
        : []),
    ],
    database: authComponent.adapter(ctx),
    rateLimit: { enabled: true, storage: "database", window: 60, max: 20 },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in")
            throw new APIError("FORBIDDEN", {
              message: "Request a sign-in code to open your events.",
            });
          await agentMail(
            "inboxes/" + encodeURIComponent(INBOX) + "/messages/send",
            process.env.AGENTMAIL_API_KEY,
            {
              method: "POST",
              body: {
                to: [email],
                subject: "Your Gather sign-in code",
                text: `Your Gather sign-in code is ${otp}.\n\nIt expires in 5 minutes. If you did not request this, ignore this email.`,
                labels: ["gather-auth"],
              },
            },
          );
        },
      }),
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  });
};
