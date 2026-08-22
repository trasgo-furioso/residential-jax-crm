<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Added principles:
  - V. Agent Orchestration
- Modified principles: none
- Added sections: none
- Removed sections: none
- Deferred items: none
-->

# Elephant Oracle Platform Constitution

## Core Principles

### I. Elephant Protocol Alignment

All data ingestion, transformation, and publishing MUST follow Elephant Protocol conventions:
- Lexicon schema for cross-jurisdictional property data consistency
- Content-addressed storage via IPFS with Filebase pinning
- Stable IPNS pointers per county for MCP consumption
- RFC 8785 canonical JSON for deterministic hashing
- Per-property JSON + sharded index + query-table Parquet layout
- CIDs pre-computed locally with `ipfs-only-hash` before upload
- Oracle skills (`onboard-county`, stage skills) as the prescribed pipeline pattern

Deviation from Elephant conventions MUST be justified and documented.

### II. Golden Path Engineering

All implementation MUST follow the soofi-xyz Golden Path standards:
- **TypeScript for ALL services** — Python is permitted ONLY for PySpark + Glue jobs
- **Vercel AI SDK for ALL LLM interactions** — direct provider SDKs (`openai`, `@anthropic-ai/sdk`, `@aws-sdk/client-bedrock-runtime`) are forbidden
- **AWS as primary cloud, us-east-2 primary region**
- **CDK is the ONLY permitted IaC tool** — no Terraform, Pulumi, SAM, or CloudFormation YAML/JSON
- **Observability**: Powertools (Logger + Tracer + Metrics), CloudWatch, X-Ray on every service
- **PagerDuty alerting**: every service MUST page on-call for critical failures; swallowing critical failures with log-only handlers is forbidden
- **Testing**: Vitest (TypeScript), Pytest (Python), CI via GitHub Actions
- **Formatting**: Prettier + ESLint (TypeScript), Ruff (Python)
- **Every metric MUST be registered in Lexicon** with a `cloudwatch-metrics.json` entry

### III. Deployment-First

Every deliverable MUST be deployed to a hosted runtime accessible without building, installing, or running the application locally:
- Localhost, 127.0.0.1, local Docker, "clone and run locally", or tunnels are NOT acceptable as delivery
- The deployed runtime is the primary evidence artifact — code review without a working runtime is insufficient
- A demo artifact (video walkthrough preferred) MUST accompany every submission
- Credentials MUST be provided or the runtime MUST be publicly accessible
- Work MUST be submitted as a PR to the designated assignment repository

### IV. Realistic Data Scale

All data pipelines and query systems MUST operate at realistic production-like volumes:
- Reference county volumes: Lee (~512k properties), Palm Beach (~654k), Miami-Dade (~933k)
- Loading fewer than thousands of real records is considered a "toy dataset" and is unacceptable
- Data MUST come from real county public sources, not synthetic or fabricated records
- Scale signals (record counts, source diversity, query performance under load) are primary evaluation criteria
- Coverage gaps MUST be documented with specific source limitations, not silently omitted

### V. Agent Orchestration

All spec-driven workflow and implementation MUST follow a two-layer orchestration pattern:

**Orchestrator** (main agent):
- Manages workflow lifecycle and launches async background agents
- Uses `TaskCreate`/`TaskUpdate` to display progress status to the user
- Commits spec artifacts and e2e tests to the root repo (`/Users/trasgofurioso/Code/elephant/`)
- MUST NOT run speckit skills (`speckit-specify`, `speckit-plan`, `speckit-tasks`, `speckit-converge`, `speckit-implement`) inline — these MUST be delegated to async agents

**Async agents** (background workers):
- Speckit skills (`specify`, `plan`, `tasks`, `converge`, `implement`) MUST be launched as async background agents
- Agents create files and report results back to the orchestrator
- Implementation agents MUST `cd` into the delivery repo before working and commit there
- Delivery repos are separate git clones of the designated assignment repositories

**Repository boundaries**:
- Root repo: spec artifacts, e2e tests, research, orchestration
- `oracle-property-intelligence-platform-pipeline-duval-fl/`: pipeline delivery repo (R1)
- `residential-jax-crm/`: CRM delivery repo (R2)
- Implementation agents MUST NOT commit to the root repo; orchestrator MUST NOT commit to delivery repos

## Technology Constraints

- **Database**: DuckDB for local/portable analytical querying; Vercel Neon for hosted query DB
- **Storage**: Elephant IPFS via Filebase (S3-compatible) with IPNS pointers
- **Infrastructure cost**: Oracle MUST NOT carry ongoing hosted-database cost by default
- **MCP**: Stateless per-consumer MCP servers reading published IPNS data
- **Kit conformance**: Implementation SHOULD reference soofi-xyz kit agents (Oracle, Donphan, Arceus) and skills (`use-oracle`, `use-elephant-mcp`, `apply-engineering-guidelines`)

## Quality Gates

- **PR gate**: All work submitted as PR to designated repository
- **Runtime gate**: Deployed, hosted runtime exercisable without local setup
- **Credentials gate**: Working access credentials present or runtime is public
- **Demo gate**: Demo artifact present and reachable
- **Data gate**: Realistic record volumes loaded from real county sources
- **Provenance gate**: 100% of records include source provenance and collection timestamp

## Governance

This constitution supersedes default practices for all Elephant Oracle Platform work. Amendments require:
- Documentation of the change and rationale
- Version increment following semantic versioning (MAJOR: principle removal/redefinition, MINOR: new principle/section, PATCH: clarification/wording)
- Review against existing specs to identify impact

All PRs and reviews MUST verify compliance with these principles. Complexity or deviation MUST be justified in the PR description.

**Version**: 1.1.0 | **Ratified**: 2026-08-20 | **Last Amended**: 2026-08-20
