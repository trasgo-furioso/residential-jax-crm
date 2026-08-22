#!/usr/bin/env bash
# scan-specs.sh — Scan specs/ directory and emit metadata as JSON.
#
# Deterministic only. Contains no judgment: it resolves paths, extracts
# text patterns from spec.md files, and emits a stable JSON contract on
# stdout.
#
# Output (stdout, single line JSON):
#   {"specs_dir":"specs","specs":[{"id":"...","title":"...","status":"...","created":"..."},...]}
#
# Exit codes:
#   0 — success (even if no specs found — empty array is valid)
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

# Prioritize CWD for repo root (the project being scanned), then
# fall back to script location (the bundle's own project).
REPO_ROOT="$(_find_specify_root "$PWD" || true)"
[ -n "$REPO_ROOT" ] || REPO_ROOT="$(_find_specify_root "$SCRIPT_DIR" || true)"
[ -n "$REPO_ROOT" ] || REPO_ROOT="$PWD"

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

# --- Scan specs directory -----------------------------------------------------
SPECS_DIR="$REPO_ROOT/specs"

# Start JSON output
specs_json=""

if [ -d "$SPECS_DIR" ]; then
    # Iterate over subdirectories sorted by name (natural ascending)
    for spec_dir in "$SPECS_DIR"/*/; do
        # Skip if glob didn't match (no subdirectories)
        [ -d "$spec_dir" ] || continue

        dir_name="$(basename -- "$spec_dir")"

        # Skip hidden directories
        case "$dir_name" in
            .*) continue ;;
        esac

        # Determine which file to scan (spec.md takes precedence over prd.md)
        if [ -f "$spec_dir/spec.md" ]; then
            spec_file="$spec_dir/spec.md"
        elif [ -f "$spec_dir/prd.md" ]; then
            spec_file="$spec_dir/prd.md"
        else
            continue
        fi

        # Extract title from "# Feature Specification: [TITLE]" or "# PRD: [TITLE]"
        title=""
        title_line="$(grep -m1 '^# Feature Specification:\|^# PRD:' "$spec_file" 2>/dev/null || true)"
        if [ -n "$title_line" ]; then
            case "$title_line" in
                "# Feature Specification:"*)
                    title="${title_line#\# Feature Specification: }" ;;
                "# PRD:"*)
                    title="${title_line#\# PRD: }" ;;
            esac
            # Trim whitespace
            title="$(printf '%s' "$title" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        fi
        # Fallback: use directory name
        [ -n "$title" ] || title="$dir_name"

        # Extract status from "**Status**: [VALUE]"
        status=""
        status_line="$(grep -m1 '^\*\*Status\*\*:' "$spec_file" 2>/dev/null || true)"
        if [ -n "$status_line" ]; then
            status="${status_line#\*\*Status\*\*: }"
            status="$(printf '%s' "$status" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        fi
        [ -n "$status" ] || status="Unknown"

        # Extract created from "**Created**: [DATE]"
        created=""
        created_line="$(grep -m1 '^\*\*Created\*\*:' "$spec_file" 2>/dev/null || true)"
        if [ -n "$created_line" ]; then
            created="${created_line#\*\*Created\*\*: }"
            created="$(printf '%s' "$created" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        fi
        [ -n "$created" ] || created="Unknown"

        # Build JSON entry
        entry="$(printf '{"id":"%s","title":"%s","status":"%s","created":"%s"}' \
            "$(json_escape "$dir_name")" \
            "$(json_escape "$title")" \
            "$(json_escape "$status")" \
            "$(json_escape "$created")")"

        if [ -z "$specs_json" ]; then
            specs_json="$entry"
        else
            specs_json="$specs_json,$entry"
        fi
    done
fi

# Emit JSON contract
printf '{"specs_dir":"specs","specs":[%s]}\n' "$specs_json"
