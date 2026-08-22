#!/usr/bin/env bash
# flow-nudge.sh — Gather PR state and infer phase for PR lifecycle nudges.
#
# Sources flow-context.sh for git-local state, then adds:
# - gh availability and integration setting
# - PR state (via gh, when available and enabled)
# - Phase inference from spec artifacts
# - Suggested action based on phase + PR state
#
# Output (stdout, single line JSON):
#   {"flow_context":{...},"gh_available":...,"gh_integration":...,"has_open_pr":...,...}
#
# Exit codes:
#   0 — success
#   1 — not a git repository or fatal error
#
# Portability: targets bash 3.2+ (macOS default).
set -euo pipefail

# --- Locate repo root and source flow-context.sh ----------------------------
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

# Run flow-context.sh and capture its output
flow_context_script="$SCRIPT_DIR/flow-context.sh"
if [ ! -f "$flow_context_script" ]; then
    echo "flow-nudge: flow-context.sh not found at $flow_context_script" >&2
    exit 1
fi

flow_context_json="$(bash "$flow_context_script" 2>/dev/null)"
if [ -z "$flow_context_json" ]; then
    echo "flow-nudge: flow-context.sh produced no output" >&2
    exit 1
fi

# --- Fallback json_escape ----------------------------------------------------
if ! declare -F json_escape >/dev/null 2>&1; then
    json_escape() {
        local s="$1"
        s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
        s="${s//$'\n'/\\n}"; s="${s//$'\t'/\\t}"; s="${s//$'\r'/\\r}"
        printf '%s' "$s"
    }
fi

# --- Check gh availability ---------------------------------------------------
if command -v gh >/dev/null 2>&1; then
    gh_available="true"
else
    gh_available="false"
    echo "flow-nudge: gh not found, PR fields will be empty" >&2
fi

# --- Read gh_integration setting ----------------------------------------------
gh_integration="true"  # default
extensions_yml="$REPO_ROOT/.specify/extensions.yml"
if [ -f "$extensions_yml" ]; then
    # Simple grep for gh_integration setting
    gh_line="$(grep -m1 'gh_integration:' "$extensions_yml" 2>/dev/null || true)"
    if [ -n "$gh_line" ]; then
        gh_val="$(printf '%s' "$gh_line" | sed 's/.*gh_integration:[[:space:]]*//' | sed 's/[[:space:]]*$//')"
        if [ "$gh_val" = "false" ]; then
            gh_integration="false"
        fi
    fi
fi

# --- Query PR state -----------------------------------------------------------
has_open_pr="false"
pr_is_draft="false"
pr_number="null"
pr_url="null"

if [ "$gh_available" = "true" ] && [ "$gh_integration" = "true" ]; then
    pr_json="$(gh pr view --json number,state,isDraft,url 2>/dev/null || true)"
    if [ -n "$pr_json" ]; then
        # Extract fields using simple pattern matching (no jq dependency)
        pr_state="$(printf '%s' "$pr_json" | grep -o '"state":"[^"]*"' | head -1 | sed 's/"state":"//;s/"//' || true)"
        if [ "$pr_state" = "OPEN" ]; then
            has_open_pr="true"
            pr_is_draft_raw="$(printf '%s' "$pr_json" | grep -o '"isDraft":[a-z]*' | head -1 | sed 's/"isDraft"://' || true)"
            if [ "$pr_is_draft_raw" = "true" ]; then
                pr_is_draft="true"
            fi
            pr_number_raw="$(printf '%s' "$pr_json" | grep -o '"number":[0-9]*' | head -1 | sed 's/"number"://' || true)"
            if [ -n "$pr_number_raw" ]; then
                pr_number="$pr_number_raw"
            fi
            pr_url_raw="$(printf '%s' "$pr_json" | grep -o '"url":"[^"]*"' | head -1 | sed 's/"url":"//;s/"//' || true)"
            if [ -n "$pr_url_raw" ]; then
                pr_url="\"$(json_escape "$pr_url_raw")\""
            fi
        fi
    fi
else
    if [ "$gh_integration" = "false" ]; then
        echo "flow-nudge: gh_integration disabled, skipping PR queries" >&2
    fi
fi

# --- Infer phase from artifacts -----------------------------------------------
inferred_phase="analyze"  # default fallback

# Read spec_dir from flow context
spec_dir="$(printf '%s' "$flow_context_json" | grep -o '"spec_dir":"[^"]*"' | head -1 | sed 's/"spec_dir":"//;s/"//' || true)"

if [ -n "$spec_dir" ] && [ "$spec_dir" != "null" ]; then
    spec_abs="$REPO_ROOT/$spec_dir"
    if [ -f "$spec_abs/tasks.md" ]; then
        inferred_phase="implement"
    elif [ -f "$spec_abs/plan.md" ]; then
        inferred_phase="plan"
    fi
else
    echo "flow-nudge: feature.json not found, cannot infer phase" >&2
fi

# --- Compute suggested action -------------------------------------------------
suggested_action="none"

case "$inferred_phase" in
    plan)
        if [ "$has_open_pr" = "false" ]; then
            suggested_action="create_draft"
        fi
        ;;
    implement)
        if [ "$has_open_pr" = "false" ]; then
            suggested_action="create_draft"
        elif [ "$pr_is_draft" = "true" ]; then
            suggested_action="mark_ready"
        fi
        ;;
    analyze)
        if [ "$has_open_pr" = "true" ]; then
            suggested_action="final_review"
        elif [ "$has_open_pr" = "false" ]; then
            suggested_action="create_draft"
        fi
        ;;
esac

# --- Emit JSON contract -------------------------------------------------------
printf '{"flow_context":%s,"gh_available":%s,"gh_integration":%s,"has_open_pr":%s,"pr_is_draft":%s,"pr_number":%s,"pr_url":%s,"inferred_phase":"%s","suggested_action":"%s"}\n' \
    "$flow_context_json" \
    "$gh_available" \
    "$gh_integration" \
    "$has_open_pr" \
    "$pr_is_draft" \
    "$pr_number" \
    "$pr_url" \
    "$inferred_phase" \
    "$suggested_action"
