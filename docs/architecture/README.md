# Gather architecture

[Editable SVG](gather-architecture.svg) · [Full-resolution PNG](gather-architecture.png) · [Project overview](../../README.md)

![Gather architecture](gather-architecture.png)

Gather runs a review loop: import evidence, propose cited facts, accept selected changes, calculate timing clashes, ask a supplier for clarification, and review the reply. Convex owns persistent state and the transitions between these steps.

The diagram shows **logical application relationships**, not every network request. The persistence band serves all Convex workflows. The return arrow labeled “review data” represents saved source progress and candidate facts becoming visible through reactive queries; a background action does not directly push a response to the browser.

## Components and implementation

| Diagram component | Implemented responsibility | Source |
| --- | --- | --- |
| React workspace | Imports URLs, pasted text and text-based documents; PDF.js reads PDF text in the browser. Original uploaded files are retained in Convex storage. The UI shows evidence, a deterministic preview and explicit review controls. | [Source review](../../src/Sources.jsx), [document reader](../../src/documents.js), [app](../../src/App.jsx) |
| Convex static hosting | Serves the built React application on the public `convex.site` deployment. | [Component registration](../../convex/convex.config.ts), [HTTP routes](../../convex/http.ts) |
| Better Auth | Email-code sign-in and persistent sessions using the Convex component. AgentMail delivers the sign-in code. | [Authentication](../../convex/auth.ts), [accounts](../../convex/accounts.ts) |
| Queries and updates | Reactive reads, workspace membership checks and mutations that save imports and drafts. Private event operations validate workspace access on the server. | [Access checks](../../convex/access.ts), [events](../../convex/events.ts), [sources](../../convex/sources.ts) |
| Source ingestion | A mutation schedules an internal action. URL sources go through Firecrawl; saved text goes to OpenAI. Validation checks structured values and exact quotations before candidate facts are saved. | [Ingestion](../../convex/ingest.ts), [providers](../../shared/providers.mjs), [validation](../../shared/extraction.mjs) |
| Review and plan | Explicitly accepted facts pass citation and version checks in a mutation. The mutation preserves before/after versions and an activity record. The shared deterministic evaluator calculates timing clashes in browser previews and backend review/report paths. | [Acceptance](../../convex/sources.ts), [timing rules](../../shared/plan.mjs), [revision capture](../../convex/reportData.ts) |
| Email workflow | Saving a draft does not send it. Approval locks the message and schedules a send with a stable idempotency key. On-demand sync stores and matches received mail; importing a reply explicitly creates a new source for ingestion. | [Mail state](../../convex/mail.ts), [actions](../../convex/mailActions.ts), [provider helpers](../../shared/mail.mjs) |
| Shared persistence | Convex tables store workspaces, membership, events, sources, candidates, revisions, mailboxes, drafts, messages, activity, reports and import usage. File storage retains uploaded documents. | [Schema](../../convex/schema.ts), [uploads](../../convex/sources.ts) |
| Published report | The owner previews and confirms a separate snapshot containing selected report data. Anyone with its public link can read it while active. Subsequent event edits do not rewrite that snapshot; the owner can revoke its link. | [Report lifecycle](../../convex/reports.ts), [snapshot construction](../../convex/reportData.ts), [public UI](../../src/Public.jsx) |

## The provider boundaries

- **Firecrawl** retrieves Markdown from a public venue URL through a server-side REST request. Uploaded or pasted text skips this step.
- **OpenAI** receives source text and event context through the Responses API. GPT-5.6 Luna returns structured proposals with quotations. It does not decide which facts enter the plan or calculate the final timing verdict.
- **AgentMail** sends approved supplier messages and supplies received messages when the organizer checks the inbox. It also delivers authentication codes through a separate auth path. Receiving or importing a reply does not accept its facts.
- **Convex** supplies the database, file storage, queries, mutations, scheduled actions, authentication component persistence and static hosting. Firecrawl and AgentMail are direct API integrations, not installed Convex components.

Provider credentials remain in backend configuration. Hosted supplier-mail access is restricted to the configured organizer; public sign-up does not grant visitors that inbox.

## One full loop

1. The organizer adds a venue URL or uploads/pastes a document. Convex saves the source and schedules ingestion.
2. Firecrawl retrieves text for URL imports. OpenAI proposes facts; application code checks the output and its citations. Convex persists the source and proposals.
3. Reactive queries update the review screen. The organizer selects facts, sees their impact, and accepts them against the current event version.
4. A Convex mutation validates the acceptance and preserves plan revisions. Shared deterministic code calculates readiness, removal and missing delivery-charge information.
5. The organizer reviews the exact recipient and email text, then approves sending. A scheduled action calls AgentMail and records the result.
6. An on-demand inbox check retrieves replies. After association and explicit import, a reply follows the same extraction and review path. The plan changes only when the organizer accepts its facts.
7. If the owner chooses to share, report publication creates a separate immutable snapshot with a revocable public link.

## Scope of this diagram

This is the current implementation, not a proposed future system. It covers same-day timing and a delivery charge. It does not imply automatic inbox polling, webhook-driven reply processing, multi-day scheduling, per-user supplier inboxes, OCR, bookings or payments. The diagram groups related functions into cards; these are not separately deployed services.

The optional sample-event path is separate from the fresh-source workflow illustrated here. The live demo uses real provider requests and an illustrative event with two inboxes controlled by the builder.

## Artwork and reproduction

The layout follows the spacious cards, system boundary, small icon tiles and labeled connectors of [Relay's architecture reference](https://github.com/Pavilion-devs/relay/blob/main/docs/architecture/relay-architecture.svg). The Gather artwork is newly authored vector geometry with cream, lilac and sage colors. No Relay or provider logo artwork is embedded. Service names identify integrations, not endorsements.

The SVG contains selectable text, an accessible title and description, and no external assets. The PNG is exported directly from that SVG at **2240 × 1600**.

From the repository root:

```sh
python3 docs/architecture/build_diagram.py
npm install --prefix .local/architecture-tools --no-audit --no-fund @resvg/resvg-js@2.6.2
node docs/architecture/render.cjs
```

The optional rasterizer lives under ignored `.local/`; it is not an application dependency. The SVG can also be opened and edited directly in a vector editor.
