# Residential CRM — Development Log

## Session 1 — 2026-08-19 17:54–17:57 (~3min)

Created the GitHub repo. No code yet — just planting the flag.

## Session 2 — 2026-08-22 07:58–08:59 (~1h)

Wrote the full product spec: who the user is, what they need, and how the CRM should work. The initial plan targeted Vercel for hosting, but a compliance review forced a rewrite to AWS-native infrastructure — Amplify for the frontend, Lambda for the API, CDK for everything. Ended with 71 tasks across 10 phases.

## Session 3 — 2026-08-22 09:10–09:58 (~48min)

Built the entire application in a single sprint. Map-based property explorer, criteria search with match scoring, deal pipeline with stage tracking, webhook receiver for pipeline updates, notification system, outreach simulation, CSV export, and an AI chat agent that can query properties in natural language. The key architectural bet: property data lives on IPFS and gets queried client-side with DuckDB-WASM, so the CRM never needs its own copy of the dataset.

## Session 4 — 2026-08-22 10:02–10:52 (~50min)

Hardened the backend: CDK infrastructure, CloudWatch dashboards, PagerDuty alerting, unit and contract tests, CI/CD pipelines. Switched the AI model from OpenAI to Anthropic Claude. Fixed a CORS bug in API Gateway that was silently blocking all cross-origin requests.

## Session 5 — 2026-08-22 11:01–12:10 (~1h 9min)

Entered the Amplify deployment swamp. The monorepo build spec was rewritten six times — each fix revealed a new quirk in how Amplify resolves paths, detects frameworks, and assembles artifacts. Nothing worked. The session ended with a manual workaround to assemble the deployment structure in a post-build step.

## Session 6 — 2026-08-22 13:39–14:32 (~53min)

Still stuck in the Amplify swamp. Six more build spec rewrites, experimenting with every combination of monorepo config options Amplify supports. The core problem: getting Next.js standalone mode to play nice with Turborepo inside Amplify's opinionated build system.

## Session 7 — 2026-08-22 15:56–16:35 (~39min)

Finally cracked Amplify deployment. The fix was embarrassingly specific: copy from the right nested path, use the correct runtime version, and preserve the standalone directory structure exactly as Next.js expects it. Twelve build spec rewrites across three sessions to get there. Marked 67 of 71 tasks complete.

## Session 8 — 2026-08-23 08:52–09:59 (~1h 7min)

Wired the CRM to the pipeline for real. Added a dedicated webhook endpoint for incoming pipeline events. Rewrote IPFS data resolution on both server and client to fetch the latest dataset dynamically instead of using a hardcoded path. Fixed several SSR crashes caused by browser-only libraries loading on the server.

## Session 9 — 2026-08-23 10:30–11:41 (~1h 11min)

Debugged the data connection end-to-end. The IPFS gateway URL was subtly wrong — fetching a sub-path when the name already pointed to the file. Added a server-side fallback for when the gateway is slow. Solved a cross-origin worker loading issue with DuckDB-WASM by creating same-origin blob URLs. Planned 10 convergence tasks for final polish.

## Session 10 — 2026-08-23 12:41–14:33 (~1h 52min)

The longest session, mostly fighting SDK version conflicts. Fixed null crashes, lazy-loaded native modules to prevent Lambda cold-start failures, and corrected all API URL prefixes. Then spent the back half upgrading the AI SDK through three breaking version changes — each upgrade fixed one thing and broke another, until the right combination of package versions finally stabilized.

## Session 11 — 2026-08-23 18:26–19:03 (~37min)

Two surgical fixes. Hardened the webhook to reject malformed requests before attempting cryptographic verification. Switched the server-side data engine from streaming HTTP reads to downloading the full Parquet file to local disk, backed by a purpose-built DuckDB Lambda layer — faster and more reliable.

## Session 12 — 2026-08-24 09:04–10:38 (~1h 34min)

Polish and a critical data bug. Extracted secrets from the codebase into environment variables. Fixed a column naming mismatch between the database layer and the frontend — properties were loading but addresses were silently blank. Made opportunity cards show human-readable addresses instead of raw parcel IDs. Taught the AI agent Jacksonville neighborhood geography so it can answer questions like "show me properties in Riverside."

## Session 13 — 2026-08-24 11:01–12:02 (~1h 1min)

Code quality pass. Removed type-checking escape hatches, wired the CloudWatch dashboard into the infrastructure stack, and documented which specialist agents handled each build phase. Added security guards on the frontend to prevent cross-origin redirects — a subtle class of vulnerability in apps that fetch external URLs.

## Session 14 — 2026-08-24 14:12–15:17 (~1h 5min)

Recorded a full demo walkthrough covering every acceptance criterion. Fixed cosmetic issues — null values were rendering as the literal text "null" instead of dashes. Improved the AI agent's ability to handle price and value comparisons.

## Session 15 — 2026-08-25 07:02–08:04 (~1h 2min)

Prepared the UI for real-world scale. Added query limits so the browser doesn't choke on 400,000 properties. Redesigned the search panel to be compact and collapsible, widened the map, and switched the property list to stacked cards that work better in the split-view layout.

## Session 16 — 2026-08-25 09:15–09:40 (~25min)

The big performance pivot. Stopped downloading the entire Parquet file upfront and switched to lazy range-request queries — now the browser only fetches the bytes it needs. Added a "Search this area" button on the map that filters properties by the visible viewport, so users explore by panning rather than loading everything at once.
