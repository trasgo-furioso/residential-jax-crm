# Slowking Assessment Analysis

Comprehensive analysis of the Slowking evaluation agent from soofi-xyz-team-kit, focused on how it will evaluate the Oracle Property Intelligence Platform Pipeline (Duval County, FL) assignment.

---

## Overview of Slowking

Slowking is the candidate test-task evaluation orchestrator in the soofi-xyz-team-kit. It evaluates hiring candidates' submitted assignments by producing a factual 100-point score and hiring verdict. It does NOT build or fix anything -- it only judges.

Slowking operates through three sequential evaluation pillars:

1. **Pillar 1 -- Intent and Model** (`evaluate-candidate-intent`): Derives the one-sentence business intent, builds the evidence model, establishes gates, creates the weighted scoring model, and computes delivery speed.
2. **Pillar 2 -- Evidence and Functional Outcome** (`evaluate-candidate-product`): Exercises the live deployed runtime with Playwright browser, scores each functional evaluation point individually, checks access boundaries.
3. **Pillar 3 -- Implementation and Kit Usage** (`evaluate-candidate-implementation`): Reviews architecture, code quality, and whether the soofi-xyz kit agents/skills were used correctly.

Pillars 2 and 3 run as independent subagents to prevent bias between functional evidence and code review.

---

## Scoring Dimensions and Weights

| Dimension | Weight | Owned by |
|---|---|---|
| Functional outcome (decomposed into 3-8 evaluation points) | **40** | evaluate-candidate-product |
| Runtime & demo quality | **20** | evaluate-candidate-product |
| Evidence quality (runtime behavior, data, output, demo) | **12** | evaluate-candidate-product |
| Access-boundary compliance | **8** | evaluate-candidate-product |
| Implementation quality (architecture, code, AC depth) | **7** | evaluate-candidate-implementation |
| Kit-usage conformance (built with soofi-xyz kit) | **5** | evaluate-candidate-implementation |
| Reproducibility | **4** | evaluate-candidate-product |
| Speed (elapsed delivery time) | **4** | orchestrator |
| **Total** | **100** | |

Key insight: **Functional outcome (40) + Runtime & demo quality (20) = 60 points** are about proving the business outcome works in a live deployed runtime. Implementation (7) and kit usage (5) together are only 12 points.

### Anchored Bands (Deterministic Scoring)

Each dimension is scored at exactly one of five fixed bands -- no free-form numbers:

| Band | Fraction | Meaning |
|---|---|---|
| 0 | 0% | Not demonstrated / absent / contradicted |
| 1 | 25% | Barely present; major gaps; mostly unproven |
| 2 | 50% | Partially demonstrated; clear gaps remain |
| 3 | 75% | Largely demonstrated with minor gaps |
| 4 | 100% | Fully demonstrated with direct evidence |

Points = Band fraction x Weight. For example, Functional outcome at Band 3 (75%) = 0.75 x 40 = 30 points.

---

## What Earns a HIGH Score (Specific, Actionable Items)

### 1. Deployed, Hosted Runtime (MANDATORY -- Gate)

This is the single most critical requirement. The runtime MUST be:

- A **candidate-deployed, hosted runtime** at a public URL (e.g., Vercel, AWS Amplify, Railway, Render, Fly.io, or similar).
- Reachable and exercisable WITHOUT building, installing, or running the app.
- NOT localhost, 127.0.0.1, Docker Compose, or any local setup.

**Action items for Oracle Pipeline Duval:**
- Deploy the UI to a hosted service (Vercel, Amplify, or similar).
- Deploy any backend/API to a hosted service.
- Ensure DuckDB data is accessible from the deployed runtime (not just local files).
- Include the deployed URL prominently in the PR description.
- Provide working credentials if authentication is required.

### 2. Functional Outcome -- 40 Points (Decomposed)

Based on the Oracle Property Intelligence Platform evidence catalog, the functional outcome will likely be decomposed into evaluation points such as:

| Likely Evaluation Point | Expected Sub-weight | What Proves It |
|---|---|---|
| Continuous/incremental pipeline with run history | 8-10 | Multiple pipeline runs visible, timestamps, deltas, source list |
| Dataset coverage and scale (real Duval County records) | 8-10 | Realistic record counts across property, permit, ownership, contractor, business, coordinates -- NOT a toy handful of rows |
| IPFS/IPNS publication of artifacts | 5-7 | CIDs and/or IPNS pointers visible, following Elephant conventions |
| UI exploration of property data | 5-7 | UI returns real results for roof age, water view, ownership, regional owners, transit, Starbucks queries |
| Agent/MCP query capability | 4-6 | Agent answers compound property intelligence questions with source-backed evidence |
| Entity reconciliation and provenance | 3-5 | Duplicate entities reconciled, source provenance preserved and visible |
| Infrastructure cost design (DuckDB + IPFS) | 2-3 | Oracle does not carry ongoing infra cost |

**Critical: Data scale is scored within functional outcome. A product with only a handful of rows/records scores EXTREMELY LOW regardless of UI or code polish.**

