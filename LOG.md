# Residential CRM — Development Log

## Session 1 — Aug 19

Created the GitHub repo. No code yet — just planting the flag.

## Session 2 — Aug 22, morning

Wrote the full product spec: who the user is, what they need, and how the CRM should work. The initial plan targeted Vercel for hosting, but a compliance review forced a rewrite to AWS-native infrastructure — Amplify for the frontend, Lambda for the API, CDK for everything. Ended with 71 tasks across 10 phases.

## Session 3 — Aug 22, mid-morning

Built the entire application in a single sprint. Map-based property explorer, criteria search with match scoring, deal pipeline with stage tracking, webhook receiver for pipeline updates, notification system, outreach simulation, CSV export, and an AI chat agent that can query properties in natural language. The key architectural bet: property data lives on IPFS and gets queried client-side with DuckDB, so the CRM never needs its own copy of the dataset.

## Session 4 — Aug 22, late morning

Hardened the backend: cloud infrastructure, operational dashboards, alerting, unit and contract tests, CI/CD pipelines. Switched the AI model from OpenAI to Anthropic Claude. Fixed a CORS bug that was silently blocking all cross-origin requests.

## Sessions 5-7 — Aug 22, afternoon

The Amplify deployment swamp. Twelve build-spec rewrites across three sessions, each fix revealing a new quirk in how Amplify resolves paths, detects frameworks, and assembles artifacts for a monorepo. The final fix was embarrassingly specific: copy from the right nested path, use the correct runtime version, and preserve the directory structure exactly as the framework expects it.

## Session 8 — Aug 23, morning

Wired the CRM to the pipeline for real. Added a dedicated webhook endpoint for incoming pipeline events and switched from hardcoded data paths to dynamic resolution of the latest dataset published on IPFS. Fixed several crashes caused by browser-only libraries trying to load on the server.

## Session 9 — Aug 23, mid-morning

Debugged the data connection end-to-end. The IPFS gateway URL was subtly wrong — fetching a sub-path when the name already pointed to the file. Added a server-side fallback for when the gateway is slow. Solved a cross-origin worker loading issue by creating same-origin URLs on the fly.

## Session 10 — Aug 23, afternoon

The longest session, mostly fighting SDK version conflicts. Fixed null crashes, lazy-loaded native modules to prevent cold-start failures, and corrected all API URL prefixes. Then spent the back half upgrading the AI SDK through three breaking version changes — each upgrade fixed one thing and broke another, until the right combination of package versions finally stabilized.

## Session 11 — Aug 23, evening

Two surgical fixes. Hardened the webhook to reject malformed requests before attempting verification. Switched the server-side data engine from streaming reads to downloading the full dataset to local disk — faster and more reliable.

## Session 12 — Aug 24, morning

Polish and a critical data bug. Made opportunity cards show human-readable addresses instead of raw parcel IDs. Taught the AI agent Jacksonville neighborhood geography so it can answer questions like "show me properties in Riverside."

## Session 13 — Aug 24, mid-morning

Code quality pass. Removed type-checking escape hatches, wired the operational dashboard into the infrastructure stack, and documented which specialist agents handled each build phase.

## Session 14 — Aug 24, afternoon

Recorded a full demo walkthrough covering every acceptance criterion. Fixed cosmetic issues — null values were rendering as the literal text "null" instead of dashes. Improved the AI agent's ability to handle price and value comparisons.

## Session 15 — Aug 25, early morning

Prepared the UI for real-world scale. Added query limits so the browser doesn't choke on 400,000 properties. Redesigned the search panel to be compact and collapsible, widened the map, and switched the property list to stacked cards that work better in the split-view layout.

## Session 16 — Aug 25, mid-morning

Stopped downloading the entire dataset upfront and switched to lazy queries — now the browser only fetches the bytes it needs. Added a "Search this area" button on the map so users explore by panning rather than loading everything at once. The map now renders immediately and queries the visible area on load instead of waiting for data.

## Session 17 — Aug 25, late morning

Stabilized the demo recording. Fixed a bug where IPFS gateway redirects would hijack the browser tab. Hardened navigation guards to block any external redirect attempts. Re-recorded the demo twice to capture the new viewport-based workflow at the right zoom level.

## Session 18 — Aug 25, afternoon

Removed the in-browser database entirely. The CRM now calls the pipeline's live REST API for all property queries instead of maintaining its own local copy of the data. This simplified the frontend dramatically — no more database initialization, no caching logic, no IPFS resolution. Also fixed the roof age filter (it was finding old roofs instead of new ones) and made search criteria apply within the visible map area so results stay relevant to what the user is looking at.
