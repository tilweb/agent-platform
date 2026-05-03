# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Runtime
FROM oven/bun:1-alpine
WORKDIR /app/backend

# Install system dependencies
RUN apk add --no-cache ffmpeg

# Install backend dependencies
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy backend source
COPY backend/src/ ./src/

# Copy seed data (used to initialize volumes on first start)
COPY backend/data/ ./backend-data-seed/
COPY data/ ./data-seed/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist/ ../frontend/dist/

# Copy seed script
COPY scripts/seed-demo-users.ts ./scripts/seed-demo-users.ts
COPY backend/scripts/seed-demo-pm-owners.ts ./scripts/seed-demo-pm-owners.ts

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Single volume at /app/data holds everything.
# backend/data/ is a symlink into the volume.
# Seed data is synced on every start (merge, don't overwrite user data).
CMD sh -c '\
  echo "=== Syncing seed data into volume ===" && \
  cp -rn /app/backend/data-seed/* /app/data/ 2>/dev/null; \
  echo "=== Syncing system agents (preserving user-created) ===" && \
  mkdir -p /app/data/agents && \
  for agent_dir in /app/backend/data-seed/agents/*/; do \
    agent_name=$(basename "$agent_dir"); \
    rm -rf "/app/data/agents/$agent_name"; \
    cp -r "$agent_dir" "/app/data/agents/$agent_name"; \
  done && \
  echo "=== Syncing system skills (preserving custom) ===" && \
  rm -rf /app/data/skills/system && \
  mkdir -p /app/data/skills/system /app/data/skills/custom && \
  cp -r /app/backend/data-seed/skills/system/* /app/data/skills/system/ && \
  echo "=== Syncing config ===" && \
  rm -rf /app/data/config && \
  cp -r /app/backend/data-seed/config /app/data/config && \
  cp -f /app/backend/data-seed/auth/users/user_1770561498880_39ohgu5.yaml /app/data/auth/users/user_1770561498880_39ohgu5.yaml && \
  echo "=== Syncing backend-data (config + schemas only, preserving user data) ===" && \
  mkdir -p /app/data/backend-data/apps && \
  cp -f /app/backend/backend-data-seed/apps/registry.yaml /app/data/backend-data/apps/registry.yaml && \
  for app_dir in /app/backend/backend-data-seed/apps/*/; do \
    app_name=$(basename "$app_dir"); \
    mkdir -p "/app/data/backend-data/apps/$app_name"; \
    for sub in schemas vorlagen knowledge; do \
      if [ -d "$app_dir/$sub" ]; then \
        rm -rf "/app/data/backend-data/apps/$app_name/$sub"; \
        cp -r "$app_dir/$sub" "/app/data/backend-data/apps/$app_name/$sub"; \
      fi; \
    done; \
    [ -f "$app_dir/config.json" ] && cp -f "$app_dir/config.json" "/app/data/backend-data/apps/$app_name/config.json"; \
    cp -rn "$app_dir"* "/app/data/backend-data/apps/$app_name/" 2>/dev/null; \
  done && \
  cp -rn /app/backend/backend-data-seed/* /app/data/backend-data/ 2>/dev/null; \
  rm -rf /app/backend/data && \
  ln -s /app/data/backend-data /app/backend/data && \
  echo "=== Verifying providers ===" && \
  grep "^  - id:" /app/data/config/providers.yaml && \
  echo "=== Running seed script ===" && \
  bun run /app/backend/scripts/seed-demo-users.ts && \
  echo "=== Running projectmanagement demo owner seed ===" && \
  SEED_DEMO_OWNERS=true bun run /app/backend/scripts/seed-demo-pm-owners.ts && \
  echo "=== Starting server ===" && \
  bun run /app/backend/src/index.ts'
