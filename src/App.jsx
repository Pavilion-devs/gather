import MailView from "./Mail";
import { ShareReport } from "./Public";
import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useConvexConnectionState } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Flag,
  Flower2,
  HelpCircle,
  LayoutGrid,
  Mail,
  MapPin,
  Plus,
  Search,
  Share2,
  Truck,
  Users,
  UtensilsCrossed,
  X,
  RotateCcw,
  Pencil,
  Link2,
  AlertCircle,
  Building2,
} from "lucide-react";
import {
  DEMO,
  PROPOSED,
  SOURCES,
  DEFAULT_DRAFT,
  evaluatePlan,
  time,
  minutes,
} from "../shared/plan.mjs";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./styles.css";
import SourcesView from "./Sources";
import { FIELD_INFO } from "../shared/extraction.mjs";
function getWorkspace() {
  let key = localStorage.getItem("gather-workspace");
  if (!key) {
    key = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem("gather-workspace", key);
  }
  return key;
}
const localWorkspace = getWorkspace();
function go(path) {
  location.hash = path;
  window.scrollTo({ top: 0 });
}
function useRoute() {
  const [route, set] = useState(location.hash.slice(1) || "plan");
  useEffect(() => {
    const f = () => set(location.hash.slice(1) || "plan");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return route === "account" ? "plan" : route;
}
function Btn({ children, onClick, primary = false, className = "", ...props }) {
  return (
    <button
      className={`btn ${primary ? "primary" : ""} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
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
function SourceLink({ id, label }) {
  return (
    <button className="source-link" onClick={() => go("sources/" + id)}>
      <FileText size={12} />
      {label || SOURCES.find((s) => s.key === id)?.label}
      <ArrowUpRight size={11} />
    </button>
  );
}
const dateLabel = (date) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export default function App({
  workspaceId = localWorkspace,
  account = null,
  onSignOut,
}) {
  const workspace = workspaceId;
  const route = useRoute();
  const connection = useConvexConnectionState();
  const [selected, setSelected] = useState(
    localStorage.getItem(`gather-event-${workspace}`) ||
      (!account ? localStorage.getItem("gather-event") : null),
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const list = useQuery(api.events.list, { workspace });
  const init = useMutation(api.events.initialize);
  const freshDemo = useMutation(api.events.freshDemo);
  const accept = useMutation(api.events.accept);
  const flag = useMutation(api.events.flag);
  const edit = useMutation(api.events.editFacts);
  const started = useRef(false);
  useEffect(() => {
    if (list && !started.current) {
      started.current = true;
      if (!list.length && account) go("new");
      else if (!list.length)
        init({ workspace })
          .then((id) => choose(id))
          .catch((e) => setError(e.message));
      else if (!list.some((e) => e._id === selected)) choose(list[0]._id);
    }
  }, [list]);
  const data = useQuery(
    api.events.details,
    selected && list?.some((e) => e._id === selected)
      ? { workspace, id: selected }
      : "skip",
  );
  function choose(id) {
    setSelected(id);
    localStorage.setItem(`gather-event-${workspace}`, id);
  }
  function notify(text) {
    setNotice(text);
  }
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(id);
    }
  }, [notice]);
  async function run(fn, success) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (success) notify(success);
      return true;
    } catch (err) {
      setError(typeof err.data === "string" ? err.data : err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const event = data?.event;
  const checks = event && evaluatePlan(event);
  const args = { workspace, id: selected };
  const isGlobal = ["events", "new", "welcome"].includes(route);
  const activeTab = route.startsWith("issue")
    ? "issues"
    : route.startsWith("sources")
      ? "sources"
      : route === "reply" || route.startsWith("inbox")
        ? "inbox"
        : route;
  return (
    <>
      <header className="top-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => go("welcome")}
            aria-label="Gather home"
          >
            <span className="brand-logo">
              g<span>•</span>
            </span>
            <span className="brand-name">Gather</span>
          </button>
          <nav className="capsule-nav" aria-label="Main navigation">
            {[
              ["plan", LayoutGrid, "Workspace"],
              ["new", Plus, "New event"],
              ["events", CalendarDays, "My events"],
              ["inbox", Mail, "Inbox"],
            ].map(([path, Icon, label]) => (
              <button
                key={path}
                className={`capsule-item ${(path === "plan" && !isGlobal && !(route === "reply" || route.startsWith("inbox"))) || path === route || (path === "inbox" && (route === "reply" || route.startsWith("inbox"))) ? "active" : ""}`}
                aria-label={label}
                onClick={() => go(path)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-btn notification"
              onClick={() => go("activity")}
              aria-label="View recent activity"
            >
              <Bell size={17} />
              {event?.replyStatus === "pending" && <i />}
            </button>
            {account ? (
              <button
                className="text-btn"
                onClick={onSignOut}
                title={account.email}
              >
                Sign out
              </button>
            ) : (
              <button className="text-btn" onClick={() => go("account")}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="page-body">
        {error && (
          <div role="alert" className="error-banner">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        {route === "welcome" ? (
          <Welcome />
        ) : route === "new" ? (
          <NewEvent
            workspace={workspace}
            run={run}
            busy={busy}
            onCreated={(id) => {
              choose(id);
              go("sources");
            }}
          />
        ) : !event && list?.length === 0 ? (
          <Panel title="Your first gathering">
            <div className="empty">
              <p>
                Start with your event details, then bring in your venue rules
                and supplier proposals.
              </p>
              <Btn primary onClick={() => go("new")}>
                Create an event
              </Btn>
            </div>
          </Panel>
        ) : !event ? (
          <Panel>
            <div className="loading">
              <span className="spinner" />
              Opening your workspace…
            </div>
          </Panel>
        ) : (
          <>
            {route === "events" ? (
              <Events
                events={list}
                busy={busy}
                fresh={() =>
                  run(async () => {
                    const id = await freshDemo({ workspace });
                    choose(id);
                    go("plan");
                  })
                }
                choose={(id) => {
                  choose(id);
                  go("plan");
                }}
              />
            ) : (
              <>
                <section className="event-header">
                  <div className="event-title-row">
                    <div className="title-cluster">
                      <button
                        className="icon-btn back"
                        aria-label="Back to my events"
                        onClick={() => go("events")}
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div>
                        <div className="title-line">
                          <h1>{event.name}</h1>
                          {event.isDemo && <Badge>Demo event</Badge>}
                        </div>
                        <div className="event-meta">
                          <span>
                            <CalendarDays />
                            {dateLabel(event.date)}
                          </span>
                          <span>
                            <Clock3 />
                            {time(event.arrival)}
                          </span>
                          <span>
                            <MapPin />
                            {event.venue || "Venue not added"}
                          </span>
                          <span>
                            <Users />
                            {event.guests} guests
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="event-actions">
                      <Badge tone="quiet">
                        <span className="live-dot" />
                        {connection.isWebSocketConnected
                          ? busy
                            ? "Saving…"
                            : account
                              ? "Saved to your account"
                              : "Saved locally"
                          : "Reconnecting…"}
                      </Badge>
                      <Btn onClick={() => go("share")}>
                        <Share2 size={14} />
                        Plan summary
                      </Btn>
                    </div>
                  </div>
                  <nav className="event-subnav" aria-label="Event navigation">
                    {[
                      "plan",
                      "issues",
                      "schedule",
                      "suppliers",
                      "sources",
                      "inbox",
                    ].map((tab) => (
                      <button
                        key={tab}
                        className={`tab ${activeTab === tab ? "active" : ""}`}
                        onClick={() => go(tab)}
                        aria-current={activeTab === tab ? "page" : undefined}
                      >
                        {tab[0].toUpperCase() + tab.slice(1)}
                        {tab === "issues" &&
                          checks.timing + checks.priceQuestions > 0 && (
                            <span className="tab-count">
                              {checks.timing + checks.priceQuestions}
                            </span>
                          )}
                        {tab === "inbox" && event.replyStatus === "pending" && (
                          <span className="tab-dot" />
                        )}
                      </button>
                    ))}
                  </nav>
                </section>
                {route === "plan" && (
                  <Plan
                    event={event}
                    checks={checks}
                    activity={data.activity}
                    sourceCount={(event.isDemo ? 5 : 0) + data.sources.length}
                  />
                )}
                {route === "issues" && (
                  <>
                    <PageTitle
                      eyebrow="PLAN CHECKS"
                      title="A little clarity before you commit."
                      subtitle="Every question is connected to the statements behind it."
                    />
                    <Panel
                      title="Decisions needing attention"
                      action={
                        <Badge>
                          {checks.timing + checks.priceQuestions} open
                        </Badge>
                      }
                    >
                      <Issues event={event} checks={checks} />
                    </Panel>
                  </>
                )}
                {route.startsWith("issue/") && (
                  <Evidence
                    sources={data.sources}
                    event={event}
                    issue={route.split("/")[1]}
                    checks={checks}
                    edit={() => setEditing({ ...event })}
                  />
                )}
                {route === "reply" && (
                  <Reply
                    key={selected}
                    event={event}
                    busy={busy}
                    onAccept={(version) =>
                      run(
                        () => accept({ ...args, expectedVersion: version }),
                        "Schedule updated. One price question remains.",
                      ).then((ok) => {
                        if (ok) go("plan");
                      })
                    }
                    onFlag={() =>
                      run(
                        () =>
                          flag({
                            ...args,
                            flagged: event.replyStatus !== "flagged",
                          }),
                        "Review status saved.",
                      )
                    }
                    edit={() => setEditing({ ...event })}
                  />
                )}
                {route === "schedule" && (
                  <Schedule event={event} checks={checks} />
                )}
                {route === "suppliers" && (
                  <>
                    <PageTitle
                      eyebrow="SUPPLIERS & COSTS"
                      title="Know what’s included."
                      subtitle="Stated amounts and open questions, kept together."
                    />
                    <Suppliers event={event} checks={checks} full />
                  </>
                )}
                {route.startsWith("sources") && (
                  <SourcesView
                    workspace={workspace}
                    go={go}
                    event={event}
                    added={data.sources}
                    selected={route.split("/")[1]}
                    run={run}
                    busy={busy}
                    edit={() => setEditing({ ...event })}
                  />
                )}
                {route.startsWith("inbox") && (
                  <MailView
                    selectedMessage={route.split("/")[1]}
                    key={event._id}
                    workspace={workspace}
                    event={event}
                    run={run}
                    busy={busy}
                    go={go}
                  />
                )}
                {route === "activity" && (
                  <>
                    <PageTitle
                      eyebrow="ACTIVITY"
                      title="Every decision has a history."
                      subtitle="Source updates and your reviews stay attached to this event."
                    />
                    <Activity activity={data.activity} expanded />
                  </>
                )}
                {route === "share" && (
                  <Summary
                    event={event}
                    checks={checks}
                    workspace={workspace}
                  />
                )}
              </>
            )}
          </>
        )}
        <footer className="page-footer">
          <span>Gather · Every detail, together.</span>
          <span>
            {account ? "Your private workspace" : "Local prototype"}
            {!isGlobal && event?.isDemo ? " · Fictional sample sources" : ""}
          </span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {editing && (
        <FactEditor
          event={editing}
          error={error}
          busy={busy}
          close={() => setEditing(null)}
          save={(values) =>
            run(
              () =>
                edit({ ...args, expectedVersion: editing.version, ...values }),
              "Facts saved and checks recalculated.",
            ).then((ok) => {
              if (ok) setEditing(null);
            })
          }
        />
      )}
    </>
  );
}
function PageTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function Metrics({ checks, sourceCount, event }) {
  return (
    <div className="metrics-grid">
      {[
        [
          "Timing conflicts",
          checks.timing,
          Clock3,
          checks.timing
            ? "Needs attention"
            : checks.unknownTiming
              ? "Facts needed"
              : "Within supplied limits",
          checks.timing ? "red" : checks.unknownTiming ? "amber" : "green",
        ],
        [
          "Price questions",
          checks.priceQuestions,
          HelpCircle,
          checks.priceQuestions ? "Delivery not stated" : "Delivery stated",
          "amber",
        ],
        event.isDemo
          ? ["Suppliers", 3, Users, "Working together", "neutral"]
          : [
              "Reviewed facts",
              Object.keys(event.origins || {}).length,
              CheckCheck,
              "Source-linked",
              "neutral",
            ],
        ["Sources", sourceCount, FileText, "Linked to the plan", "neutral"],
      ].map(([label, n, Icon, caption, tone]) => (
        <section className="metric" key={label}>
          <div className="metric-top">
            <span>{label}</span>
            <span className="metric-icon">
              <Icon size={15} />
            </span>
          </div>
          <div className="metric-bottom">
            <strong>{n}</strong>
            <Badge tone={tone}>{caption}</Badge>
          </div>
        </section>
      ))}
    </div>
  );
}
function Plan({ event, checks, activity, sourceCount }) {
  return (
    <>
      <Metrics checks={checks} sourceCount={sourceCount} event={event} />
      {!event.isDemo && !sourceCount && (
        <Panel>
          <div className="empty">
            <FileText />
            <h2>Bring your plan together.</h2>
            <p>
              Add your source text, then review the timing facts to start
              checking this event.
            </p>
            <Btn primary onClick={() => go("sources")}>
              Add sources <Plus size={15} />
            </Btn>
          </div>
        </Panel>
      )}
      {event.replyStatus === "accepted" && (
        <div className="outcome">
          <CheckCheck size={19} />
          <div>
            <strong>Schedule updated. More room to breathe.</strong>
            <p>
              Two timing issues resolved. The delivery charge still needs an
              answer.
            </p>
          </div>
          <Btn onClick={() => go("reply")}>
            View accepted changes <ArrowUpRight size={14} />
          </Btn>
        </div>
      )}
      <div className="workspace-grid">
        <div>
          <Panel
            title="Decisions needing attention"
            action={<Badge>{checks.timing + checks.priceQuestions} open</Badge>}
          >
            <Issues event={event} checks={checks} />
          </Panel>
          <Suppliers event={event} checks={checks} />
        </div>
        <aside>
          {["pending", "flagged"].includes(event.replyStatus) && (
            <Panel className="reply-teaser">
              <div className="reply-teaser-top">
                <span className="soft-icon blue">
                  <Mail size={18} />
                </span>
                <Badge tone="blue">New reply</Badge>
              </div>
              <h2>A better time for everything.</h2>
              <p>
                Juniper proposed new delivery and pickup times. See what changes
                before you accept.
              </p>
              <div className="mini-diff">
                <span>11:30</span>
                <ArrowRight size={14} />
                <strong>10:00</strong>
                <span className="muted">delivery complete</span>
              </div>
              <Btn primary onClick={() => go("reply")}>
                Review reply <ArrowUpRight size={15} />
              </Btn>
            </Panel>
          )}
          <Panel
            title="Your day, at a glance"
            action={
              <button className="text-btn" onClick={() => go("schedule")}>
                View all <ArrowUpRight size={13} />
              </button>
            }
          >
            <Timeline event={event} checks={checks} compact />
          </Panel>
          <Activity activity={activity} />
        </aside>
      </div>
    </>
  );
}
function issueItems(e, c) {
  return [
    c.cateringLate > 0 && {
      id: "catering",
      title: "Catering is ready after guests arrive",
      text: `Delivery at ${time(e.delivery)} + ${e.setup} minutes of setup means ready at ${time(c.ready)}. Guests arrive at ${time(e.arrival)}.`,
      tag: `${c.cateringLate} min late`,
      sources: ["juniper", "olive"],
      tone: "red",
    },
    c.removalLate > 0 && {
      id: "pickup",
      title: "Rental pickup finishes after access ends",
      text: `Pickup at ${time(e.pickup)} + ${e.loading} minutes of loading means equipment leaves at ${time(c.removed)}. Access ends at ${time(e.accessEnd)}.`,
      tag: `${c.removalLate} min late`,
      sources: ["juniper", "venue"],
      tone: "red",
    },
    c.earlyDelivery > 0 && {
      id: "access",
      title: "Delivery completes before access opens",
      text: `Delivery is stated as complete at ${time(e.delivery)}, before access begins at ${time(e.accessStart)}. Clarify access with the venue.`,
      tag: "Access question",
      sources: ["juniper", "venue"],
      tone: "red",
    },
    e.fee === null && {
      id: "price",
      title: "The delivery charge is missing",
      text: e.isDemo
        ? "The $3,450 rental subtotal excludes delivery. The charge has not been stated."
        : "No delivery charge has been entered in the plan.",
      tag: "Price question",
      sources: e.isDemo ? ["juniper"] : [],
      tone: "amber",
    },
  ].filter(Boolean);
}
function Issues({ event, checks }) {
  const items = issueItems(event, checks);
  return (
    <div className="decision-list">
      {checks.unknownTiming && (
        <div className="note">
          <HelpCircle size={16} />
          Timing checks need more facts. Add the missing times in Sources.
        </div>
      )}
      {items.map((item, i) => (
        <article className="decision" key={item.id}>
          <div className="decision-top">
            <span className={`issue-number ${item.tone}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <Badge tone={item.tone}>{item.tag}</Badge>
          </div>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
          <div className="decision-bottom">
            <div className="source-tags">
              {Object.keys(event.origins || {}).length
                ? [
                    ...new Set(
                      (item.id === "price"
                        ? ["fee"]
                        : item.id === "pickup"
                          ? ["pickup", "loading", "accessEnd"]
                          : item.id === "access"
                            ? ["delivery", "accessStart"]
                            : ["delivery", "setup", "arrival"]
                      )
                        .map((f) => event.origins?.[f]?.sourceId)
                        .filter(Boolean),
                    ),
                  ].map((id) => (
                    <SourceLink key={id} id={id} label="Reviewed source" />
                  ))
                : event.isDemo &&
                  item.sources.map((id) => <SourceLink key={id} id={id} />)}
            </div>
            <button className="text-btn" onClick={() => go("issue/" + item.id)}>
              Review evidence <ArrowUpRight size={14} />
            </button>
          </div>
        </article>
      ))}
      {!items.length && !checks.unknownTiming && (
        <div className="empty small">
          <CheckCheck />
          <h3>No open checks in the supplied facts.</h3>
          <p>This covers the timing and delivery charge entered so far.</p>
        </div>
      )}
    </div>
  );
}
function Suppliers({ event, checks, full = false }) {
  if (!event.isDemo)
    return (
      <Panel title="Suppliers">
        <div className="empty small">
          <Users />
          <p>
            {Object.keys(event.origins || {}).length
              ? "Your timing facts are linked to reviewed sources. Supplier totals and booking approvals are not recorded yet."
              : "Add supplier source text to begin building the plan."}
          </p>
          <Btn onClick={() => go("sources")}>Add a source</Btn>
        </div>
      </Panel>
    );
  return (
    <Panel
      title={full ? "Your suppliers" : "Working together"}
      action={
        !full && (
          <button className="text-btn" onClick={() => go("suppliers")}>
            View costs <ArrowUpRight size={13} />
          </button>
        )
      }
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Stated amount</th>
              <th>Plan status</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                Truck,
                "juniper",
                "Juniper Rentals",
                "Furniture",
                "$3,450",
                checks.unknownTiming
                  ? "Facts needed"
                  : checks.timing
                    ? "Timing needs review"
                    : "Times reviewed",
                checks.timing ? "red" : "green",
              ],
              [
                UtensilsCrossed,
                "olive",
                "Olive Kitchen",
                "Catering",
                "$8,200",
                checks.cateringLate === null
                  ? "Setup unknown"
                  : checks.cateringLate
                    ? "Depends on delivery"
                    : "Setup fits",
                "neutral",
              ],
              [
                Flower2,
                "meadow",
                "Meadow Florals",
                "Flowers",
                "$1,850",
                "Approved choice",
                "green",
              ],
            ].map(([Icon, id, name, category, amount, status, tone]) => (
              <tr key={id}>
                <td>
                  <button
                    className="supplier"
                    onClick={() => go("sources/" + id)}
                  >
                    <span
                      className={`soft-icon ${id === "juniper" ? "blue" : id === "olive" ? "lilac" : "pink"}`}
                    >
                      <Icon size={17} />
                    </span>
                    <span>
                      <strong>{name}</strong>
                      <small>{category}</small>
                    </span>
                  </button>
                </td>
                <td>
                  {amount}
                  {id === "juniper" && <small>excludes delivery</small>}
                </td>
                <td>
                  <Badge tone={tone}>{status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="subtotal">
        <div>
          <span>Known supplier subtotal</span>
          <small>Not the final event total</small>
        </div>
        <strong>${(13500 + (event.fee || 0)).toLocaleString("en-US")}</strong>
      </div>
      <div className="note">
        <HelpCircle size={14} />
        {event.fee === null
          ? "Delivery and venue charges remain unknown."
          : `Includes $${event.fee} delivery. Venue charge remains unknown.`}
      </div>
      {full && (
        <div className="followup">
          <div>
            <strong>Before paying a deposit</strong>
            <p>
              Get the missing charges in writing and review any unresolved
              timing questions.
            </p>
          </div>
          <Btn primary onClick={() => go("inbox")}>
            Draft a question <Mail size={14} />
          </Btn>
        </div>
      )}
    </Panel>
  );
}
function Timeline({ event: e, checks: c, compact = false }) {
  const rows = [
    [e.accessStart, "Venue access opens", "venue", false],
    [e.delivery, "Rental delivery complete", "juniper", false],
    [c.ready, "Catering setup ready", "olive", c.cateringLate > 0],
    [e.arrival, "Guests arrive", null, false],
    [e.pickup, "Rental pickup starts", "juniper", false],
    [c.removed, "All equipment removed", "juniper", c.removalLate > 0],
    [e.accessEnd, "Venue access ends", "venue", false],
  ]
    .filter((x) => x[0] !== null)
    .sort((a, b) => a[0] - b[0]);
  return (
    <div className={`timeline ${compact ? "compact" : ""}`}>
      {rows.map(([t, label, source, conflict]) => (
        <div
          className={`timeline-row ${conflict ? "conflict" : ""}`}
          key={label}
        >
          <time>{time(t)}</time>
          <i />
          <div>
            <strong>{label}</strong>
            {!compact && e.isDemo && source && <SourceLink id={source} />}
          </div>
          {conflict && <Badge tone="red">Conflict</Badge>}
        </div>
      ))}
      {!rows.length && <p className="muted">No timing facts added yet.</p>}
    </div>
  );
}
function Activity({ activity, expanded = false }) {
  return (
    <Panel
      title="Recent activity"
      action={
        !expanded && (
          <button
            className="text-btn"
            onClick={() => go("activity")}
            aria-label="View full activity"
          >
            <ArrowUpRight size={15} />
          </button>
        )
      }
    >
      <div className="activity">
        {activity.slice(0, expanded ? 30 : 3).map((a) => (
          <div key={a._id}>
            <span
              className={`activity-dot ${a.kind === "accepted" ? "green" : ""}`}
            />
            <div>
              <p>{a.text}</p>
              {expanded && a.changes && (
                <details className="change-history">
                  <summary>View changed facts</summary>
                  <pre>{a.changes}</pre>
                </details>
              )}
              <small>
                {new Date(a._creationTime).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          </div>
        ))}
        {!activity.length && (
          <p className="muted">Your event history starts here.</p>
        )}
      </div>
    </Panel>
  );
}
function Evidence({ event: e, issue, checks: c, edit, sources = [] }) {
  const price = issue === "price",
    pickup = issue === "pickup",
    access = issue === "access";
  const item = issueItems(e, c).find((i) => i.id === issue);
  const citedFields = (
    price
      ? ["fee"]
      : pickup
        ? ["pickup", "loading", "accessEnd"]
        : access
          ? ["delivery", "accessStart"]
          : ["delivery", "setup", "arrival"]
  ).filter((field) => e.origins?.[field]);
  return (
    <>
      <button className="text-btn breadcrumb" onClick={() => go("issues")}>
        <ArrowLeft size={14} />
        All plan checks
      </button>
      <PageTitle
        eyebrow={price ? "OPEN PRICE QUESTION" : "TIMING CHECK"}
        title={item?.title || "This timing check is resolved."}
        subtitle="Follow the source. Understand the consequence. Decide what changes."
        action={
          <Badge tone={item?.tone || "green"}>{item?.tag || "Resolved"}</Badge>
        }
      />
      <div className="evidence-grid">
        <div>
          <Panel
            title="The statements behind this check"
            action={
              <Badge>
                {citedFields.length
                  ? "Reviewed sources"
                  : e.isDemo
                    ? "Sample sources"
                    : "Manual facts"}
              </Badge>
            }
          >
            {e.isDemo && !citedFields.length ? (
              (price
                ? ["juniper"]
                : pickup || access
                  ? ["juniper", "venue"]
                  : ["juniper", "olive"]
              ).map((id) => (
                <div className="evidence-source" key={id}>
                  <div className="source-heading">
                    <span className="soft-icon">
                      <FileText size={17} />
                    </span>
                    <div>
                      <h3>{SOURCES.find((s) => s.key === id).name}</h3>
                      <small>{SOURCES.find((s) => s.key === id).kind}</small>
                    </div>
                    <SourceLink id={id} label="Open source" />
                  </div>
                  <blockquote>
                    {SOURCES.find((s) => s.key === id)
                      .text.split(/(11:30|23:30|90 minutes|23:00|not stated)/)
                      .map((str, i) =>
                        /^(11:30|23:30|90 minutes|23:00|not stated)$/.test(
                          str,
                        ) ? (
                          <mark key={i}>{str}</mark>
                        ) : (
                          str
                        ),
                      )}
                  </blockquote>
                </div>
              ))
            ) : (
              <>
                {citedFields.map((field) => (
                  <div className="evidence-source" key={field}>
                    <div className="source-heading">
                      <span className="soft-icon">
                        <FileText size={17} />
                      </span>
                      <div>
                        <h3>{FIELD_INFO[field].label}</h3>
                        <small>
                          {sources.find(
                            (s) => s._id === e.origins[field].sourceId,
                          )?.name || "Reviewed source"}
                        </small>
                      </div>
                      <SourceLink
                        id={e.origins[field].sourceId}
                        label="Open source"
                      />
                    </div>
                    <blockquote>{e.origins[field].quote}</blockquote>
                  </div>
                ))}
                {!citedFields.length && (
                  <p className="muted">
                    No accepted source-linked value for this check yet. Review
                    your source documents before confirming it.
                  </p>
                )}
              </>
            )}
            <div className="note">
              Original source wording stays intact when you correct a fact.
              {e.replyStatus === "stale" &&
                " Current facts include reviewed changes; see Activity for their history."}
            </div>
          </Panel>
          <Panel title="What this affects">
            <div className="impact">
              <span className="soft-icon lilac">
                {price ? (
                  <HelpCircle />
                ) : pickup ? (
                  <Building2 />
                ) : (
                  <UtensilsCrossed />
                )}
              </span>
              <div>
                <h3>
                  {price
                    ? "Your known event cost"
                    : pickup
                      ? "Venue access and rental removal"
                      : "Catering and guest arrival"}
                </h3>
                <p>
                  {price
                    ? "A missing charge cannot be treated as zero."
                    : pickup
                      ? "Loading needs to finish within the venue’s stated access window."
                      : `Setup needs to be complete before ${e.guests} guests arrive.`}
                </p>
              </div>
            </div>
            {e.floristApproved && (
              <div className="unaffected">
                <Check size={15} />
                Meadow Florals approval is unaffected.
              </div>
            )}
          </Panel>
        </div>
        <aside>
          <Panel
            title={price ? "What’s still missing" : "How the times add up"}
          >
            {price ? (
              <>
                <div className="calculation-row">
                  <span>Delivery charge</span>
                  <strong>Not stated</strong>
                </div>
                <p className="muted">
                  Neither the proposal nor revision 3 gives a delivery amount.
                </p>
              </>
            ) : (
              <>
                <div className="calculation-row">
                  <span>
                    {pickup
                      ? "Pickup starts"
                      : access
                        ? "Delivery complete"
                        : "Delivery complete"}
                  </span>
                  <strong>{time(pickup ? e.pickup : e.delivery)}</strong>
                </div>
                {!access && (
                  <div className="calculation-row">
                    <span>
                      {pickup ? "Loading duration" : "Catering setup"}
                    </span>
                    <strong>+ {pickup ? e.loading : e.setup} min</strong>
                  </div>
                )}
                <div className="calculation-row">
                  <span>
                    {pickup
                      ? "Equipment removed"
                      : access
                        ? "Access opens"
                        : "Setup ready"}
                  </span>
                  <strong>
                    {time(
                      pickup ? c.removed : access ? e.accessStart : c.ready,
                    )}
                  </strong>
                </div>
                <div className="calculation-result">
                  <span>
                    {pickup
                      ? "Venue deadline"
                      : access
                        ? "Access starts"
                        : "Guests arrive"}
                  </span>
                  <strong>
                    {time(
                      pickup ? e.accessEnd : access ? e.accessStart : e.arrival,
                    )}
                  </strong>
                </div>
              </>
            )}
            {e.replyStatus === "pending" && !price && (
              <div className="proposal-note">
                <Mail size={16} />
                <div>
                  <strong>A proposed fix is waiting.</strong>
                  <p>
                    Juniper’s revision 3 changes delivery and pickup. Review
                    both changes together.
                  </p>
                </div>
              </div>
            )}
            <div className="stack-actions">
              <Btn
                primary
                onClick={() =>
                  go(price || e.replyStatus === "none" ? "inbox" : "reply")
                }
              >
                {price || e.replyStatus === "none"
                  ? "Draft a question"
                  : "Review revision 3"}
                <ArrowRight size={15} />
              </Btn>
              <Btn onClick={edit}>
                <Pencil size={14} />
                Edit current facts
              </Btn>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
function Reply({ event: e, busy, onAccept, onFlag, edit }) {
  const [baseline] = useState(e.version);
  if (!e.isDemo || e.replyStatus === "none")
    return (
      <Panel>
        <div className="empty">
          <Mail />
          <h2>No reply to review yet.</h2>
          <p>New source text can be added from Sources.</p>
        </div>
      </Panel>
    );
  const after = evaluatePlan({ ...DEMO, ...PROPOSED });
  const accepted = e.replyStatus === "accepted";
  const stale =
    e.replyStatus === "stale" || (!accepted && e.version !== baseline);
  return (
    <>
      <button className="text-btn breadcrumb" onClick={() => go("inbox")}>
        <ArrowLeft size={14} />
        Back to inbox
      </button>
      <PageTitle
        eyebrow="REPLY REVIEW · REVISION 3"
        title={
          accepted
            ? "A reviewed change. A clearer plan."
            : "New times. See the whole picture."
        }
        subtitle="Juniper Rentals · Community Dinner"
        action={
          <Badge tone={accepted ? "green" : stale ? "red" : "blue"}>
            {accepted
              ? "Accepted"
              : stale
                ? "Needs fresh review"
                : e.replyStatus === "flagged"
                  ? "Flagged for review"
                  : "Awaiting your review"}
          </Badge>
        }
      />
      <div className="evidence-grid">
        <div>
          <Panel
            title="What Juniper said"
            action={<SourceLink id="reply" label="View source" />}
          >
            <blockquote className="reply-quote">
              “We can complete delivery by <mark>10:00</mark> and start pickup
              at <mark>22:15</mark>. Loading takes 30 minutes.”
            </blockquote>
            <p className="muted">
              Sample reply · The delivery charge is not addressed.
            </p>
          </Panel>
          <Panel title="Two times change. The rest stays visible.">
            <div className="comparison-head">
              <span>Timing fact</span>
              <span>Revision 2</span>
              <span>Revision 3</span>
            </div>
            {[
              ["Delivery complete", "11:30", "10:00"],
              ["Pickup starts", "23:30", "22:15"],
              ["Loading duration", "30 min", "30 min"],
              ["Delivery charge", "Not stated", "Not stated"],
            ].map(([label, before, after]) => (
              <div className="comparison-row" key={label}>
                <strong>{label}</strong>
                <span className="old-value">{before}</span>
                <span
                  className={
                    after === "Not stated" ? "warning-value" : "new-value"
                  }
                >
                  {before !== after && <ArrowRight size={14} />} {after}
                </span>
              </div>
            ))}
          </Panel>
          <Panel
            title={
              stale
                ? "Original revision impact"
                : accepted
                  ? "What changed"
                  : "What accepting would change"
            }
          >
            {stale && (
              <div className="note amber">
                These results describe revision 3 against the original demo
                facts. Current facts changed; check the current plan before
                making another correction.
              </div>
            )}
            <div className="result-row">
              <span className="soft-icon green">
                <UtensilsCrossed size={18} />
              </span>
              <div>
                <h3>Catering ready by {time(after.ready)}</h3>
                <p>
                  {DEMO.arrival - after.ready} minutes before the original guest
                  arrival time.
                </p>
              </div>
              <Badge tone="green">
                {stale ? "Original check" : accepted ? "Resolved" : "Resolves"}
              </Badge>
            </div>
            <div className="result-row">
              <span className="soft-icon green">
                <Truck size={18} />
              </span>
              <div>
                <h3>Equipment removed by {time(after.removed)}</h3>
                <p>
                  {DEMO.accessEnd - after.removed} minutes before the original
                  access deadline.
                </p>
              </div>
              <Badge tone="green">
                {stale ? "Original check" : accepted ? "Resolved" : "Resolves"}
              </Badge>
            </div>
            <div className="result-row">
              <span className="soft-icon pink">
                <Flower2 size={18} />
              </span>
              <div>
                <h3>Meadow Florals stays approved</h3>
                <p>This choice is independent of the rental timing.</p>
              </div>
              <Badge>Unchanged</Badge>
            </div>
          </Panel>
        </div>
        <aside>
          <Panel title={accepted ? "Internal plan updated" : "Your review"}>
            <div className="review-summary">
              <strong>{stale ? "—" : "2"}</strong>
              <span>
                {stale
                  ? "Current facts need a new review"
                  : accepted
                    ? "timing issues resolved"
                    : "timing issues can be resolved"}
              </span>
            </div>
            <div className="note amber">
              <HelpCircle size={17} />
              <div>
                <strong>
                  {e.fee === null
                    ? "One price question remains."
                    : "Delivery charge recorded."}
                </strong>
                <p>
                  {e.fee === null
                    ? "The delivery charge is still missing."
                    : "The current plan has a reviewed delivery amount."}
                </p>
              </div>
            </div>
            <p className="review-disclaimer">
              Accepting updates your internal plan. It does not send a message
              or commit you to a supplier.
            </p>
            {stale && (
              <div className="note red">
                Current facts changed after this reply. Review and correct the
                current facts before applying another revision.
              </div>
            )}
            <div className="stack-actions reply-actions">
              {accepted ? (
                <Btn primary onClick={() => go("plan")}>
                  <CheckCheck size={16} />
                  View updated plan
                </Btn>
              ) : (
                <>
                  <Btn
                    primary
                    disabled={busy || stale || e.replyStatus === "flagged"}
                    onClick={() => onAccept(baseline)}
                  >
                    <Check size={16} />
                    {busy ? "Saving…" : "Accept changes"}
                  </Btn>
                  <Btn onClick={edit}>
                    <Pencil size={14} />
                    Edit current facts
                  </Btn>
                  {!stale && (
                    <Btn disabled={busy} onClick={onFlag}>
                      <Flag size={14} />
                      {e.replyStatus === "flagged"
                        ? "Clear review flag"
                        : "Flag for review"}
                    </Btn>
                  )}
                </>
              )}
              <button className="text-btn centered" onClick={() => go("inbox")}>
                Draft a question about the charge <ArrowUpRight size={14} />
              </button>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
function Schedule({ event, checks }) {
  const [compare, setCompare] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="SCHEDULE"
        title="One day. Everything connected."
        subtitle={`All times in ${event.zone.replace("_", " ")}. Duration calculations follow the supplied facts.`}
        action={
          event.replyStatus === "pending" && (
            <Btn onClick={() => setCompare(!compare)}>
              {compare ? "Show current plan" : "Compare proposed times"}
            </Btn>
          )
        }
      />
      <div className="evidence-grid">
        <Panel
          title="Current plan"
          action={<Badge>Version {event.version}</Badge>}
        >
          <Timeline event={event} checks={checks} />
        </Panel>
        <Panel
          title={
            compare ? "If revision 3 is accepted" : "The important boundaries"
          }
        >
          {compare ? (
            <>
              <Timeline
                event={{ ...event, ...PROPOSED }}
                checks={evaluatePlan({ ...event, ...PROPOSED })}
              />
              <Btn primary onClick={() => go("reply")}>
                Review proposed changes <ArrowRight size={14} />
              </Btn>
            </>
          ) : (
            <>
              <div className="boundary">
                <Building2 />
                <div>
                  <small>Venue access</small>
                  <h3>
                    {time(event.accessStart)} — {time(event.accessEnd)}
                  </h3>
                </div>
              </div>
              <div className="boundary">
                <Users />
                <div>
                  <small>Guests arrive</small>
                  <h3>{time(event.arrival)}</h3>
                </div>
              </div>
              <div className="boundary">
                <UtensilsCrossed />
                <div>
                  <small>Setup after rental delivery</small>
                  <h3>{event.setup ?? "Unknown"} minutes</h3>
                </div>
              </div>
              <div className="note">
                Delivery completion is a milestone. The delivery start time has
                not been supplied.
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
function Summary({ event: e, checks: c, workspace }) {
  function download() {
    const text = `${e.name}\n${dateLabel(e.date)} · ${e.venue} · ${e.guests} guests\nTimezone: ${e.zone}\n\nCURRENT PLAN (version ${e.version})\nDelivery complete: ${time(e.delivery)}\nCatering ready: ${time(c.ready)}\nGuests arrive: ${time(e.arrival)}\nPickup starts: ${time(e.pickup)}\nEquipment removed: ${time(c.removed)}\nVenue access: ${time(e.accessStart)}–${time(e.accessEnd)}\n\nOPEN QUESTIONS\n${issueItems(
      e,
      c,
    )
      .map((i) => "- " + i.title + ": " + i.text)
      .join(
        "\n",
      )}\n${c.unknownTiming ? "Timing checks incomplete: more facts needed." : ""}\n${e.isDemo ? "\nDemo event: fictional sources. Known supplier subtotal $" + (13500 + (e.fee || 0)) + ". Venue cost unknown." : ""}\n\nThis summary reflects supplied facts and internal review. It does not make supplier commitments.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gather-plan-summary.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageTitle
        eyebrow="PLAN SUMMARY"
        title="The same picture, for everyone."
        subtitle="Download a snapshot of the current plan with its open questions."
        action={
          <Btn primary onClick={download}>
            <Download size={15} />
            Download summary
          </Btn>
        }
      />
      <div className="evidence-grid">
        <Panel title={e.name}>
          <Timeline event={e} checks={c} />
        </Panel>
        <Panel title="Still needs an answer">
          <Issues event={e} checks={c} />
          <div className="note">
            Download a private summary, or review and create a read-only link
            below.
          </div>
        </Panel>
      </div>
      <ShareReport workspace={workspace} event={e} />
    </>
  );
}
function Events({ events, choose, fresh, busy }) {
  const [search, setSearch] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORKSPACE"
        title="Good plans start here."
        subtitle="Bring the details together, before you bring everyone together."
        action={
          <Btn primary onClick={() => go("new")}>
            <Plus size={16} />
            New event
          </Btn>
        }
      />
      <div className="events-tools">
        <Btn onClick={fresh} disabled={busy}>
          <RotateCcw size={14} />
          Try a fresh demo
        </Btn>
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Search events"
            placeholder="Search your events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="event-grid">
        {events
          .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
          .map((e) => (
            <button
              className="event-card"
              onClick={() => choose(e._id)}
              key={e._id}
            >
              <div className="event-art">
                <span className="event-orbit" />
                <span className="event-orbit second" />
                <span className="event-art-icon">
                  <UtensilsCrossed size={28} />
                </span>
                <Badge>{e.isDemo ? "Demo event" : "Your event"}</Badge>
              </div>
              <div className="event-card-body">
                <small>{dateLabel(e.date)}</small>
                <h2>{e.name}</h2>
                <p>
                  {e.venue || "Venue to be added"} · {e.guests} guests
                </p>
                <div>
                  <Badge tone="amber">
                    {evaluatePlan(e).timing + evaluatePlan(e).priceQuestions}{" "}
                    open questions
                  </Badge>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </button>
          ))}
      </div>
      {!events.some((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
      ) && <p>No matching events.</p>}
    </>
  );
}
function NewEvent({ workspace, run, busy, onCreated }) {
  const create = useMutation(api.events.create);
  return (
    <div className="narrow">
      <button className="text-btn breadcrumb" onClick={() => go("events")}>
        <ArrowLeft size={14} />
        My events
      </button>
      <PageTitle
        eyebrow="A NEW GATHERING"
        title="Let’s make the details work."
        subtitle="Start with the basics. Bring your venue rules and supplier proposals next."
      />
      <Panel title="Tell us about your event">
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            let id;
            const ok = await run(async () => {
              id = await create({
                workspace,
                name: f.get("name"),
                date: f.get("date"),
                venue: f.get("venue"),
                guests: Number(f.get("guests")),
                zone: f.get("zone"),
              });
            });
            if (ok) onCreated(id);
          }}
        >
          <div className="form-grid">
            <label className="full">
              Event name
              <input
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Our team’s end-of-year dinner"
              />
            </label>
            <label>
              Event date
              <input type="date" name="date" required />
            </label>
            <label>
              Guests
              <input
                type="number"
                min="1"
                max="100000"
                name="guests"
                required
                placeholder="120"
              />
            </label>
            <label className="full">
              Venue
              <input
                name="venue"
                maxLength={150}
                placeholder="Venue name, if you have one"
              />
            </label>
          </div>
          <label className="zone-field">
            Event time zone
            <select name="zone" defaultValue="Africa/Lagos">
              <option>Africa/Lagos</option>
              <option>Europe/London</option>
              <option>America/New_York</option>
              <option>America/Los_Angeles</option>
              <option>Asia/Singapore</option>
              <option>Australia/Sydney</option>
              <option>UTC</option>
            </select>
          </label>
          <div className="note">
            Use local clock times for this event. Timing facts start empty until
            you review them. This version checks same-day schedules.
          </div>
          <div className="form-footer">
            <span>One venue. All the moving parts.</span>
            <Btn primary disabled={busy}>
              Create event <ArrowRight size={15} />
            </Btn>
          </div>
        </form>
      </Panel>
    </div>
  );
}
function Welcome() {
  return (
    <section className="welcome">
      <Badge>For the moments worth getting right</Badge>
      <h1>
        Great gatherings.
        <br />
        <span>Fewer surprises.</span>
      </h1>
      <p>
        Make sure your venue, suppliers and schedule work together. Before you
        commit.
      </p>
      <div className="welcome-actions">
        <Btn primary onClick={() => go("plan")}>
          Explore the demo <ArrowRight size={16} />
        </Btn>
        <Btn onClick={() => go("new")}>
          Plan your event <Plus size={15} />
        </Btn>
      </div>
      <div className="welcome-preview">
        <div className="preview-dot-row">
          <i />
          <i />
          <i />
          <span>COMMUNITY DINNER · PLAN CHECK</span>
        </div>
        <div className="welcome-flow">
          <span>
            <Truck />
            Delivery complete<strong>11:30</strong>
          </span>
          <ArrowRight />
          <span>
            <UtensilsCrossed />
            90-minute setup<strong>13:00</strong>
          </span>
          <ArrowRight />
          <span className="rose">
            <Users />
            Guests arrive<strong>12:00</strong>
          </span>
        </div>
        <div className="welcome-insight">
          <AlertCircle size={18} />
          One proposal looks fine. Together, the times don’t work.
        </div>
      </div>
      <div className="welcome-points">
        <span>
          <FileText />
          Keep the evidence
        </span>
        <span>
          <Clock3 />
          See the dependencies
        </span>
        <span>
          <CheckCheck />
          Review every change
        </span>
      </div>
    </section>
  );
}
function FactEditor({ event: e, error, busy, close, save }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  const fields = [
    ["delivery", "Delivery complete", "time"],
    ["pickup", "Pickup starts", "time"],
    ["arrival", "Guest arrival", "time"],
    ["accessStart", "Venue access opens", "time"],
    ["accessEnd", "Equipment removed by", "time"],
    ["setup", "Catering setup (minutes)", "number"],
    ["loading", "Loading duration (minutes)", "number"],
    ["fee", "Delivery charge (USD)", "number"],
  ];
  const [localError, setLocalError] = useState("");
  return (
    <dialog ref={dialog} onCancel={close} className="modal">
      <div className="modal-head">
        <div>
          <div className="eyebrow">REVIEWED CORRECTION</div>
          <h2>Edit current facts</h2>
        </div>
        <button
          className="icon-btn"
          onClick={close}
          aria-label="Close fact editor"
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted">
        Leave unknown values empty. Add where the correction came from; original
        sources remain unchanged.
      </p>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          try {
            const f = new FormData(ev.currentTarget);
            const facts = Object.fromEntries(
              fields.map(([k, , type]) => [
                k,
                f.get(k) === ""
                  ? null
                  : type === "time"
                    ? minutes(f.get(k))
                    : Number(f.get(k)),
              ]),
            );
            save({ facts, reason: f.get("reason") });
          } catch (err) {
            setLocalError(err.message);
          }
        }}
      >
        <div className="form-grid">
          {fields.map(([key, label, type]) => (
            <label key={key}>
              {label}
              <input
                type={type}
                name={key}
                min="0"
                step={key === "fee" ? "0.01" : undefined}
                defaultValue={
                  e[key] === null
                    ? ""
                    : type === "time"
                      ? time(e[key]).slice(0, 5)
                      : e[key]
                }
              />
            </label>
          ))}
          <label className="full">
            Source or reason for correction
            <textarea
              name="reason"
              required
              maxLength={1000}
              rows={2}
              placeholder="e.g. Venue email confirms access begins at 08:30"
            />
          </label>
        </div>
        {(localError || error) && (
          <p role="alert" className="red-text">
            {localError || error}
          </p>
        )}
        <div className="form-footer">
          <Btn onClick={close} type="button">
            Cancel
          </Btn>
          <Btn primary disabled={busy}>
            {busy ? "Saving…" : "Save reviewed facts"}
          </Btn>
        </div>
      </form>
    </dialog>
  );
}
