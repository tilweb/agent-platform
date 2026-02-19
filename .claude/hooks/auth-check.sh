#!/bin/bash
# Hook: Auth Coverage Check (PreToolUse on Bash)
# Blocks git commit if staged route files lack authMiddleware.
# Exit 0 = OK | Exit 2 = problem found (commit blocked)

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git commit
if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit\b'; then
  exit 0
fi

# --- Config ---

# Route files that are allowed to have NO or PARTIAL auth
# (auth.ts has login/register, connections.ts has OAuth callback)
KNOWN_PARTIAL_AUTH="auth.ts"

# --- Helpers ---

ERRORS=()
WARNINGS=()

add_error() { ERRORS+=("$1"); }
add_warning() { WARNINGS+=("$1"); }

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# --- Check 1: Staged route files must import authMiddleware ---

staged_routes=$(echo "$STAGED_FILES" | grep '^backend/src/routes/' || true)

for route_file in $staged_routes; do
  basename_file=$(basename "$route_file")

  # Skip known partial-auth files
  if echo "$KNOWN_PARTIAL_AUTH" | grep -qF "$basename_file"; then
    continue
  fi

  full_path="$PROJECT_DIR/$route_file"
  if [ ! -f "$full_path" ]; then
    continue
  fi

  # Check if file imports authMiddleware or optionalAuthMiddleware
  has_auth=$(grep -E 'import.*authMiddleware|import.*optionalAuthMiddleware' "$full_path" 2>/dev/null || true)

  if [ -z "$has_auth" ]; then
    add_error "Route '$route_file' importiert weder authMiddleware noch optionalAuthMiddleware. Jede Route-Datei muss Authentifizierung haben."
  fi

  # Check if authMiddleware is actually applied (not just imported)
  has_use=$(grep -E '\.use\(.*authMiddleware|,\s*authMiddleware' "$full_path" 2>/dev/null || true)
  if [ -n "$has_auth" ] && [ -z "$has_use" ]; then
    # authMiddleware imported but maybe not applied as .use() — could be per-endpoint which is OK
    # Check if there's at least one per-endpoint usage
    has_per_endpoint=$(grep -cE 'authMiddleware' "$full_path" 2>/dev/null || echo "0")
    if [ "$has_per_endpoint" -le 1 ]; then
      add_warning "Route '$route_file' importiert authMiddleware, wendet es aber moeglicherweise nicht an. Bitte pruefen."
    fi
  fi
done

# --- Check 2: New app.route() in index.ts without auth in target file ---

if echo "$STAGED_FILES" | grep -q 'backend/src/index.ts'; then
  new_routes=$(git diff --cached -U0 -- backend/src/index.ts 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -oE "app\.route\([^)]+\)" || true)

  if [ -n "$new_routes" ]; then
    # Extract route variable names from new app.route() calls
    route_vars=$(echo "$new_routes" | grep -oE ',\s*[a-zA-Z]+\)' | tr -d ', )' || true)
    for var in $route_vars; do
      # Find which file exports this variable
      source_file=$(grep -rlE "export.*(const|function|class)\s+$var\b" "$PROJECT_DIR/backend/src/routes/" 2>/dev/null | head -1 || true)
      if [ -n "$source_file" ] && [ -f "$source_file" ]; then
        has_auth_in_file=$(grep -E 'authMiddleware' "$source_file" 2>/dev/null || true)
        if [ -z "$has_auth_in_file" ]; then
          rel_path=$(echo "$source_file" | sed "s|$PROJECT_DIR/||")
          add_error "Neue Route '$var' in index.ts registriert, aber '$rel_path' hat kein authMiddleware."
        fi
      fi
    done
  fi
fi

# --- Output ---

if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  exit 0
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  ERROR_MSG="AUTH-CHECK FEHLGESCHLAGEN:\n"
  for i in "${!ERRORS[@]}"; do
    ERROR_MSG+="$((i+1)). ${ERRORS[$i]}\n"
  done

  if [ ${#WARNINGS[@]} -gt 0 ]; then
    ERROR_MSG+="\nWarnungen:\n"
    for i in "${!WARNINGS[@]}"; do
      ERROR_MSG+="- ${WARNINGS[$i]}\n"
    done
  fi

  jq -n --arg msg "$ERROR_MSG" '{
    decision: "block",
    reason: $msg
  }'
  exit 2
fi

# Warnings only — don't block, just inform
WARN_MSG="AUTH-CHECK Warnungen:\n"
for i in "${!WARNINGS[@]}"; do
  WARN_MSG+="- ${WARNINGS[$i]}\n"
done

jq -n --arg msg "$WARN_MSG" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: $msg
  }
}'
exit 0
