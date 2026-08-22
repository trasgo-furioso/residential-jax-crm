# PRD: Residential Property Acquisition CRM (Jacksonville / Duval County)

**Created**: 2026-08-22
**Discovery Session**: 2026-08-22
**Status**: Opportunity

## Problem Statement

**Pain Point**: Residential acquisition investors in Jacksonville use fragmented tools — PropStream, BatchLeads, ListSource for data discovery, driving for dollars for fieldwork, and spreadsheets for deal tracking and outreach management. Discovery happens in one tool, outreach in another, and deal tracking in spreadsheets. This disconnected workflow causes opportunities to slip through the cracks and wastes time on manual reconciliation across platforms.

**Who**: Solo real estate investors (wholesalers, buy-and-hold operators) working the Jacksonville / Duval County market, possibly with one VA assisting on support tasks like list pulling or skip tracing. They do everything themselves — finding properties, qualifying, outreach, and closing.

**Current Alternatives**: PropStream (nationwide property data for lists and comps), BatchLeads (skip tracing and list building), ListSource (mailing list generation from public records), driving for dollars (manual fieldwork to spot distressed properties), and spreadsheets (outreach status, deal pipeline, and notes). None of these integrate the continuous Duval County Oracle pipeline data, and none unify discovery, outreach, and deal tracking in a single workflow.

**Desired Outcome**: A single tool where the investor opens up, sees the freshest Duval County data already filtered to their target criteria, gets proactively alerted when new matches appear from the continuous pipeline, and tracks outreach and deals end-to-end without ever touching a spreadsheet.

## Jobs to Be Done

- When I sit down to find my next deal, I want to check for new distressed properties in my target zip codes, so I can act on fresh opportunities before competitors
- When I find a promising property, I want to qualify it (check signals, assess distress indicators, review ownership history) and reach out to the owner, so I can move quickly from discovery to contact
- When I'm managing multiple leads, I want to track outreach status and deal stages in the same place I found the property, so nothing falls through the cracks
- When the Duval pipeline ingests new or updated records, I want to be notified automatically if they match my saved criteria, so I don't have to manually re-check data sources

## Assumptions

- The Duval County Oracle pipeline data is fresh and rich enough to replace PropStream/BatchLeads as the primary source for property discovery in the Jacksonville market
- A solo investor will actually stop using spreadsheets if the CRM provides a unified workflow that is faster and more reliable
- Mocked outreach channels (email, SMS, direct mail) are sufficient for the initial demo — no real messaging integrations are needed yet
- The continuous pipeline (DuckDB / Elephant IPFS pattern) can serve the CRM without requiring Oracle to carry ongoing hosted-database costs
- Court-data enrichment (foreclosure, lien, probate) is optional and additive — the core product is viable without it
