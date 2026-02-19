#!/bin/bash
# Hook: Nach einem git commit an Doku-Update erinnern
# Trigger: PostToolUse auf Bash-Aufrufe mit "git commit"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Nur auf git commit reagieren (nicht auf git commit --amend allein)
if ! echo "$COMMAND" | grep -qE "^git commit"; then
  exit 0
fi

# Release-Commits ignorieren (werden vom /release-Command erstellt)
if echo "$COMMAND" | grep -qE 'Release v[0-9]'; then
  exit 0
fi

# Reminder als additionalContext injizieren
jq -n '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "HINWEIS: Du hast gerade einen Commit erstellt. Falls Code- oder Feature-Änderungen enthalten sind, prüfe ob die Anwenderdokumentation aktualisiert werden muss. Führe dazu `/update-docs check` aus, um eine Gap-Analyse zu erhalten."
  }
}'

exit 0
