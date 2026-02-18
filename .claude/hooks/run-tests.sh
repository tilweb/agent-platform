#!/bin/bash
# Test Runner Hook - Führt Tests nach Änderungen aus
# Async ausgeführt, blockiert nicht

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Nur bei Source-Dateien (keine Tests, keine Config)
if [[ "$FILE_PATH" == *test* || "$FILE_PATH" == *spec* || "$FILE_PATH" == *.config.* ]]; then
  exit 0
fi

if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then
  exit 0
fi

# Nur Backend-Tests ausführen (Frontend hat noch keine Tests)
if [[ "$FILE_PATH" != *backend/* ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/backend"

RESULT=$(bun test 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  PASSED=$(echo "$RESULT" | grep -oE '[0-9]+ pass' | head -1)
  echo "{\"systemMessage\": \"Tests OK: $PASSED\"}"
else
  FAILED=$(echo "$RESULT" | grep -E '(FAIL|Error|fail)' | head -3 | tr '\n' ' ')
  echo "{\"systemMessage\": \"Tests FEHLGESCHLAGEN: $FAILED\"}"
fi

exit 0
