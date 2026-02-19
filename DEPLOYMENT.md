# Agent Platform - Deployment Guide

Dieses Dokument beschreibt die Installation und den Betrieb der Agent Platform in einer Produktionsumgebung.

## Inhaltsverzeichnis

1. [Systemvoraussetzungen](#1-systemvoraussetzungen)
2. [Environment-Variablen](#2-environment-variablen)
3. [Datenverzeichnis](#3-datenverzeichnis)
4. [Backend-Deployment](#4-backend-deployment)
5. [Frontend-Deployment](#5-frontend-deployment)
6. [Docker Compose](#6-docker-compose)
7. [Kubernetes / Helm](#7-kubernetes--helm)
8. [Provider-Konfiguration](#8-provider-konfiguration)
9. [Sicherheit](#9-sicherheit)
10. [Health Checks & Monitoring](#10-health-checks--monitoring)
11. [Backup & Recovery](#11-backup--recovery)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Systemvoraussetzungen

### Mindestanforderungen

| Komponente | Anforderung |
|------------|-------------|
| Bun Runtime | >= 1.0 |
| Node.js | >= 20 (nur für Frontend-Build) |
| RAM | 2 GB (empfohlen: 4 GB) |
| Speicher | 10 GB (abhängig von Datenvolumen) |
| OS | Linux, macOS |

### Optionale Dependencies

| Komponente | Verwendung |
|------------|------------|
| ffmpeg | Audio-Transkription (WebM/M4A zu MP3) |
| nginx | Reverse Proxy |

### Installation Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Pfad hinzufügen (falls nötig)
export PATH="$HOME/.bun/bin:$PATH"

# Verifizieren
bun --version
```

---

## 2. Environment-Variablen

### .env (Projekt-Root)

Es gibt eine **einzige `.env`-Datei im Projekt-Root** — sie ist die zentrale Konfigurationsquelle für alle Deployment-Modi (lokal, Docker Compose, Kubernetes).

```bash
cp .env.example .env
# Werte anpassen:
```

```bash
# ============================================
# Server-Konfiguration
# ============================================
BACKEND_PORT=3001
API_BASE_URL=https://agent.example.com
NODE_ENV=production

# ============================================
# Sicherheit (PFLICHT)
# ============================================
# Generieren mit: openssl rand -hex 32
CONNECTION_ENCRYPTION_KEY=<32-byte-hex-key>

# ============================================
# LLM Provider (mindestens einer erforderlich)
# ============================================

# Adacor AI
ADACOR_AI_API_URL=https://your-llm-api.example.com/v1
ADACOR_AI_API_KEY=your-api-key
ADACOR_AI_MODEL=mistral-3-24b-128k

# ============================================
# OAuth Provider (optional)
# ============================================

# Confluence/Atlassian
CONFLUENCE_CLIENT_ID=your-client-id
CONFLUENCE_CLIENT_SECRET=your-client-secret

# Google (Drive, etc.)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# ============================================
# MCP Runner (optional)
# ============================================
# MCP_RUNNER_URL=http://mcp-runner:3002
# MCP_RUNNER_SECRET=<shared-secret>

# ============================================
# Sicherheits-Optionen
# ============================================

# SSRF Protection für Custom API Tools
SSRF_CHECK_MALWARE=false      # URLhaus Check (erfordert externe API)
SSRF_ALLOW_LOCALHOST=false    # NIEMALS in Produktion aktivieren!

# Proxy-Vertrauen (nur wenn hinter Reverse Proxy)
TRUST_PROXY=true
```

Vollständige Referenz aller Variablen: siehe `.env.example`

### Wichtige Hinweise

- **CONNECTION_ENCRYPTION_KEY**: Wird zur Verschlüsselung von OAuth-Tokens verwendet. Bei Änderung werden alle gespeicherten Connections ungültig!
- **TRUST_PROXY**: Nur aktivieren, wenn ein vertrauenswürdiger Reverse Proxy (nginx, Cloudflare) X-Forwarded-* Header setzt

---

## 3. Datenverzeichnis

Alle persistenten Daten werden im `data/` Verzeichnis gespeichert (auf Ebene von backend/frontend).

### Verzeichnisstruktur

```
data/
├── auth/                 # Benutzer-Sessions
│   └── sessions/         # Session-Dateien
├── agents/               # Agent-Definitionen (YAML)
├── apps/                 # App-spezifische Daten
├── chat-uploads/         # Hochgeladene Dateien in Chats
├── chats/                # Chat-Verläufe (YAML pro Session)
│   └── chat-folders.yaml # Ordner-Struktur für Chats
├── config/               # System-Konfiguration
│   └── providers.yaml    # LLM Provider-Einstellungen
├── connections/          # OAuth Tokens (verschlüsselt!)
├── conversations/        # Legacy: Konversations-Exporte (MD)
├── generated-images/     # Generierte Bilder
├── knowledge-base/       # Knowledge Base Collections
│   └── collections/      # Indexierte Dokumente
├── memory/               # User Memory
│   ├── sessions/         # In-Memory Session Backup
│   └── users/            # Per-User Memory (YAML)
├── plans/                # Task-Pläne
├── spaces/               # Space-Daten
├── results/              # Task-Ergebnisse
├── skills/               # Skill-Definitionen
├── tables/               # Datenbank-Tabellen
├── tasks/                # Task-Queue & Tasks (YAML)
│   └── queue.yaml        # Queue-Status
├── temp/                 # Temporäre Dateien
└── tools/                # Custom Tool-Definitionen
```

### Wichtige Dateien

| Datei | Beschreibung |
|-------|--------------|
| `config/providers.yaml` | LLM-Provider Konfiguration |
| `tasks/queue.yaml` | Task-Queue Status |
| `auth/sessions/` | Aktive User-Sessions |
| `connections/` | Verschlüsselte OAuth-Tokens |

### Berechtigungen

```bash
# Backend-Prozess muss Schreibrechte haben
chmod -R 755 data/
chown -R <app-user>:<app-group> data/
```

---

## 4. Backend-Deployment

### Installation

```bash
# Im Projekt-Root
cp .env.example .env
# ... Environment-Variablen anpassen

cd backend/
bun install
```

### Start-Befehle

```bash
# Entwicklung (mit Hot-Reload)
bun run dev

# Produktion
bun run start

# Alternative: Direkter Aufruf
bun run src/index.ts
```

### Systemd Service (Linux)

Erstelle `/etc/systemd/system/agent-platform-backend.service`:

```ini
[Unit]
Description=Agent Platform Backend
After=network.target

[Service]
Type=simple
User=agent-platform
WorkingDirectory=/opt/agent-platform/backend
Environment=PATH=/home/agent-platform/.bun/bin:/usr/local/bin:/usr/bin
ExecStart=/home/agent-platform/.bun/bin/bun run src/index.ts
Restart=on-failure
RestartSec=10

# Sicherheit
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/opt/agent-platform/data

[Install]
WantedBy=multi-user.target
```

```bash
# Service aktivieren
sudo systemctl daemon-reload
sudo systemctl enable agent-platform-backend
sudo systemctl start agent-platform-backend
```

---

## 5. Frontend-Deployment

### Build

```bash
cd frontend/

# Dependencies installieren
npm install
# oder: bun install

# Production Build
npm run build
# oder: bun run build
```

Der Build wird in `frontend/dist/` erstellt.

### Deployment-Optionen

#### Option A: Statische Dateien via nginx

```bash
# Build-Dateien kopieren
cp -r frontend/dist/* /var/www/agent-platform/
```

#### Option B: Docker / Kubernetes

Siehe Abschnitte [Docker Compose](#6-docker-compose) und [Kubernetes / Helm](#7-kubernetes--helm).

---

## 6. Docker Compose

### Voraussetzungen

- Docker >= 20.10
- Docker Compose >= 2.0

### Starten

```bash
cp .env.example .env          # Konfiguration anpassen
docker compose up -d
```

Die Anwendung ist unter `http://localhost:8080` erreichbar.

### Architektur

```
                    :8080
  Browser ──────► nginx (Proxy)
                    ├── /api/* ───► backend:3001
                    ├── /health ──► backend:3001
                    └── /* ───────► frontend:80
                                      │
                    backend ──HTTP──► mcp-runner:3002 ──spawn──► MCP Server (stdio)
```

### Container-Details

| Container | Image-Basis | Port | User | Beschreibung |
|-----------|-------------|------|------|--------------|
| backend | `oven/bun:alpine` | 3001 | UID 1000 (non-root) | API + Business Logic |
| mcp-runner | `oven/bun:alpine` + Node.js | 3002 | UID 1000 (non-root) | MCP Server Prozess-Management |
| frontend | `nginx:alpine` | 80 | UID 101 (nginx) | React SPA |
| proxy | `nginx:alpine` | 8080 | - | Reverse Proxy |

### MCP Runner

Der MCP Runner ist ein dedizierter Container, der MCP-Server-Prozesse isoliert vom Backend ausführt. Das Backend kommuniziert per HTTP mit dem Runner statt selbst Child-Prozesse zu spawnen.

```yaml
# Relevante Environment-Variablen
MCP_RUNNER_URL=http://mcp-runner:3002   # Backend → Runner Verbindung
MCP_RUNNER_SECRET=<shared-secret>        # Bearer Token Auth
MCP_RUNNER_PORT=3002                     # Runner Listen-Port
```

**Lokal ohne Runner**: Ohne `MCP_RUNNER_URL` startet das Backend MCP-Server wie bisher als Child-Prozesse.

### Volumes

Das Backend-Datenverzeichnis wird als Bind-Mount eingebunden:

```yaml
volumes:
  - ./data:/app/data          # Persistente Daten
```

### Docker-spezifische Overrides

Für Container-spezifische Overrides (die nicht in die Haupt-`.env` gehören):

```bash
cp docker-compose.env.example docker-compose.env
```

Beispiel: `TRUST_PROXY=true` ist im Container immer nötig (nginx-Proxy davor).

---

## 7. Kubernetes / Helm

### Voraussetzungen

- Kubernetes >= 1.25
- Helm >= 3.12
- Ingress Controller (z.B. nginx-ingress)

### Installation

```bash
# Minimale Installation
helm install agent-platform ./helm/agent-platform \
  --namespace agent-platform --create-namespace \
  --set ingress.host=agent.example.com \
  --set backend.secret.data.ADACOR_AI_API_KEY=your-key \
  --set backend.secret.data.CONNECTION_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Oder mit eigener values-Datei
helm install agent-platform ./helm/agent-platform \
  -f my-values.yaml \
  --namespace agent-platform --create-namespace
```

### Architektur

```
                    Ingress (nginx)
  Browser ──────►   ├── /api/*    ───► backend-svc:3001
                    ├── /health   ───► backend-svc:3001
                    └── /*        ───► frontend-svc:80 ──► :8080
                                        │
                    PVC (10Gi) ◄────► backend-pod ──HTTP──► mcp-runner-svc:3002
                                        │                    (optional)
                    ConfigMap ──────► env vars (nicht-sensitiv)
                    Secret ────────► env vars (API-Keys, OAuth, MCP_RUNNER_SECRET)
```

### Konfiguration (values.yaml)

Die wichtigsten Werte:

```yaml
# Container-Registry
backend:
  image:
    repository: ghcr.io/OWNER/agent-platform-backend
    tag: "0.1.0"

frontend:
  image:
    repository: ghcr.io/OWNER/agent-platform-frontend
    tag: "0.1.0"

# Ingress
ingress:
  enabled: true
  className: nginx
  host: agent.example.com
  tls:
    - secretName: agent-platform-tls
      hosts:
        - agent.example.com

# Nicht-sensitive Konfiguration -> ConfigMap
backend:
  config:
    nodeEnv: production
    adacorAiApiUrl: "https://your-llm-api.example.com/v1"
    adacorAiModel: "mistral-3-24b-128k"
    platformModels:
      PLATFORM_APPS_PROVIDER_ID: adacor
      PLATFORM_APPS_MODEL_ID: mistral-3-24b-128k

# Sensitive Daten -> Secret
  secret:
    create: true
    data:
      ADACOR_AI_API_KEY: "your-key"
      CONNECTION_ENCRYPTION_KEY: "your-hex-key"

# Persistenz
persistence:
  enabled: true
  size: 10Gi
  # storageClass: "managed-premium"

# MCP Runner (optional)
mcpRunner:
  enabled: false            # Aktivieren für isolierte MCP-Server
  image:
    repository: ghcr.io/OWNER/agent-platform-mcp-runner
    tag: "0.1.0"
```

### External Secrets (Produktion)

Für produktive Umgebungen empfohlen: Secrets nicht in `values.yaml`, sondern über External Secrets Operator:

```yaml
backend:
  secret:
    create: false
    existingSecret: "agent-platform-external-secret"
```

### Container-Sicherheit

Alle Container laufen gehärtet:

- **Non-Root**: Backend UID 1000, Frontend UID 101
- **ReadOnlyRootFilesystem**: Schreibzugriff nur auf explizite Volumes
- **Drop ALL Capabilities**: Keine Linux-Capabilities
- **Probes**: Liveness + Readiness auf `/health` (Backend) und `/` (Frontend)

### Daten-Seeding

Der Backend-Pod enthält einen InitContainer, der beim ersten Start Seed-Daten (config, agents, skills, apps, tools) aus dem Image in das PVC kopiert. Bestehende Daten werden dabei **nicht** überschrieben (`cp -rn`).

### SSE/Streaming

Das Ingress-Template setzt die nötigen nginx-Annotations für Server-Sent Events:

- `proxy-buffering: off` — ohne das hängt SSE
- `proxy-read-timeout: 3600` — Langläufer-Verbindungen für Chat
- `proxy-request-buffering: off` — für Datei-Uploads

---

## 8. Provider-Konfiguration

### LLM Provider Setup

Die LLM-Provider werden in `data/config/providers.yaml` konfiguriert:

```yaml
providers:
  - id: adacor-ai
    name: Adacor AI
    baseUrl: https://your-llm-api.example.com/v1
    defaultModel: gpt-4o
    enabled: true

  - id: openai
    name: OpenAI
    baseUrl: https://api.openai.com/v1
    defaultModel: gpt-4-turbo-preview
    enabled: false

settings:
  defaultProvider: adacor-ai
  temperature: 0.7
  maxTokens: 4096
```

### Mindestens ein Provider erforderlich

Die Plattform benötigt mindestens einen aktiven LLM-Provider. Ohne Provider sind alle Chat- und Agent-Funktionen deaktiviert.

---

## 9. Sicherheit

### Verschlüsselung

- **OAuth-Tokens**: Werden mit AES-256-GCM verschlüsselt gespeichert
- **Passwörter**: Argon2id Hashing
- **Sessions**: Sichere Token-Generierung mit crypto.randomBytes

### CORS-Konfiguration

Das Backend konfiguriert CORS basierend auf `FRONTEND_URL`:

```typescript
// Bereits im Code implementiert
cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
})
```

### Session-Sicherheit

- **Sliding Sessions**: Sessions werden bei Aktivität verlängert
- **Maximum Lifetime**: 30 Tage absolute Lebensdauer
- **Secure Cookies**: In Produktion mit `secure: true` und `httpOnly: true`

### Multi-User Isolation

Nach dem Update v2.x:
- Alle Task- und Memory-Routes erfordern Authentifizierung
- Jeder User sieht nur seine eigenen Daten
- In-Memory Caches sind user-isoliert

### Migration bestehender Daten

Bei Update von Single-User auf Multi-User:

```bash
cd backend/

# Dry-Run (zeigt was migriert wird)
bun run scripts/migrate-to-multiuser.ts --admin-user=<userId> --dry-run

# Echte Migration
bun run scripts/migrate-to-multiuser.ts --admin-user=<userId>
```

---

## 10. Health Checks & Monitoring

### Health-Check Endpoints

```bash
# Backend Health Check
curl http://localhost:3001/health
# {"status":"ok","timestamp":"2024-..."}

# MCP Runner Health Check (falls aktiviert)
curl http://localhost:3002/health
# {"status":"ok","servers":2,"connected":2,"uptime":3600}
```

### Wichtige Metriken

| Metrik | Beschreibung |
|--------|--------------|
| `/health` | Backend-Verfügbarkeit |
| Task Queue Status | Anzahl aktiver/wartender Tasks |
| Session Count | Aktive User-Sessions |

### Logging

Das Backend loggt nach stdout. Empfohlen: Weiterleitung an Log-Aggregator.

```bash
# Systemd Journal
journalctl -u agent-platform-backend -f

# Oder: Logfile
bun run src/index.ts 2>&1 | tee /var/log/agent-platform/backend.log
```

---

## 11. Backup & Recovery

### Wichtige Backup-Ziele

| Pfad | Priorität | Beschreibung |
|------|-----------|--------------|
| `data/` | KRITISCH | Alle Benutzerdaten |
| `.env` | KRITISCH | Konfiguration & Secrets |

### Backup-Script Beispiel

```bash
#!/bin/bash
BACKUP_DIR=/backups/agent-platform
DATE=$(date +%Y%m%d_%H%M%S)

# Daten-Backup
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

# Konfiguration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz .env

# Alte Backups aufräumen (älter als 30 Tage)
find $BACKUP_DIR -mtime +30 -delete
```

### Recovery

```bash
# Daten wiederherstellen
tar -xzf /backups/agent-platform/data_YYYYMMDD_HHMMSS.tar.gz

# Backend neu starten
systemctl restart agent-platform-backend
```

---

## 12. Troubleshooting

### Häufige Probleme

#### Backend startet nicht

```bash
# Logs prüfen
journalctl -u agent-platform-backend -n 100

# Typische Ursachen:
# - Port bereits belegt: lsof -i :3001
# - Fehlende .env Datei
# - Ungültige CONNECTION_ENCRYPTION_KEY
```

#### Frontend kann Backend nicht erreichen

```bash
# CORS-Probleme
# - FRONTEND_URL in .env korrekt setzen
# - Keine trailing slashes verwenden

# Network-Probleme
curl -v https://api.example.com/health
```

#### LLM-Fehler (keine Antworten)

```bash
# Provider-Status prüfen
curl https://api.example.com/api/providers

# API-Key prüfen
# - Korrekt in .env gesetzt?
# - Key noch gültig?
```

#### Session-Probleme / Login funktioniert nicht

```bash
# Sessions aufräumen
rm -rf data/auth/sessions/*

# Backend neu starten
systemctl restart agent-platform-backend
```

#### Tasks bleiben "stuck"

```bash
# Task-Recovery ausführen (über API)
curl -X POST https://api.example.com/api/tasks/recover

# Oder: Queue manuell zurücksetzen
rm data/tasks/queue.yaml
systemctl restart agent-platform-backend
```

### Debug-Modus

Für detailliertes Logging:

```bash
DEBUG=* bun run src/index.ts
```

---

## Reverse Proxy Setup (nginx)

### Beispiel-Konfiguration

```nginx
# /etc/nginx/sites-available/agent-platform

# Backend API
upstream backend {
    server 127.0.0.1:3001;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Timeouts für Long-Running Requests (Tasks, Streaming)
    proxy_read_timeout 300;
    proxy_connect_timeout 60;
    proxy_send_timeout 300;

    # WebSocket Support (für SSE Streaming)
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE: Buffering deaktivieren
        proxy_buffering off;
        proxy_cache off;
    }

    # File Uploads
    client_max_body_size 50M;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    root /var/www/agent-platform;
    index index.html;

    # SPA: Alle Routes zu index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP -> HTTPS Redirect
server {
    listen 80;
    server_name api.example.com app.example.com;
    return 301 https://$host$request_uri;
}
```

### SSL-Zertifikate mit Let's Encrypt

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx

# Zertifikate erstellen
sudo certbot --nginx -d api.example.com -d app.example.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

---

## Checkliste: Production Readiness

- [ ] `NODE_ENV=production` gesetzt
- [ ] `CONNECTION_ENCRYPTION_KEY` sicher generiert und gespeichert
- [ ] Mindestens ein LLM-Provider konfiguriert
- [ ] SSL/TLS für alle Endpoints
- [ ] CORS korrekt konfiguriert
- [ ] Backup-Strategie implementiert
- [ ] Health-Check Monitoring eingerichtet
- [ ] Log-Aggregation konfiguriert
- [ ] Firewall: Nur Ports 80/443 öffentlich
- [ ] Multi-User Migration durchgeführt (falls Update)
