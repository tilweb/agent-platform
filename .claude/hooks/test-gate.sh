#!/bin/bash
# Hook: Test Gate (PreToolUse on Bash)
# Blocks git commit if staged route/service files have no corresponding test file.
# Exit 0 = OK | Exit 2 = blocked
#
# Enforcement-Point: Edits bleiben frei, aber Commits werden blockiert
# bis Tests im erwarteten Pfad existieren.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git commit
if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit\b'; then
  exit 0
fi

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

ERRORS=()

# --- Check: Backend routes and services must have test files ---

staged_backend=$(echo "$STAGED_FILES" | grep -E '^backend/src/(routes|services)/' || true)

for src_file in $staged_backend; do
  basename_file=$(basename "$src_file")

  # Skip test files themselves
  if [[ "$basename_file" == *.test.* || "$basename_file" == *.spec.* ]]; then
    continue
  fi

  # Skip type definitions, index re-exports
  if [[ "$basename_file" == types.ts || "$basename_file" == index.ts ]]; then
    continue
  fi

  # Determine expected test path: routes/chat.ts → routes/__tests__/chat.test.ts
  dir=$(dirname "$PROJECT_DIR/$src_file")
  base=$(basename "$basename_file" .ts)
  test_file="$dir/__tests__/${base}.test.ts"

  if [ ! -f "$test_file" ]; then
    rel_src=$(echo "$src_file" | sed "s|^backend/||")
    rel_test=$(echo "$test_file" | sed "s|$PROJECT_DIR/backend/||")
    ERRORS+=("$rel_src hat keine Tests ($rel_test). Erstelle sie mit: Task tool (test-writer) oder /test-scaffold $src_file")
  fi
done

# --- Output ---

if [ ${#ERRORS[@]} -eq 0 ]; then
  exit 0
fi

ERROR_MSG="TEST-GATE FEHLGESCHLAGEN — Commit blockiert:\n\n"
for i in "${!ERRORS[@]}"; do
  ERROR_MSG+="$((i+1)). ${ERRORS[$i]}\n"
done
ERROR_MSG+="\nTests muessen vor dem Commit existieren."

jq -n --arg msg "$ERROR_MSG" '{
  decision: "block",
  reason: $msg
}'
exit 2
