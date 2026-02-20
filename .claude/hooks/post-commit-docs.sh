#!/bin/bash
# Hook: Nach einem git commit an Doku-Update erinnern
# Trigger: PostToolUse auf Bash-Aufrufe mit "git commit"

# Schneller Bail-Out: Raw-Input auf "git commit" prüfen bevor jq gestartet wird
INPUT=$(cat)
echo "$INPUT" | grep -q "git commit" || exit 0

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
    additionalContext: "HINWEIS: Du hast gerade einen Commit erstellt. Falls Code- oder Feature-Änderungen enthalten sind, prüfe ob die interne Projektdokumentation aktualisiert werden muss: README.md, DEPLOYMENT.md, CLAUDE.md, backend/CLAUDE.md, frontend/CLAUDE.md, docs/*.md. Erinnere den Benutzer daran, falls Änderungen nötig sind."
  }
}'

exit 0
