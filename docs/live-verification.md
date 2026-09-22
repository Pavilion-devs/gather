# Live verification — 21 September 2026

Release URL: https://clever-boar-260.convex.site

## Hosting and account checks

- The app and its static assets are served by the Convex static-hosting component in the existing production deployment.
- Self-service email-code sign-in has replaced the invite list. Membership checks still isolate event and source data.
- Fixed the reported tab-switch bug: background session refresh no longer unmounts code entry. Only the pending email, expiry and resend deadline are stored in session storage; the code itself is never stored there.
- Requested a live sign-in code, opened the owned test inbox, reloaded Gather, verified the code-entry screen survived, and signed in successfully.
- The owner subsequently confirmed successful sign-in. Their newly created workspace opened the empty event form, not a sample event.

## Fresh source test on Convex hosting

Event: Makers evening — live verification (18 November 2026, 85 guests).

Inputs are explicitly labeled as a fictional booking. No real supplier or venue was contacted.

1. Firecrawl retrieved the Civic Centre's actual published terms from https://www.theciviccentre.com/TCC%20Terms%20and%20Conditions.pdf . Source ID: k571qcpspf9k18wr2ydaw1fga98etr8b. Live Luna extraction did not invent event-specific access times, equipment-removal deadlines or delivery charges from conditional general policies. All eight plan fields stayed unknown.
2. A separate authored test document supplied access 14:00, removal deadline 22:00, guest arrival 18:00, delivery complete 17:15, setup 75 minutes, pickup 21:40 and loading 35 minutes; delivery charge unknown.
3. Seven cited values were extracted. Nothing changed before explicit acceptance. Acceptance produced the expected 30-minute readiness conflict and 15-minute removal conflict. Reload preserved the plan.
4. A new authored offer proposed delivery 16:50, pickup 21:10 and delivery charge USD 75. Accepting pickup alone preserved the original delivery and unknown charge. Accepting the remaining two values later left a five-minute readiness conflict, removed the pickup conflict and recorded the stated charge. The outcome was calculated from the new values, not from the Community Dinner sample.
5. Supplier totals and booking approvals were absent from this event. The unconnected test account could draft questions but had no control to connect or send through the organizer inbox.

## Automated checks

21 domain/provider tests, 15 Convex tests, the local integration suite and TypeScript checks passed. The added regression verifies fresh events have no sample facts, approvals, sources or prepared revisions, and that prepared sample revisions cannot be applied to real events.

## Scope retained

One set of event timing facts, Africa/Lagos event times, delivery fee in USD or explicit free delivery. Full supplier cost tracking, bookings, arbitrary multi-day schedules, OCR, public per-user inbox provisioning and automatic inbox polling are not implemented. The organizer's connected inbox is protected from other accounts. Fictional sample events remain explicitly labeled and opt-in.

## Organizer email round trip — passed

The organizer signed in through the updated Vercel preview, which uses the same production backend as the Convex site. This part was exercised in that signed-in browser session; the separate Convex-site account/crawl/review tests above cover the new hosting origin.

- Created a second blank event, Makers night — mail verification, with the same new test timing values and no fee.
- Connected the existing organizer inbox, saved the calculated clarification, reviewed the exact recipient/body, and sent only to the owned fictional supplier inbox.
- Confirmed actual arrival in the AgentMail console. Sent a real reply from that owned inbox stating delivery complete 16:30, pickup start 21:10, and explicit free delivery (USD 0). The reply identified itself as a controlled fictional test and made no real booking or commitment.
- Gather fetched the reply and automatically matched it to the existing event conversation. An older, unrelated test reply remained unassigned.
- Email source k57akxvxg102rcehxyfebfqy518ev1ah proposed exactly the three new facts. Quoted older schedule values did not become new proposals. Existing plan values stayed unchanged until explicit acceptance.
- Acceptance changed timing conflicts from 2 to 0 and established the zero delivery fee. Setup remained 75 minutes, loading 35 minutes, guests 18:00 and access 14:00–22:00. Readiness calculated to 17:45; removal calculated to 21:45.
- Reload preserved the accepted plan. Checking the inbox again still showed one reply and one sent question, with no duplicate evidence import.

