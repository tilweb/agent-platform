#!/bin/bash
# Icon Duplication Check Hook - Verhindert neue Icon-Duplikate
# Exit 0 = OK (systemMessage = Warnung)
#
# Convention: Alle Icons zentral in components/Icons.jsx definieren.
# Keine lokalen Icon-Funktionen in Pages oder anderen Components.
#
# Erlaubt:
#   - Icons.jsx selbst
#   - Import von Icons aus Icons.jsx
#   - Inline-SVGs die keine wiederverwendbaren Icon-Komponenten sind
#     (z.B. dekorative SVGs in Markdown-Renderern)
#
# Verboten:
#   - function XyzIcon() { return <svg>...</svg> } in Page/Component-Dateien
#   - Kopierte Icon-Definitionen aus anderen Dateien

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Nur Frontend JSX/JS Dateien
if [[ "$FILE_PATH" != *frontend/src/* ]]; then
  exit 0
fi
if [[ "$FILE_PATH" != *.jsx && "$FILE_PATH" != *.js ]]; then
  exit 0
fi

# Icons.jsx selbst ist erlaubt
if [[ "$FILE_PATH" == *components/Icons.jsx ]]; then
  exit 0
fi

WARNINGS=""

# Check 1: Neue Icon-Funktionsdefinitionen
# Suche nach: function XyzIcon(, const XyzIcon =
ICON_DEFS=$(echo "$NEW_CONTENT" | grep -oE "function [A-Z][a-zA-Z]*Icon\s*\(" | head -5)
if [ -n "$ICON_DEFS" ]; then
  # Filtere bekannte Ausnahmen (AppIcon die app-spezifisch mapped)
  REAL_ICONS=$(echo "$ICON_DEFS" | grep -v "AppIcon\|getCommandIcon\|getContentTypeIcon\|getProviderIcon" || true)
  if [ -n "$REAL_ICONS" ]; then
    ICON_NAMES=$(echo "$REAL_ICONS" | sed 's/function //;s/($//' | tr '\n' ', ' | sed 's/,$//')
    WARNINGS="${WARNINGS}ICON-DUPLIKAT: Lokale Icon-Definition(en) erkannt: ${ICON_NAMES}. Icons muessen zentral in components/Icons.jsx definiert und von dort importiert werden. "
  fi
fi

# Check 2: Arrow-Function Icon-Definitionen
ARROW_ICONS=$(echo "$NEW_CONTENT" | grep -oE "const [A-Z][a-zA-Z]*Icon\s*=" | head -5)
if [ -n "$ARROW_ICONS" ]; then
  ARROW_NAMES=$(echo "$ARROW_ICONS" | sed 's/const //;s/ *=$//' | tr '\n' ', ' | sed 's/,$//')
  WARNINGS="${WARNINGS}ICON-DUPLIKAT: Lokale Icon-Konstante(n) erkannt: ${ARROW_NAMES}. Bitte in components/Icons.jsx zentralisieren. "
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"systemMessage\": \"Icon-Check: $WARNINGS\"}"
fi

exit 0
