#!/bin/bash
# Test Coverage Check Hook - Prüft ob geänderte Dateien Tests haben
# Exit 0 = OK (systemMessage = Warnung/Hinweis)
#
# Läuft nach jeder Code-Änderung und prüft:
# 1. Existiert eine Test-Datei für die geänderte Source-Datei?
# 2. Haben sich exportierte Funktionen/Signaturen geändert → Tests evtl. outdated?
# 3. Neue Dateien ohne Tests → Hinweis auf /test-scaffold

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Nur Source-Dateien (keine Tests, Config, Doku)
if [[ "$FILE_PATH" == *test* || "$FILE_PATH" == *spec* || "$FILE_PATH" == *__tests__* ]]; then
  exit 0
fi
if [[ "$FILE_PATH" == *.config.* || "$FILE_PATH" == *CLAUDE.md* || "$FILE_PATH" == *.md ]]; then
  exit 0
fi
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]]; then
  exit 0
fi

# Ignoriere reine Typ-/Config-Dateien
if [[ "$FILE_PATH" == *types.ts || "$FILE_PATH" == *config/* || "$FILE_PATH" == *theme.js ]]; then
  exit 0
fi

WARNINGS=""
PROJECT_DIR="$CLAUDE_PROJECT_DIR"

# ── Backend-Dateien ──────────────────────────────────────────────
if [[ "$FILE_PATH" == *backend/src/* ]]; then
  # Bestimme erwarteten Test-Pfad
  # backend/src/routes/chat.ts → backend/src/routes/__tests__/chat.test.ts
  DIR=$(dirname "$FILE_PATH")
  BASE=$(basename "$FILE_PATH" .ts)
  TEST_DIR="$DIR/__tests__"
  TEST_FILE="$TEST_DIR/${BASE}.test.ts"

  if [ ! -f "$TEST_FILE" ]; then
    # Prüfe ob es eine kritische Datei ist (routes, services)
    if [[ "$FILE_PATH" == *routes/* || "$FILE_PATH" == *services/* ]]; then
      WARNINGS="${WARNINGS}TEST-COVERAGE: Keine Tests fuer $(basename "$FILE_PATH"). Erstelle Tests mit /test-scaffold $(echo "$FILE_PATH" | sed "s|$PROJECT_DIR/||"). "
    fi
  else
    # Tests existieren — prüfe ob Signaturänderungen vorliegen
    if echo "$NEW_CONTENT" | grep -qE "^export (function|const|async function|class) "; then
      EXPORT_NAMES=$(echo "$NEW_CONTENT" | grep -oE "export (function|const|async function) [a-zA-Z]+" | head -3 | awk '{print $NF}' | tr '\n' ', ' | sed 's/,$//')
      if [ -n "$EXPORT_NAMES" ]; then
        # Prüfe ob die exportierten Funktionen in den Tests referenziert werden
        MISSING_IN_TESTS=""
        for FUNC in $(echo "$EXPORT_NAMES" | tr ',' ' '); do
          if ! grep -q "$FUNC" "$TEST_FILE" 2>/dev/null; then
            MISSING_IN_TESTS="${MISSING_IN_TESTS}${FUNC}, "
          fi
        done
        if [ -n "$MISSING_IN_TESTS" ]; then
          MISSING_IN_TESTS=$(echo "$MISSING_IN_TESTS" | sed 's/, $//')
          WARNINGS="${WARNINGS}TEST-COVERAGE: Exportierte Funktionen (${MISSING_IN_TESTS}) haben keine Tests in $(echo "$TEST_FILE" | sed "s|$PROJECT_DIR/||"). Tests erweitern oder mit /test-scaffold aktualisieren. "
        fi
      fi
    fi
  fi
fi

# ── Frontend-Dateien ─────────────────────────────────────────────
if [[ "$FILE_PATH" == *frontend/src/* ]]; then
  # Nur Hooks und wichtige Pages prüfen (Components sind UI-lastig)
  if [[ "$FILE_PATH" == *hooks/* ]]; then
    DIR=$(dirname "$FILE_PATH")
    BASE=$(basename "$FILE_PATH" .js)
    TEST_FILE="$DIR/__tests__/${BASE}.test.js"

    if [ ! -f "$TEST_FILE" ]; then
      WARNINGS="${WARNINGS}TEST-COVERAGE: Kein Test fuer Hook $(basename "$FILE_PATH"). Frontend-Tests mit /test-scaffold $(echo "$FILE_PATH" | sed "s|$PROJECT_DIR/||") erstellen. "
    fi
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"systemMessage\": \"$WARNINGS\"}"
fi

exit 0
