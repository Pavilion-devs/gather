import {
  extractionInstructions,
  extractionSchema,
  providerError,
  validateExtraction,
  normalizeModelFacts,
} from "./extraction.mjs";
import dns from "node:dns/promises";
import net from "node:net";
export class ImportError extends Error {
  constructor(message, code = "import") {
    super(message);
    this.code = code;
  }
}
export function validPublicUrl(value) {
  try {
    const u = new URL(value),
      host = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      !net.isIP(host) &&
      host.includes(".") &&
      !/(^|\.)(localhost|local|internal|test|invalid|home|lan)$/.test(host) &&
      !host.includes(":")
    );
  } catch {
    return false;
  }
}
function privateAddress(ip) {
  return (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::|fc|fd|fe80|ff)/i.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)
  );
}
export async function readVenue(
  url,
  key,
  { fetcher = fetch, lookup = dns.lookup } = {},
) {
  if (!key)
    throw new ImportError(
      "Firecrawl is not configured. Paste source text or upload a document instead.",
      "configuration",
    );
  if (!validPublicUrl(url))
    throw new ImportError(
      "Use a public HTTPS venue page without embedded credentials.",
      "url",
    );
  const addresses = await lookup(new URL(url).hostname, { all: true });
  if (!addresses.length || addresses.some((a) => privateAddress(a.address)))
    throw new ImportError(
      "That URL does not point to a public venue page.",
      "url",
    );
  const r = await fetcher("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: 0,
      timeout: 45000,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = providerError("Firecrawl", r.status, data);
    throw new ImportError(e.message, e.code);
  }
  const body = data.data;
  const finalUrl = body?.metadata?.url || body?.metadata?.sourceURL || url;
  if (
    !data.success ||
    typeof body?.markdown !== "string" ||
    !body.markdown.trim() ||
    body.metadata?.statusCode >= 400 ||
    !validPublicUrl(finalUrl)
  )
    throw new ImportError(
      "The venue page could not be read. Try a specific public page or paste the relevant text.",
      "unreadable",
    );
  if (body.markdown.length > 60000)
    throw new ImportError(
      "This page is too long for one source. Paste the relevant venue rules instead.",
      "too_long",
    );
  return { text: body.markdown, url: finalUrl };
}
export async function extractFacts(
  text,
  event,
  { key = "", model = "gpt-5.6-luna", fetcher = fetch } = {},
) {
  if (model !== "gpt-5.6-luna")
    throw new ImportError(
      "Extraction is limited to the configured budget model (GPT-5.6 Luna). Update the model setting before retrying.",
      "configuration",
    );
  if (!key)
    throw new ImportError(
      "OpenAI is not configured. Your source is saved and can be reviewed manually.",
      "configuration",
    );
  const r = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: extractionInstructions,
      input: JSON.stringify({
        eventContext: {
          name: event.name,
          date: event.date,
          venue: event.venue,
          timeZone: event.zone,
        },
        sourceText: text,
      }),
      max_output_tokens: 4000,
      service_tier: "default",
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "gather_source_facts",
          strict: true,
          schema: extractionSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = providerError("OpenAI", r.status, body);
    throw new ImportError(e.message, e.code);
  }
  if (body.status !== "completed")
    throw new ImportError(
      "Extraction did not finish. Your source is saved; retry or add facts manually.",
      "incomplete",
    );
  const content = body.output?.flatMap((o) => o.content || []) || [];
  if (content.some((c) => c.type === "refusal"))
    throw new ImportError(
      "This source could not be extracted automatically. Review the text manually.",
      "refusal",
    );
  let parsed;
  try {
    parsed = JSON.parse(
      content
        .filter((c) => c.type === "output_text")
        .map((c) => c.text)
        .join(""),
    );
  } catch {
    throw new ImportError(
      "The extraction returned unreadable data. Retry or add facts manually.",
      "invalid_output",
    );
  }
  return {
    ...validateExtraction(normalizeModelFacts(parsed), text),
    model,
    usage: {
      inputTokens: body.usage?.input_tokens || 0,
      outputTokens: body.usage?.output_tokens || 0,
      cachedInputTokens: body.usage?.input_tokens_details?.cached_tokens || 0,
    },
  };
}
