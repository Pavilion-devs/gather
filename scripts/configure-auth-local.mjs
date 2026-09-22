import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
if (!process.env.VITE_CONVEX_URL?.startsWith("http://127.0.0.1:"))
  throw Error("Local configuration only");
function set(name, value) {
  const result = spawnSync(
    "node",
    ["node_modules/convex/bin/main.js", "env", "set", name],
    { input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  if (result.status !== 0) throw Error(`Could not set ${name}`);
  console.log(`Configured ${name}`);
}
// Keep an existing service secret so repeat configuration does not invalidate sessions.
const existing = spawnSync(
  "node",
  ["node_modules/convex/bin/main.js", "env", "get", "BETTER_AUTH_SECRET"],
  { encoding: "utf8" },
);
if (existing.status !== 0 || !existing.stdout.trim())
  set("BETTER_AUTH_SECRET", randomBytes(32).toString("base64"));
set("SITE_URL", "http://127.0.0.1:5180");
set("GATHER_SIGNIN_EMAILS", "gather-test-7766@agentmail.to");
const file = readFileSync(".env.local", "utf8");
if (!file.includes("VITE_CONVEX_SITE_URL="))
  appendFileSync(
    ".env.local",
    "\nVITE_CONVEX_SITE_URL=http://127.0.0.1:3217\n",
  );
