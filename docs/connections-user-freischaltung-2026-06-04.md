# Connections — Admin-Freischaltung + User-Self-Connect

**Stand**: 2026-06-04 · **Branches**: main (Scalingo) + demo/messe (Railway)

## Context
Die Connections (Confluence, Jira, Google Drive/Mail, DocuWare, Pipedrive, YouTrack)
lagen nur im Admin-Bereich (Settings → Connections, `adminOnly`). Die OAuth-Verbindung
muss aber **jeder User selbst** herstellen — das Backend war ohnehin **per-User**
(Token pro User, OAuth-Routes nur `authMiddleware`). Es fehlte ein globales
„für Nutzer freigeschaltet"-Flag pro Provider und eine User-Ansicht.

## Entscheidungen
- **Admin-View** (bleibt admin-only): Setup-Anleitungen + **Schieberegler „für Nutzer
  freischalten"** pro Provider. Reine Verwaltung, kein eigenes Verbinden hier.
- **User-View**: neuer Settings-Tab **„Meine Verbindungen" zwischen „Profil" und
  „Meine Modelle"** (für alle sichtbar), zeigt nur freigeschaltete Provider, ohne
  Setup-Anleitungen.
- **Default: alles aus (opt-in)** — kein Auto-Seed. Admin schaltet pro Provider frei.

## Datenmodell / Persistenz
Globales `enabledForUsers`-Flag pro Provider-ID, über die **Connections-Storage-
Abstraktion** (gleiches Interface, andere Implementierung pro Worktree):
- `getProviderEnabledMap(): Record<string, boolean>` (fail-safe → `{}`)
- `setProviderEnabled(providerId, enabled)`
- **main:** Postgres-Tabelle `connections.provider_settings` (`provider` PK,
  `enabled_for_users` bool default false, `updated_at`).
- **Railway:** YAML-Datei `data/connections/_provider-settings.yaml` (`{ providerId: bool }`).

> **Migration (main):** `backend/drizzle/0019_connections_provider_settings.sql` +
> Journal-Eintrag **von Hand** geschrieben. `drizzle-kit generate` braucht hier ein
> TTY (bestehende Schema-Drift via `db:push` → interaktiver Resolver-Prompt). `migrate()`
> beim Boot wendet die SQL + Journal idempotent an (lokal verifiziert: „migrations
> applied"). Kein Snapshot aktualisiert → ein künftiges `generate` würde die Tabelle
> erneut als „neu" sehen; dann den 0019-Stand berücksichtigen.

## Backend-Änderungen
- `connections/types.ts`: `ProviderInfo` um `enabledForUsers?` + `configured?` (konstant
  true, da nur konfigurierte Provider registriert werden).
- `connections/registry.ts` `getProviderInfos()`: einmal `getProviderEnabledMap()` laden,
  pro Provider `enabledForUsers` setzen (rollen-agnostisch, kein Filter hier).
- `connections/storage.ts` (+ `index.ts` Re-Export): die zwei Funktionen.
- `routes/connections.ts`:
  - `GET /` filtert für **Nicht-Admins** auf `enabledForUsers`.
  - Neu: `GET /admin/providers` (alle + Status) und `PUT /admin/providers/:id/enabled`
    — **vor** `GET /:id` registriert (sonst matcht `/:id` „admin").
  - Defensiv: `/:id/connect` + `/:id/credentials` lehnen für Nicht-Admins nicht
    freigeschaltete Provider mit 403 ab.
  - main nutzt `adminMiddleware`; Railway hat kein exportiertes `adminMiddleware` →
    inline-Check `user.role !== 'admin'` (Railway-Muster, analog `providers.ts`).

## Frontend-Änderungen
- `hooks/useConnections.js`: optionaler Param `{ admin }` (Admin-Liste von
  `/admin/providers`), neue Methode `setProviderEnabled`.
- `pages/ConnectionsPage.jsx`: Prop `admin`; `ConnectionCard` zwei-modig — Admin:
  Status-Badge + Toggle + Setup-Button (kein Connect); User: Connect/Disconnect +
  Status (kein Setup, kein Toggle). Titel/Empty-State je Modus.
- `pages/SettingsPage.jsx`: neuer Tab `my-connections` „Meine Verbindungen" zwischen
  `profile` und `mymodels` (ohne `adminOnly`) → `<ConnectionsPage embedded />`;
  bestehender `connections`-Tab → `<ConnectionsPage embedded admin />`.

## Verifikation
- Backend `tsc` (beide Worktrees): keine neuen Fehler in den geänderten Dateien.
- Frontend-Build grün (beide Worktrees).
- Lokales main-Backend: Reload sauber, **Migration 0019 applied**, `provider_settings`
  existiert; `GET /api/connections` → 401, `GET /api/connections/admin/providers` → 401
  (nicht 404 → Routing-Reihenfolge korrekt).
- **Offen (manueller E2E):** Admin togglet Provider → User sieht ihn unter „Meine
  Verbindungen" (ohne Setup) → User-OAuth → verbunden (Token pro User). Idealer
  Testkandidat: `workplace-cofermin` (DocuWare ist dort konfiguriert) → DocuWare
  freischalten, als User verbinden.

## Betroffene Dateien
**Backend (main):** `db/schema/connections.ts`, `drizzle/0019_*.sql` + `meta/_journal.json`,
`connections/{storage,index,types,registry}.ts`, `routes/connections.ts`.
**Frontend (main):** `hooks/useConnections.js`, `pages/ConnectionsPage.jsx`, `pages/SettingsPage.jsx`.
**Railway:** spiegelbildlich (Storage als YAML statt Tabelle/Migration; inline-Admin-Check).
