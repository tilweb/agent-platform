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

# Initialize volumes if empty, run seed script, start server
CMD sh -c '\
  echo "=== Initializing data volumes ===" && \
  if [ -z "$(ls -A /app/data 2>/dev/null)" ]; then \
    echo "Volume /app/data is empty, copying seed data..." && \
    cp -r /app/backend/data-seed/* /app/data/; \
  else \
    echo "Volume /app/data already initialized."; \
  fi && \
  if [ -z "$(ls -A /app/backend/data 2>/dev/null)" ]; then \
    echo "Volume /app/backend/data is empty, copying seed data..." && \
    mkdir -p /app/backend/data && \
    cp -r /app/backend/backend-data-seed/* /app/backend/data/; \
  else \
    echo "Volume /app/backend/data already initialized."; \
  fi && \
  echo "=== Running seed script ===" && \
  bun run /app/backend/scripts/seed-demo-users.ts && \
  echo "=== Starting server ===" && \
  bun run /app/backend/src/index.ts'
