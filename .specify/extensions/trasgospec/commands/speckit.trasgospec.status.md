---
description: Set, validate, or revert lifecycle status on a feature.
scripts:
  sh: scripts/bash/status-change.sh
---

## User Input

```text
$ARGUMENTS
```

## Goal

Manage lifecycle status for the current feature. Supports setting status to any valid phase, blocking/unblocking, and validating current status.

## Outline

1. Parse the user's input to determine the action and arguments:
   - `set <phase>` — Set status to a lifecycle phase
   - `blocked` — Mark the feature as blocked
   - `unblock` — Restore previous status from git history
   - `validate` — Show current status without changing it
   - No arguments — Show usage help

2. Run `{SCRIPT} <action> [args...]` from the repo root and parse the JSON output.

3. If `success` is `true`:
   - Display: "Status changed: **{old_status}** → **{new_status}** in `{file}`"
   - If action was `unblock`, also display: "Previous status recovered from git history."

4. If `success` is `false`:
   - If `gate_failures` is present: Display quality gate failures as a bulleted list and suggest which sections need to be completed.
   - If `error` is present: Display the error message.
   - If `valid_phases` is present: Display the list of valid lifecycle phases.

5. If the script fails (non-zero exit): Display the error and stop.

## Valid Lifecycle Phases

| Phase | Description |
|-------|-------------|
| Discovery | PRD in progress |
| Opportunity | PRD complete, validated |
| Planning | Spec and plan being written |
| Ready to Dev | Spec and plan complete |
| In Progress | Tasks and implementation underway |
| In Review | PR open, team reviewing |
| Delivered | Branch merged to main |
| Blocked | Human decision needed (lateral) |

## Done When

- [ ] Status action executed and result displayed to user
