#!/bin/bash
# Error Consistency Check Hook - Prüft einheitliche Fehlerbehandlung in Backend-Routes
# Exit 0 = OK (systemMessage = Warnung)
#
# Convention: Backend-Routes sollen die zentralen Error-Helper aus
# utils/errorHandler.ts verwenden statt direkte c.json({ error: ... }) Aufrufe.
#
# Erlaubte Patterns:
#   errorResponse(c, ...)
#   internalError(c, ...)
#   validationError(c, ...)
#   notFoundError(c, ...)
#   unauthorizedError(c, ...)
#   forbiddenError(c, ...)
#   serviceError(c, ...)
#   withErrorHandling(...)
#
# Verbotene Patterns in neuem Code:
#   c.json({ error: '...' }, 4xx)
#   return c.json({ error: ... }, 500)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Nur Backend Route-Dateien
if [[ "$FILE_PATH" != *backend/src/routes/* ]]; then
  exit 0
fi

# Ignoriere errorHandler.ts selbst
if [[ "$FILE_PATH" == *errorHandler* ]]; then
  exit 0
fi

WARNINGS=""

# Check 1: Direkte c.json({ error: ... }, Status) statt errorResponse/Helper
# Suche nach Pattern: c.json({ error: '...' }, 4xx/5xx) oder c.json({ error: "..." }, 4xx/5xx)
if echo "$NEW_CONTENT" | grep -qE "c\.json\(\s*\{[^}]*error\s*:" ; then
  # Prüfe ob der errorResponse Import vorhanden ist
  if ! echo "$NEW_CONTENT" | grep -qE "errorResponse|internalError|validationError|notFoundError|unauthorizedError|forbiddenError|serviceError"; then
    WARNINGS="${WARNINGS}ERROR-HANDLING: Direkter c.json({ error: ... }) Aufruf ohne errorHandler Import. Verwende die Helper aus utils/errorHandler.ts (errorResponse, notFoundError, validationError, etc.). "
  else
    # Import vorhanden, aber trotzdem direktes c.json mit error
    DIRECT_COUNT=$(echo "$NEW_CONTENT" | grep -cE "c\.json\(\s*\{[^}]*error\s*:" || true)
    if [ "$DIRECT_COUNT" -gt 0 ]; then
      WARNINGS="${WARNINGS}ERROR-HANDLING: ${DIRECT_COUNT}x direkter c.json({ error }) statt errorHandler. Verwende notFoundError(c, 'Resource'), validationError(c, 'Nachricht'), forbiddenError(c), internalError(c, err). "
    fi
  fi
fi

# Check 2: Englische Error-Messages (Convention: UI-Text = Deutsch)
if echo "$NEW_CONTENT" | grep -qE "error:\s*['\"]([A-Z][a-z]+ )(not found|required|invalid|denied|failed|already exists|missing)" ; then
  WARNINGS="${WARNINGS}I18N: Englische Fehlermeldung erkannt. Convention: Error-Messages an den User auf Deutsch (z.B. 'Ressource nicht gefunden' statt 'Resource not found'). "
fi

# Check 3: throw new Error() in Route-Handlern ohne withErrorHandling Wrapper
if echo "$NEW_CONTENT" | grep -qE "throw new (Error|TypeError|RangeError)\("; then
  if ! echo "$NEW_CONTENT" | grep -q "withErrorHandling"; then
    WARNINGS="${WARNINGS}ERROR-HANDLING: throw in Route ohne withErrorHandling-Wrapper. Unbehandelte Exceptions fuehren zu 500ern ohne strukturierte Fehlerantwort. "
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"systemMessage\": \"Error-Consistency: $WARNINGS Siehe backend/src/utils/errorHandler.ts fuer die verfuegbaren Helper.\"}"
fi

exit 0