**Action items:**
- Load a REALISTIC volume of Duval County records (thousands, not dozens).
- Show multiple pipeline run executions with visible deltas.
- Ensure all six query types work with real data (roof age, water view, ownership exchange, regional owners, transit proximity, Starbucks proximity).
- Publish real IPFS/IPNS artifacts following Elephant conventions.
- Ensure agent queries return source-backed answers.
- Show entity reconciliation across sources.

### 3. Runtime & Demo Quality -- 20 Points

- The runtime must be stable and responsive during Playwright-driven testing.
- Demo video must show the REAL outcome, not mockups.
- Error handling should be graceful.
- The demo transcript from the assignment README is essentially the Playwright test script -- every item in it will be exercised.

**Action items:**
- Record a demo video walking through every item in the Demo Transcript section of the assignment.
- Ensure the deployed runtime handles all demo scenarios without crashing.
- Link the demo video from the PR.

### 4. Evidence Quality -- 12 Points

- Runtime behavior must be observable (not just code claims).
- Data evidence must show actual record counts and variety.
- Output evidence must show real query results.
- Demo artifacts must show real outcomes.

**Action items:**
- Show record counts prominently in the UI (total records by source, by type).
- Show provenance metadata alongside query results.
- Ensure pipeline run history is visible with concrete numbers.

### 5. Access-Boundary Compliance -- 8 Points

For Oracle Pipeline, the evidence catalog specifies:
- Real records at realistic scale.
- Canonical entity and relationship modeling across sources.
- Source provenance for ingested records.
- RAG-backed retrieval over real records.
- Exploration UI for browsing entities/relationships.
- Required inquiry workflows executed over real records (not mocked).

**Action items:**
- Do NOT mock data or bypass the actual pipeline.
- Use real Duval County public data sources.
- Do NOT hardcode query results.
- Use proper IPFS publication paths (Filebase or equivalent).

### 6. Implementation Quality -- 7 Points

Evaluated by consulting relevant builder agents (likely `oracle`, `espeon`, `metagross`, `donphan`) as read-only reviewers:

**Action items:**
- TypeScript for all services (engineering guidelines mandate this).
- Use Vercel AI SDK for any LLM interactions (NOT direct provider SDKs).
- CDK for infrastructure if deploying to AWS.
- Clean architecture: proper module separation, error handling, tests.
- Match the patterns prescribed by the oracle agent and relevant skills.

### 7. Kit-Usage Conformance -- 5 Points

Slowking checks whether the candidate used the soofi-xyz-team-kit agents/skills:

**Action items:**
- Use the `oracle` agent's prescribed pipeline approach (elephant-xyz/skills).
- Use `donphan` / `use-elephant-mcp` for data exploration.
- Follow `apply-engineering-guidelines` (TypeScript, CDK, Vitest, Powertools observability).
- Use `espeon` patterns for RAG if implementing semantic search.
- Use `metagross` patterns for fullstack monorepo if applicable.

### 8. Reproducibility -- 4 Points

- Can the runtime and results be reached from the PR alone?
- Are setup docs, working URL/credentials, and demo all linked from the PR?

**Action items:**
- PR description must contain: deployed URL, credentials (if any), demo video link.
- README with clear setup instructions (even though the evaluator will NOT run locally, these show reproducibility).

### 9. Speed -- 4 Points

- Elapsed time from assignment-sent datetime to latest commit timestamp.
- Faster delivery = higher score, but this is only 4 points.

---

## What Causes Deductions

### Automatic 0/100 -- Total Fail (Gate Failures)

These are NON-NEGOTIABLE. Any single one results in 0/100:

1. **No deployed runtime / local-only app**: localhost, 127.0.0.1, "npm run dev" instructions, Docker Compose, tunnels -- all result in AUTOMATIC 0/100.
2. **No PR to the designated assignment repo**: Work must be submitted as a PR to the correct repository.
3. **Missing or non-working credentials**: If login is required and credentials don't work.
4. **No demo artifact**: No demo video or demo documentation.
5. **Unreachable runtime for ANY reason**: Even if the code is perfect, if the URL is down, returns errors, or has unresolvable auth, it's 0/100.

### Severe Deductions (Low Bands)

1. **Toy data**: Only a handful of records loaded. "A product populated with only a handful of rows/records/entities is a toy and must score extremely low on functional outcome." This alone can tank the 40-point functional outcome.
2. **Documentation claims without runtime proof**: "Never mark a criterion Pass/high from a documentation claim alone -- require an observed action and result."
3. **Checklist coverage without meeting the intent**: "Many technical bullets but a missed outcome is a low score with an explicit explanation." Building lots of features but failing to prove the core business outcome = low score.
4. **Access-boundary violations**: Bypassing intended data access patterns.
5. **Missing query types**: Each of the six property intelligence query types (roof age, water view, ownership, regional owners, transit, Starbucks) maps to functional evaluation points. Missing any = lost points on that sub-weight.
6. **No pipeline continuity evidence**: One-shot bulk load without showing incremental/ongoing capability.
7. **No IPFS/IPNS publication**: The assignment explicitly requires Elephant IPFS publication. Missing this loses points on multiple evaluation points.

