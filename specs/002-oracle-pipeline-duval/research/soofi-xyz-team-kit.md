# Soofi XYZ Team Kit — Research Summary

**Source**: `/Users/trasgofurioso/Code/elephant/soofi-xyz-team-kit/`
**Version**: 0.30.0
**Date**: 2026-08-20

## What Is It?

A development toolkit packaging **35 specialized agents** and **50 reusable skills** for AI-assisted development. Distributed as a Cursor/Copilot/Codex plugin, bundled with **elephant-mcp** for Oracle property data exploration.

## Critical: Slowking Evaluation Agent

Slowking is the **candidate assignment evaluator** — a 100-point scoring system with a three-pillar framework. This is how our work will be assessed.

### Gates (Any failure = 0/100, Fail, STOP)

1. **PR Gate** — Work submitted as PR against the **designated assignment repository**
2. **Runtime Gate (ABSOLUTE)** — Must provide a **deployed, hosted runtime** (not localhost, not Docker, not "clone and run"). Slowking exercises it with Playwright
3. **Credentials Gate** — Working credentials present or runtime is public
4. **Demo Gate** — Demo artifact present and reachable (video walkthrough preferred)

### Scoring Dimensions (100 points)

| Dimension | Weight | Notes |
|-----------|--------|-------|
| Functional outcome | 40 | Broken into 3-8 evaluation points tied to business intent |
| Runtime & demo quality | 20 | Stability, responsiveness, real workflow shown |
| Evidence quality | 12 | How convincingly runtime/data/output proves points |
| Access-boundary compliance | 8 | Respects assignment-specific access rules |
| Implementation quality | 7 | Architecture, code structure, AC technical depth |
| Kit-usage conformance | 5 | Built with soofi-xyz kit agents/skills |
| Reproducibility | 4 | Can be reached/reproduced from PR |
| Speed | 4 | Elapsed delivery time |

### Scoring Bands (Deterministic)

- **0% (0 band)** — Not demonstrated / absent
- **25% (1 band)** — Barely present; major gaps
- **50% (2 band)** — Partially demonstrated; clear gaps
- **75% (3 band)** — Largely demonstrated with minor gaps
- **100% (4 band)** — Fully demonstrated with direct evidence

### Oracle Assignment Evidence Catalog

For the Oracle Property Intelligence Platform, Slowking expects:
- **Loaded dataset at realistic scale** — toy datasets score extremely low
- **Canonical entity modeling** — reconciled, deduplicated
- **Source provenance** — every record traceable
- **RAG retrieval** — agent answers with source-backed evidence
- **Exploration UI** — browse/query the data
- **Required workflows over real records** — continuous pipeline demonstrated

### One-Sentence Intent (Non-Negotiable)

Before scoring, Slowking derives: "A `<actor>` can `<achieve outcome>` so that `<business value>`"
If this cannot be articulated, the assignment fails.

## Golden Path Engineering Guidelines

### Non-Negotiables (MANDATORY)

1. **TypeScript for ALL services** — Python ONLY for PySpark + Glue jobs
2. **Vercel AI SDK for ALL LLM interactions** — Direct provider SDKs forbidden (`openai`, `@anthropic-ai/sdk`)
3. **AWS as primary cloud, us-east-2 primary region**
4. **CDK is ONLY permitted IaC tool** — No Terraform, Pulumi, SAM, CF YAML
5. **No secrets in logs**
6. **Every metric registered in Lexicon** — cloudwatch-metrics.json entry required
7. **Every service MUST page on-call via PagerDuty** for critical failures

### High-Priority Standards

- Testing: Vitest (TS) / Pytest (Python)
- Formatting: Prettier + ESLint (TS), Ruff (Python)
- Type checking: tsc (TS), basedpyright (Python)
- Observability: Powertools (Logger + Tracer + Metrics), CloudWatch, X-Ray
- DLQ: Self-resolving CloudWatch alarm per DLQ

## Relevant Agents for Our Work

- **Oracle agent** — Discovers/ingests/validates/refreshes county property records into Neon query DB. Orchestrates elephant-xyz/skills against oracle-node pipeline. Reference county: Lee, FL
- **Donphan agent** — Explores Elephant MCP open-data properties via bundled `@elephant-xyz/mcp` tools
- **Arceus agent** — Master router, recommends specialists and skills

## Relevant Skills for Our Work

- `use-oracle` — Operate Oracle ingestion: install elephant-xyz/skills, drive onboard-county + stage skills on oracle-node pipeline
- `use-elephant-mcp` — Explore Elephant Oracle open-data via bundled MCP
- `use-elephant-query-db` — Consume Vercel Neon elephant-query-db with Drizzle
- `apply-engineering-guidelines` — Golden Path baseline for ALL tasks
- `evaluate-candidate-intent` — Understand how intent is derived
- `evaluate-candidate-product` — Understand what runtime evidence is gathered

## MCP Integration

Bundled elephant-mcp (Node 22.18+) with:
- `PROPERTY_QUERY_TABLE_MAP` — IPFS/IPNS URLs to property query tables per county
- `ORACLE_OPEN_DATA_IPNS_MAP` — IPNS names for open-data catalogs
- `ORACLE_GEO_INDEX_IPNS` — Geo-index IPNS name
- `PERMIT_QUERY_TABLE_MAP` — Permit table IPFS/IPNS URLs

Reference counties already configured: Lee (~512k), Palm Beach (~654k), Miami-Dade (~933k), Orange, Santa Clara.

## Key Takeaways for Our Implementation

1. **Deploy to hosted runtime** — This is the #1 gate. No localhost.
2. **Realistic data scale** — Load 100k+ Duval County properties, not 50. Toy = extremely low score.
3. **Prove the business intent** — Functional outcome (40 pts) + runtime quality (20 pts) = 60% of score.
4. **Follow Golden Path** — TypeScript, CDK, Vercel AI SDK, PagerDuty, Powertools observability.
5. **Use the kit** — Reference Oracle agent, use-oracle skill, elephant-mcp. Kit conformance is scored.
6. **Demo artifact required** — Record a video walkthrough of the end-to-end flow.
7. **PR to designated repo** — Submit against the assignment repository, not a standalone fork.
8. **Speed matters (4 pts)** — But outcome matters 15x more (60 pts).
