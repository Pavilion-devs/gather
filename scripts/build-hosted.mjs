import {
  readFileSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
const { VITE_CONVEX_URL, VITE_CONVEX_SITE_URL } = parseEnv(
  readFileSync(".env.cloud", "utf8"),
);
if (
  !VITE_CONVEX_URL?.endsWith(".convex.cloud") ||
  !VITE_CONVEX_SITE_URL?.endsWith(".convex.site")
)
  throw Error("Configure the cloud backend first.");
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    env: { ...process.env, VITE_CONVEX_URL, VITE_CONVEX_SITE_URL },
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status || 1);
// This directory contains only generated artifacts, never source or credentials.
rmSync(".vercel/output", { recursive: true, force: true });
mkdirSync(".vercel/output/static", { recursive: true });
cpSync("dist", ".vercel/output/static", { recursive: true });
writeFileSync(
  ".vercel/output/config.json",
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index.html" }],
    },
    null,
    2,
  ) + "\n",
);
console.log("Hosted static bundle prepared. Backend keys are not included.");
