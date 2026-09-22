# Gather public deployment

Application: https://clever-boar-260.convex.site

Previous preview (same backend): https://gather-flax-eight.vercel.app

Convex project: `favour-olaboye:gather`, production deployment `main` (`clever-boar-260`).
The previous Vercel preview uses the same backend; Convex hosting is the submission URL.

## Accounts

Email-code sign-in uses Better Auth's Convex component. Codes expire after five minutes, permit three attempts and are stored hashed. The auth service uses persistent database rate limits. Sign-up is open to any email address; no invitation list is used. No passwords or new third-party auth account are needed. Each user verifies their own email.

A verified identity receives one durable workspace, created transactionally. Every private event, source and mail operation checks workspace membership. The landing page and explicitly published report snapshots are public. Roles are owner, editor and viewer; viewer writes are refused. Invitations and a team-management UI are not implemented. The supplied inbox can be connected and used for sending/sync only by the workspace owner whose verified email matches `GATHER_MAIL_OWNER_EMAIL`.

The local unauthenticated capability mode is allowed only when both `GATHER_LOCAL_WORKSPACES=true` and the backend's `CONVEX_SITE_URL` is a loopback HTTP URL. Cloud is configured false; local-style workspace keys do not grant cloud access. Local data remains in the separate development database and is not silently copied to accounts. Signing in locally via `#account` opens a separate account workspace; “Back to local workspace” restores the existing prototype.

## Import limits

The hosted preview permits 10 import attempts per workspace per UTC day, with 50 attempts per UTC day across the deployment. Every text, URL, upload, retry and email import reserves its allowance atomically before scheduling. Duplicate reuse does not reserve another attempt. Failed attempts still count. Manual cited review remains available. Existing per-source size limits, three concurrent imports, the Luna-only guard and no automatic model retries remain in place. These controls bound request counts; they are not an OpenAI account billing limit.

## Deploying an update

Use Node 22.23.1 or compatible. `.env.local`, `.env.cloud`, `.local/`, `.convex/` and `.vercel/` are ignored and must not be committed.

`.env.cloud` selects the production Convex deployment and contains its two public URLs. It has no provider API keys. Provider keys and the auth encryption secret are stored in the Convex environment. Do not copy provider keys to Vercel's frontend environment.

```
npm test
npm run test:mail
npm run test:integration
npm run typecheck
npm run deploy
```

`deploy` explicitly targets Gather production, builds with the cloud URLs, deploys the backend, and uploads static assets using @convex-dev/static-hosting. Auth routes retain their existing paths; static routes are the catch-all. Only the generated static bundle is uploaded. `SITE_URL` is the Convex site origin; `GATHER_PREVIOUS_SITE_URL` temporarily preserves the old Vercel origin. `build:hosted` remains available for updating that earlier preview.

`scripts/configure-auth-cloud.mjs` is for initial configuration or an intentional settings update. It copies the three specified provider credentials from an existing local environment file, preserves an existing auth encryption secret, and fixes the extraction model to GPT-5.6 Luna. It does not output secrets. Its destination is the Gather production deployment, explicitly named in the script. `scripts/configure-auth-local.mjs` affects the local deployment only and preserves its existing secret.

## Evidence and remaining scope

- Twelve authored source cases passed their prewritten exact-value/unknown expectations on live Luna, with no plan changes. Full results: `docs/evaluations/2026-09-21T14-13-31-269Z.json`. This is a small synthetic suite, not a real-world accuracy estimate.
- 21 domain/provider tests and 15 Convex tests passed, plus the local integration suite, type checking and hosted build. Account tests cover anonymous rejection, cross-account isolation, concurrent initialization, viewer restrictions, cloud refusal of local capability mode, protected mail ownership and transactional daily allowances.
- Local browser check: emailed code, sign-in, workspace creation, reload persistence, sign-out and restoration of the existing local event.
- Production browser sign-in and event creation passed. A fictional supplier source produced eight correctly cited facts; nothing entered the plan before explicit acceptance, and all eight accepted values survived reload. Sign-out returned to the login screen. The login card fits 390px without horizontal overflow. Anonymous production event access is refused.
- Existing live AgentMail clarification round trip used two owned inboxes and fictional evidence. No real supplier booking was made.

The public URL supports self-service email sign-up. New accounts start with a blank event; fictional sample events are opt-in. Unconnected accounts can draft questions and import replies, but cannot send through or read the organizer’s inbox. Collaborator invitation UI, multi-day scheduling, OCR and automatic inbox checking remain outside this release. Original email attachments still need separate document upload. The earlier local test data remains local.

The sign-in form now survives focus-triggered session refreshes and stores only the pending email and expiry/cooldown in session storage (never the OTP). Reloading and completing a live sign-in were verified on Convex hosting.

Implementation references: https://labs.convex.dev/better-auth/framework-guides/react and https://better-auth.com/docs/plugins/email-otp . Installed Better Auth 1.6.22 is a patched version compatible with the Convex component; dependency audit passed with zero known vulnerabilities at release time.

## Public evidence reports

The default route is now a public landing page. `#account`/workspace routes retain authentication. `#report/<random-token>` reads only an explicitly published snapshot, with no access to the source documents, inbox, workspace identifiers or future private edits. Owners must review a preview and acknowledge publication. They may revoke links from Plan summary. A revoked featured report also disappears from the landing page. Downloaded copies cannot be recalled.

The deployment operator can feature an already published example with the internal `reports:feature` mutation. The featured controlled test is `bb15ef8d-bdb4-4a36-8ef3-0bada0ae7685`. Its venue constraints are explicitly reviewed planning assumptions, and its supplier/event are fictional. The crawl, extraction and email transport were live.

Use Node 22.23.1 for builds and tests.