### Moderate Deductions

1. **Not using the kit**: Building well but without soofi-xyz kit patterns costs the 5-point kit-usage dimension.
2. **Wrong tech stack**: Using Python instead of TypeScript (except for PySpark/Glue), not using Vercel AI SDK for LLM calls, not using CDK for infrastructure.
3. **Poor reproducibility**: Side-channel context needed to understand the submission.
4. **Slow delivery**: Impacts the 4-point Speed dimension.

---

## Recommendations for Our Implementation

### Priority 1: Deployment (Gate -- Pass/Fail)

- Deploy the UI and backend to a hosted service immediately. This is binary: no deployment = 0 points total.
- Use Vercel, AWS Amplify, Railway, or similar. The URL must be reachable without any local setup.
- If DuckDB is the query engine, ensure it's accessible from the deployed environment (e.g., DuckDB-WASM in browser, or a server-side DuckDB instance on a hosted backend).
- Test that the deployed URL works from outside your network.

### Priority 2: Data Scale (Biggest Impact on Functional Outcome)

- Load THOUSANDS of real Duval County records, not dozens.
- Cover all data types: property, permit, ownership, contractor, business, coordinates.
- Show actual record counts in the UI prominently.
- This is the single most impactful differentiator between a high and low functional score.

### Priority 3: All Six Query Types Working

- Roof age > 15 years
- Water view properties
- Ownership not exchanged in 10+ years
- Regional owners
- Walking distance to public transportation (coordinate-based)
- Walking distance to Starbucks (coordinate-based)

Each must work with real data in the deployed runtime AND through the agent interface.

### Priority 4: Continuous Pipeline Evidence

- Show at least 2-3 pipeline runs with visible timestamps, record counts, and deltas.
- Make run history browsable in the UI.
- Demonstrate incremental capability (not just full re-loads).

### Priority 5: IPFS/IPNS Publication

- Publish dataset artifacts to Elephant IPFS following Elephant conventions.
- Show CIDs and IPNS pointers in the UI or API.
- Ensure MCP can resolve published artifacts.

### Priority 6: Demo Video

- Record a video following the exact Demo Transcript from the assignment README.
- Cover every bullet point in the transcript.
- Link it from the PR description.

### Priority 7: PR Completeness

- PR against the correct designated repository.
- Include in PR description: deployed URL, credentials, demo video link.
- Ensure everything is reachable from the PR alone.

### Priority 8: Kit Conformance and Engineering Guidelines

- Use TypeScript for all services.
- Use Vercel AI SDK (`ai` package) for any LLM/RAG interactions.
- Follow oracle agent's prescribed skill pipeline.
- Use CDK if deploying AWS infrastructure.
- Add basic observability (structured logs at minimum).

### Priority 9: Agent/RAG Quality

- Agent must return source-backed answers (not hallucinated).
- Compound queries must work (e.g., "properties with roofs older than 15 years that haven't exchanged ownership in 10 years").
- RAG retrieval should be grounded in real records.

---

## Key Gotchas and Non-Obvious Requirements

1. **"Inconclusive" is NOT an escape hatch for runtime issues.** If the runtime can't be exercised, it's always Fail/0, never Inconclusive. Inconclusive is only for secondary non-runtime checks that are blocked.

2. **Slowking will actually DRIVE the runtime with Playwright.** It navigates, clicks, fills forms, takes screenshots, and verifies actual DOM content. The app must be functional, not just a static page. Every claim must be provable through browser interaction.

3. **The evaluator gets ONE operator-assisted access attempt.** If the first attempt to reach the runtime fails, there's one chance for help. After that, if it still doesn't work, it's 0/100.

4. **Functional outcome is NEVER one opaque number.** It's always decomposed into 3-8 evaluation points with individual sub-weights summing to 40. Each point is scored independently. Missing one capability doesn't just "average down" -- it zeroes out that specific sub-weight.

5. **Anti-checklist judgment is explicitly enforced.** Satisfying many technical bullets while missing the core business outcome = low score. The intent ("a platform that lets users explore and inquire over canonical, provenance-tracked property entities") must be proven.

6. **Scale signal is embedded in functional outcome AND evidence quality.** Sparse data scores extremely low in BOTH dimensions (40 + 12 = 52 points at risk).

7. **Builder agents will be consulted as code reviewers.** The oracle, espeon, metagross, and potentially donphan agents will review the code read-only and return 0-100 scores. Their scores are weighted by how central each agent is to the task.

8. **Speed is computed from the GitHub commit timestamp, not from when you say you finished.** The latest commit on the PR head is the official end time.

9. **DuckDB + IPFS is explicitly required.** The assignment says "Use DuckDB for local/portable analytical querying" and "publish the data to Elephant IPFS." Missing either is a direct functional outcome deduction.

10. **The runtime gate explicitly rejects "The API/MCP responded but I could not use the actual product."** If only the API works but the UI and full product experience can't be exercised, it may still be 0 unless the API surface alone fully demonstrates the core intent.
