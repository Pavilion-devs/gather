export const INBOX = "favour-7766@agentmail.to";
export const RETRY_WINDOW = 23 * 60 * 60 * 1000;
export function emailAddress(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
  const address = (value.match(/<([^<>]+)>\s*$/)?.[1] || value)
    .trim()
    .toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
    address,
  ) && address.length <= 254
    ? address
    : null;
}
export function validateDraft({ to, subject, text }) {
  const address = emailAddress(to);
  if (!address || address !== to.trim().toLowerCase())
    throw Error("Enter one email address, without a display name.");
  if (!subject.trim() || subject.length > 180 || /[\r\n]/.test(subject))
    throw Error("Add a subject under 180 characters on one line.");
  if (!text.trim() || text.length > 10000)
    throw Error("Write a message between 1 and 10,000 characters.");
  return { to: address, subject: subject.trim(), text: text.trim() };
}
export function escapedHtml(text) {
  return (
    '<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">' +
    text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ) +
    "</div>"
  );
}
export function matchReply(message, drafts) {
  if (!message.labels?.includes("received")) return null;
  const sender = emailAddress(message.from);
  if (!sender) return null;
  const matches = drafts.filter(
    (d) =>
      d.state === "sent" && d.threadId === message.thread_id && d.to === sender,
  );
  const events = [...new Set(matches.map((d) => d.eventId))];
  return events.length === 1 ? events[0] : null;
}
export function mailBody(message) {
  const full = typeof message.text === "string" ? message.text : "";
  const clean =
    typeof message.extracted_text === "string"
      ? message.extracted_text.trim()
      : "";
  return {
    text: full.slice(0, 120000),
    extractedText: clean.slice(0, 60000),
    truncated: full.length > 120000 || clean.length > 60000,
    attachments: (message.attachments || []).length,
  };
}
export class MailError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}
/**
 * @param {string} path
 * @param {string | undefined} key
 * @param {{method?: string, body?: Record<string, unknown>, idempotencyKey?: string, fetcher?: typeof fetch}} options
 */
export async function agentMail(
  path,
  key,
  { method = "GET", body, idempotencyKey, fetcher = fetch } = {},
) {
  if (!key)
    throw new MailError("AgentMail is not configured. Your draft is saved.");
  if (!path.startsWith("inboxes/" + encodeURIComponent(INBOX)))
    throw new MailError("This inbox is not configured for Gather.");
  const sending = method === "POST";
  let response;
  try {
    response = await fetcher("https://api.agentmail.to/v0/" + path, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new MailError(
      sending
        ? "The send result is uncertain. Check status or retry this exact approved message; do not compose a duplicate."
        : "The inbox could not be reached. Try checking again.",
      sending,
    );
  }
  if (!response.ok)
    throw new MailError(
      response.status === 401 || response.status === 403
        ? "AgentMail could not authorize this action. Check the inbox key and sending permissions."
        : response.status === 429
          ? "AgentMail is rate-limited. Wait before trying again."
          : response.status === 409
            ? "AgentMail rejected a conflicting send attempt. This message has not been changed."
            : `AgentMail could not complete this action (HTTP ${response.status}).`,
      sending && (response.status >= 500 || response.status === 409),
    );
  const data = await response.json().catch(() => null);
  if (!data)
    throw new MailError("AgentMail returned an unreadable response.", sending);
  return data;
}
export function sendEndpoint(inbox, draft) {
  return (
    "inboxes/" +
    encodeURIComponent(inbox) +
    "/messages/" +
    (draft.replyTo ? encodeURIComponent(draft.replyTo) + "/reply" : "send")
  );
}
export function sendPayload(draft) {
  return {
    to: [draft.to],
    ...(draft.replyTo ? { reply_all: false } : { subject: draft.subject }),
    text: draft.text,
    html: escapedHtml(draft.text),
    labels: ["gather"],
  };
}
