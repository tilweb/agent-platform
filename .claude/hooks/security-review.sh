#!/bin/bash
# Security Review Hook - Prüft sicherheitskritische Patterns
# Exit 0 = OK, Exit 2 = Block

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Nur bei relevanten Dateien
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then
  exit 0
fi

WARNINGS=""

# Check 1: Backend Route ohne Auth-Middleware
if [[ "$FILE_PATH" == *backend/src/routes* && "$FILE_PATH" != *auth* ]]; then
  if ! echo "$NEW_CONTENT" | grep -q "authMiddleware\|optionalAuthMiddleware\|adminMiddleware\|requireResourceAccess\|requireViewAccess\|requireEditAccess"; then
    WARNINGS="${WARNINGS}WARNUNG: Route ohne Auth-Middleware! "
  fi
fi

# Check 2: RBAC Middleware ohne Auth-Middleware
if echo "$NEW_CONTENT" | grep -q "requireViewAccess\|requireEditAccess\|requireDeleteAccess\|requireManageAccess"; then
  if ! echo "$NEW_CONTENT" | grep -q "authMiddleware"; then
    WARNINGS="${WARNINGS}WARNUNG: RBAC-Middleware ohne vorheriges authMiddleware! "
  fi
fi

# Check 3: dangerouslySetInnerHTML (XSS-Risiko)
if echo "$NEW_CONTENT" | grep -q "dangerouslySetInnerHTML"; then
  WARNINGS="${WARNINGS}WARNUNG: dangerouslySetInnerHTML gefunden (XSS-Risiko)! "
fi

# Check 4: Hardcoded Secrets
if echo "$NEW_CONTENT" | grep -qiE "(password|secret|apikey|api_key|token)\s*[:=]\s*['\"][^'\"]+['\"]"; then
  WARNINGS="${WARNINGS}KRITISCH: Möglicher hardcoded Secret gefunden! "
fi

# Check 5: console.log mit sensiblen Daten
if echo "$NEW_CONTENT" | grep -qE "console\.(log|error|warn).*\b(token|password|secret|session)\b"; then
  WARNINGS="${WARNINGS}WARNUNG: Sensitive Daten werden möglicherweise geloggt! "
fi

# Check 6: eval() oder new Function()
if echo "$NEW_CONTENT" | grep -qE "eval\(|new Function\("; then
  WARNINGS="${WARNINGS}KRITISCH: eval() oder new Function() gefunden (Code Injection Risiko)! "
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"systemMessage\": \"Security Review: $WARNINGS\"}"
fi

exit 0
