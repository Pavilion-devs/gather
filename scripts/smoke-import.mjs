import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
if (!process.env.VITE_CONVEX_URL?.startsWith("http://127.0.0.1:"))
  throw Error("Local backend only");
const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL, {
  logger: false,
});
const workspace = randomUUID() + randomUUID();
const id = await client.mutation(api.events.create, {
  workspace,
  name: "Public venue import check",
  date: "2026-10-24",
  venue: "Mansion House — research only",
  guests: 120,
});
const url = "https://mansionhouseevents.cityoflondon.gov.uk/faq/";
const sourceId = await client.mutation(api.sources.add, {
  workspace,
  id,
  name: "Mansion House public venue FAQs",
  kind: "url",
  url,
  requestId: randomUUID(),
});
writeFileSync(
  "/tmp/gather-smoke-import.json",
  JSON.stringify({ workspace, id, sourceId }),
);
let last = "";
for (let i = 0; i < 90; i++) {
  const data = await client.query(api.sources.review, { workspace, sourceId });
  if (data.source.status !== last) {
    console.log("Import: " + data.source.status);
    last = data.source.status;
  }
  if (["review", "error"].includes(last)) {
    console.log(
      JSON.stringify({
        status: last,
        sourceCharacters: data.source.text.length,
        readFrom: !!data.source.url,
        candidates: data.candidates.length,
        errorCode: data.source.errorCode || null,
      }),
    );
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}
