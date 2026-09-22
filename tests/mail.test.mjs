import test from "node:test";
import assert from "node:assert/strict";
import {
  INBOX,
  emailAddress,
  validateDraft,
  matchReply,
  agentMail,
  mailBody,
  sendPayload,
} from "../shared/mail.mjs";
test("recipient and subject validation blocks multiple recipients and injected headers", () => {
  assert.equal(
    emailAddress("Juniper <vendor@example.com>"),
    "vendor@example.com",
  );
  for (const to of [
    "vendor@example.com\nBcc: other@example.com",
    "a@example.com,b@example.com",
    "Name <a@example.com>",
  ])
    assert.throws(() =>
      validateDraft({ to, subject: "Question", text: "Hello" }),
    );
  assert.throws(() =>
    validateDraft({
      to: "a@example.com",
      subject: "Question\r\nCc: a",
      text: "Hello",
    }),
  );
});
test("thread matching needs an incoming message, the expected sender and one unambiguous event", () => {
  const d = {
    eventId: "event1",
    state: "sent",
    threadId: "thread1",
    to: "supplier@example.com",
  };
  const m = {
    labels: ["received"],
    thread_id: "thread1",
    from: "Supplier <supplier@example.com>",
  };
  assert.equal(matchReply(m, [d]), "event1");
  assert.equal(matchReply({ ...m, from: "other@example.com" }, [d]), null);
  assert.equal(matchReply({ ...m, labels: ["sent"] }, [d]), null);
  assert.equal(matchReply(m, [d, { ...d, eventId: "event2" }]), null);
});
test("original body is separate from extracted reply and oversized content is flagged", () => {
  const body = mailBody({
    text: "New reply\n>old question",
    extracted_text: "New reply",
    attachments: [{}],
  });
  assert.equal(body.text, "New reply\n>old question");
  assert.equal(body.extractedText, "New reply");
  assert.equal(body.attachments, 1);
  assert.equal(mailBody({ text: "a".repeat(120001) }).truncated, true);
});
test("outbound HTML escapes source-like markup and has the same plain-text content", () => {
  const p = sendPayload({
    to: "a@example.com",
    subject: "test",
    text: "<script>alert(1)</script> & question",
  });
  assert.equal(p.html.includes("<script>"), false);
  assert.ok(p.html.includes("&lt;script&gt;"));
  assert.equal(p.text, "<script>alert(1)</script> & question");
});
test("provider requests restrict credential destination and use the stable send key", async () => {
  let seen;
  await agentMail(
    "inboxes/" + encodeURIComponent(INBOX) + "/messages/send",
    "test",
    {
      method: "POST",
      body: { text: "test" },
      idempotencyKey: "gather-test-1",
      fetcher: async (url, options) => {
        seen = { url, options };
        return Response.json({ message_id: "m", thread_id: "t" });
      },
    },
  );
  assert.ok(seen.url.startsWith("https://api.agentmail.to/v0/"));
  assert.equal(seen.options.headers.Authorization, "Bearer test");
  assert.equal(seen.options.headers["Idempotency-Key"], "gather-test-1");
  await assert.rejects(agentMail("https://elsewhere.example", "test"));
  await assert.rejects(
    agentMail(
      "inboxes/" + encodeURIComponent(INBOX) + "/messages/send",
      "test",
      {
        method: "POST",
        fetcher: async () => {
          throw Error("network");
        },
      },
    ),
    (e) => e.uncertain === true,
  );
});
