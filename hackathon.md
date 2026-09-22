# Gather — All Gas Hackathon build log

**Check the plan. Before you pay deposits.**

- **Live app:** https://clever-boar-260.convex.site/
- **Public repository:** https://github.com/Pavilion-devs/gather
- **Demo:** [Watch the 2:44 video on X](https://x.com/olathepavilion/status/2102243994855997558).
- **Social post:** [Published on X](https://x.com/olathepavilion/status/2102243994855997558) with @convex, @OpenAI, @firecrawl and @agentmail. [Architecture reply](https://x.com/olathepavilion/status/2102243998270202338).
- **Vibe Apps listing:** [Gather](https://vibeapps.dev/s/gather), published September 22 with the app, repository, demo, screenshots and AllGasHackathon tag. Dedicated judging-form completion is still unconfirmed.

## What we built

Gather checks whether an event's venue rules, supplier proposals and schedule work together. An organizer imports evidence, reviews source-backed facts, sees timing clashes, asks a supplier for clarification, then reviews the reply before applying changes. Earlier plan versions and their evidence remain available in a shareable report.

The product is not limited to weddings. The demonstration uses an illustrative founders' dinner. Provider calls, persistence, calculations and the email exchange are real; the supplier is played through a second inbox controlled by the builder.

## Sponsor technology in the working product

| Technology | Implemented use | Source |
| --- | --- | --- |
| Convex | Event/source/message persistence, live queries, transactional review, scheduled ingestion and sending, storage, workspace checks and report snapshots. Better Auth and static-hosting components. | [Backend](convex/), [component registration](convex/convex.config.ts) |
| OpenAI | Responses API with GPT-5.6 Luna and strict structured output proposes timing and USD delivery-charge facts with exact quotations. Human review and deterministic checks precede acceptance. | [Provider](shared/providers.mjs), [validation](shared/extraction.mjs) |
| Firecrawl | Scrapes public venue pages into saved Markdown evidence. | [Provider](shared/providers.mjs), [ingestion](convex/ingest.ts) |
| AgentMail | Sends explicitly approved clarification messages, retrieves and associates replies, and delivers sign-in codes. | [Mail actions](convex/mailActions.ts), [authentication](convex/auth.ts) |
| Codex | Assisted with research, implementation, debugging, verification, design implementation and demo production. | Development workflow |

## Development record

This summary is drawn from the project's saved implementation and verification records. It does not claim that every intermediate coding session was logged contemporaneously.

### Product and interface

- Developed the event-plan checking concept around evidence, timing dependencies and review before commitment.
- Built the React interface from Stitch design work, informed by Outcrowd's restrained visual style and Kredo's evidence-review approach.
- Implemented blank events, opt-in fictional sample data, source inspection, selected-fact acceptance and before/after calculations.
- Kept source extraction and the final decision separate: the model proposes, application code validates, and the organizer accepts.

### September 21 — live integration and deployment

- Connected Firecrawl venue retrieval and live Luna extraction, preserving original text and quotations.
- Corrected a live extraction failure that read an explicit free-delivery amount as a clock time; added field separation and supporting-clock validation.
- Exercised twelve authored source edge cases with live extraction. The [evaluation report](docs/evaluations/2026-09-21T14-13-31-269Z.json) retains individual results and token usage.
- Connected the owned AgentMail inbox, immutable send approvals, duplicate detection and reply-to-event matching.
- Deployed the application on Convex static hosting with self-service email-code sign-in and account workspaces.
- Fixed code entry resetting when the user switched to their email tab.
- Added revocable public report snapshots, reviewed publication and preserved fact history.
- Verified a fresh-event crawl/review flow and the organizer's real owned-inbox email round trip. See [dated verification notes](docs/live-verification.md).

### September 22 — demo and repository preparation

- Completed the Founders' Dinner demonstration: venue evidence, supplier proposal, two timing clashes, clarification email, supplier reply, selected acceptance and a report with preserved evidence.
- Improved landing-page copy and added an actual product-run video excerpt.
- Produced a 2:44 demo with the landing-page intro, ElevenLabs narration, HyperFrames motion graphics, captions and a quiet music bed. The video remains under the three-minute limit and is published on X with the architecture in a reply.
- Prepared a README with a generated ImageGen banner, table of contents and implementation-linked sponsor sections.
- Added an implementation-verified architecture diagram in editable SVG and PNG, with a walkthrough of the evidence, review and supplier-email loop. See [architecture](docs/architecture/README.md).
- Connected the public GitHub repository and prepared the source package, excluding environment files, local databases and raw media workspaces.
- Published the [Vibe Apps listing](https://vibeapps.dev/s/gather). The builder confirmed Luma registration. The dedicated judging form is prepared, but its LinkedIn field blocks submission even though its helper text says optional; judging inclusion still needs confirmation.

## What the recorded example proves

The original proposal finishes setup at 18:30 for guests arriving at 18:00, and removes equipment at 22:15 against an organizer-adopted 22:00 cutoff. A reply changes delivery to 16:30 and pickup to 21:10, and explicitly confirms free delivery.

After accepting only those three changes, Gather calculates readiness at 17:45 and removal at 21:45. The two timing clashes clear. The original evidence, changed facts and earlier version remain accessible. General venue rules are labeled as planning assumptions, not a confirmed booking.

## Verification and boundaries

Automated checks cover domain calculations, extraction validation, email review/retry behavior, account isolation and report snapshots. Live checks exercise the actual provider calls separately. Test fixtures and authored evaluation cases do not establish broad extraction accuracy or real event outcomes.

The hosted app supports sign-up without an invitation. Public visitors can view the landing page and published example; the organizer's supplier inbox remains restricted. Multi-day planning, full supplier-cost accounting, OCR, bookings/payments, automatic inbox polling and per-user inbox provisioning are not implemented.

See [README limitations](README.md#current-limitations) and [deployment notes](docs/deployment.md).

## Remaining submission steps

- [x] Upload the finished demo to X and link it from this file and README.
- [x] Include the required sponsor tags in the social post.
- [x] Confirm Luma registration (confirmed by the builder September 22).
- [x] Publish the public repository, live app and demo links on Vibe Apps with the AllGasHackathon tag.
- [ ] Confirm entry in the dedicated hackathon judging flow; resolve the form's required LinkedIn field.
