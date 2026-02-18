# Agent Platform - Deployment Guide

Dieses Dokument beschreibt die Installation und den Betrieb der Agent Platform in einer Produktionsumgebung.

## Inhaltsverzeichnis

1. [Systemvoraussetzungen](#1-systemvoraussetzungen)
2. [Environment-Variablen](#2-environment-variablen)
3. [Datenverzeichnis](#3-datenverzeichnis)
4. [Backend-Deployment](#4-backend-deployment)
5. [Frontend-Deployment](#5-frontend-deployment)
6. [Provider-Konfiguration](#6-provider-konfiguration)
7. [Sicherheit](#7-sicherheit)
8. [Health Checks & Monitoring](#8-health-checks--monitoring)
9. [Backup & Recovery](#9-backup--recovery)
10. [Troubleshooting](#10-troubleshooting)

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

### Backend (.env)

Erstelle eine `.env` Datei im `backend/` Verzeichnis:

```bash
# ============================================
# Server-Konfiguration
# ============================================
PORT=3001
API_BASE_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
NODE_ENV=production

# ============================================
# Sicherheit (PFLICHT)
# ============================================
# Generieren mit: openssl rand -hex 32
CONNECTION_ENCRYPTION_KEY=<32-byte-hex-key>

# ============================================
# LLM Provider (mindestens einer erforderlich)
# ============================================

# Option A: Adacor AI (lokal gehostet)
ADACOR_AI_API_KEY=your-api-key
ADACOR_AI_BASE_URL=https://your-llm-api.example.com/v1

# Option B: OpenAI
OPENAI_API_KEY=sk-...

# Option C: Anthropic
ANTHROPIC_API_KEY=sk-ant-...

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
# Sicherheits-Optionen
# ============================================

# SSRF Protection für Custom API Tools
SSRF_CHECK_MALWARE=false      # URLhaus Check (erfordert externe API)
SSRF_ALLOW_LOCALHOST=false    # NIEMALS in Produktion aktivieren!

# Proxy-Vertrauen (nur wenn hinter Reverse Proxy)
TRUST_PROXY=true
```

### Frontend (.env)

Erstelle eine `.env` Datei im `frontend/` Verzeichnis:

```bash
VITE_API_URL=https://api.example.com/api
```

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
├── chat-folders.yaml     # Ordner-Struktur für Chats
├── chat-uploads/         # Hochgeladene Dateien in Chats
├── chats/                # Chat-Verläufe (YAML pro Session)
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
├── projects/             # Projekt-Daten
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
cd backend/

# Dependencies installieren
bun install

# Environment-Datei erstellen
cp .env.example .env
# ... Environment-Variablen anpassen
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

#### Option B: Docker Container (Empfohlen)

Siehe Beispiel-Dockerfile weiter unten.

---

## 6. Provider-Konfiguration

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

## 7. Sicherheit

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

## 8. Health Checks & Monitoring

### Health-Check Endpoint

```bash
# Backend Health Check
curl http://localhost:3001/health

# Erwartete Antwort:
# {"status":"ok","timestamp":"2024-..."}
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

## 9. Backup & Recovery

### Wichtige Backup-Ziele

| Pfad | Priorität | Beschreibung |
|------|-----------|--------------|
| `data/` | KRITISCH | Alle Benutzerdaten |
| `backend/.env` | KRITISCH | Konfiguration & Secrets |
| `frontend/.env` | Mittel | Frontend-Konfiguration |

### Backup-Script Beispiel

```bash
#!/bin/bash
BACKUP_DIR=/backups/agent-platform
DATE=$(date +%Y%m%d_%H%M%S)

# Daten-Backup
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

# Konfiguration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  backend/.env \
  frontend/.env

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

## 10. Troubleshooting

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
# - FRONTEND_URL in backend/.env korrekt setzen
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
