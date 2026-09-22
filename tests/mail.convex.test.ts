import { convexTest } from "convex-test";
import { test, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { DEMO } from "../shared/plan.mjs";
import { INBOX, RETRY_WINDOW } from "../shared/mail.mjs";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function setup() {
  vi.useFakeTimers();
  vi.stubEnv("GATHER_LOCAL_WORKSPACES", "true");
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3217");
  vi.stubEnv("AGENTMAIL_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw Error("Unexpected network request in test");
    }),
  );
  const t = convexTest(schema, modules),
    workspace = "a".repeat(64);
  const id = await t.run(async (ctx) => {
    const id = await ctx.db.insert("events", { ...DEMO, workspace });
    await ctx.db.insert("mailboxes", { workspace, inboxId: INBOX });
    return id;
  });
  return { t, workspace, id };
}
async function draft(f: any) {
  return f.t.mutation(api.mail.save, {
    workspace: f.workspace,
    id: f.id,
    planVersion: 2,
    to: "supplier@example.com",
    subject: "Confirm delivery",
    text: "Can you confirm delivery completion?",
    requestId: "request-test-12345",
  });
}
test("saving does not send; approval is immutable and concurrent duplicate approval sends once", async () => {
  const f = await setup();
  const fetcher = vi.fn(async () =>
    Response.json({ message_id: "sent1", thread_id: "thread1" }),
  );
  vi.stubGlobal("fetch", fetcher);
  const draftId = await draft(f);
  expect(fetcher).not.toHaveBeenCalled();
  const approval = {
    workspace: f.workspace,
    draftId,
    expectedRevision: 1,
    expectedVersion: 2,
  };
  await Promise.all([
    f.t.mutation(api.mail.approve, approval),
    f.t.mutation(api.mail.approve, approval),
  ]);
  await expect(
    f.t.mutation(api.mail.save, {
      workspace: f.workspace,
      id: f.id,
      draftId,
      expectedRevision: 1,
      planVersion: 2,
      to: "changed@example.com",
      subject: "changed",
      text: "changed",
      requestId: "request-test-12345",
    }),
  ).rejects.toThrow();
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(fetcher).toHaveBeenCalledTimes(1);
  const d = await f.t.run((ctx) => ctx.db.get(draftId));
  expect(d?.state).toBe("sent");
  expect(d?.to).toBe("supplier@example.com");
});
test("stale plan, stale draft and foreign workspace cannot approve", async () => {
  const f = await setup(),
    draftId = await draft(f);
  const a = {
    workspace: f.workspace,
    draftId,
    expectedRevision: 1,
    expectedVersion: 2,
  };
  await expect(
    f.t.mutation(api.mail.approve, { ...a, workspace: "b".repeat(64) }),
  ).rejects.toThrow();
  await expect(
    f.t.mutation(api.mail.approve, { ...a, expectedRevision: 0 }),
  ).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(f.id, { version: 3 }));
  await expect(f.t.mutation(api.mail.approve, a)).rejects.toThrow();
});
test("uncertain send uses the same payload and key on explicit retry; expired retry is blocked", async () => {
  const f = await setup(),
    draftId = await draft(f);
  let count = 0;
  const fetcher = vi.fn(async () => {
    if (count++ === 0) throw Error("lost response");
    return Response.json({ message_id: "sent1", thread_id: "thread1" });
  });
  vi.stubGlobal("fetch", fetcher);
  await f.t.mutation(api.mail.approve, {
    workspace: f.workspace,
    draftId,
    expectedRevision: 1,
    expectedVersion: 2,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect((await f.t.run((ctx) => ctx.db.get(draftId)))?.state).toBe(
    "uncertain",
  );
  vi.advanceTimersByTime(11000);
  await f.t.mutation(api.mail.retrySend, { workspace: f.workspace, draftId });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[1][0]);
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  expect(fetcher.mock.calls[0][1].headers).toEqual(
    fetcher.mock.calls[1][1].headers,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(draftId, {
      state: "uncertain",
      approvedAt: Date.now() - RETRY_WINDOW - 1,
    }),
  );
  await expect(
    f.t.mutation(api.mail.retrySend, { workspace: f.workspace, draftId }),
  ).rejects.toThrow("safe retry window");
});
test("incoming deduplication, sender matching and no plan changes on receipt", async () => {
  const f = await setup(),
    draftId = await draft(f);
  await f.t.run((ctx) =>
    ctx.db.patch(draftId, {
      state: "sent",
      threadId: "thread1",
      messageId: "outbound1",
    }),
  );
  const m = {
    workspace: f.workspace,
    messageId: "inbound1",
    threadId: "thread1",
    from: "supplier@example.com",
    to: [INBOX],
    subject: "Re: Confirm delivery",
    text: "Delivery complete at 10:00.",
    extractedText: "Delivery complete at 10:00.",
    timestamp: Date.now(),
    labels: ["received"],
    attachments: 0,
    truncated: false,
  };
  const id = await f.t.mutation(internal.mail.ingest, m);
  expect(await f.t.mutation(internal.mail.ingest, m)).toBe(id);
  const saved = await f.t.run((ctx) => ctx.db.get(id));
  expect(saved?.eventId).toBe(f.id);
  expect((await f.t.run((ctx) => ctx.db.get(f.id)))?.delivery).toBe(
    DEMO.delivery,
  );
  const unexpected = await f.t.mutation(internal.mail.ingest, {
    ...m,
    messageId: "inbound2",
    from: "other@example.com",
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(unexpected)))?.eventId,
  ).toBeUndefined();
  await expect(
    f.t.mutation(api.mail.assign, {
      workspace: "b".repeat(64),
      id: f.id,
      messageId: unexpected,
    }),
  ).rejects.toThrow();
  const sourceId = await f.t.mutation(api.mail.importReply, {
    workspace: f.workspace,
    id: f.id,
    messageId: id,
  });
  expect(
    await f.t.mutation(api.mail.importReply, {
      workspace: f.workspace,
      id: f.id,
      messageId: id,
    }),
  ).toBe(sourceId);
});
test("an older reply cannot overwrite a newer accepted reply in the same conversation", async () => {
  const f = await setup();
  const { sourceId, candidateId } = await f.t.run(async (ctx) => {
    await ctx.db.insert("sources", {
      eventId: f.id,
      name: "newer reply",
      text: "Delivery complete at 10:00.",
      conversation: "thread1|supplier@example.com",
      sentAt: 200,
      acceptedAt: 300,
      status: "accepted",
    });
    const sourceId = await ctx.db.insert("sources", {
      eventId: f.id,
      name: "older reply",
      text: "Delivery complete at 11:30.",
      conversation: "thread1|supplier@example.com",
      sentAt: 100,
      status: "review",
    });
    const candidateId = await ctx.db.insert("candidates", {
      sourceId,
      field: "delivery",
      value: 690,
      quote: "Delivery complete at 11:30.",
      start: 0,
      end: 26,
      note: "",
      state: "pending",
      method: "manual",
    });
    return { sourceId, candidateId };
  });
  await expect(
    f.t.mutation(api.sources.apply, {
      workspace: f.workspace,
      sourceId,
      expectedVersion: 2,
      facts: [{ candidateId, value: 690, reason: "" }],
    }),
  ).rejects.toThrow("newer reply");
});
test("editing a reply preserves its thread and cannot change the recipient", async () => {
  const f = await setup();
  const messageId = await f.t.run((ctx) =>
    ctx.db.insert("mailMessages", {
      workspace: f.workspace,
      inboxId: INBOX,
      messageId: "received-original",
      threadId: "thread1",
      from: "supplier@example.com",
      to: [INBOX],
      subject: "Confirmed times",
      text: "Delivery complete at 10:00.",
      extractedText: "",
      timestamp: Date.now(),
      labels: ["received"],
      attachments: 0,
      truncated: false,
      eventId: f.id,
    }),
  );
  const args = {
    workspace: f.workspace,
    id: f.id,
    planVersion: 2,
    to: "supplier@example.com",
    subject: "Re: Confirmed times",
    text: "Thank you. Please confirm the charge.",
    requestId: "reply-request-12345",
  };
  const draftId = await f.t.mutation(api.mail.save, {
    ...args,
    replyMessageId: messageId,
  });
  await f.t.mutation(api.mail.save, {
    ...args,
    draftId,
    expectedRevision: 1,
    text: "Please also confirm the loading duration.",
  });
  expect((await f.t.run((ctx) => ctx.db.get(draftId)))?.replyTo).toBe(
    "received-original",
  );
  await expect(
    f.t.mutation(api.mail.save, {
      ...args,
      draftId,
      expectedRevision: 2,
      to: "different@example.com",
    }),
  ).rejects.toThrow("recipient");
  const fetcher = vi.fn(async () =>
    Response.json({ message_id: "sent-reply", thread_id: "thread1" }),
  );
  vi.stubGlobal("fetch", fetcher);
  await f.t.mutation(api.mail.approve, {
    workspace: f.workspace,
    draftId,
    expectedRevision: 2,
    expectedVersion: 2,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(fetcher.mock.calls[0][0]).toContain(
    "/messages/received-original/reply",
  );
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.to).toEqual(["supplier@example.com"]);
  expect(body.reply_all).toBe(false);
});
test("sync saves incoming messages without extracting them, carries pagination and scopes reads", async () => {
  const f = await setup();
  const incoming = {
    inbox_id: INBOX,
    message_id: "incoming-page-1",
    thread_id: "unmatched-thread",
    from: "unknown@example.com",
    to: [INBOX],
    subject: "Confirm fee",
    text: "Delivery is free.",
    extracted_text: "Delivery is free.",
    timestamp: new Date().toISOString(),
    labels: ["received"],
    attachments: [],
  };
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.includes("?")
        ? { messages: [incoming], next_page_token: "next-page" }
        : incoming,
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  await f.t.action(api.mailActions.sync, { workspace: f.workspace });
  const state = await f.t.query(api.mail.list, {
    workspace: f.workspace,
    id: f.id,
  });
  expect(state.hasOlder).toBe(true);
  expect(state.unassigned).toHaveLength(1);
  expect(state.unassigned[0]).not.toHaveProperty("text");
  expect(state.unassigned[0].sourceId).toBeUndefined();
  const detail = await f.t.query(api.mail.message, {
    workspace: f.workspace,
    id: f.id,
    messageId: state.unassigned[0]._id,
  });
  expect(detail?.text).toBe("Delivery is free.");
  await expect(
    f.t.query(api.mail.message, {
      workspace: "b".repeat(64),
      id: f.id,
      messageId: state.unassigned[0]._id,
    }),
  ).rejects.toThrow();
  vi.advanceTimersByTime(6000);
  await f.t.action(api.mailActions.sync, {
    workspace: f.workspace,
    older: true,
  });
  expect(
    fetcher.mock.calls.some((c) => c[0].includes("page_token=next-page")),
  ).toBe(true);
  expect(
    (await f.t.query(api.mail.list, { workspace: f.workspace, id: f.id }))
      .unassigned,
  ).toHaveLength(1);
});
test('previously stored AI price-as-time proposals are refused at acceptance',async()=>{
 const f=await setup();const ids=await f.t.run(async ctx=>{const sourceId=await ctx.db.insert('sources',{eventId:f.id,name:'Historical faulty extraction',text:'Delivery is free: USD 0.',status:'review'});const candidateId=await ctx.db.insert('candidates',{sourceId,field:'delivery',value:0,quote:'Delivery is free: USD 0.',start:0,end:24,note:'',state:'pending',method:'extraction'});return {sourceId,candidateId}});
 await expect(f.t.mutation(api.sources.apply,{workspace:f.workspace,sourceId:ids.sourceId,expectedVersion:2,facts:[{candidateId:ids.candidateId,value:0,reason:''}]})).rejects.toThrow('not supported by its quotation');
 expect((await f.t.run(ctx=>ctx.db.get(f.id)))?.delivery).toBe(DEMO.delivery);
});
