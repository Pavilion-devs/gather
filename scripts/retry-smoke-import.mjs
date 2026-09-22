import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "node:fs";
if (!process.env.VITE_CONVEX_URL?.startsWith("http://127.0.0.1:"))
  throw Error("Local backend only");
const { workspace, sourceId } = JSON.parse(
  readFileSync("/tmp/gather-smoke-import.json", "utf8"),
);
const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL, {
  logger: false,
});
await client.mutation(api.sources.retry, { workspace, sourceId });
let last = "";
for (let i = 0; i < 90; i++) {
  const data = await client.query(api.sources.review, { workspace, sourceId });
  if (data.source.status !== last) {
    console.log("Import: " + data.source.status);
    last = data.source.status;
  }
  if (["review", "error"].includes(last)) {
    console.log(
      JSON.stringify(
        {
          status: last,
          model: data.source.model,
          sourceCharacters: data.source.text.length,
          facts: data.candidates.map((f) => ({
            field: f.field,
            value: f.value,
            quote: f.quote,
            note: f.note,
          })),
          notes: data.source.notes,
          errorCode: data.source.errorCode || null,
          usage: data.source.usage,
        },
        null,
        2,
      ),
    );
    break;
  }
  await new Promise((r) => setTimeout(r, 1500));
}