This is real provider execution using openly labeled test evidence, not a real supplier interaction. No demo video was recorded during these checks.

## Evidence-sharing pass — 21 September 2026

- Added an anonymous landing page and opt-in read-only report snapshots. Existing workspaces remain authenticated.
- Owner previews event details, selected evidence, review notes and captured plan versions before creating a random share link. Revocation disables the link; snapshots do not track later private edits. Full source documents and message bodies are not serialized into the public report.
- New accepted-source and manual-correction revisions preserve the before/after facts and citation provenance. Older events explicitly state that earlier versions were not captured; history is never reconstructed from demo constants.
- Public reports distinguish organizer-added cited constraints from reviewed AI proposals. Email/recognizable phone strings are masked, but the owner must review other private information before publication.
- Added event time-zone selection so the real venue source and fictional scenario can use the venue's local clock time.
- Added four integration tests covering owner-only sharing, required confirmation, stale-version rejection, anonymous snapshot access, privacy filtering, immutable snapshots, revocation, featured-example removal and preserved before/after calculations. All 19 Convex tests pass on Node 22.23.1. Running the same suite with the shell's other Node runtime produced timer-hook failures; use the documented Node 22 runtime.

### Fresh source: Manila CSD

Actual source: https://www.manilacsd.com/page10.html
Imported through the production app using Firecrawl, then GPT-5.6 Luna. Source `k57527qdax2c8cay2f7173qgmh8ev152`.

The model returned unknown event facts and explained that general rental policies do not confirm this fictional booking. This behavior was preserved. We did not change the prompt to force extraction.

The organizer explicitly added two cited planning assumptions: 08:00 earliest setup and 22:00 equipment-removal cutoff derived from the general cleanup deadline. Review notes disclose that cleanup is not an equipment appointment and actual cleanup may need extra time. These are scenario assumptions, not venue confirmation, and are labelled as such in the public report.

Fictional supplier terms are in `docs/demo/supplier-proposal.txt`. Live extraction proposed five values: delivery 17:15, setup 75 minutes after delivery, guests 18:00, pickup 21:40, loading 35 minutes. Delivery fee remained unknown. Acceptance preserved venue constraints and produced two timing conflicts: readiness 18:30 (30 minutes late) and removal 22:15 (15 minutes after the adopted cutoff).

The clarification was sent only between the owned test inboxes. AgentMail thread: `3158dfd5-fa98-47e5-bc8a-a3c2b03db6bb`. The recipient and fictional nature were verified in the actual received message. No venue or real supplier was contacted.

Reply completion: the real reply produced five proposals (two changed times, two reaffirmed durations, one explicit free fee). We accepted only delivery, pickup and fee. Version 4 retained the original duration/arrival/venue facts; readiness became 17:45 and removal 21:45, with zero timing conflicts and no missing delivery charge. Reload persisted the result.

The owner reviewed the complete public snapshot, added an explicit scenario disclosure and created this report through the UI:
https://clever-boar-260.convex.site/#report/bb15ef8d-bdb4-4a36-8ef3-0bada0ae7685

An unauthenticated Convex HTTP client verified versions 1–4 with conflict counts `[0, 0, 2, 0]`, readiness/removal math, one actual sent message and one actual received reply, manual venue-review provenance and absence of private contact fields. The earlier zero-conflict versions are visibly marked incomplete. The report was then featured on the public landing page; its summary is derived from this persisted report, not UI constants. Desktop and 390px browser checks verified the landing/report layouts and no horizontal overflow. Selecting version 3 restored the original 30-minute/15-minute conflicts; version 4 shows the resolution.

Final validation: 21 domain/provider tests + 19 Convex tests = 40 passing; typecheck, production build and Convex deployment pass. The recording outline is `docs/demo/recording-outline.md`; no video has been recorded in this pass.
