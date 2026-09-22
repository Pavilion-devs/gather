import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
const input = process.argv[2];
if (!input) throw new Error("Supply the existing local env-file path.");
const values = parseEnv(readFileSync(input, "utf8"));
// Keep Gather on its budget model even if another project uses a costly model.
values.OPENAI_MODEL = "gpt-5.6-luna";
for (const name of ["OPENAI_API_KEY", "OPENAI_MODEL", "FIRECRAWL_API_KEY"]) {
  if (!values[name]) {
    console.log(name + ": not configured");
    continue;
  }
  const r = spawnSync(
    process.execPath,
    ["node_modules/convex/bin/main.js", "env", "set", name],
    { input: values[name], encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(name + ": could not configure deployment");
    process.exitCode = 1;
  } else console.log(name + ": configured on local backend");
}
