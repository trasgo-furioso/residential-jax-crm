#!/usr/bin/env bash
# commit.sh — Gather deterministic git state for the commit command.
#
# Scans the entire repository for changed, new, and deleted files using
# git status --porcelain. Reports branch state and remote tracking info.
#
# Output (stdout, single line JSON):
#   {"changed_files":[...],"new_files":[...],"deleted_files":[...],
#    "has_changes":true,"branch":"...","has_remote":true,"error":null}
#
# Exit codes:
#   0 — success (including detached HEAD — reported via error field)
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
    echo "commit: not a git repository" >&2
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

# --- Current branch -----------------------------------------------------------
current_branch="$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || true)"

# --- Detached HEAD check ------------------------------------------------------
error_msg=""
if [ -z "$current_branch" ]; then
    error_msg="Detached HEAD — cannot commit"
fi

# --- Check remote tracking ----------------------------------------------------
has_remote="false"
if [ -n "$current_branch" ]; then
    remote_name="$(git -C "$REPO_ROOT" config --get "branch.${current_branch}.remote" 2>/dev/null || true)"
    if [ -n "$remote_name" ]; then
        has_remote="true"
    fi
fi

# --- Parse git status --porcelain ---------------------------------------------
changed_files=""
new_files=""
deleted_files=""
has_changes="false"
first_changed="true"
first_new="true"
first_deleted="true"

while IFS= read -r line; do
    # Skip empty lines
    [ -z "$line" ] && continue

    # Extract status code (first 2 chars) and file path (from char 4 onward)
    status="${line:0:2}"
    filepath="${line:3}"

    # Handle renamed files: "R  old -> new" — use the new path
    case "$filepath" in
        *" -> "*)
            filepath="${filepath##* -> }"
            ;;
    esac

    # Skip .specify/ files (gitignored, should not appear, but filter anyway)
    case "$filepath" in
        .specify/*) continue ;;
    esac

    # Trim status whitespace for classification
    status_trimmed="$(printf '%s' "$status" | sed 's/[[:space:]]//g')"

    case "$status_trimmed" in
        "??")
            # Untracked new file
            if [ "$first_new" = "true" ]; then
                first_new="false"
            else
                new_files="${new_files},"
            fi
            new_files="${new_files}{\"path\":\"$(json_escape "$filepath")\",\"status\":\"??\"}"
            has_changes="true"
            ;;
        D|?D)
            # Deleted file
            if [ "$first_deleted" = "true" ]; then
                first_deleted="false"
            else
                deleted_files="${deleted_files},"
            fi
            deleted_files="${deleted_files}{\"path\":\"$(json_escape "$filepath")\",\"status\":\"D\"}"
            has_changes="true"
            ;;
        M|?M|A|?A|MM|AM|R|?R)
            # Modified, added, or renamed file
            if [ "$first_changed" = "true" ]; then
                first_changed="false"
            else
                changed_files="${changed_files},"
            fi
            changed_files="${changed_files}{\"path\":\"$(json_escape "$filepath")\",\"status\":\"M\"}"
            has_changes="true"
            ;;
    esac
done <<EOF
$(git -C "$REPO_ROOT" status --porcelain -uall 2>/dev/null || true)
EOF

# --- Build JSON output --------------------------------------------------------
if [ -n "$current_branch" ]; then
    branch_json="\"$(json_escape "$current_branch")\""
else
    branch_json="null"
fi

if [ -n "$error_msg" ]; then
    error_json="\"$(json_escape "$error_msg")\""
else
    error_json="null"
fi

printf '{"changed_files":[%s],"new_files":[%s],"deleted_files":[%s],"has_changes":%s,"branch":%s,"has_remote":%s,"error":%s}\n' \
    "$changed_files" \
    "$new_files" \
    "$deleted_files" \
    "$has_changes" \
    "$branch_json" \
    "$has_remote" \
    "$error_json"
