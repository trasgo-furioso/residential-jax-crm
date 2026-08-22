---
name: speckit-trasgospec-roadmap
description: View the project roadmap as a markdown table showing all feature specs
  with their ID, title, status, and creation date.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: trasgospec:commands/speckit.trasgospec.roadmap.md
---

## User Input

```text
$ARGUMENTS
```

## Goal

Display a consolidated roadmap view of all feature specifications in the current project. This is a read-only command that never modifies any files.

## Outline

1. Run `.specify/extensions/trasgospec/scripts/bash/scan-specs.sh` from the repo root and parse the JSON output. The script emits a single-line JSON object with `specs_dir` and `specs` fields.

2. If the `specs` array is empty, display:

   ```
   No features have been specified yet. Use `/speckit-specify` to create your first feature spec.
   ```

   Stop here.

3. If the `specs` array has entries, render a markdown table with these columns:

   | ID  | Title | Status | Created |
   |-----|-------|--------|---------|

   - **ID**: The spec directory name (e.g., `001-bundle-install`)
   - **Title**: The extracted feature title
   - **Status**: The spec's current status (e.g., Draft, In Progress, Complete)
   - **Created**: The creation date

   List entries in the order returned by the script (already sorted by directory name).

4. After the table, display a summary line:

   ```
   **Total**: N feature(s)
   ```