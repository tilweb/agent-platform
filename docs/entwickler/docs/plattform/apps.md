# App-Framework

Das App-Framework ermöglicht die Integration von spezialisierten Anwendungen in den KI-Workplace. Apps sind in sich geschlossene Module mit eigenen Routes, UI-Seiten und Business-Logik.

## Überblick

Apps werden über eine zentrale Registry verwaltet und können von Admins aktiviert/deaktiviert und sortiert werden. Aktivierte Apps erscheinen in der Sidebar.

## Built-in Apps

| App                | ID                   | Beschreibung                    |
| ------------------ | -------------------- | ------------------------------- |
| Vertragsmanagement | `vertragsmanagement` | Vertragsverwaltung und -analyse |
| Projektmanagement  | `projektmanagement`  | Projektplanung und -tracking    |

## App-Registry

Die App-Registry (`backend/src/apps/registry.ts`) verwaltet den Status aller Apps:

```typescript
getApps(); // Alle Apps auflisten
getEnabledApps(); // Nur aktivierte Apps
getApp(appId); // App-Details
enableApp(appId); // App aktivieren
disableApp(appId); // App deaktivieren
reorderApps(appIds); // Reihenfolge ändern
```

## REST API

| Endpoint                   | Methode | Auth  | Beschreibung                      |
| -------------------------- | ------- | ----- | --------------------------------- |
| `/api/apps`                | GET     | User  | Alle Apps auflisten               |
| `/api/apps/enabled`        | GET     | User  | Nur aktivierte Apps (für Sidebar) |
| `/api/apps/:appId`         | GET     | User  | App-Details                       |
| `/api/apps/:appId/enable`  | PUT     | Admin | App aktivieren                    |
| `/api/apps/:appId/disable` | PUT     | Admin | App deaktivieren                  |
| `/api/apps/order`          | PUT     | Admin | Apps sortieren                    |

### App-spezifische Routes

Jede App mountet eigene Routes unter `/api/apps/<app-id>/`:

```
/api/apps/vertragsmanagement/*    Vertragsmanagement-Endpoints
/api/apps/projektmanagement/*     Projektmanagement-Endpoints
```

## App-Struktur

```
backend/src/apps/
├── registry.ts                App-Registry (Enable/Disable/Reorder)
├── vertragsmanagement/
│   ├── routes.ts              Hono-Router mit App-Endpoints
│   ├── service.ts             Business-Logik
│   └── types.ts               Typdefinitionen
└── projektmanagement/
    ├── routes.ts
    ├── service.ts
    └── types.ts
```

Im Frontend werden App-Seiten unter `frontend/src/pages/apps/` implementiert und über die Settings-Page eingebettet.
