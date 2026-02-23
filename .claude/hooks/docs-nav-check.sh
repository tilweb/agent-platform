#!/bin/bash
# Docs NAV Integrity Check — PostToolUse Hook (Edit|Write)
# Prüft ob DocsPage.jsx NAV-Slugs mit dem Dateisystem übereinstimmen.
# Nur aktiv bei Änderungen an docs/anwenderdoku/** oder DocsPage.jsx.
# Exit 0 = OK (always — this is advisory, not blocking)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Nur bei relevanten Dateien aktiv
case "$FILE_PATH" in
  *docs/anwenderdoku/*|*DocsPage.jsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR"

DOCS_PAGE="frontend/src/pages/DocsPage.jsx"
DOCS_DIR="docs/anwenderdoku/docs"

if [ ! -f "$DOCS_PAGE" ] || [ ! -d "$DOCS_DIR" ]; then
  exit 0
fi

# NAV-Slugs aus DocsPage.jsx extrahieren (nur innerhalb der NAV-Struktur, vor FEATURES)
NAV_SLUGS=$(sed -n '/^const NAV = \[/,/^];/p' "$DOCS_PAGE" | grep -oE "slug: '[^']+'" | sed "s/slug: '//;s/'//")

MISSING=""

for slug in $NAV_SLUGS; do
  if [ ! -f "$DOCS_DIR/${slug}.md" ]; then
    MISSING="${MISSING}  - ${slug}.md\n"
  fi
done

if [ -n "$MISSING" ]; then
  echo "{\"systemMessage\": \"DOCS-NAV MISMATCH: Folgende in DocsPage.jsx referenzierte Docs-Dateien fehlen im Dateisystem:\\n${MISSING}Bitte fehlende Dateien anlegen oder NAV-Einträge entfernen. Falls ein Vite-Dev-Server läuft, muss dieser ggf. neu gestartet werden.\"}"
fi

exit 0
