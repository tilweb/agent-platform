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
CMD sh -c '\
  echo "=== Initializing data volume ===" && \
  if [ -z "$(ls -A /app/data 2>/dev/null)" ]; then \
    echo "Volume /app/data is empty, copying seed data..." && \
    cp -r /app/backend/data-seed/* /app/data/ && \
    mkdir -p /app/data/backend-data && \
    cp -r /app/backend/backend-data-seed/* /app/data/backend-data/; \
  else \
    echo "Volume /app/data already initialized."; \
  fi && \
  echo "=== Linking backend/data ===" && \
  rm -rf /app/backend/data && \
  ln -s /app/data/backend-data /app/backend/data && \
  echo "=== Running seed script ===" && \
  bun run /app/backend/scripts/seed-demo-users.ts && \
  echo "=== Starting server ===" && \
  bun run /app/backend/src/index.ts'
