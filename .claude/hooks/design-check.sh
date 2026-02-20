#!/bin/bash
# Design Consistency Check Hook - Prüft Design-Vorgaben bei Frontend-Änderungen
# Exit 0 = OK (systemMessage = Warnung), Exit 2 = Block
#
# Prüft neuen/geänderten Code gegen die Design-Vorgaben aus frontend/CLAUDE.md:
# - Keine hardcoded Farben (muss theme.colors.* sein)
# - Keine hardcoded Spacing/Pixel-Werte (muss theme.spacing.* sein)
# - Keine CSS Toggle-Switches (muss ToggleOnIcon/ToggleOffIcon sein)
# - Keine Emojis in JSX
# - theme.js muss importiert sein
# - Keine CSS-Datei-Imports

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

# Ignoriere theme.js selbst, Utils, Config
if [[ "$FILE_PATH" == *config/theme* || "$FILE_PATH" == *utils/* ]]; then
  exit 0
fi

WARNINGS=""

# Check 1: Hardcoded Farben (Hex-Werte die nicht in theme.colors Kontext stehen)
# Erlaubt: theme.colors.*, '#fff', '#ffffff', 'transparent', 'none', 'currentColor'
# Erlaubt: Hex in Opacity-Suffixen wie ${theme.colors.error}30
if echo "$NEW_CONTENT" | grep -qE "'#[0-9a-fA-F]{3,8}'|\"#[0-9a-fA-F]{3,8}\"" | grep -v "theme\.colors"; then
  # Prüfe ob es echte hardcoded Farben sind (nicht #fff/#000/transparent in SVG-Kontexten)
  HARDCODED=$(echo "$NEW_CONTENT" | grep -oE "'#[0-9a-fA-F]{3,8}'|\"#[0-9a-fA-F]{3,8}\"" | grep -viE "'#fff'|'#ffffff'|'#000'|'#000000'|\"#fff\"|\"#ffffff\"|\"#000\"|\"#000000\"" | head -3)
  if [ -n "$HARDCODED" ]; then
    WARNINGS="${WARNINGS}DESIGN: Hardcoded Farben gefunden (${HARDCODED}). Verwende theme.colors.* stattdessen. "
  fi
fi

# Check 2: CSS Toggle-Switch Patterns (position: relative + borderRadius: 50% Dot-Pattern)
if echo "$NEW_CONTENT" | grep -qE "toggleDot|toggle.*Dot|\.toggle.*position.*relative" | grep -v "ToggleOnIcon\|ToggleOffIcon"; then
  WARNINGS="${WARNINGS}DESIGN: CSS Toggle-Switch Pattern erkannt. Verwende ToggleOnIcon/ToggleOffIcon SVG-Icons (siehe frontend/CLAUDE.md). "
fi

# Check 3: Emojis in JSX (Unicode Emoji Ranges)
# Erlaubt: Länder-Flags (U+1F1E6-1F1FF)
if echo "$NEW_CONTENT" | grep -P '[\x{1F300}-\x{1F5FF}\x{1F600}-\x{1F64F}\x{1F680}-\x{1F6FF}\x{1F900}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]' 2>/dev/null; then
  WARNINGS="${WARNINGS}DESIGN: Emojis in UI gefunden. Verwende SVG-Icons aus components/Icons.jsx. "
fi

# Check 4: CSS-Datei-Imports
if echo "$NEW_CONTENT" | grep -qE "import.*\.css['\"]|require.*\.css['\"]"; then
  WARNINGS="${WARNINGS}DESIGN: CSS-Datei Import gefunden. Verwende Inline-Styles mit theme.js. "
fi

# Check 5: Externe Icon-Libraries (keine Font-Awesome, Material Icons etc.)
if echo "$NEW_CONTENT" | grep -qiE "import.*from.*['\"](@?font-awesome|@mui/icons|react-icons|@heroicons)"; then
  WARNINGS="${WARNINGS}DESIGN: Externe Icon-Library Import. Verwende Icons aus components/Icons.jsx. "
fi

# Check 6: accentColor oder andere nicht-theme CSS-Properties
if echo "$NEW_CONTENT" | grep -qE "accentColor.*['\"]#[0-9a-fA-F]"; then
  WARNINGS="${WARNINGS}DESIGN: Hardcoded accentColor. Verwende theme.colors.* Werte. "
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"systemMessage\": \"Design-Check: $WARNINGS Siehe frontend/CLAUDE.md fuer die vollstaendigen Design-Vorgaben.\"}"
fi

exit 0
