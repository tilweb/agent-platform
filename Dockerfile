# Scalingo-Deploy Dockerfile.
#
# Persistenz lebt in Scalingo Postgres + Flow.swiss S3 — kein Volume-Mount,
# kein Disk-State zwischen Deploys. Das Image enthaelt nur das ausgepackte
# data/-Verzeichnis als One-Shot-Seed-Quelle. Beim ersten Boot laufen die
# seedXxxFromDisk()-Funktionen idempotent und uebertragen Custom-Skills,
# Projekte, Chats, KB-Collections+Documents in DB+S3.

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

# ffmpeg fuer Audio-Transcription, ca-certificates fuer outbound HTTPS.
RUN apk add --no-cache ffmpeg ca-certificates

# Backend-Dependencies
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

# Backend-Source (inkl. Drizzle-Migrations unter drizzle/).
# drizzle.config.ts ist nur fuer das Dev-Tool db:generate noetig — runMigrations()
# nutzt zur Laufzeit den drizzle-orm Migrator, der die SQL-Files direkt liest.
COPY backend/src/ ./src/
COPY backend/drizzle/ ./drizzle/

# Seed-Daten direkt unter ../data/ (kein Volume-Sync)
COPY data/ /app/data/
COPY backend/data/ /app/backend-data-bundled/

# Built Frontend
COPY --from=frontend-build /app/frontend/dist/ /app/frontend/dist/

# Helper-Scripts
COPY scripts/ /app/scripts/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Direkt-Start: bun src/index.ts. initialize() macht alles:
#   1. runMigrations()   — applies drizzle/000X_*.sql idempotent
#   2. seedDemoUsers()   — wenn SCALINGO_POSTGRES gesetzt + SEED_DEMO_DATA=true
#      (+ ALLOW_DEMO_SEED_IN_PRODUCTION=true in production)
#   3. seedCustomSkillsFromDisk() / seedProjectsFromDisk() / seedChatsFromDisk() /
#      seedKbFromDisk() — idempotent gegen DB-Existenz
#   4. ensureBucket()    — Flow.swiss S3
#   5. setupTools(), llmService.init(), MCP, taskExecutor
CMD ["bun", "run", "src/index.ts"]
