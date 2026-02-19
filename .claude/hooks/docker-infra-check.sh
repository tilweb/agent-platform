#!/bin/bash
# Hook: Docker/Infra Consistency Check (PreToolUse on Bash)
# Blocks git commit if infrastructure files are out of sync.
# Exit 0 = OK | Exit 2 = problem found (commit blocked)

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git commit (not amend, not other git commands)
if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit\b'; then
  exit 0
fi

# --- Helpers -----------------------------------------------------------

ERRORS=()

add_error() {
  ERRORS+=("$1")
}

# Get staged files (cached = staged for commit)
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
DOCKER_COMPOSE="$PROJECT_DIR/docker-compose.yml"
PROXY_CONF="$PROJECT_DIR/docker/proxy.conf"
BACKEND_DOCKERFILE="$PROJECT_DIR/backend/Dockerfile"
FRONTEND_DOCKERFILE="$PROJECT_DIR/frontend/Dockerfile"
PATHS_TS="$PROJECT_DIR/backend/src/utils/paths.ts"
BACKEND_INDEX="$PROJECT_DIR/backend/src/index.ts"
HELM_DIR="$PROJECT_DIR/helm"

# --- Check 1: New process.env.X in backend → must exist in .env.example ---

staged_backend_src=$(echo "$STAGED_FILES" | grep '^backend/src/' || true)
if [ -n "$staged_backend_src" ]; then
  # Get newly added process.env references in staged changes
  new_env_vars=$(git diff --cached -U0 -- backend/src/ 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -oE 'process\.env\.([A-Z_][A-Z0-9_]*)' \
    | sed 's/process\.env\.//' \
    | sort -u || true)

  if [ -n "$new_env_vars" ] && [ -f "$ENV_EXAMPLE" ]; then
    for var in $new_env_vars; do
      if ! grep -qE "^#?\s*${var}=" "$ENV_EXAMPLE"; then
        add_error "ENV-Variable '$var' wird in backend/src/ referenziert, fehlt aber in .env.example. Bitte ergaenzen."
      fi
    done
  fi
fi

# --- Check 2: New vars in .env.example → should exist in helm/values.yaml ---

if echo "$STAGED_FILES" | grep -q '\.env\.example$'; then
  if [ -d "$HELM_DIR" ] && [ -f "$HELM_DIR/values.yaml" ]; then
    new_env_example_vars=$(git diff --cached -U0 -- .env.example 2>/dev/null \
      | grep '^+' | grep -v '^+++' \
      | grep -oE '^[A-Z_][A-Z0-9_]*=' \
      | sed 's/=//' \
      | sort -u || true)

    for var in $new_env_example_vars; do
      if ! grep -qi "$var" "$HELM_DIR/values.yaml"; then
        add_error "Neue ENV-Variable '$var' in .env.example, aber nicht in helm/values.yaml gefunden. Helm Chart ggf. aktualisieren."
      fi
    done
  fi
fi

# --- Check 3: Port changes → Dockerfile EXPOSE, docker-compose, proxy.conf ---

# Backend port check
if echo "$STAGED_FILES" | grep -q 'backend/src/index.ts'; then
  staged_port=$(git diff --cached -U0 -- backend/src/index.ts 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -oE 'port.*[:=]\s*[0-9]+' \
    | grep -oE '[0-9]+' | tail -1 || true)

  if [ -n "$staged_port" ] && [ "$staged_port" != "3001" ]; then
    if [ -f "$BACKEND_DOCKERFILE" ] && ! grep -q "EXPOSE $staged_port" "$BACKEND_DOCKERFILE"; then
      add_error "Backend-Port auf $staged_port geaendert, aber backend/Dockerfile EXPOSE zeigt noch auf $(grep EXPOSE "$BACKEND_DOCKERFILE" | grep -oE '[0-9]+')."
    fi
    if [ -f "$DOCKER_COMPOSE" ] && ! grep -q "$staged_port" "$DOCKER_COMPOSE"; then
      add_error "Backend-Port auf $staged_port geaendert, aber docker-compose.yml referenziert noch den alten Port."
    fi
    if [ -f "$PROXY_CONF" ] && ! grep -q "backend:$staged_port" "$PROXY_CONF"; then
      add_error "Backend-Port auf $staged_port geaendert, aber docker/proxy.conf referenziert noch den alten Port."
    fi
  fi
fi

