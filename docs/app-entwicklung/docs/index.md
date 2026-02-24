# App-Entwicklung

Willkommen in der Dokumentation zur App-Entwicklung für KI-Workplace. Diese Dokumentation richtet sich an Entwickler, die eigene Apps für die Plattform erstellen möchten.

## Was sind Apps?

Apps erweitern die Plattform um eigenständige Funktionsbereiche. Jede App besteht aus:

- **Frontend-Seiten** — React-Komponenten unter `frontend/src/apps/<app-id>/`
- **Backend-Routen** — Hono-Router unter `backend/src/apps/<app-id>/`
- **Registry-Eintrag** — Registrierung in der zentralen App-Registry

Aktivierte Apps erscheinen automatisch in der Sidebar und sind über eigene URL-Pfade erreichbar.

## Architektur-Überblick

```
┌──────────────────────────────────────────────────┐
│                   Frontend                        │
│                                                  │
│  frontend/src/apps/<app-id>/                     │
│  ├── MyAppPage.jsx          (Hauptseite)         │
│  ├── DetailPage.jsx         (Detail-Ansicht)     │
│  └── components/            (App-Komponenten)    │
│                                                  │
│  frontend/src/hooks/useMyApp.js  (Daten-Hook)    │
├──────────────────────────────────────────────────┤
│                 API (/api/apps/<app-id>/...)      │
├──────────────────────────────────────────────────┤
│                   Backend                         │
│                                                  │
│  backend/src/apps/<app-id>/                      │
│  ├── routes.ts              (API-Endpunkte)      │
│  ├── service.ts             (Business-Logik)     │
│  └── storage.ts             (Datenzugriff)       │
│                                                  │
│  backend/data/apps/<app-id>/  (Persistenz)       │
└──────────────────────────────────────────────────┘
```

## Voraussetzungen

Bevor Sie mit der Entwicklung beginnen, stellen Sie sicher, dass die Entwicklungsumgebung eingerichtet ist:

```bash
# Backend
cd backend
bun install
bun run dev          # Port 3001

# Frontend
cd frontend
npm install
npm run dev          # Port 5173
```

Die `.env`-Datei liegt im Root-Verzeichnis und wird von beiden Servern geladen.

## Nächste Schritte

Folgen Sie dem [Schnellstart-Tutorial](schnellstart/neue-app.md), um Ihre erste App zu erstellen.
