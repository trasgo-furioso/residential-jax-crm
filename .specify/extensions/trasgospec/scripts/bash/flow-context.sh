#!/usr/bin/env bash
# flow-context.sh — Gather deterministic git state and emit as JSON.
#
# Reads the expected branch name from the **Feature Branch**: field
# in the active spec's spec.md (located via .specify/feature.json).
#
# Output (stdout, single line JSON):
#   {"current_branch":"...","is_main":...,"spec_dir":"...","expected_branch":"...",
#    "spec_branch_match":...,"branch_age_days":...,"commits_behind_main":...,"uncommitted_changes":...}
#
# Exit codes:
#   0 — success
#   1 — not a git repository or fatal error
#
# Portability: targets bash 3.2+ (macOS default).
set -euo pipefail

# --- Locate repo root --------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

_find_specify_root() {
    local d="$1"
    while [ -n "$d" ] && [ "$d" != "/" ]; do
        if [ -d "$d/.specify" ]; then printf '%s' "$d"; return 0; fi
        d="$(dirname -- "$d")"
    done
    [ -d "/.specify" ] && { printf '/'; return 0; }
    return 1
}

REPO_ROOT="$(_find_specify_root "$PWD" || true)"
[ -n "$REPO_ROOT" ] || REPO_ROOT="$(_find_specify_root "$SCRIPT_DIR" || true)"
[ -n "$REPO_ROOT" ] || REPO_ROOT="$PWD"

# --- Verify git repository ---------------------------------------------------
if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    echo "flow-context: not a git repository" >&2
    exit 1
fi

# --- Optionally source core common.sh ----------------------------------------
_common=""
for up in "$REPO_ROOT/.specify/scripts/bash/common.sh" \
          "$SCRIPT_DIR/../../../.specify/scripts/bash/common.sh"; do
    if [ -f "$up" ]; then _common="$up"; break; fi
done
if [ -n "$_common" ]; then
    # shellcheck source=/dev/null
    . "$_common" 2>/dev/null || true
fi

# Fallback json_escape if core helper was not sourced.
if ! declare -F json_escape >/dev/null 2>&1; then
    json_escape() {
        local s="$1"
        s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
        s="${s//$'\n'/\\n}"; s="${s//$'\t'/\\t}"; s="${s//$'\r'/\\r}"
        printf '%s' "$s"
    }
fi

# --- Gather git state ---------------------------------------------------------

# Current branch (null if detached HEAD)
current_branch="$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || true)"

# is_main
if [ "$current_branch" = "main" ]; then
    is_main="true"
else
    is_main="false"
fi

# --- Read spec context from feature.json and spec.md -------------------------
spec_dir=""
expected_branch=""
feature_json="$REPO_ROOT/.specify/feature.json"

if [ -f "$feature_json" ]; then
    # Extract feature_directory value (simple grep, no jq dependency)
    spec_dir_raw="$(grep -o '"feature_directory"[[:space:]]*:[[:space:]]*"[^"]*"' "$feature_json" 2>/dev/null || true)"
    if [ -n "$spec_dir_raw" ]; then
        # Extract the value between the last pair of quotes
        spec_dir="$(printf '%s' "$spec_dir_raw" | sed 's/.*:.*"\([^"]*\)"/\1/')"
    fi

    # Read expected_branch from spec.md
    if [ -n "$spec_dir" ]; then
        spec_file="$REPO_ROOT/$spec_dir/spec.md"
        if [ -f "$spec_file" ]; then
            branch_line="$(grep -m1 '^\*\*Feature Branch\*\*:' "$spec_file" 2>/dev/null || true)"
            if [ -n "$branch_line" ]; then
                # Strip "**Feature Branch**: " prefix
                expected_branch="${branch_line#\*\*Feature Branch\*\*: }"
                # Strip backtick wrapping
                expected_branch="$(printf '%s' "$expected_branch" | sed 's/^[[:space:]]*`//;s/`[[:space:]]*$//')"
                # Trim whitespace
                expected_branch="$(printf '%s' "$expected_branch" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
            else
                echo "flow-context: spec.md has no Feature Branch field" >&2
            fi
        fi
    fi
else
    echo "flow-context: feature.json not found, skipping spec context" >&2
fi

# --- Compute spec_branch_match -----------------------------------------------
# null if expected_branch is empty, true/false otherwise
spec_branch_match=""
if [ -n "$expected_branch" ] && [ -n "$current_branch" ]; then
    if [ "$current_branch" = "$expected_branch" ]; then
        spec_branch_match="true"
    else
        spec_branch_match="false"
    fi
fi

# --- Compute branch age and divergence ---------------------------------------
branch_age_days=0
commits_behind_main=0

# Check if main branch exists
has_main="$(git -C "$REPO_ROOT" rev-parse --verify main >/dev/null 2>&1 && echo yes || echo no)"

if [ "$has_main" = "yes" ] && [ "$is_main" = "false" ] && [ -n "$current_branch" ]; then
    # Branch age: days since first divergent commit
    first_commit_date="$(git -C "$REPO_ROOT" log main..HEAD --format="%ai" --reverse 2>/dev/null | head -1 || true)"
    if [ -n "$first_commit_date" ]; then
        # Extract just the date portion (YYYY-MM-DD)
        first_date="$(printf '%s' "$first_commit_date" | cut -d' ' -f1)"
        today="$(date +%Y-%m-%d)"
        # Compute difference in days using portable date arithmetic
        if command -v python3 >/dev/null 2>&1; then
            branch_age_days="$(python3 -c "
from datetime import date
d1 = date.fromisoformat('$first_date')
d2 = date.fromisoformat('$today')
print((d2 - d1).days)
" 2>/dev/null || echo 0)"
        else
            branch_age_days=0
        fi
    fi

    # Commits behind main
    commits_behind_main="$(git -C "$REPO_ROOT" rev-list HEAD..main --count 2>/dev/null || echo 0)"
elif [ "$has_main" = "no" ]; then
    echo "flow-context: main branch not found, defaulting to zero divergence" >&2
fi

# --- Uncommitted changes -----------------------------------------------------
porcelain="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)"
if [ -n "$porcelain" ]; then
    uncommitted_changes="true"
else
    uncommitted_changes="false"
fi

# --- Emit JSON contract -------------------------------------------------------
# Build JSON, handling null values
if [ -n "$current_branch" ]; then
    branch_json="\"$(json_escape "$current_branch")\""
else
    branch_json="null"
fi

if [ -n "$spec_dir" ]; then
    spec_dir_json="\"$(json_escape "$spec_dir")\""
else
    spec_dir_json="null"
fi

if [ -n "$expected_branch" ]; then
    expected_branch_json="\"$(json_escape "$expected_branch")\""
else
    expected_branch_json="null"
fi

if [ -n "$spec_branch_match" ]; then
    spec_branch_match_json="$spec_branch_match"
else
    spec_branch_match_json="null"
fi

printf '{"current_branch":%s,"is_main":%s,"spec_dir":%s,"expected_branch":%s,"spec_branch_match":%s,"branch_age_days":%d,"commits_behind_main":%d,"uncommitted_changes":%s}\n' \
    "$branch_json" \
    "$is_main" \
    "$spec_dir_json" \
    "$expected_branch_json" \
    "$spec_branch_match_json" \
    "$branch_age_days" \
    "$commits_behind_main" \
    "$uncommitted_changes"
