---
name: speckit-trasgospec-flow-gate
description: Enforce GitHub Flow branch discipline — gate or create feature branches.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: trasgospec:commands/speckit.trasgospec.flow-gate.md
---

## User Input

```text
$ARGUMENTS
```

## Goal

Enforce GitHub Flow branching discipline. This command operates in two modes:

1. **After-specify mode** (`after_specify` hook): Read the `expected_branch` from the newly created spec and create/switch to that branch.
2. **Before-* mode** (`before_*` hooks): Block execution if on `main`, warn if on wrong branch, pass if on correct feature branch.

## Outline

1. Run `.specify/extensions/trasgospec/scripts/bash/flow-context.sh` from the repo root and parse the JSON output.

2. **Determine mode** by checking the hook context:
   - If invoked as `after_specify` hook: use **after-specify mode**
   - If invoked as `before_*` hook: use **before-* mode**
   - If invoked directly (no hook context): use **before-* mode**

3. **After-specify mode**:

   a. Read `expected_branch` from the script output.

   b. If `expected_branch` is null:
      - Display: "No **Feature Branch** field found in spec.md. Please add one and run again."
      - Stop. Do not block the skill.

   c. If `current_branch` equals `expected_branch`:
      - Display: "Already on branch `{expected_branch}`. Proceeding."
      - Stop. Allow the skill to proceed.

   d. If `current_branch` does not equal `expected_branch`:
      - Check if branch `expected_branch` already exists: run `git rev-parse --verify {expected_branch}`
      - If branch exists: run `git checkout {expected_branch}` and display: "Switched to existing branch `{expected_branch}`."
      - If branch does not exist: run `git checkout -b {expected_branch}` and display: "Created and switched to branch `{expected_branch}`."

4. **Before-* mode**:

   a. If `current_branch` is null (detached HEAD):
      - Display error: "You are on a detached HEAD. GitHub Flow requires a named feature branch."
      - If `expected_branch` is available, suggest: "Run: `git checkout -b {expected_branch}`"
      - **BLOCK** — do not allow the skill to proceed.

   b. If `is_main` is true:
      - Display error: "You are on `main`. GitHub Flow requires a feature branch for spec-driven work."
      - If `expected_branch` is available, offer: "Create and switch to branch `{expected_branch}`? [Y/n]"
        - If user accepts: create/switch to the branch (same logic as after-specify mode step 3d)
        - If user declines: **BLOCK** — do not allow the skill to proceed.
      - If `expected_branch` is null: suggest the user create a branch manually and **BLOCK**.

   c. If `is_main` is false and `spec_branch_match` is false and `expected_branch` is not null:
      - Display warning: "You are on `{current_branch}` but the spec expects `{expected_branch}`. Proceeding anyway."
      - Allow the skill to proceed (warn only, do not block).

   d. If `is_main` is false and (`spec_branch_match` is true or null):
      - Allow the skill to proceed silently.