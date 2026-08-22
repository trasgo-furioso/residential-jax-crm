---
description: Suggest PR lifecycle actions at workflow milestones.
scripts:
  sh: scripts/bash/flow-nudge.sh
---

## User Input

```text
$ARGUMENTS
```

## Goal

Suggest pull request actions at appropriate workflow milestones. This command is designed to run as an optional `after_*` hook at the plan, implement, and analyze phases.

## Outline

1. Run `{SCRIPT}` from the repo root and parse the JSON output.

2. Check `suggested_action` to determine what to suggest:

   - **`none`**: No action needed. Display nothing or a brief "PR is up to date."

   - **`create_draft`**: Suggest opening a draft PR.

     If `gh_integration` is `true` and `gh_available` is `true`:
     - Compose a PR title from the spec: `feat(<spec_dir_basename>): <spec_title>`
     - Compose a PR body from spec.md summary
     - Offer: "Open a draft PR? [Y/n]"
     - If accepted: run `gh pr create --draft --title "..." --body "..."`
     - Display the resulting PR URL

     If `gh_integration` is `false` OR `gh_available` is `false`:
     - Display the suggested PR details:
       ```
       PR Action Suggested: Open Draft PR

         Title:  feat(<spec_dir_basename>): <spec_title>
         Branch: <current_branch> → main
         Body:   <summary from spec>

         Run: gh pr create --draft --title "..." --body "..."
       ```

   - **`mark_ready`**: Suggest marking the PR as ready for review.

     If `gh_integration` is `true` and `gh_available` is `true`:
     - Offer: "Mark PR #<pr_number> as ready for review? [Y/n]"
     - If accepted: run `gh pr ready`
     - Display confirmation

     If `gh_integration` is `false` OR `gh_available` is `false`:
     - Display:
       ```
       PR Action Suggested: Mark Ready for Review

         PR: #<pr_number> (<pr_url>)

         Run: gh pr ready
       ```

   - **`final_review`**: Suggest the PR is ready for final review.

     Display:
     ```
     PR Status: Ready for Final Review

       PR: #<pr_number> (<pr_url>)

       The implementation and analysis phases are complete.
       This PR is ready for team review and merge.
     ```

3. If `gh_available` is `false` and `gh_integration` is `true`:
   - Display once: "Note: `gh` CLI not found. Install it for automated PR management, or set `gh_integration: false` in `.specify/extensions.yml`."
