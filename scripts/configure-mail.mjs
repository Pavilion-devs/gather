import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
const file = process.argv[2];
const key =
  process.env.AGENTMAIL_API_KEY ||
  (file ? parseEnv(readFileSync(file, "utf8")).AGENTMAIL_API_KEY : undefined);
if (!key)
  throw Error(
    "AGENTMAIL_API_KEY is not configured. Supply the existing env-file path.",
  );
const r = spawnSync(
  process.execPath,
  ["node_modules/convex/bin/main.js", "env", "set", "AGENTMAIL_API_KEY"],
  { input: key, encoding: "utf8" },
);
if (r.status !== 0)
  throw Error("Could not configure AgentMail on the local backend.");
console.log(
  "AgentMail key configured on local backend. Key value is not displayed.",
);
