---
description: Guide interactive problem exploration and produce a structured PRD.
scripts:
  sh: scripts/bash/discovery.sh
---

## User Input

```text
$ARGUMENTS
```

## Pre-Execution Checks

**Check for extension hooks (before discovery)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_discovery` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Goal

Guide users through interactive problem exploration before they commit to a spec. Ask targeted questions one at a time, challenge vague statements, and optionally use web research to ground the conversation. Produce a structured PRD (`prd.md`) persisted in the specs directory.

## Outline

1. Run `{SCRIPT} --json` from the repo root, passing the user's input as a slug hint if provided. Parse the JSON output for `spec_dir`, `prd_path`, and `spec_number`.

2. If the script fails, display the error and stop.

3. **Begin the discovery conversation.** The user's initial input (from `$ARGUMENTS`) is the starting point. Analyze it to determine which PRD sections already have partial coverage and which are missing.

4. **Adaptive topic exploration.** Maintain an internal coverage map tracking these required sections:

   | Section | Status |
   |---------|--------|
   | Pain Point | empty / partial / complete |
   | Who | empty / partial / complete |
   | Current Alternatives | empty / partial / complete |
   | Desired Outcome | empty / partial / complete |
   | Jobs to Be Done | empty / partial / complete |
   | Assumptions | empty / partial / complete |

   Ask about the least-covered topic first. Follow the natural conversation flow rather than a fixed sequence. Assume users have product sense and can navigate the exploration.

5. **One question at a time.** Ask exactly one question per turn. Wait for the user's response before asking the next question.

6. **Challenge vague statements.** When the user provides vague or non-specific answers, push back with a targeted follow-up:
   - Non-specific audiences ("everyone", "all users") -> ask for a specific user segment or persona
   - Unmeasurable outcomes ("better", "faster", "more intuitive") -> ask what that means in observable or measurable terms
   - Undefined scope ("and more", "etc.") -> ask for specific examples
   - Missing specifics ("some kind of") -> ask for concrete details
   Do not challenge answers that are already specific enough.

7. **Incremental persistence.** After each topic reaches sufficient coverage, ask the user: "Want me to save this progress to prd.md?" If yes, write the current state to the `prd_path` from the script output. If no, continue but note that unpersisted content may be lost if the session is interrupted.

8. **Criteria-based completion.** When all required sections reach "complete" status, nudge the user: "The PRD covers all required topics. You can continue refining or say 'done' to finalize." The user can always continue adding detail.

9. **Web research (optional).** If the user passes `--research` or opts in during the conversation:
   - Use the `/research` skill to find information about the problem domain at natural conversation points (especially current alternatives and desired outcomes)
   - Present findings to the user for confirmation or correction
   - Persist results in the Research Findings section
   If web research is not enabled, skip this entirely and do not attempt any web calls.

10. **Session finalization.** When the user says "done":
    - Write the final `prd.md` with all sections populated from the conversation
    - Display the prd.md path
    - Suggest: "To generate a full spec from this PRD, run: `/speckit-specify <prd-path>`"

11. **Abort handling.** If the user wants to abort:
    - If no content has been persisted yet, exit without creating artifacts
    - If incremental saves have already been made, warn that a partial prd.md exists and offer to delete it or keep it as-is

## PRD Structure

The `prd.md` follows this structure:

```markdown
# PRD: [Feature Title]

**Created**: [YYYY-MM-DD]
**Discovery Session**: [YYYY-MM-DD]

## Problem Statement

**Pain Point**: [from conversation]

**Who**: [from conversation]

**Current Alternatives**: [from conversation]

**Desired Outcome**: [from conversation]

## Jobs to Be Done

- When [situation], I want to [motivation], so I can [outcome]

## Assumptions

- [Assumption 1]

## Research Findings

- [Finding 1 - only when web research was used]
```

When web research was not used, omit the Research Findings section entirely.

## Mandatory Post-Execution Hooks

**This section fires ONLY when the discovery session completed successfully and prd.md was written. If the session was aborted (step 11 path), skip this section entirely.**

**You MUST complete this section before reporting completion to the user.**

Check if `.specify/extensions.yml` exists in the project root.
- If it does not exist, or no hooks are registered under `hooks.after_discovery`, skip to the Completion Suggestions.
- If it exists, read it and look for entries under the `hooks.after_discovery` key.
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue to the Completion Suggestions.
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Mandatory hook** (`optional: false`) — **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## Done When

- [ ] Discovery conversation completed with all required sections covered
- [ ] prd.md written to the spec directory with populated content
- [ ] User informed of prd.md path and next steps
- [ ] Extension hooks dispatched or skipped according to the rules above
