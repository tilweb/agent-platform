#!/bin/bash
# Quality Check Hook - Runs after code changes
# Exit 0 = OK, Exit 2 = Block

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Nur bei TypeScript/JavaScript Dateien
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then
  exit 0
fi

# Ignoriere Test-Dateien und Konfiguration
if [[ "$FILE_PATH" == *test* || "$FILE_PATH" == *spec* || "$FILE_PATH" == *.config.* ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Backend TypeScript Check
if [[ "$FILE_PATH" == *backend/* ]]; then
  if ! cd backend && bunx tsc --noEmit 2>/dev/null; then
    echo '{"systemMessage": "TypeScript-Fehler im Backend nach Änderung an '"$FILE_PATH"'. Bitte beheben."}'
  fi
fi

# Frontend Lint Check
if [[ "$FILE_PATH" == *frontend/* ]]; then
  if ! cd frontend && npx eslint --quiet "$(basename "$FILE_PATH")" 2>/dev/null; then
    echo '{"systemMessage": "Lint-Fehler im Frontend nach Änderung an '"$FILE_PATH"'. Bitte beheben."}'
  fi
fi

exit 0
