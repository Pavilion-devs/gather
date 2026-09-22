import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  FileText,
  Plus,
  Link2,
  Upload,
  ArrowUpRight,
  ArrowRight,
  Check,
  Flag,
  RotateCcw,
  ChevronRight,
  Pencil,
  Quote,
  Clock3,
  HelpCircle,
  CheckCheck,
  X,
} from "lucide-react";
import { SOURCES, time, minutes, evaluatePlan } from "../shared/plan.mjs";
import {
  FIELD_INFO,
  locateQuote,
  validateValue,
} from "../shared/extraction.mjs";
import { readDocument } from "./documents";
const statusLabel = {
  queued: "Waiting to import",
  reading: "Reading source",
  extracting: "Finding facts",
  review: "Ready for review",
  accepted: "Reviewed",
  error: "Needs attention",
  flagged: "Flagged for review",
};
const statusTone = {
  queued: "blue",
  reading: "blue",
  extracting: "blue",
  review: "blue",
  accepted: "green",
  error: "amber",
  flagged: "red",
};
function Btn({ primary = false, children, ...props }) {
  return (
    <button className={`btn ${primary ? "primary" : ""}`} {...props}>
      {children}
    </button>
  );
}
function Badge({ tone = "neutral", children }) {
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
function shown(field, value) {
  return value == null
    ? "Not stated"
    : FIELD_INFO[field].unit === "clock"
      ? time(value)
      : field === "fee"
        ? `$${value}`
        : `${value} min`;
}
function inputValue(field, value) {
  return value == null
    ? ""
    : FIELD_INFO[field].unit === "clock"
      ? time(value).slice(0, 5)
      : String(value);
}
function parsedValue(field, value) {
  if (value === "") return null;
  return FIELD_INFO[field].unit === "clock" ? minutes(value) : Number(value);
}
export default function SourcesView({
  workspace,
  event,
  added,
  selected,
  run,
  busy,
  edit,
  go,
}) {
  const [adding, setAdding] = useState(false);
  const all = [
    ...(event.isDemo ? SOURCES.map((s) => ({ ...s, sample: true })) : []),
    ...added.map((s) => ({
      ...s,
      key: s._id,
      kind:
        s.kind === "url"
          ? "Venue webpage"
          : s.kind === "file"
            ? "Uploaded document"
            : s.kind === "email"
              ? "Email reply"
              : "Pasted source",
    })),
  ];
  const source = all.find((s) => s.key === selected) || all[0];
  const connection = useQuery(api.sources.connection, { workspace });
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">EVENT DOCUMENTS</div>
          <h2>Sources & documents</h2>
          <p>
            Review venue terms, supplier proposals and replies before updating
            your plan.
          </p>
        </div>
        <Btn primary onClick={() => setAdding(!adding)}>
          {adding ? <X size={15} /> : <Plus size={15} />}{" "}
          {adding ? "Close import" : "Add source"}
        </Btn>
      </div>
      {adding && (
        <ImportForm
          workspace={workspace}
          event={event}
          connection={connection}
          run={run}
          busy={busy}
          done={(id) => {
            setAdding(false);
            go("sources/" + id);
          }}
        />
      )}
      <div className="sources-grid">
        <Panel className="source-list">
          {all.map((s) => (
            <button
              key={s.key}
              onClick={() => go("sources/" + s.key)}
              className={source?.key === s.key ? "selected" : ""}
            >
              <span className="source-kind-icon">
                {s.url ? <Link2 size={18} /> : <FileText size={18} />}
              </span>
              <span>
                <strong>{s.name}</strong>
                <small>
                  {s.sample ? s.kind : statusLabel[s.status] || "Saved source"}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!all.length && (
            <div className="empty small">
              <FileText />
              <h3>No documents yet</h3>
              <p>
                Add a venue page, proposal or supplier reply to get started.
              </p>
              <Btn onClick={() => setAdding(true)}>Add your first source</Btn>
            </div>
          )}
        </Panel>
        <div className="source-workspace">
          {source?.sample ? (
            <SampleSource source={source} />
          ) : source ? (
            <SourceReview
              key={source.key}
              workspace={workspace}
              event={event}
              sourceId={source.key}
              run={run}
              busy={busy}
              go={go}
            />
          ) : (
            <Panel>
              <div className="empty">
                <Link2 />
                <h2>Review before updating</h2>
                <p>
                  Gather keeps the original source beside proposed facts.
                  Nothing enters your plan until you review and accept it.
                </p>
              </div>
            </Panel>
          )}
          <Panel
            title="Current plan facts"
            action={
              <Btn onClick={edit}>
                <Pencil size={13} />
                Edit facts
              </Btn>
            }
          >
            <div className="fact-grid">
              {Object.keys(FIELD_INFO).map((field) => (
                <div key={field}>
                  <span>
                    {FIELD_INFO[field].label}
                    {event.origins?.[field] && (
                      <button
                        className="fact-origin"
                        onClick={() =>
                          go("sources/" + event.origins[field].sourceId)
                        }
                      >
                        <Link2 size={11} />
                        Reviewed source
                      </button>
                    )}
                  </span>
                  <strong>{shown(field, event[field])}</strong>
                </div>
              ))}
            </div>
            <div className="note">
              <Link2 size={15} />
              Reviewed facts update the plan. Original text and earlier
              decisions remain in your history.
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
function SampleSource({ source }) {
  return (
    <Panel title={source.name} action={<Badge>Sample evidence</Badge>}>
      <div className="document">
        <div className="document-title">
          <FileText size={20} />
          {source.kind}
        </div>
        <h3>{source.name}</h3>
        <p>{source.text}</p>
        <div className="document-foot">
          Fictional source text for the demo. Add a real source to use the new
          import flow.
        </div>
      </div>
    </Panel>
  );
}
function ImportForm({ workspace, event, connection, run, busy, done }) {
  const [mode, setMode] = useState("url"),
    [reading, setReading] = useState(false),
    [requestId, setRequestId] = useState(crypto.randomUUID());
  const add = useMutation(api.sources.add),
    prepare = useMutation(api.sources.prepareUpload),
    addFile = useMutation(api.sources.addFile);
  async function submit(ev) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    let sourceId;
    const ok = await run(async () => {
      if (mode === "file") {
        const file = f.get("file");
        setReading(true);
        try {
          const doc = await readDocument(file);
          const url = await prepare({ workspace, id: event._id });
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": doc.type },
            body: file,
          });
          if (!response.ok)
            throw new Error(
              "Upload failed. Your plan has not changed. Please retry.",
            );
          const { storageId } = await response.json();
          sourceId = await addFile({
            workspace,
            id: event._id,
            name: String(f.get("name") || file.name),
            storageId,
            text: doc.text,
            requestId,
          });
        } finally {
          setReading(false);
        }
      } else
        sourceId = await add({
          workspace,
          id: event._id,
          name: f.get("name"),
          kind: mode,
          requestId,
          ...(mode === "url" ? { url: f.get("url") } : { text: f.get("text") }),
        });
    }, "Source saved. Your current plan is unchanged.");
    if (ok) done(sourceId);
  }
  return (
    <Panel title="Add a document or venue page" className="import-panel">
      <div className="import-tabs" role="tablist" aria-label="Source type">
        {[
          ["url", Link2, "Venue page"],
          ["file", Upload, "Upload document"],
          ["text", FileText, "Paste text"],
        ].map(([key, Icon, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={mode === key}
            key={key}
            className={mode === key ? "selected" : ""}
            onClick={() => {
              setMode(key);
              setRequestId(crypto.randomUUID());
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <form
        key={mode}
        onSubmit={submit}
        onChange={() => setRequestId(crypto.randomUUID())}
      >
        <div className="form-grid">
          <label className="full">
            Source title
            <input
              name="name"
              required={mode !== "file"}
              maxLength={150}
              placeholder={
                mode === "url"
                  ? "e.g. Glasshouse venue rules"
                  : "e.g. Juniper proposal — revision 4"
              }
            />
          </label>
          {mode === "url" ? (
            <label className="full">
              Public venue URL
              <input
                name="url"
                type="url"
                required
                maxLength={2000}
                placeholder="https://venue.com/hire/terms"
              />
              <small>
                Choose the specific rules or hire page, rather than the
                homepage.
              </small>
            </label>
          ) : mode === "file" ? (
            <label className="full upload-drop">
              <Upload size={22} />
              <strong>Your proposal, rules or supplier reply</strong>
              <span>
                PDF, TXT or Markdown · up to 5 MB · text-based PDFs up to 20
                pages
              </span>
              <input
                aria-label="Source document"
                type="file"
                name="file"
                accept=".pdf,.txt,.md"
                required
              />
            </label>
          ) : (
            <label className="full">
              Original source text
              <textarea
                name="text"
                required
                rows={7}
                maxLength={60000}
                placeholder="Paste the exact proposal, venue rules or supplier reply…"
              />
            </label>
          )}
        </div>
        <div className="import-footnote">
          <HelpCircle size={14} />
          <span>
            {mode === "url"
              ? "Firecrawl reads the public page; OpenAI proposes facts from its text."
              : "The document text is sent to OpenAI to propose facts. Your original source is saved."}{" "}
            You review every change before it reaches the plan.
          </span>
        </div>
        {connection &&
          (!connection.openai || (mode === "url" && !connection.firecrawl)) && (
            <div className="note amber">
              A provider key is missing. You can still save text and review it
              manually.
            </div>
          )}
        <div className="form-footer">
          <span>
            <Check size={13} />
            Your plan stays unchanged until acceptance.
          </span>
          <Btn primary disabled={busy || reading}>
            {reading
              ? "Reading document…"
              : busy
                ? "Saving source…"
                : "Import & find facts"}
            <ArrowRight size={14} />
          </Btn>
        </div>
      </form>
    </Panel>
  );
}
function SourceReview({ workspace, event, sourceId, run, busy, go }) {
  const data = useQuery(api.sources.review, { workspace, sourceId });
  const retry = useMutation(api.sources.retry),
    flag = useMutation(api.sources.flag),
    apply = useMutation(api.sources.apply);
  const [baseline, setBaseline] = useState(event.version),
    [values, setValues] = useState({}),
    [selected, setSelected] = useState({}),
    [reasons, setReasons] = useState({}),
    [focused, setFocused] = useState(null),
    [manual, setManual] = useState(false),
    [captured, setCaptured] = useState("");
  const documentRef = useRef(null);
  if (!data)
    return (
      <Panel>
        <div className="loading">
          <span className="spinner" />
          Loading your source…
        </div>
      </Panel>
    );
  const { source, candidates, downloadUrl } = data;
  const working = ["queued", "reading", "extracting"].includes(source.status),
    stale = baseline !== event.version;
  const pending = candidates.filter((f) => f.state === "pending");
  const picks = pending.filter((f) => selected[f._id] && f.value !== null);
  let edits = {},
    inputError = "";
  for (const f of picks) {
    try {
      const value = parsedValue(
        f.field,
        values[f._id] ?? inputValue(f.field, f.value),
      );
      if (!validateValue(f.field, value))
        throw new Error("Check the selected values.");
      if (f.field in edits)
        throw new Error("Select only one statement per fact.");
      edits[f.field] = value;
    } catch (err) {
      inputError = err.message;
    }
  }
  const after = evaluatePlan({ ...event, ...edits }),
    before = evaluatePlan(event);
  const focusedFact = candidates.find((f) => f._id === focused);
  const citation = focusedFact
    ? locateQuote(source.text, focusedFact.quote)
    : null;
  async function accept() {
    const ok = await run(
      () =>
        apply({
          workspace,
          sourceId,
          expectedVersion: baseline,
          facts: picks.map((f) => ({
            candidateId: f._id,
            value: parsedValue(
              f.field,
              values[f._id] ?? inputValue(f.field, f.value),
            ),
            reason: reasons[f._id] || "",
          })),
        }),
      "Reviewed facts accepted. The plan has been recalculated.",
    );
    if (ok) {
      setSelected({});
      setBaseline(event.version + 1);
    }
  }
  return (
    <>
      <Panel
        title={source.name}
        action={
          <Badge tone={statusTone[source.status]}>
            {statusLabel[source.status] || "Saved source"}
          </Badge>
        }
      >
        <div className="source-provenance">
          {source.status === "review" &&
            !candidates.some((f) => f.state === "accepted") && (
              <button
                className="text-btn"
                disabled={busy}
                onClick={() =>
                  run(
                    () => retry({ workspace, sourceId }),
                    "Extraction queued again. Your plan is unchanged.",
                  )
                }
              >
                <RotateCcw size={12} />
                Re-extract
              </button>
            )}
          {source.kind === "email" && (
            <button
              className="text-btn"
              onClick={() => go("inbox/" + source.mailMessageId)}
            >
              View original email <ArrowUpRight size={12} />
            </button>
          )}
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer">
              <Link2 size={12} />
              {new URL(source.url).hostname}
              <ArrowUpRight size={12} />
            </a>
          )}
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              <FileText size={12} />
              Original document
              <ArrowUpRight size={12} />
            </a>
          )}
          <span>
            {source.retrievedAt
              ? "Read " +
                new Date(source.retrievedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Saved source"}
            {source.model ? " · AI extraction" : ""}
          </span>
        </div>
        {working && (
          <div className="import-progress" role="status">
            <span className="spinner" />
            <div>
              <strong>{statusLabel[source.status]}</strong>
              <p>
                Your plan is unchanged. You can leave this page; the import
                continues.
              </p>
            </div>
          </div>
        )}
        {source.error && (
          <div className="source-error" role="status">
            <HelpCircle size={18} />
            <div>
              <strong>
                {source.errorCode === "credits"
                  ? "Source saved. AI extraction needs credits."
                  : "This source needs attention."}
              </strong>
              <p>{source.error}</p>
            </div>
            {!working && source.status !== "accepted" && (
              <Btn
                onClick={() =>
                  run(
                    () => retry({ workspace, sourceId }),
                    "Extraction queued again.",
                  )
                }
                disabled={busy}
              >
                <RotateCcw size={13} />
                Retry
              </Btn>
            )}
          </div>
        )}
        {source.text && (
          <>
            <div className="document-tools">
              <span>Original source text</span>
              <button
                className="text-btn"
                type="button"
                disabled={working}
                onClick={() => {
                  setCaptured("");
                  setManual(!manual);
                }}
              >
                <Plus size={13} />
                Add a cited fact
              </button>
            </div>
            <div
              className="document source-text"
              ref={documentRef}
              onMouseUp={() => {
                const selection = window.getSelection();
                if (
                  selection &&
                  documentRef.current?.contains(selection.anchorNode)
                ) {
                  const text = selection.toString();
                  if (text.length >= 4 && text.length <= 800) setCaptured(text);
                }
              }}
            >
              <p>
                {citation ? (
                  <>
                    {source.text.slice(0, citation.start)}
                    <mark>
                      {source.text.slice(citation.start, citation.end)}
                    </mark>
                    {source.text.slice(citation.end)}
                  </>
                ) : (
                  source.text
                )}
              </p>
            </div>
            {captured && !working && !manual && (
              <div className="selection-offer">
                <Quote size={14} />
                <span>Use your selected passage as evidence.</span>
                <Btn onClick={() => setManual(true)}>Add cited fact</Btn>
              </div>
            )}
            <p className="source-hint">
              Select a passage to add a fact manually, or inspect the proposed
              facts below.
            </p>
          </>
        )}
      </Panel>
      {manual && source.text && !working && (
        <ManualFact
          workspace={workspace}
          sourceId={sourceId}
          initialQuote={captured}
          run={run}
          busy={busy}
          close={() => {
            setManual(false);
            setCaptured("");
          }}
        />
      )}
      {(candidates.length > 0 || source.status === "review") && (
        <Panel
          title="Facts to review"
          action={
            <Badge>
              {pending.filter((f) => f.value !== null).length} proposed
            </Badge>
          }
        >
          <p className="review-intro">
            Compare each proposal with the original text. Tick the facts you
            want to use. Corrections need a short explanation.
          </p>
          {source.notes?.length > 0 && (
            <div className="extraction-notes">
              <strong>Source limitations</strong>
              <ul>
                {source.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {!candidates.length && (
            <div className="empty small">
              <HelpCircle />
              <h3>No supported timing or delivery facts found.</h3>
              <p>
                The source is saved. Add a cited fact manually if you find a
                relevant statement.
              </p>
            </div>
          )}
          <div className="candidate-list">
            {candidates.map((f) => {
              const eligible = f.state === "pending" && f.value !== null;
              const val = values[f._id] ?? inputValue(f.field, f.value);
              let changed = false;
              try {
                changed = parsedValue(f.field, val) !== f.value;
              } catch {
                changed = true;
              }
              return (
                <article
                  className={`candidate ${focused === f._id ? "focused" : ""}`}
                  key={f._id}
                >
                  <div className="candidate-heading">
                    <label className="fact-check">
                      <input
                        type="checkbox"
                        aria-label={`Use ${FIELD_INFO[f.field].label}`}
                        disabled={!eligible || source.status === "flagged"}
                        checked={!!selected[f._id] && eligible}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            [f._id]: e.target.checked,
                          })
                        }
                      />
                      <strong>{FIELD_INFO[f.field].label}</strong>
                    </label>
                    <Badge
                      tone={
                        f.state === "accepted"
                          ? "green"
                          : f.value === null
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {f.state === "accepted"
                        ? "Accepted"
                        : f.state === "rejected"
                          ? "Replaced"
                          : f.value === null
                            ? "Not established"
                            : f.method === "manual"
                              ? "Manually proposed"
                              : "Proposed"}
                    </Badge>
                  </div>
                  <div className="candidate-values">
                    <div>
                      <small>Current plan</small>
                      <strong>{shown(f.field, event[f.field])}</strong>
                    </div>
                    <ArrowRight size={15} />
                    <label>
                      Source proposal
                      {eligible ? (
                        <input
                          aria-label={`Proposed ${FIELD_INFO[f.field].label}`}
                          type={
                            FIELD_INFO[f.field].unit === "clock"
                              ? "time"
                              : "number"
                          }
                          min="0"
                          max={FIELD_INFO[f.field].max}
                          step={f.field === "fee" ? "0.01" : "1"}
                          value={val}
                          onChange={(e) =>
                            setValues({ ...values, [f._id]: e.target.value })
                          }
                        />
                      ) : (
                        <strong>{shown(f.field, f.value)}</strong>
                      )}
                    </label>
                  </div>
                  {f.quote && (
                    <button
                      className="citation-quote"
                      onClick={() => {
                        setFocused(f._id);
                        documentRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }}
                    >
                      <Quote size={14} />
                      <span>{f.quote}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                  {f.note && <p className="candidate-note">{f.note}</p>}
                  {changed && eligible && (
                    <label className="correction-reason">
                      Why are you correcting this proposal?
                      <input
                        maxLength={500}
                        value={reasons[f._id] || ""}
                        onChange={(e) =>
                          setReasons({ ...reasons, [f._id]: e.target.value })
                        }
                        placeholder="Explain what the source actually means…"
                      />
                    </label>
                  )}
                </article>
              );
            })}
          </div>
          {pending.some((f) => f.value !== null) && (
            <div className="acceptance-preview">
              {stale ? (
                <div className="note amber">
                  <HelpCircle size={16} />
                  <div>
                    The current plan changed since you opened this review.
                    Compare the latest values before accepting.
                    <button
                      className="text-btn"
                      onClick={() => {
                        setBaseline(event.version);
                        setSelected({});
                        setValues({});
                        setReasons({});
                      }}
                    >
                      Review latest version <RotateCcw size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="preview-count">
                    <strong>{picks.length}</strong>
                    <span>selected fact{picks.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="impact-preview">
                    <span>
                      Timing conflicts{" "}
                      <strong>
                        {before.timing} → {after.timing}
                      </strong>
                    </span>
                    <span>
                      Delivery charge{" "}
                      <strong>
                        {after.priceQuestions ? "Still unknown" : "Stated"}
                      </strong>
                    </span>
                    {after.unknownTiming && (
                      <span>More timing facts needed</span>
                    )}
                  </div>
                </>
              )}
              {inputError && <p className="red-text">{inputError}</p>}
              <div className="review-controls">
                <Btn
                  primary
                  disabled={
                    busy ||
                    !picks.length ||
                    stale ||
                    !!inputError ||
                    source.status === "flagged" ||
                    working
                  }
                  onClick={accept}
                >
                  <CheckCheck size={15} />
                  Accept selected facts
                </Btn>
                <Btn
                  disabled={busy || working || source.status === "accepted"}
                  onClick={() =>
                    run(
                      () =>
                        flag({
                          workspace,
                          sourceId,
                          flagged: source.status !== "flagged",
                        }),
                      "Review flag updated.",
                    )
                  }
                >
                  <Flag size={14} />
                  {source.status === "flagged"
                    ? "Clear flag"
                    : "Flag for review"}
                </Btn>
              </div>
              <p className="footnote">
                Updates your internal plan only. Unselected values and unrelated
                approvals stay unchanged.
              </p>
            </div>
          )}
          {source.status === "accepted" && (
            <div className="review-complete">
              <CheckCheck size={18} />
              <span>Reviewed facts are in your plan.</span>
              <Btn onClick={() => go("plan")}>
                View plan <ArrowRight size={14} />
              </Btn>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
function ManualFact({ workspace, sourceId, initialQuote, run, busy, close }) {
  const add = useMutation(api.sources.addManualFact);
  const [field, setField] = useState("delivery"),
    [quote, setQuote] = useState(initialQuote),
    [localError, setLocalError] = useState("");
  return (
    <Panel
      title="Add a fact from this source"
      action={
        <button
          className="icon-btn"
          aria-label="Close cited fact form"
          onClick={close}
        >
          <X size={15} />
        </button>
      }
    >
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          setLocalError("");
          const f = new FormData(ev.currentTarget);
          let value;
          try {
            value = parsedValue(field, f.get("value"));
            if (!validateValue(field, value))
              throw new Error("Enter a valid value.");
          } catch (err) {
            setLocalError(err.message);
            return;
          }
          if (
            await run(
              () =>
                add({
                  workspace,
                  sourceId,
                  field,
                  value,
                  quote,
                  note: f.get("note"),
                }),
              "Cited fact added for review. Nothing has been applied yet.",
            )
          )
            close();
        }}
      >
        <div className="form-grid">
          <label>
            Fact
            <select
              aria-label="Fact type"
              value={field}
              onChange={(e) => setField(e.target.value)}
            >
              {Object.entries(FIELD_INFO).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Value
            {FIELD_INFO[field].unit === "clock"
              ? " (local time)"
              : field === "fee"
                ? " (USD)"
                : " (minutes)"}
            <input
              key={field}
              name="value"
              aria-label="Cited fact value"
              required
              type={FIELD_INFO[field].unit === "clock" ? "time" : "number"}
              min="0"
              max={FIELD_INFO[field].max}
              step={field === "fee" ? "0.01" : "1"}
            />
          </label>
          <label className="full">
            Exact source passage
            <textarea
              aria-label="Exact source passage"
              rows={3}
              required
              maxLength={800}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Copy the passage that supports this value…"
            />
          </label>
          <label className="full">
            Review note
            <input
              name="note"
              maxLength={500}
              placeholder="Any conditions or context to keep with this fact"
            />
          </label>
        </div>
        {localError && (
          <p role="alert" className="red-text">
            {localError}
          </p>
        )}
        <div className="form-footer">
          <span>The passage must match this source.</span>
          <Btn primary disabled={busy}>
            Add for review <Plus size={14} />
          </Btn>
        </div>
      </form>
    </Panel>
  );
}
