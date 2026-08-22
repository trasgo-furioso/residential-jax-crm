README.md contain the input coming from the stakeholders.

skills/README.md is auto-explained and we need them for implementing the product.

soofi-xyz-team-kit/README.md is a kit of development agents that we must leverage for implementation.

# soofi-xyz Team Kit Usage Guide

The `soofi-xyz-team-kit/` directory contains a company-wide kit of specialist agents and skills for AI-assisted development. This guide explains how to use them in any project with Claude Code.

## Structure

```
soofi-xyz-team-kit/
├── agents/          # Agent personas (markdown definitions)
├── skills/          # Implementation playbooks (SKILL.md + rules/)
└── README.md        # Full roster with descriptions and triggers
```

- **Agents** are personas — they define *who* does the work (role, constraints, handoff behavior). They do NOT contain implementation knowledge.
- **Skills** are playbooks — they define *how* to do the work (rules, patterns, code conventions, reference material). Skills are installed in `.claude/skills/` and loaded automatically.

## How to route: start with Arceus

Before starting any task, consult `arceus` (the master router) to determine which agent(s) and skill(s) to use. Arceus reads the README.md and individual agent/skill files to make a grounded recommendation.

```
# Spawn an Explore agent that acts as Arceus
Agent prompt: "You are Arceus, the master router. Read soofi-xyz-team-kit/README.md
and the relevant agent/skill .md files, then recommend which agent(s) and skill(s)
should handle: <describe your task>"
```

Arceus returns:
- **Primary agent** — single best-fit agent with rationale
- **Supporting skills** — always includes `apply-engineering-guidelines` as baseline, plus task-specific skills
- **Secondary agents** — only if the task crosses domains
- **Invocation hint** — how to use the recommendation

## How to use agents in Claude Code

Agents are markdown files defining a persona. In Claude Code, use them as prompts when spawning subagents:

1. Read the agent definition: `soofi-xyz-team-kit/agents/<name>.md`
2. Read the associated skill(s): `.claude/skills/<skill-name>/SKILL.md` + `rules/*.md`
3. Include both in the Agent prompt so the subagent has the persona AND the implementation knowledge

```
# Example: using metagross to scaffold a monorepo
Agent prompt: "You are metagross. <paste agent instructions>
Load these skills: <paste relevant skill rules>
Task: Scaffold a Turborepo monorepo for <project description>"
```

## Key agents by domain

| Domain | Agent | Skills | Use for |
|--------|-------|--------|---------|
| Fullstack apps | `metagross` | `build-frontend-backends` | Turborepo monorepo, tRPC, Amplify, CDK |
| AI/RAG agents | `ash`, `alakazam`, `espeon` | `build-ai-agents`, `build-rag-systems`, `build-local-rag-pocs` | Lambda agents, Vercel AI SDK, OpenSearch RAG |
| Batch workflows | `machamp` | `build-batch-workflows` | Step Functions, Glue PySpark, cost gates |
| Frontend bugs | `audino` | `frontend-bug-fix` | Design comparison, minimal fixes, regression tests |
| Figma → code | `sylveon` | `figma-to-code` | Update code from Figma, preserve logic |
| Responsive tests | `smeargle` | `responsive-design-tests` | Playwright design specs across breakpoints |
| Elephant data | `donphan` | `use-elephant-mcp` | Explore Oracle open-data via MCP |
| Data ingestion | `oracle` | `use-oracle` | County property/permit ingestion pipeline |
| Platform services | `conkeldurr` | Various `build-*-service` | Account, Marketplace, Deployer, Persist, etc. |
| Candidate eval | `slowking` | `evaluate-candidate-*` | Assignment evaluation with runtime testing |
| Routing | `arceus` | — | Route to the right specialist (does not implement) |

## Non-negotiable skill: apply-engineering-guidelines

Every task in every project MUST load `apply-engineering-guidelines` as baseline. It enforces:

