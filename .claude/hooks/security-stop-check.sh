#!/bin/bash
# Stop Hook - Prüft ob sicherheitskritische Dateien geändert wurden
# Warnt nur (kein Block), damit kein Loop entsteht bei vorbestehenden Änderungen

CRITICAL_PATTERNS=(
  "backend/src/routes/"
  "backend/src/middleware/"
  "backend/src/auth/"
  "backend/src/rbac/"
)

CHANGED_FILES=$( (git diff --name-only --diff-filter=ACDMR HEAD 2>/dev/null; git diff --name-only --diff-filter=ACDMR --cached 2>/dev/null) | sed '/^$/d' | sort -u )

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

HITS=""
for pattern in "${CRITICAL_PATTERNS[@]}"; do
  MATCHES=$(echo "$CHANGED_FILES" | grep -F "$pattern")
  if [ -n "$MATCHES" ]; then
    HITS="${HITS}${MATCHES}"$'\n'
  fi
done

HITS=$(echo "$HITS" | sed '/^$/d' | sort -u)

if [ -n "$HITS" ]; then
  FILE_LIST=$(echo "$HITS" | tr '\n' ', ' | sed 's/,$//')
  # Warn only (no decision: block) to avoid infinite loop with pre-existing changes
  echo "{\"reason\": \"Hinweis: Sicherheitskritische Dateien geändert: ${FILE_LIST}\"}"
fi

exit 0
