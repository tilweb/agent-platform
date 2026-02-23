#!/bin/bash
# Docs NAV Integrity Check — PostToolUse Hook (Edit|Write)
# Prüft ob DocsPage.jsx NAV-Slugs mit dem Dateisystem übereinstimmen.
# Prüft sowohl Anwenderdoku (ANWENDERDOKU_NAV) als auch Entwickler-Doku (ENTWICKLER_NAV).
# Nur aktiv bei Änderungen an docs/anwenderdoku/**, docs/entwickler/** oder DocsPage.jsx.
# Exit 0 = OK (always — this is advisory, not blocking)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Nur bei relevanten Dateien aktiv
case "$FILE_PATH" in
  *docs/anwenderdoku/*|*docs/entwickler/*|*DocsPage.jsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR"

DOCS_PAGE="frontend/src/pages/DocsPage.jsx"
DOCS_DIR="docs/anwenderdoku/docs"
ENTWICKLER_DIR="docs/entwickler/docs"

if [ ! -f "$DOCS_PAGE" ]; then
  exit 0
fi

MISSING=""

# Anwenderdoku prüfen
if [ -d "$DOCS_DIR" ]; then
  ANWENDERDOKU_SLUGS=$(sed -n '/^const ANWENDERDOKU_NAV = \[/,/^];/p' "$DOCS_PAGE" | grep -oE "slug: '[^']+'" | sed "s/slug: '//;s/'//")
  for slug in $ANWENDERDOKU_SLUGS; do
    if [ ! -f "$DOCS_DIR/${slug}.md" ]; then
      MISSING="${MISSING}  - anwenderdoku/${slug}.md\n"
    fi
  done
fi

# Entwickler-Docs prüfen (wenn Verzeichnis existiert)
if [ -d "$ENTWICKLER_DIR" ]; then
  ENTWICKLER_SLUGS=$(sed -n '/^const ENTWICKLER_NAV = \[/,/^];/p' "$DOCS_PAGE" | grep -oE "slug: '[^']+'" | sed "s/slug: '//;s/'//")
  for slug in $ENTWICKLER_SLUGS; do
    if [ ! -f "$ENTWICKLER_DIR/${slug}.md" ]; then
      MISSING="${MISSING}  - entwickler/${slug}.md\n"
    fi
  done
fi

if [ -n "$MISSING" ]; then
  echo "{\"systemMessage\": \"DOCS-NAV MISMATCH: Folgende in DocsPage.jsx referenzierte Docs-Dateien fehlen im Dateisystem:\\n${MISSING}Bitte fehlende Dateien anlegen oder NAV-Einträge entfernen. Falls ein Vite-Dev-Server läuft, muss dieser ggf. neu gestartet werden.\"}"
fi

exit 0