- **TypeScript** for all services (Python only for PySpark/Glue)
- **Vercel AI SDK** for all LLM interactions (no direct provider SDKs)
- **AWS** primary cloud, **us-east-2** primary region
- **CDK** is the ONLY permitted IaC tool
- **Powertools** Logger + Tracer + Metrics on every Lambda
- **PagerDuty** alerting for critical failures (MUST page on-call)
- **Vitest** (TypeScript) / **Pytest** (Python) for testing
- **GitHub Actions** for CI/CD
- **Every metric registered in Lexicon** with CloudWatch dashboard widget

## Workflow pattern

1. **Route**: Consult `arceus` → get agent + skills recommendation
2. **Document**: Record agent/skill mapping in plan.md (per-phase table)
3. **Implement**: Spawn agents with the persona + skill rules as prompt context
4. **Verify**: Check implementation against `apply-engineering-guidelines` rules

## Adding the kit to a new project

1. Add `soofi-xyz-team-kit` as a git submodule or copy it into the project
2. Install skills: copy `soofi-xyz-team-kit/skills/` contents into `.claude/skills/`
3. Reference agents from `soofi-xyz-team-kit/agents/` when spawning subagents
4. Add this guide to the project's CLAUDE.md


# Agent Orchestration

You are the orchestrator, you delegate operations to async agents to keep you context clean and be able to orchestrate end to end. Never run explorations, coding, testing, research by yourself, always spawn an agent. Keep me informed about async runs using TaskCreate.

All spec-driven workflow and implementation MUST follow a two-layer orchestration pattern:

**Orchestrator** (main agent):
- Manages workflow lifecycle and launches async background agents
- Uses `TaskCreate`/`TaskUpdate` to display progress status to the user
- Commits spec artifacts and e2e tests to the root repo (`/Users/trasgofurioso/Code/elephant/`)
- MUST NOT run speckit skills (`speckit-specify`, `speckit-plan`, `speckit-tasks`, `speckit-converge`, `speckit-implement`) inline — these MUST be delegated to async agents

**Async agents** (background workers):
- Speckit skills (`specify`, `plan`, `tasks`, `converge`, `implement`) MUST be launched as async background agents
- Explore agents (`subagent_type=Explore`) MUST ALWAYS run in background (`run_in_background: true`)
- `/research` skill invocations MUST ALWAYS run in background as async agents
- Agents create files and report results back to the orchestrator
- Implementation agents MUST `cd` into the delivery repo before working and commit there
- Delivery repos are git submodules of the root repo (see Git Submodule Strategy below)

# Commit Message Format (all repos)

ALL commits — root repo AND delivery repos — MUST use the trasgospec commit format. One line per changed file, no blank lines between entries:

```
<repo-relative-path> - <description>
<repo-relative-path> - <description>
```

**Rules**:
- Each line: `<repo-relative-path> - <description>`
- Descriptions are concise (under 80 chars), meaningful, derived from inspecting diffs or file content
- Focus on *what changed* and *why*, not just "updated" or "modified"
- No conventional-commit tags (`feat:`, `fix:`, `chore:`), no headers, no footers, no bullets, no blank lines
- No `Co-Authored-By` or other git trailers
- Lowercase descriptions unless referring to proper nouns
- Stage files explicitly by name — never `git add .` or `git add -A`
- Do NOT commit files that look like secrets (`.env`, credentials, tokens, keys)

**Good examples**:
```
pipeline/src/lib/db.ts - implemented Postgres connection pool and typed query helpers
pipeline/src/migrations/001-initial-schema.sql - created tables for pipeline_runs, data_sources, properties
pipeline/src/lib/filebase.ts - added S3 client wrapper for Filebase with CID pre-computation
```

**Bad examples**:
```
feat: add database layer                  <- NO tags/prefixes
Updated db.ts                             <- NO generic descriptions, NO bare filenames
- pipeline/src/lib/db.ts - added pool     <- NO leading dashes or bullets
```

**In delivery repos**: implementation agents follow this format directly when committing. No script needed — just compose the message from the staged changes.

**In root repo**: the `/speckit-trasgospec-commit` skill automates this via `commit.sh`. Use it when available.