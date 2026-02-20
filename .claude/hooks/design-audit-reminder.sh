#!/bin/bash
# PostToolUse Hook: Reminds Claude to run design-auditor after frontend edits
# Returns a systemMessage when frontend JSX/JS files are modified

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only trigger for frontend source files
if [[ "$FILE_PATH" != *frontend/src/* ]]; then
  exit 0
fi
if [[ "$FILE_PATH" != *.jsx && "$FILE_PATH" != *.js ]]; then
  exit 0
fi

# Skip theme.js, utils, config (no design patterns to audit)
if [[ "$FILE_PATH" == *config/theme* || "$FILE_PATH" == *utils/* ]]; then
  exit 0
fi

# Use a marker file to avoid spamming the reminder on every single edit.
# Only remind once per 5-minute window.
MARKER="/tmp/.design-audit-reminder-$$"
if [[ -f "$MARKER" ]]; then
  # Check age — only re-remind after 5 minutes
  AGE=$(( $(date +%s) - $(stat -f %m "$MARKER" 2>/dev/null || echo 0) ))
  if (( AGE < 300 )); then
    exit 0
  fi
fi
touch "$MARKER"

echo '{"systemMessage": "Frontend-Datei geaendert. Fuehre nach Abschluss aller Aenderungen den design-auditor Subagent aus (Task-Tool, subagent_type: design-auditor), um Design-Konsistenz sicherzustellen. Nicht nach jedem einzelnen Edit — erst wenn die aktuelle Aufgabe abgeschlossen ist."}'
exit 0
