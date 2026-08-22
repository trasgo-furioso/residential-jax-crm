#!/usr/bin/env bash
# discovery.sh — Create a specs directory and scaffold prd.md for discovery.
#
# Deterministic only. No AI calls, no judgment, no presentation logic.
# Creates the next sequential spec directory and scaffolds an empty prd.md.
#
# Usage: discovery.sh [--json] [slug-hint]
#
# Output (stdout, single line JSON):
#   {"spec_dir":"specs/008-slug","spec_number":"008","slug":"slug",
#    "prd_path":"specs/008-slug/prd.md","feature_json_updated":true}
#
# Exit codes:
#   0 — success
#   1 — fatal error (not a Spec Kit project, filesystem error)
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
[ -n "$REPO_ROOT" ] || { echo "discovery: cannot find .specify root" >&2; exit 1; }

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

# --- Parse arguments ----------------------------------------------------------
SLUG_HINT=""
for arg in "$@"; do
    case "$arg" in
        --json) ;; # accepted but no-op (always JSON)
        *) SLUG_HINT="$arg" ;;
    esac
done

# --- Derive slug --------------------------------------------------------------
if [ -n "$SLUG_HINT" ]; then
    # Convert to kebab-case: lowercase, replace spaces/underscores with hyphens,
    # strip non-alphanumeric (except hyphens), collapse multiple hyphens.
    SLUG="$(printf '%s' "$SLUG_HINT" \
        | tr '[:upper:]' '[:lower:]' \
        | sed 's/[[:space:]_]/-/g; s/[^a-z0-9-]//g; s/--*/-/g; s/^-//; s/-$//')"
else
    # Fallback to timestamp
    SLUG="$(date +%Y%m%d-%H%M%S)"
fi

# --- Determine next sequential number ----------------------------------------
SPECS_DIR="$REPO_ROOT/specs"
MAX_NUM=0

if [ -d "$SPECS_DIR" ]; then
    for d in "$SPECS_DIR"/*/; do
        [ -d "$d" ] || continue
        dir_name="$(basename -- "$d")"
        # Extract leading digits
        num_part="$(printf '%s' "$dir_name" | sed 's/^\([0-9]*\).*/\1/')"
        if [ -n "$num_part" ]; then
            # Remove leading zeros for arithmetic (handle "000" edge case)
            num_val="$((10#$num_part))"
            if [ "$num_val" -gt "$MAX_NUM" ]; then
                MAX_NUM="$num_val"
            fi
        fi
    done
fi

NEXT_NUM=$((MAX_NUM + 1))
SPEC_NUMBER="$(printf '%03d' "$NEXT_NUM")"

# --- Create directory and scaffold -------------------------------------------
SPEC_DIR_NAME="${SPEC_NUMBER}-${SLUG}"
SPEC_DIR_PATH="$SPECS_DIR/$SPEC_DIR_NAME"
PRD_PATH="$SPEC_DIR_PATH/prd.md"
SPEC_DIR_REL="specs/$SPEC_DIR_NAME"
PRD_PATH_REL="$SPEC_DIR_REL/prd.md"

mkdir -p "$SPEC_DIR_PATH"

# Convert slug to title case for PRD heading
TITLE="$(printf '%s' "$SLUG" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')"

# Write PRD scaffold with section headers only
TODAY="$(date +%Y-%m-%d)"
cat > "$PRD_PATH" <<SCAFFOLD
# PRD: ${TITLE}

**Created**: ${TODAY}
**Discovery Session**: ${TODAY}
**Status**: Discovery

## Problem Statement

**Pain Point**:

**Who**:

**Current Alternatives**:

**Desired Outcome**:

## Jobs to Be Done

## Assumptions

## Research Findings
SCAFFOLD

# --- Update feature.json ------------------------------------------------------
FEATURE_JSON="$REPO_ROOT/.specify/feature.json"
printf '{\n  "feature_directory": "%s"\n}\n' "$(json_escape "$SPEC_DIR_REL")" > "$FEATURE_JSON"

# --- Emit JSON output ---------------------------------------------------------
printf '{"spec_dir":"%s","spec_number":"%s","slug":"%s","prd_path":"%s","feature_json_updated":true}\n' \
    "$(json_escape "$SPEC_DIR_REL")" \
    "$(json_escape "$SPEC_NUMBER")" \
    "$(json_escape "$SLUG")" \
    "$(json_escape "$PRD_PATH_REL")"
