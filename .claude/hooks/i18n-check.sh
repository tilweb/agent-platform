#!/bin/bash
# i18n Consistency Check Hook - Prüft Sprachkonsistenz
# Exit 0 = OK (systemMessage = Warnung)
#
# Convention (aus CLAUDE.md):
#   - UI-Text (Fehlermeldungen an User, Labels, Überschriften): Deutsch
#   - Code/Variablen: Englisch
#
# Prüft:
#   Backend: Englische Error-Strings in c.json({ error: '...' })
#   Frontend: Englische UI-Strings in JSX (Button-Labels, Titel, Platzhalter)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Nur TS/JS Dateien
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then
  exit 0
fi

# Ignoriere Config, Tests, Utils (keine UI-Texte)
if [[ "$FILE_PATH" == *config/* || "$FILE_PATH" == *test* || "$FILE_PATH" == *spec* ]]; then
  exit 0
fi

WARNINGS=""

# ── Backend: Englische Error-Messages ──────────────────────────────
if [[ "$FILE_PATH" == *backend/src/routes/* ]]; then

  # Pattern: c.json({ error: 'English text' }, 4xx/5xx)
  # Erkennt gängige englische Fehlerphrasen
  EN_ERRORS=$(echo "$NEW_CONTENT" | grep -oiE "error:\s*['\"]([A-Z][a-z]+ )*(not found|required|invalid|denied|forbidden|failed|unauthorized|already exists|missing|too many|bad request|not allowed|no access|access denied|internal error|server error)['\"]" | head -3)

  if [ -n "$EN_ERRORS" ]; then
    WARNINGS="${WARNINGS}I18N-Backend: Englische Fehlermeldung(en) erkannt. UI-Text muss Deutsch sein. Verwende die errorHandler-Helper (notFoundError, validationError, forbiddenError) — die liefern automatisch deutsche Meldungen. "
  fi
fi

# ── Frontend: Englische UI-Strings ─────────────────────────────────
if [[ "$FILE_PATH" == *frontend/src/* ]]; then

  # Pattern: Englische Strings in typischen UI-Kontexten
  # Prüfe Button-Labels, Titel, Platzhalter, Descriptions
  # Suche nach: >English text< oder title="English" oder placeholder="English"

  # Gängige englische UI-Wörter die auf Deutsch sein sollten
  EN_UI=$(echo "$NEW_CONTENT" | grep -oE "(>|\"|')\\s*(Delete|Save|Cancel|Submit|Loading|Search|Edit|Create|Update|Close|Open|Back|Next|Previous|Settings|Error|Warning|Success|Confirm|Add|Remove|Select|Filter|Sort|Download|Upload|Refresh|Reset|Enable|Disable|Connect|Disconnect|Sign in|Sign out|Log in|Log out)\\s*(<|\"|')" | head -3)

  if [ -n "$EN_UI" ]; then
    # Filtere false positives: Code-Kommentare, Variablennamen, console.log
    # Prüfe ob es wirklich in JSX-Kontext steht (zwischen > < oder in title/placeholder)
    REAL_EN=$(echo "$EN_UI" | grep -E "^>|title=|placeholder=|label=" | head -3)
    if [ -n "$REAL_EN" ]; then
      WARNINGS="${WARNINGS}I18N-Frontend: Englischer UI-Text erkannt (${REAL_EN}). Labels, Buttons und Platzhalter muessen auf Deutsch sein (z.B. 'Loeschen' statt 'Delete', 'Speichern' statt 'Save'). "
    fi
  fi

  # Pattern: placeholder="English..."
  EN_PLACEHOLDER=$(echo "$NEW_CONTENT" | grep -oE "placeholder=['\"][A-Z][a-z]+([ ][a-z]+)*['\"]" | grep -iE "search|enter|type|select|filter|choose" | head -2)
  if [ -n "$EN_PLACEHOLDER" ]; then
    WARNINGS="${WARNINGS}I18N-Frontend: Englischer Platzhalter erkannt (${EN_PLACEHOLDER}). Verwende deutsche Texte (z.B. 'Suchen...' statt 'Search...'). "
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"systemMessage\": \"i18n-Check: $WARNINGS Convention: UI-Text = Deutsch, Code/Variablen = Englisch.\"}"
fi

exit 0
