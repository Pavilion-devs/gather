import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FileText,
  Link2,
  ShieldCheck,
  Mail,
  X,
  ChevronRight,
} from "lucide-react";
import { FIELD_INFO } from "../shared/extraction.mjs";
import { time } from "../shared/plan.mjs";
const dateTime = (n) =>
  new Date(n).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const value = (k, v) =>
  v == null
    ? "Not stated"
    : k === "fee"
      ? `$${v}`
      : ["setup", "loading"].includes(k)
        ? `${v} min`
        : time(v);
export function Brand() {
  return (
    <a href="#welcome" className="brand">
      <span className="brand-logo">
        g<span>•</span>
      </span>
      <span className="brand-name">Gather</span>
    </a>
  );
}
function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <a className="btn" href="#account">
        My workspace <ArrowUpRight size={14} />
      </a>
    </header>
  );
}
export function PublicPage({ route }) {
  const token = route.startsWith("#report/") ? route.slice(8) : null;
  const report = useQuery(api.reports.read, token ? { token } : "skip");
  return (
    <div className="public-shell">
      <PublicHeader />
      {token ? (
        report === undefined ? (
          <div className="loading">Opening the shared report…</div>
        ) : report === null ? (
          <section className="public-empty panel">
            <h1>This report is unavailable.</h1>
            <p>The owner may have revoked the link.</p>
            <a href="#welcome" className="btn">
              Back to Gather
            </a>
          </section>
        ) : (
          <ReportBody report={report} />
        )
      ) : (
        <Landing />
      )}
      <footer className="public-footer">
        <Brand />
        <span>Every detail, together.</span>
        <a href="#account">
          Start a gathering <ArrowRight size={14} />
        </a>
      </footer>
    </div>
  );
}
function Landing() {
  const example = useQuery(api.reports.example, {});
  const [videoError, setVideoError] = useState(false);
  return (
    <main className="landing">
      <section className="landing-hero">
        <span className="badge">FOR THE MOMENTS WORTH GETTING RIGHT</span>
        <h1>
          Catch the timing clashes in your event plan.
          <span className="hero-outcome">Before you pay deposits.</span>
        </h1>
        <p>
          Gather checks your venue rules, supplier proposals and event schedule together.
          Spot late deliveries and impossible pickup times, ask suppliers for clarification,
          and review their replies before updating your plan.
        </p>
        <div className="welcome-actions">
          <a className="btn primary" href="#new">
            Check my event <ArrowRight size={16} />
          </a>
        </div>
        <small>
          For dinners, launches, team events—and the people bringing them
          together.
        </small>
      </section>
      <section className="landing-demo" aria-label="Gather product walkthrough">
        <div className="demo-frame">
          <video
            className="hero-video"
            aria-label="Gather in 28 seconds: find conflicts, clarify by email, review changes and update the plan"
            aria-describedby="demo-description"
            src="/media/gather-in-action-v1.mp4"
            poster="/media/gather-in-action-v1.webp"
            preload="auto"
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            onError={() => setVideoError(true)}
          >
            Your browser does not support embedded video.
          </video>
          {videoError && <p className="demo-video-error">The video couldn’t load. <a href="/media/gather-in-action-v1.mp4">Open the clip</a> or view the evidence below.</p>}
        </div>
        <div className="demo-caption">
          <div>
            <h2>One reply. A plan that fits.</h2>
            <p id="demo-description">Find two timing conflicts, send a clarification, then review and accept the reply to resolve them.</p>
          </div>
          {example && <a className="text-btn" href={`#report/${example.token}`}>View the evidence <ArrowUpRight size={15} /></a>}
        </div>
        <p className="demo-disclosure">Illustrative event and supplier. Recorded in Gather with real email between owned inboxes. Waiting time shortened.</p>
      </section>
      <section className="landing-how">
        <div>
          <p className="eyebrow">A LITTLE CLARITY, BEFORE YOU COMMIT</p>
          <h2>
            From scattered details
            <br />
            to a plan you can explain.
          </h2>
        </div>
        <div className="landing-steps">
          {[
            [
              FileText,
              "01",
              "Bring the details together",
              "Import a venue page, upload a document or paste a supplier proposal.",
            ],
            [
              Clock3,
              "02",
              "See what doesn’t fit",
              "Compare delivery, setup, guest arrival and collection against the venue’s access times.",
            ],
            [
              Check,
              "03",
              "Close the loop",
              "Clarify the issue, review the reply and accept the changes. Keep the evidence attached.",
            ],
          ].map(([Icon, n, title, copy]) => (
            <article key={n}>
              <span className="step-icon">
                <Icon size={19} />
              </span>
              <div>
                <small>{n}</small>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-note">
        <ShieldCheck size={21} />
        <div>
          <h3>You make the call. Gather keeps the evidence.</h3>
          <p>
            Unknown details stay unknown. Every proposed change needs your
            review. Timing checks and delivery charges are supported today;
            Gather does not book suppliers or assess every contract term.
            Connected email is currently available in the organizer’s
            demonstration workspace.
          </p>
        </div>
      </section>
      <section className="landing-bottom">
        <h2>
          Bring everyone together.
          <br />
          <span>Get the details together first.</span>
        </h2>
        <a className="btn primary" href="#new">
          Check my event <ArrowRight size={16} />
        </a>
      </section>
    </main>
  );
}
export function ReportBody({ report: r, preview = false }) {
  const [index, setIndex] = useState(r.steps.length - 1);
  useEffect(() => setIndex(r.steps.length - 1), [r.version, r.steps.length]);
  const step = r.steps[index] || r.steps.at(-1),
    c = step.checks;
  const baseline =
    r.steps.find((s) => s.checks.timing > 0 && !s.checks.unknownTiming) ||
    r.steps.find((s) => s.checks.timing > 0);
  const latest = r.steps.at(-1);
  return (
    <main className="case-report">
      <div className="report-heading">
        <p className="eyebrow">
          {preview ? "SHARING PREVIEW" : "SHARED CASE REPORT · READ ONLY"}
        </p>
        <h1>{r.name}</h1>
        <p>
          {r.date} · {r.venue} · {r.guests} guests · {r.zone}
        </p>
        <small>
          Snapshot of version {r.version} · Saved {dateTime(r.capturedAt)}.
          Later edits are not included.
        </small>
      </div>
      {r.disclosure && (
        <div className="report-disclosure">
          <ShieldCheck size={18} />
          <p>{r.disclosure}</p>
        </div>
      )}
      <div className="report-metrics">
        <div>
          <small>Timing conflicts</small>
          <strong>
            {baseline ? `${baseline.checks.timing} → ` : ""}
            {latest.checks.timing}
          </strong>
          <span>
            {latest.checks.unknownTiming
              ? "Checks incomplete"
              : "From reviewed facts"}
          </span>
        </div>
        <div>
          <small>Delivery charge questions</small>
          <strong>{latest.checks.priceQuestions}</strong>
          <span>Other costs are outside this check</span>
        </div>
        <div>
          <small>Email recorded in this run</small>
          <strong>
            {r.mail.sent} sent · {r.mail.received} received
          </strong>
          <span>Contact details and full messages omitted</span>
        </div>
      </div>
      <div className="report-grid">
        <aside className="panel report-versions">
          <div className="panel-head">
            <h2>Decision history</h2>
          </div>
          {r.steps.map((s, i) => (
            <button
              key={s.version}
              className={i === index ? "selected" : ""}
              onClick={() => setIndex(i)}
            >
              <span>
                Version {s.version}
                <small>{s.kind}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!r.historyComplete && (
            <p className="note">
              Earlier versions were not captured. This report does not
              reconstruct them.
            </p>
          )}
          {r.truncated && (
            <p className="note">
              The first 50 recorded versions and the current plan are shown.
            </p>
          )}
        </aside>
        <section className="report-detail">
          <div className="panel">
            <div className="panel-head">
              <h2>Version {step.version} · The timing check</h2>
              <span className={`badge ${c.timing ? "rose" : "quiet"}`}>
                {c.timing} conflicts{c.unknownTiming ? " · incomplete" : ""}
              </span>
            </div>
            <div className="report-calculations">
              <p>
                <span>Ready for guests</span>
                <strong>
                  {time(step.facts.delivery)} +{" "}
                  {value("setup", step.facts.setup)} = {time(c.ready)}
                </strong>
                <small>
                  Guests arrive {time(step.facts.arrival)}
                  {c.cateringLate != null
                    ? ` · ${c.cateringLate ? `${c.cateringLate} min late` : "Fits"}`
                    : " · Needs confirmation"}
                </small>
              </p>
              <p>
                <span>Equipment removed</span>
                <strong>
                  {time(step.facts.pickup)} +{" "}
                  {value("loading", step.facts.loading)} = {time(c.removed)}
                </strong>
                <small>
                  Venue deadline {time(step.facts.accessEnd)}
                  {c.removalLate != null
                    ? ` · ${c.removalLate ? `${c.removalLate} min late` : "Fits"}`
                    : " · Needs confirmation"}
                </small>
              </p>
              <p>
                <span>Delivery access</span>
                <strong>
                  {time(step.facts.delivery)} ≥ {time(step.facts.accessStart)}
                </strong>
                <small>
                  {c.earlyDelivery == null
                    ? "Needs confirmation"
                    : c.earlyDelivery
                      ? `${c.earlyDelivery} min before access opens`
                      : "Fits the stated access time"}
                </small>
              </p>
            </div>
          </div>
          <div className="panel report-evidence">
            <div className="panel-head">
              <h2>The statements behind the numbers</h2>
            </div>
            {Object.entries(FIELD_INFO).map(([k, info]) => {
              const cite = step.evidence.find((e) => e.field === k);
              return (
                <article key={k}>
                  <div className="fact-heading">
                    <h3>{info.label}</h3>
                    <strong>{value(k, step.facts[k])}</strong>
                  </div>
                  {cite ? (
                    <>
                      <blockquote>“{cite.quote}”</blockquote>
                      <p className="review-origin">
                        {cite.method === "manual"
                          ? "Organizer-added cited constraint"
                          : cite.method === "extraction"
                            ? "AI proposal, reviewed and accepted"
                            : "Reviewed source fact"}
                        {cite.reviewNote ? ` · ${cite.reviewNote}` : ""}
                      </p>
                      <div className="cite-meta">
                        <span>
                          <FileText size={13} />
                          {cite.sourceName} ·{" "}
                          {cite.kind === "email"
                            ? "Email reply"
                            : cite.kind === "url"
                              ? "Web source"
                              : "Document / pasted text"}
                        </span>
                        {cite.url && (
                          <a href={cite.url} target="_blank" rel="noreferrer">
                            Open source <ArrowUpRight size={13} />
                          </a>
                        )}
                      </div>
                      {cite.hash && (
                        <details>
                          <summary>Source record</summary>
                          <p>
                            Retrieved{" "}
                            {cite.retrievedAt
                              ? dateTime(cite.retrievedAt)
                              : "at import"}
                          </p>
                          <code>SHA-256 · {cite.hash}</code>
                        </details>
                      )}
                    </>
                  ) : (
                    <p className="muted">
                      {step.facts[k] == null
                        ? "Not supplied. No value inferred."
                        : "Entered or corrected by the organizer; no source quote attached."}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <p className="report-boundary">
        This report checks the supplied timing facts and delivery charge. A
        resolved timing check is not a booking confirmation or a complete review
        of costs, capacity or contract terms.
      </p>
    </main>
  );
}
export function ShareReport({ workspace, event }) {
  const data = useQuery(api.reports.preview, { workspace, id: event._id });
  const publish = useMutation(api.reports.publish),
    revoke = useMutation(api.reports.revoke);
  const [disclosure, setDisclosure] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => setConfirmed(false), [event.version, disclosure]);
  const base = import.meta.env.VITE_CONVEX_SITE_URL || location.origin;
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.data || e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p>Preparing the sharing preview…</p>;
  return (
    <div className="share-report">
      <section className="panel share-controls">
        <p className="eyebrow">SHARE THE EVIDENCE</p>
        <h2>A clear picture, without your inbox.</h2>
        <p>
          Anyone with the link can read the snapshot below: event details,
          reviewed facts, source quotes, public source links and recorded
          changes. Full documents, inbox messages and contact fields are
          omitted; email addresses and recognizable phone numbers in excerpts
          are masked. Check the preview for any other private details before
          sharing.
        </p>
        <label>
          Context for readers
          <textarea
            maxLength={1000}
            value={disclosure}
            onChange={(e) => setDisclosure(e.target.value)}
            placeholder="Explain what this report represents, including any fictional test inputs."
          />
        </label>
        <label className="share-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I reviewed this preview and want anyone with the link to see it.
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          className="btn primary"
          disabled={!confirmed || !disclosure.trim() || busy}
          onClick={() =>
            run(async () => {
              await publish({
                workspace,
                id: event._id,
                expectedVersion: event.version,
                disclosure,
                confirmed,
              });
              setConfirmed(false);
            })
          }
        >
          <Link2 size={15} />
          Create read-only link
        </button>
        <div className="share-links">
          {data.links.map((l) => (
            <div key={l.id}>
              <span>
                Version {l.version} · {dateTime(l.createdAt)}
              </span>
              {l.revoked ? (
                <small>Revoked</small>
              ) : (
                <>
                  <a
                    href={`${base}/#report/${l.token}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open report <ArrowUpRight size={13} />
                  </a>
                  <button
                    className="text-btn"
                    onClick={() =>
                      run(() =>
                        navigator.clipboard.writeText(
                          `${base}/#report/${l.token}`,
                        ),
                      )
                    }
                  >
                    Copy link
                  </button>
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() =>
                      run(() => revoke({ workspace, reportId: l.id }))
                    }
                  >
                    Revoke link
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <small>
          Revocation stops future access through Gather. It cannot recall copies
          already saved by a reader.
        </small>
      </section>
      <ReportBody preview report={{ ...data.snapshot, disclosure }} />
    </div>
  );
}
