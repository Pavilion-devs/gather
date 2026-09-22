import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
const [file, site, ownerEmail] = process.argv.slice(2);
if (!file || !site?.startsWith("https://") || !ownerEmail?.includes("@"))
  throw Error(
    "Provide credentials file, public HTTPS app URL and owner email.",
  );
const values = parseEnv(readFileSync(file, "utf8"));
const settings = {
  OPENAI_API_KEY: values.OPENAI_API_KEY,
  FIRECRAWL_API_KEY: values.FIRECRAWL_API_KEY,
  AGENTMAIL_API_KEY: values.AGENTMAIL_API_KEY,
  OPENAI_MODEL: "gpt-5.6-luna",
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
  SITE_URL: site,
  GATHER_LOCAL_WORKSPACES: "false",
  GATHER_MAIL_OWNER_EMAIL: ownerEmail,
};
for (const [name, value] of Object.entries(settings)) {
  if (!value) throw Error("Missing " + name);
  // Preserve an existing encryption secret. This script can configure later app URL changes safely.
  if (name === "BETTER_AUTH_SECRET") {
    const existing = spawnSync(
      process.execPath,
      [
        "node_modules/convex/bin/main.js",
        "env",
        "get",
        name,
        "--deployment",
        "favour-olaboye:gather:main",
      ],
      { encoding: "utf8" },
    );
    if (existing.status === 0 && existing.stdout.trim()) {
      console.log("Retained BETTER_AUTH_SECRET");
      continue;
    }
  }
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/convex/bin/main.js",
      "env",
      "set",
      name,
      "--deployment",
      "favour-olaboye:gather:main",
    ],
    { input: value, encoding: "utf8" },
  );
  if (result.status !== 0) throw Error("Could not configure " + name);
  console.log("Configured " + name);
}
