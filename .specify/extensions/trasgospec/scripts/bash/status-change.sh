#!/usr/bin/env bash
# status-change.sh — Set, validate, or revert lifecycle status on a feature.
#
# Deterministic only. No AI calls, no judgment, no presentation logic.
# Reads/writes the **Status** field in spec.md or prd.md.
#
# Usage: status-change.sh <action> [args...]
#   Actions:
#     set <phase>    — Set status to the given phase (case-insensitive)
#     blocked        — Shorthand for "set blocked"
#     unblock        — Restore previous status from git history
#     validate       — Report current status without changing it
#
# Output (stdout, single line JSON):
#   {"feature_dir":"specs/...","file":"spec.md","old_status":"...","new_status":"...","success":true}
#
# Exit codes:
#   0 — success (including quality gate failure — check success field in JSON)
#   1 — fatal error (missing args, no feature directory, no status field)
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
[ -n "$REPO_ROOT" ] || { echo "status-change: cannot find .specify root" >&2; exit 1; }

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

# --- Valid lifecycle phases ---------------------------------------------------
VALID_PHASES="discovery opportunity planning ready to dev in progress in review delivered blocked"

normalize_phase() {
    # Convert input to canonical title case.
    # Accepts: "planning", "PLANNING", "ready-to-dev", "ready to dev"
    local input="$1"
    # Replace hyphens with spaces, lowercase
    input="$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]' | sed 's/-/ /g')"

    case "$input" in
        discovery)      printf 'Discovery' ;;
        opportunity)    printf 'Opportunity' ;;
        planning)       printf 'Planning' ;;
        "ready to dev") printf 'Ready to Dev' ;;
        "in progress")  printf 'In Progress' ;;
        "in review")    printf 'In Review' ;;
        delivered)      printf 'Delivered' ;;
        blocked)        printf 'Blocked' ;;
        *)              return 1 ;;
    esac
}

# --- Read feature directory from feature.json --------------------------------
FEATURE_JSON="$REPO_ROOT/.specify/feature.json"
if [ ! -f "$FEATURE_JSON" ]; then
    printf '{"success":false,"error":"No .specify/feature.json found"}\n'
    exit 1
fi

FEATURE_DIR="$(sed -n 's/.*"feature_directory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$FEATURE_JSON")"
if [ -z "$FEATURE_DIR" ]; then
    printf '{"success":false,"error":"Cannot read feature_directory from feature.json"}\n'
    exit 1
fi

FEATURE_DIR_ABS="$REPO_ROOT/$FEATURE_DIR"

# --- Determine target file (spec.md takes precedence) ------------------------
TARGET_FILE=""
TARGET_FILE_NAME=""
if [ -f "$FEATURE_DIR_ABS/spec.md" ]; then
    TARGET_FILE="$FEATURE_DIR_ABS/spec.md"
    TARGET_FILE_NAME="spec.md"
elif [ -f "$FEATURE_DIR_ABS/prd.md" ]; then
    TARGET_FILE="$FEATURE_DIR_ABS/prd.md"
    TARGET_FILE_NAME="prd.md"
else
    printf '{"success":false,"error":"No spec.md or prd.md found in %s"}\n' "$(json_escape "$FEATURE_DIR")"
    exit 1
fi

# --- Read current status ------------------------------------------------------
OLD_STATUS=""
status_line="$(grep -m1 '^\*\*Status\*\*:' "$TARGET_FILE" 2>/dev/null || true)"
if [ -n "$status_line" ]; then
    OLD_STATUS="${status_line#\*\*Status\*\*: }"
    OLD_STATUS="$(printf '%s' "$OLD_STATUS" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
fi
[ -n "$OLD_STATUS" ] || OLD_STATUS="Unknown"

# --- Parse action -------------------------------------------------------------
ACTION="${1:-}"
shift 2>/dev/null || true

