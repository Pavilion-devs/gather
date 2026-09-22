import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
const settings = parseEnv(readFileSync(".env.cloud", "utf8"));
if (
  settings.CONVEX_DEPLOYMENT !== "prod:clever-boar-260" ||
  settings.VITE_CONVEX_URL !== "https://clever-boar-260.convex.cloud" ||
  settings.VITE_CONVEX_SITE_URL !== "https://clever-boar-260.convex.site"
)
  throw Error("Confirm Gather's production deployment in .env.cloud.");
const env = { ...process.env, ...settings };
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
run(["node_modules/vite/bin/vite.js", "build"]);
run([
  "node_modules/convex/bin/main.js",
  "deploy",
  "--env-file",
  ".env.cloud",
  "--yes",
]);
run([
  "node_modules/@convex-dev/static-hosting/dist/cli/index.js",
  "upload",
  "--prod",
  "--dist",
  "dist",
]);
