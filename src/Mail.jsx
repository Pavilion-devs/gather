import React, { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  Mail,
  Send,
  ArrowRight,
  ArrowLeft,
  Plus,
  RefreshCw,
  CheckCheck,
  Link2,
  FileText,
  HelpCircle,
  Clock3,
  ChevronRight,
  Inbox as InboxIcon,
} from "lucide-react";
import { time, evaluatePlan } from "../shared/plan.mjs";
import { emailAddress, RETRY_WINDOW } from "../shared/mail.mjs";
const stateNames = {
  draft: "Draft",
  queued: "Queued to send",
  sending: "Sending",
  sent: "Sent",
  uncertain: "Send status uncertain",
  failed: "Could not send",
};
const stateTones = {
  draft: "neutral",
  queued: "blue",
  sending: "blue",
  sent: "green",
  uncertain: "amber",
  failed: "red",
};
const date = (t) =>
  new Date(t).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function Btn({ primary, children, ...p }) {
  return (
    <button className={"btn " + (primary ? "primary" : "")} {...p}>
      {children}
    </button>
  );
}
function Panel({ title, action, children, className = "" }) {
  return (
    <section className={"panel " + className}>
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Badge({ tone = "neutral", children }) {
  return <span className={"badge " + tone}>{children}</span>;
}
function question(event) {
  const c = evaluatePlan(event),
    lines = [];
  if (c.ready != null && event.arrival != null && c.ready > event.arrival)
    lines.push(
      `Our current delivery completion time is ${time(event.delivery)}. With ${event.setup} minutes of setup afterwards, we would be ready at ${time(c.ready)}, after guests arrive at ${time(event.arrival)}. Can you confirm an earlier delivery completion time?`,
    );
  if (
    c.removed != null &&
    event.accessEnd != null &&
    c.removed > event.accessEnd
  )
    lines.push(
      `Pickup currently starts at ${time(event.pickup)} with ${event.loading} minutes of loading. Our current plan uses ${time(event.accessEnd)} as the equipment-removal deadline. Can you confirm a pickup start time that allows this?`,
    );
  if (event.fee == null)
    lines.push(
      "Please confirm the delivery charge and its currency, or explicitly confirm if delivery is free.",
    );
  if (!lines.length)
    lines.push(
      "Please confirm the agreed delivery and pickup times, and any conditions we still need to resolve.",
    );
  return `Hello,\n\nI’m reviewing the details for ${event.name} on ${event.date} at ${event.venue || "our venue"}. All times below are local ${event.zone}.\n\n${lines.join("\n\n")}\n\nThis is a clarification request, not a booking or acceptance of new charges.\n\nThank you.`;
}
export default function MailView({
  workspace,
  event,
  run,
  busy,
  go,
  selectedMessage,
}) {
  const data = useQuery(api.mail.list, { workspace, id: event._id });
  const connect = useMutation(api.mail.connect),
    sync = useAction(api.mailActions.sync);
  const [selected, setSelected] = useState({ kind: "compose", id: null }),
    [composeKey, setComposeKey] = useState(0),
    [reply, setReply] = useState(null);
  const message = useQuery(
    api.mail.message,
    selected.kind === "message" && selected.id
      ? { workspace, id: event._id, messageId: selected.id }
      : "skip",
  );
  useEffect(() => {
    if (selectedMessage) setSelected({ kind: "message", id: selectedMessage });
  }, [selectedMessage]);
  if (!data)
    return (
      <Panel>
        <div className="loading">
          <span className="spinner" />
          Loading event messages…
        </div>
      </Panel>
    );
  function compose(message = null) {
    setReply(message);
    setComposeKey((k) => k + 1);
    setSelected({ kind: "compose", id: null });
  }
  const draft = data.drafts.find((d) => d._id === selected.id);
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">INBOX & CLARIFICATIONS</div>
          <h2>Supplier messages</h2>
          <p>
            Send clarifications and review replies before updating your plan.
          </p>
        </div>
        <Btn onClick={() => compose()}>
          <Plus size={15} />
          New question
        </Btn>
      </div>
      <div className="mail-connection">
        <span className="soft-icon blue">
          <Mail size={18} />
        </span>
        <div>
          <strong>{data.inbox || "Supplier email"}</strong>
          <small>
            {data.connected
              ? data.lastSync
                ? "Last checked " + date(data.lastSync)
                : "Connected · ready to check replies"
              : data.canSend
                ? "Connect your AgentMail inbox"
                : "No sending inbox connected to this account"}
          </small>
        </div>
        {data.connected ? (
          <Btn
            disabled={busy || data.syncing}
            onClick={() =>
              run(() => sync({ workspace }), "Inbox check complete.")
            }
          >
            <RefreshCw size={14} />
            {data.syncing ? "Checking…" : "Check for replies"}
          </Btn>
        ) : data.canSend ? (
          <Btn
            primary
            disabled={busy || !data.configured}
            onClick={() =>
              run(
                () => connect({ workspace, id: event._id }),
                "Inbox connected to this workspace.",
              )
            }
          >
            <Link2 size={14} />
            Connect inbox
          </Btn>
        ) : null}
      </div>
      {!data.configured && (
        <div className="note amber">
          Your draft can be saved. Configure the AgentMail key to connect the
          inbox.
        </div>
      )}
      {!data.canSend && (
        <div className="note">
          You can draft questions here and add replies in Sources. Sending and
          inbox sync are currently available only in the organizer’s connected
          workspace.
        </div>
      )}
      {data.error && (
        <div className="note amber" role="status">
          <HelpCircle size={16} />
          {data.error}
        </div>
      )}
      <div className="mail-grid">
        <div>
          <Panel
            title="This event"
            action={<Badge>{data.messages.length} replies</Badge>}
          >
            {data.messages.map((m) => (
              <button
                className={
                  "mail-row " + (selected.id === m._id ? "selected" : "")
                }
                key={m._id}
                onClick={() => setSelected({ kind: "message", id: m._id })}
              >
                <span className="soft-icon lilac">
                  <Mail size={16} />
                </span>
                <span>
                  <strong>{m.subject}</strong>
                  <small>
                    {m.from} · {date(m.timestamp)}
                  </small>
                  <em>
                    {m.sourceId
                      ? "Evidence saved"
                      : m.assignment === "thread"
                        ? "Matched to this conversation"
                        : "Attached to this event"}
                  </em>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!data.messages.length && (
              <div className="empty small">
                <InboxIcon />
                <p>No incoming replies attached to this event yet.</p>
                <small>Check the inbox after your supplier responds.</small>
              </div>
            )}
            {event.isDemo && (
              <button
                className="sample-thread-link text-btn"
                onClick={() => go("reply")}
              >
                Open fictional demo reply <ArrowRight size={13} />
              </button>
            )}
          </Panel>
          <Panel
            title="Your questions"
            action={<Badge>{data.drafts.length}</Badge>}
          >
            {data.drafts.map((d) => (
              <button
                className={
                  "mail-row " + (selected.id === d._id ? "selected" : "")
                }
                key={d._id}
                onClick={() => setSelected({ kind: "draft", id: d._id })}
              >
                <span className="soft-icon">
                  <Send size={15} />
                </span>
                <span>
                  <strong>{d.subject}</strong>
                  <small>To {d.to}</small>
                  <Badge tone={stateTones[d.state]}>
                    {stateNames[d.state]}
                  </Badge>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!data.drafts.length && (
              <p className="mail-empty">
                Saved questions and sent messages stay here with their exact
                wording.
              </p>
            )}
          </Panel>
          {data.connected && (
            <Panel
              title="Needs an event"
              action={<Badge>{data.unassigned.length}</Badge>}
            >
              <p className="mail-empty">
                These messages have no confirmed event match. Open one before
                attaching it.
              </p>
              {data.unassigned.map((m) => (
                <button
                  className={
                    "mail-row " + (selected.id === m._id ? "selected" : "")
                  }
                  key={m._id}
                  onClick={() => setSelected({ kind: "message", id: m._id })}
                >
                  <span>
                    <strong>{m.subject}</strong>
                    <small>
                      {m.from} · {date(m.timestamp)}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {data.hasOlder && (
                <Btn
                  disabled={busy || data.syncing}
                  onClick={() =>
                    run(
                      () => sync({ workspace, older: true }),
                      "Older messages checked.",
                    )
                  }
                >
                  <Clock3 size={13} />
                  Load older messages
                </Btn>
              )}
            </Panel>
          )}
        </div>
        <div className="mail-workspace">
          {selected.kind === "compose" ? (
            <Composer
              key={composeKey}
              workspace={workspace}
              event={event}
              run={run}
              busy={busy}
              reply={reply}
              done={(id) => setSelected({ kind: "draft", id })}
            />
          ) : draft ? (
            <DraftReview
              key={draft._id}
              draft={draft}
              event={event}
              workspace={workspace}
              connected={data.connected}
              run={run}
              busy={busy}
              done={(id) => setSelected({ kind: "draft", id })}
            />
          ) : message ? (
            <MessageReview
              message={message}
              event={event}
              workspace={workspace}
              run={run}
              busy={busy}
              go={go}
              reply={() => compose(message)}
            />
          ) : (
            <Panel>
              <p className="mail-empty">
                Choose a conversation or start a question.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
function Composer({ workspace, event, run, busy, reply, draft, done, cancel }) {
  const save = useMutation(api.mail.save);
  const [to, setTo] = useState(draft?.to || emailAddress(reply?.from) || ""),
    [subject, setSubject] = useState(
      draft?.subject ||
        (reply
          ? "Re: " + reply.subject.replace(/^Re:\s*/i, "")
          : `${event.name} — details to confirm`),
    ),
    [text, setText] = useState(draft?.text || event.draft || question(event)),
    [version, setVersion] = useState(draft?.planVersion || event.version),
    [requestId] = useState(crypto.randomUUID());
  const stale = version !== event.version;
  async function persist() {
    let id;
    const ok = await run(async () => {
      id = await save({
        workspace,
        id: event._id,
        to,
        subject,
        text,
        planVersion: version,
        requestId,
        ...(draft
          ? { draftId: draft._id, expectedRevision: draft.revision }
          : {}),
        ...(reply ? { replyMessageId: reply._id } : {}),
      });
    }, "Draft saved. Review the exact email before sending.");
    if (ok) done(id);
  }
  return (
    <Panel
      title={draft ? "Edit your question" : "Clarification draft"}
      action={<Badge>Not sent</Badge>}
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          persist();
        }}
      >
        <div className="form-grid">
          <label className="full">
            To
            <input
              aria-label="Recipient email"
              type="email"
              required
              maxLength={254}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="supplier@example.com"
              readOnly={!!reply || !!draft?.replyTo}
            />
          </label>
          <label className="full">
            Subject
            <input
              aria-label="Email subject"
              readOnly={!!reply || !!draft?.replyTo}
              required
              maxLength={180}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="full">
            Your question
            <textarea
              aria-label="Email message"
              required
              rows={13}
              maxLength={10000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        </div>
        {stale && (
          <div className="note amber">
            <HelpCircle size={15} />
            <div>
              The plan has changed. Check the times and wording above.
              <button
                type="button"
                className="text-btn"
                onClick={() => setVersion(event.version)}
              >
                I’ve checked the current plan
              </button>
            </div>
          </div>
        )}
        <div className="draft-actions">
          <Btn primary disabled={busy || stale}>
            <FileText size={14} />
            Save & review email
          </Btn>
          {cancel && (
            <Btn type="button" onClick={cancel}>
              Cancel edit
            </Btn>
          )}
        </div>
        <p className="footnote">
          Saving does not send. You’ll see the sender, recipient and exact
          message before approving delivery.
        </p>
      </form>
    </Panel>
  );
}
function DraftReview({
  draft: d,
  event,
  workspace,
  connected,
  run,
  busy,
  done,
}) {
  const approve = useMutation(api.mail.approve),
    retry = useMutation(api.mail.retrySend);
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!["sending", "uncertain", "failed"].includes(d.state)) return;
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, [d.state]);
  if (editing && d.state === "draft")
    return (
      <Composer
        key={d.revision}
        draft={d}
        workspace={workspace}
        event={event}
        run={run}
        busy={busy}
        done={(id) => {
          setEditing(false);
          done(id);
        }}
        cancel={() => setEditing(false)}
      />
    );
  const stale = d.planVersion !== event.version,
    expired = now - (d.approvedAt || 0) >= RETRY_WINDOW,
    canRetry =
      ["uncertain", "failed"].includes(d.state) ||
      (d.state === "sending" && now - (d.lastAttempt || 0) > 90000);
  return (
    <Panel
      title={d.state === "draft" ? "Review before sending" : "Message record"}
      action={<Badge tone={stateTones[d.state]}>{stateNames[d.state]}</Badge>}
    >
      <div className="email-addresses">
        <div>
          <span>From</span>
          <strong>favour-7766@agentmail.to</strong>
        </div>
        <div>
          <span>To</span>
          <strong>{d.to}</strong>
        </div>
        <div>
          <span>Subject</span>
          <strong>{d.subject}</strong>
        </div>
      </div>
      <div className="email-paper">{d.text}</div>
      {d.state === "draft" ? (
        <>
          {stale && (
            <div className="note amber">
              <HelpCircle size={15} />
              The plan changed after this draft was saved. Edit and review it
              against the latest facts.
            </div>
          )}
          <div className="draft-actions">
            <Btn
              primary
              disabled={busy || !connected || stale}
              onClick={() =>
                run(
                  () =>
                    approve({
                      workspace,
                      draftId: d._id,
                      expectedRevision: d.revision,
                      expectedVersion: event.version,
                    }),
                  "Approved message queued for sending.",
                )
              }
            >
              <Send size={14} />
              Send this email
            </Btn>
            <Btn disabled={busy} onClick={() => setEditing(true)}>
              Edit draft
            </Btn>
          </div>
          <p className="footnote">
            Sends this exact message to {d.to}. It does not update your event
            facts.
          </p>
          {!connected && (
            <p className="footnote">Connect your inbox above to send.</p>
          )}
        </>
      ) : (
        <>
          <div className={"note " + (d.state === "sent" ? "" : "amber")}>
            <CheckCheck size={15} />
            {d.state === "sent"
              ? "AgentMail accepted this email for sending. Check for replies to continue."
              : d.error ||
                "Your approved message is being sent. Its content is now locked."}
          </div>
          {d.approvedAt && (
            <p className="footnote">
              Approved {date(d.approvedAt)} · plan version {d.planVersion}
            </p>
          )}
          {canRetry && !expired && (
            <Btn
              disabled={busy}
              onClick={() =>
                run(
                  () => retry({ workspace, draftId: d._id }),
                  "The same approved send is queued again.",
                )
              }
            >
              <RefreshCw size={14} />
              Retry same approved email
            </Btn>
          )}
          {canRetry && expired && (
            <p className="footnote">
              The safe retry window has ended. Check AgentMail’s sent inbox
              before composing another message.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
function MessageReview({ message: m, event, workspace, run, busy, go, reply }) {
  const assign = useMutation(api.mail.assign),
    importReply = useMutation(api.mail.importReply);
  async function inspect() {
    let sourceId = m.sourceId;
    if (!sourceId) {
      const ok = await run(async () => {
        sourceId = await importReply({
          workspace,
          id: event._id,
          messageId: m._id,
        });
      }, "Reply saved for fact review. Current plan unchanged.");
      if (!ok) return;
    }
    go("sources/" + sourceId);
  }
  return (
    <Panel
      title="Incoming reply"
      action={
        <Badge tone={m.eventId ? "blue" : "amber"}>
          {m.eventId ? "Ready to inspect" : "Choose an event"}
        </Badge>
      }
    >
      <div className="email-addresses">
        <div>
          <span>From</span>
          <strong>{m.from}</strong>
        </div>
        <div>
          <span>Received</span>
          <strong>{date(m.timestamp)}</strong>
        </div>
        <div>
          <span>Subject</span>
          <strong>{m.subject}</strong>
        </div>
      </div>
      <div className="email-paper">
        {m.extractedText ||
          m.text ||
          "This message has no readable plain text."}
      </div>
      {m.extractedText && m.extractedText !== m.text && (
        <details className="original-email">
          <summary>Original email, including quoted history</summary>
          <div className="email-paper">
            {m.text || "Plain-text original unavailable."}
          </div>
        </details>
      )}
      {m.attachments > 0 && (
        <div className="note amber">
          <FileText size={15} />
          {m.attachments} attachment{m.attachments === 1 ? "" : "s"} not
          imported. Upload relevant files in Sources to include their evidence.
        </div>
      )}
      {m.truncated && (
        <div className="note amber">
          This email exceeds the import limit. Paste its relevant new text in
          Sources for review.
        </div>
      )}
      {m.eventId ? (
        <>
          <div className="draft-actions">
            <Btn
              primary
              disabled={busy || m.truncated || !(m.extractedText || m.text)}
              onClick={inspect}
            >
              <FileText size={14} />
              {m.sourceId ? "Open evidence review" : "Review proposed changes"}
            </Btn>
            <Btn disabled={busy || !emailAddress(m.from)} onClick={reply}>
              <ArrowLeft size={14} />
              Draft a reply
            </Btn>
          </div>
          <p className="footnote">
            Extraction proposes facts only. Your acceptance is required to
            update the plan.
          </p>
        </>
      ) : (
        <>
          <div className="note amber">
            <HelpCircle size={15} />
            No confirmed conversation match. Check the sender and event details
            before attaching this email.
          </div>
          <Btn
            primary
            disabled={busy}
            onClick={() =>
              run(
                () => assign({ workspace, id: event._id, messageId: m._id }),
                "Message attached to this event.",
              )
            }
          >
            <Link2 size={14} />
            Attach to {event.name}
          </Btn>
        </>
      )}
    </Panel>
  );
}