# Frontend port check (vite.config.js dev server port)
if echo "$STAGED_FILES" | grep -q 'frontend/vite.config.js'; then
  staged_fe_port=$(git diff --cached -U0 -- frontend/vite.config.js 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -oE 'port\s*:\s*[0-9]+' \
    | grep -oE '[0-9]+' | tail -1 || true)

  if [ -n "$staged_fe_port" ] && [ "$staged_fe_port" != "5173" ]; then
    if [ -f "$ENV_EXAMPLE" ] && grep -q 'FRONTEND_PORT=' "$ENV_EXAMPLE"; then
      env_fe_port=$(grep 'FRONTEND_PORT=' "$ENV_EXAMPLE" | head -1 | sed 's/.*=//')
      if [ "$env_fe_port" != "$staged_fe_port" ]; then
        add_error "Frontend-Port in vite.config.js auf $staged_fe_port geaendert, aber .env.example FRONTEND_PORT=$env_fe_port. Bitte synchronisieren."
      fi
    fi
  fi
fi

# --- Check 4: DATA_DIR changes in paths.ts → docker-compose volumes ---

if echo "$STAGED_FILES" | grep -q 'backend/src/utils/paths.ts'; then
  data_dir_changed=$(git diff --cached -U0 -- backend/src/utils/paths.ts 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep 'DATA_DIR' || true)

  if [ -n "$data_dir_changed" ]; then
    if ! echo "$STAGED_FILES" | grep -q 'docker-compose.yml'; then
      add_error "DATA_DIR in backend/src/utils/paths.ts geaendert. Pruefe ob docker-compose.yml Volumes angepasst werden muessen."
    fi
  fi
fi

# --- Check 5: New system deps in package.json → Dockerfile apk add? ---

NATIVE_DEPS="sharp canvas puppeteer playwright bcrypt argon2 node-gyp sqlite3 better-sqlite3 pg-native libvips ffmpeg"

for pkg_file in $(echo "$STAGED_FILES" | grep 'package\.json$' || true); do
  new_deps=$(git diff --cached -U0 -- "$pkg_file" 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -oE '"[a-z@][a-z0-9@/_-]+"' \
    | tr -d '"' || true)

  for dep in $new_deps; do
    dep_base=$(echo "$dep" | sed 's|@.*||' | sed 's|.*/||')
    for native in $NATIVE_DEPS; do
      if [ "$dep_base" = "$native" ]; then
        add_error "Neue Dependency '$dep' in $pkg_file koennte native Bibliotheken benoetigen. Pruefe ob Dockerfile 'apk add' Anpassungen noetig sind."
        break
      fi
    done
  done
done

# --- Check 6: New backend routes outside /api/ → proxy.conf ---

if echo "$STAGED_FILES" | grep -q 'backend/src/index.ts'; then
  new_routes=$(git diff --cached -U0 -- backend/src/index.ts 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -oE "app\.(get|post|put|delete|all|route)\s*\(\s*['\"][^'\"]*['\"]" \
    | grep -oE "['\"][^'\"]*['\"]" \
    | tr -d "'\"\`" || true)

  if [ -n "$new_routes" ] && [ -f "$PROXY_CONF" ]; then
    for route in $new_routes; do
      # Skip /api/ routes — they are already covered by the proxy catchall
      if echo "$route" | grep -qE '^/api/'; then
        continue
      fi
      # Skip /health — already in proxy.conf
      if [ "$route" = "/health" ]; then
        continue
      fi
      # Check if this route prefix has a location block in proxy.conf
      route_prefix=$(echo "$route" | sed 's|/[^/]*$|/|')
      if [ -n "$route_prefix" ] && [ "$route_prefix" != "/" ]; then
        if ! grep -q "location $route_prefix\|location $route " "$PROXY_CONF"; then
          add_error "Neue Route '$route' liegt ausserhalb von /api/. docker/proxy.conf benoetigt moeglicherweise einen neuen location-Block."
        fi
      fi
    done
  fi
fi

# --- Check 7: docker-compose.yml changed but no helm/ file staged → warning ---

if echo "$STAGED_FILES" | grep -q 'docker-compose.yml'; then
  if [ -d "$HELM_DIR" ]; then
    helm_staged=$(echo "$STAGED_FILES" | grep '^helm/' || true)
    if [ -z "$helm_staged" ]; then
      add_error "docker-compose.yml geaendert, aber keine Helm-Dateien staged. Pruefe ob helm/ Chart ebenfalls aktualisiert werden muss."
    fi
  fi
fi

# --- Output -----------------------------------------------------------

if [ ${#ERRORS[@]} -eq 0 ]; then
  exit 0
fi

# Build error message for Claude
ERROR_MSG="INFRA-CHECK FEHLGESCHLAGEN — Bitte behebe folgende Probleme bevor du commitest:\n"
for i in "${!ERRORS[@]}"; do
  ERROR_MSG+="$((i+1)). ${ERRORS[$i]}\n"
done

# Output as hookSpecificOutput to block the commit
jq -n --arg msg "$ERROR_MSG" '{
  decision: "block",
  reason: $msg
}'

exit 2