case "$ACTION" in
    set)
        # Collect remaining args as the phase name (handles "ready to dev")
        PHASE_INPUT="$*"
        if [ -z "$PHASE_INPUT" ]; then
            printf '{"success":false,"error":"No phase specified","valid_phases":["Discovery","Opportunity","Planning","Ready to Dev","In Progress","In Review","Delivered","Blocked"]}\n'
            exit 1
        fi
        NEW_STATUS="$(normalize_phase "$PHASE_INPUT" || true)"
        if [ -z "$NEW_STATUS" ]; then
            printf '{"success":false,"error":"Invalid phase: %s","valid_phases":["Discovery","Opportunity","Planning","Ready to Dev","In Progress","In Review","Delivered","Blocked"]}\n' \
                "$(json_escape "$PHASE_INPUT")"
            exit 0
        fi
        ;;
    blocked)
        NEW_STATUS="Blocked"
        ;;
    unblock)
        # Recover previous status from git history
        echo "Reading previous status from git log..." >&2
        PREV_LINE="$(cd "$REPO_ROOT" && git log -1 --diff-filter=M -p -- "$FEATURE_DIR/$TARGET_FILE_NAME" 2>/dev/null \
            | grep '^\-\*\*Status\*\*:' | head -1 || true)"
        if [ -z "$PREV_LINE" ]; then
            printf '{"success":false,"error":"Cannot recover previous status from git history"}\n'
            exit 1
        fi
        NEW_STATUS="${PREV_LINE#-\*\*Status\*\*: }"
        NEW_STATUS="$(printf '%s' "$NEW_STATUS" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        ;;
    validate)
        printf '{"feature_dir":"%s","file":"%s","old_status":"%s","success":true}\n' \
            "$(json_escape "$FEATURE_DIR")" \
            "$(json_escape "$TARGET_FILE_NAME")" \
            "$(json_escape "$OLD_STATUS")"
        exit 0
        ;;
    *)
        printf '{"success":false,"error":"Unknown action: %s. Valid actions: set, blocked, unblock, validate"}\n' \
            "$(json_escape "$ACTION")"
        exit 1
        ;;
esac

# --- Quality gate for Opportunity on prd.md -----------------------------------
if [ "$NEW_STATUS" = "Opportunity" ] && [ "$TARGET_FILE_NAME" = "prd.md" ]; then
    GATE_FAILURES=""

    _check_field() {
        local field="$1"
        local content
        content="$(grep -m1 "^\\*\\*${field}\\*\\*:" "$TARGET_FILE" 2>/dev/null || true)"
        if [ -z "$content" ]; then
            GATE_FAILURES="${GATE_FAILURES:+$GATE_FAILURES,}\"Missing: $field\""
            return
        fi
        # Check if field has content after the colon
        local value="${content#\*\*${field}\*\*:}"
        value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
        if [ -z "$value" ]; then
            GATE_FAILURES="${GATE_FAILURES:+$GATE_FAILURES,}\"Empty: $field\""
        fi
    }

    _check_section_bullets() {
        local heading="$1"
        local pattern="$2"
        # Check if section exists and has at least one matching bullet
        if ! grep -q "^## ${heading}" "$TARGET_FILE" 2>/dev/null; then
            GATE_FAILURES="${GATE_FAILURES:+$GATE_FAILURES,}\"Missing: $heading\""
            return
        fi
        if ! grep -q "^${pattern}" "$TARGET_FILE" 2>/dev/null; then
            GATE_FAILURES="${GATE_FAILURES:+$GATE_FAILURES,}\"Empty: $heading\""
        fi
    }

    _check_field "Pain Point"
    _check_field "Who"
    _check_field "Current Alternatives"
    _check_field "Desired Outcome"
    _check_section_bullets "Jobs to Be Done" "- When"
    _check_section_bullets "Assumptions" "- "

    if [ -n "$GATE_FAILURES" ]; then
        printf '{"feature_dir":"%s","file":"%s","old_status":"%s","new_status":"%s","success":false,"gate_failures":[%s]}\n' \
            "$(json_escape "$FEATURE_DIR")" \
            "$(json_escape "$TARGET_FILE_NAME")" \
            "$(json_escape "$OLD_STATUS")" \
            "$(json_escape "$NEW_STATUS")" \
            "$GATE_FAILURES"
        exit 0
    fi
fi

# --- Update the status field --------------------------------------------------
if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s/^\*\*Status\*\*:.*/**Status**: ${NEW_STATUS}/" "$TARGET_FILE"
else
    sed -i "s/^\*\*Status\*\*:.*/**Status**: ${NEW_STATUS}/" "$TARGET_FILE"
fi

# --- Emit JSON output ---------------------------------------------------------
if [ "$ACTION" = "unblock" ]; then
    printf '{"feature_dir":"%s","file":"%s","old_status":"%s","new_status":"%s","recovered_from":"git","success":true}\n' \
        "$(json_escape "$FEATURE_DIR")" \
        "$(json_escape "$TARGET_FILE_NAME")" \
        "$(json_escape "$OLD_STATUS")" \
        "$(json_escape "$NEW_STATUS")"
else
    printf '{"feature_dir":"%s","file":"%s","old_status":"%s","new_status":"%s","success":true}\n' \
        "$(json_escape "$FEATURE_DIR")" \
        "$(json_escape "$TARGET_FILE_NAME")" \
        "$(json_escape "$OLD_STATUS")" \
        "$(json_escape "$NEW_STATUS")"
fi
