import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { cases, event } from "../tests/evals/source-cases.mjs";
import { FACT_KEYS } from "../shared/extraction.mjs";
const url = process.env.VITE_CONVEX_URL;
if (!url?.startsWith("http://127.0.0.1:"))
  throw Error("Evaluation requires the local backend.");
const selected = process.argv.slice(2);
if (selected.some((id) => !cases.some((c) => c.id === id)))
  throw Error("Unknown case ID.");
const suite = selected.length
  ? cases.filter((c) => selected.includes(c.id))
  : cases;
const client = new ConvexHttpClient(url, { logger: false });
const workspace = randomUUID() + randomUUID();
const id = await client.mutation(api.events.create, {
  workspace,
  ...event,
  name: `${event.name}`,
});
const report = {
  ranAt: new Date().toISOString(),
  model: "gpt-5.6-luna",
  kind: "authored synthetic cases; not a real-world accuracy estimate",
  results: [],
};
for (const c of suite) {
  const sourceId = await client.mutation(api.sources.add, {
    workspace,
    id,
    name: `Evaluation: ${c.id}`,
    kind: "text",
    text: c.text,
    requestId: randomUUID(),
  });
  let review;
  const deadline = Date.now() + 150000;
  do {
    review = await client.query(api.sources.review, { workspace, sourceId });
    if (["review", "error"].includes(review.source.status)) break;
    await new Promise((r) => setTimeout(r, 1500));
  } while (Date.now() < deadline);
  const actual = Object.fromEntries(
    review.candidates
      .filter((f) => f.value !== null)
      .map((f) => [f.field, f.value]),
  );
  const errors = FACT_KEYS.filter(
    (f) => (actual[f] ?? null) !== (c.expected[f] ?? null),
  ).map((f) => ({
    field: f,
    expected: c.expected[f] ?? null,
    actual: actual[f] ?? null,
  }));
  const saved = await client.query(api.events.details, { workspace, id });
  const unchanged = FACT_KEYS.every((f) => saved.event[f] === null);
  const pass = review.source.status === "review" && !errors.length && unchanged;
  report.results.push({
    id: c.id,
    pass,
    status: review.source.status,
    expected: c.expected,
    actual,
    errors,
    unchanged,
    notes: review.source.notes,
    usage: review.source.usage,
    proposals: review.candidates.map(({ field, value, quote, note }) => ({
      field,
      value,
      quote,
      note,
    })),
  });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${c.id}${errors.length ? " " + JSON.stringify(errors) : ""}`,
  );
  if (review.source.status !== "review") {
    console.log(
      "Import stopped: " + (review.source.errorCode || review.source.status),
    );
    break;
  }
}
report.passed = report.results.filter((r) => r.pass).length;
report.total = report.results.length;
report.usage = report.results.reduce(
  (a, r) => ({
    inputTokens: a.inputTokens + (r.usage?.inputTokens || 0),
    outputTokens: a.outputTokens + (r.usage?.outputTokens || 0),
  }),
  { inputTokens: 0, outputTokens: 0 },
);
await mkdir("docs/evaluations", { recursive: true });
const file = `docs/evaluations/${report.ranAt.replace(/[:.]/g, "-")}.json`;
await writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    passed: report.passed,
    total: report.total,
    usage: report.usage,
    file,
  }),
);
if (report.passed !== suite.length) process.exitCode = 1;
