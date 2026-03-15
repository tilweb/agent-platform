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

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Single volume at /app/data holds everything.
# backend/data/ is a symlink into the volume.
# Seed data is synced on every start (merge, don't overwrite user data).
CMD sh -c '\
  echo "=== Syncing seed data into volume ===" && \
  cp -rn /app/backend/data-seed/* /app/data/ 2>/dev/null; \
  cp -r /app/backend/data-seed/agents/ /app/data/agents/ && \
  cp -r /app/backend/data-seed/config/ /app/data/config/ && \
  cp -r /app/backend/data-seed/skills/ /app/data/skills/ && \
  cp /app/backend/data-seed/auth/users/user_1770561498880_39ohgu5.yaml /app/data/auth/users/user_1770561498880_39ohgu5.yaml && \
  echo "=== Syncing backend-data ===" && \
  mkdir -p /app/data/backend-data && \
  cp -r /app/backend/backend-data-seed/* /app/data/backend-data/ && \
  rm -rf /app/backend/data && \
  ln -s /app/data/backend-data /app/backend/data && \
  echo "=== Verifying providers.yaml ===" && \
  wc -l /app/data/config/providers.yaml && \
  grep "^  - id:" /app/data/config/providers.yaml && \
  echo "=== Running seed script ===" && \
  bun run /app/backend/scripts/seed-demo-users.ts && \
  echo "=== Starting server ===" && \
  bun run /app/backend/src/index.ts'
