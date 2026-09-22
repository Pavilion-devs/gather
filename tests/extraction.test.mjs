import test from "node:test";
import assert from "node:assert/strict";
import {
  locateQuote,
  validateExtraction,
  validateValue,
} from "../shared/extraction.mjs";
import {
  extractFacts,
  readVenue,
  validPublicUrl,
} from "../shared/providers.mjs";
const source =
  "Delivery complete at 10:00.\n\nPickup starts at 22:15. Delivery is free.";
test("citations preserve exact original positions while accepting PDF whitespace", () => {
  const found = locateQuote(source, "10:00. Pickup starts at 22:15.");
  assert.ok(found);
  assert.equal(source.slice(found.start, found.end), found.quote);
  assert.equal(locateQuote(source, "Delivery complete at 09:00."), null);
});
test("unsupported quotes and contradictory field statements never become proposals", () => {
  const { facts, notes } = validateExtraction(
    {
      facts: [
        { field: "delivery", value: 600, quote: "Delivery complete at 10:00." },
        { field: "delivery", value: 660, quote: "Delivery complete at 10:00." },
        { field: "pickup", value: 1335, quote: "Pickup begins at 22:15." },
        { field: "fee", value: null, quote: null },
      ],
      notes: [],
    },
    source,
  );
  assert.deepEqual(
    facts.map((f) => [f.field, f.value]),
    [["fee", null]],
  );
  assert.equal(notes.length, 2);
});
test("explicit free delivery remains zero; unknown and invalid values stay distinct", () => {
  const result = validateExtraction(
    {
      facts: [{ field: "fee", value: 0, quote: "Delivery is free." }],
      notes: [],
    },
    source,
  );
  assert.equal(result.facts[0].value, 0);
  assert.equal(validateValue("delivery", 1440), false);
  assert.equal(validateValue("setup", -5), false);
  assert.equal(validateValue("loading", 1.5), false);
  assert.equal(validateValue("fee", null), false);
});
test("extraction uses strict structured output and handles quota without leaking provider details", async () => {
  let seen;
  await assert.rejects(
    extractFacts(
      source,
      { name: "Test" },
      {
        key: "test-only",
        fetcher: async (url, options) => {
          seen = { url, options };
          return Response.json(
            {
              error: {
                code: "credit_balance_exhausted",
                message: "private diagnostic",
              },
            },
            { status: 429 },
          );
        },
      },
    ),
    (e) => e.code === "credits" && !e.message.includes("private diagnostic"),
  );
  assert.equal(seen.url, "https://api.openai.com/v1/responses");
  assert.equal(seen.options.headers.Authorization, "Bearer test-only");
  const body = JSON.parse(seen.options.body);
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.equal(JSON.stringify(body).includes("test-only"), false);
});
test("completed output is validated; incomplete output and refusal are rejected", async () => {
  const mock = (body) => async () => Response.json(body);
  const facts = [
    {
      field: "pickup",
      value: 1335,
      quote: "Pickup starts at 22:15.",
      note: "",
    },
  ];
  const result = await extractFacts(
    source,
    {},
    {
      key: "test",
      fetcher: mock({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ facts, notes: [] }),
              },
            ],
          },
        ],
      }),
    },
  );
  assert.equal(result.facts[0].value, 1335);
  for (const body of [
    { status: "incomplete" },
    { status: "completed", output: [{ content: [{ type: "refusal" }] }] },
  ])
    await assert.rejects(
      extractFacts(source, {}, { key: "test", fetcher: mock(body) }),
    );
});
test("venue import preserves returned text and rejects nonpublic URLs before requests", async () => {
  assert.equal(validPublicUrl("http://localhost/rules"), false);
  assert.equal(validPublicUrl("https://user:password@example.com"), false);
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return Response.json({
      success: true,
      data: {
        markdown: source,
        metadata: { sourceURL: "https://example.com/rules", statusCode: 200 },
      },
    });
  };
  await assert.rejects(
    readVenue("https://example.com/rules", "test", {
      lookup: async () => [{ address: "127.0.0.1" }],
      fetcher,
    }),
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await readVenue("https://example.com/rules", "test", {
        lookup: async () => [{ address: "93.184.216.34" }],
        fetcher,
      })
    ).text,
    source,
  );
});
test("budget guard blocks expensive model overrides before a request", async () => {
  let called = false;
  await assert.rejects(
    extractFacts(
      source,
      {},
      {
        key: "test",
        model: "gpt-6-astra",
        fetcher: async () => {
          called = true;
        },
      },
    ),
    (e) => e.code === "configuration",
  );
  assert.equal(called, false);
});
test("a free-delivery price cannot become a midnight delivery time", () => {
  const text =
    "For this event, delivery is free: USD 0. Delivery will be complete at 10:00.";
  const result = validateExtraction(
    {
      facts: [
        {
          field: "delivery",
          value: 0,
          quote: "delivery is free: USD 0",
          note: "Delivery charge",
        },
        { field: "fee", value: 0, quote: "delivery is free: USD 0", note: "" },
      ],
      notes: [],
    },
    text,
  );
  assert.deepEqual(
    result.facts.map((f) => [f.field, f.value]),
    [["fee", 0]],
  );
  assert.ok(
    result.notes.some((n) =>
      n.includes("Delivery complete needs manual review"),
    ),
  );
});
test("clock proposals must cite their actual value, including noon and explicit AM/PM", () => {
  for (const [quote, value] of [
    ["Delivery complete at 10:00.", 600],
    ["Pickup starts at 10:15 PM.", 1335],
    ["Guests arrive at noon.", 720],
    ["Equipment removed at midnight.", 0],
  ])
    assert.equal(
      validateExtraction(
        { facts: [{ field: "delivery", value, quote }], notes: [] },
        quote,
      ).facts.length,
      1,
    );
  assert.equal(
    validateExtraction(
      {
        facts: [
          { field: "delivery", value: 0, quote: "Delivery complete at 10:00." },
        ],
        notes: [],
      },
      "Delivery complete at 10:00.",
    ).facts.length,
    0,
  );
});
test('explicit model field names normalize delivery money separately from delivery time',async()=>{
 const result=await extractFacts('Delivery is free: USD 0.',{}, {key:'test',fetcher:async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({facts:[{field:'delivery_charge_usd',value:0,quote:'Delivery is free: USD 0.',note:''}],notes:[]})}]}]})});
 assert.equal(result.facts[0].field,'fee');assert.equal(result.facts[0].value,0);
});
