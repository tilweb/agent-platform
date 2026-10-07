# Apps-Rahmen: bekannte Rechte- und Sichtbarkeitslücken im Pilot

**Datum:** 2026-10-07
**Status:** **behoben** (2026-10-07, siehe „Behebung" am Ende). Zunächst nur dokumentiert, am selben Tag auf
Wunsch von Andreas umgesetzt. Wirksam auf einer Instanz erst nach deren Deploy.
**Anlass:** Bestandsaufnahme des Apps-Rahmens für das Konzept an das Produkt-Team
(`adacor/wp-app-wz-matcher`, `docs/konzept-apps-rahmen-2026-10-07.md`, dort §2 „Was gestört hat").

Die Befunde unten beschreiben den Stand **vor** der Behebung; sie bleiben als Begründung stehen. Das Produkt-Konzept
sieht für alle Punkte dieselbe Lösung vor (zentrale Zugriffsprüfung in allen Kanälen).

---

## L1 — Agenten-Werkzeuge aus App-Funktionen prüfen das App-Recht nicht

**Befund:** App-Funktionen (`AppConfig.publicFunctions`) werden beim Start als Agenten-Werkzeuge `<appId>__<funktion>`
registriert (`backend/src/tools/index.ts:187`, nur freigeschaltete Apps, `:192`). Beim Aufruf baut
`backend/src/tools/public-functions/AppFunctionTool.ts` einen synthetischen Kontext mit `permissions: ['app:*:*']`
(`:43`) und ruft den Handler direkt auf — **ohne zu prüfen, ob der chattende User die App nutzen darf**.

**Zusätzlich:** Freischalten/Abschalten einer App ändert die Werkzeug-Registrierung erst beim nächsten Neustart.
Eine abgeschaltete App bleibt bis dahin als Werkzeug aufrufbar.

**Reichweite heute:** Nur der WZ-Matcher hat Public-Funktionen (`classify`, `getNeighborhood`). Agenten bekommen
Werkzeuge nur, wenn sie in ihrer Konfiguration stehen (`agents/loop.ts` `getToolsForAgent`); keine der
mitgelieferten Agenten-Konfigurationen enthält ein `wzbar-matcher__*`-Werkzeug. Die Lücke wirkt also erst, wenn ein
Agent damit ausgestattet wird — dann für jeden User, der diesen Agenten nutzen darf.

**Risiko:** gering (Matcher-Funktionen lesen nur den öffentlichen WZ-Katalog; `classify` schreibt einen Match in den
instanzweiten Verlauf). Steigt mit jeder App, die schreibende oder personenbezogene Funktionen anbietet.

**Fix-Skizze:** In `AppFunctionTool.execute` vor dem Handler `getApp(appId)` (freigeschaltet?) und
`getUserAppPermission(context.userId, appId)` prüfen; bei Verweigerung eine klare Werkzeug-Fehlermeldung. Den
Kontext mit der echten User-ID statt `app:*:*` füllen. Optional: Werkzeuge beim Toggle (`routes/apps.ts`
enable/disable) neu registrieren bzw. entfernen.

## L2 — Interne App-Routen prüfen nicht, ob die App freigeschaltet ist

**Befund:** `requireAppAccess` (`backend/src/apps/permissions-middleware.ts:21`) prüft nur das Gruppenrecht
(`getUserAppPermission`, `:27`). `getUserAppPermission` (`backend/src/apps/permissions.ts`) liest die Registry ohne
`enabled`- und ohne `ENABLED_APPS`-Prüfung. Die Public-API prüft `enabled` dagegen (`public-api/router.ts:45`, `:154`).

**Auswirkung:** Eine abgeschaltete (oder per `ENABLED_APPS` gesperrte) App verschwindet aus Navigation und Launcher,
ihre API unter `/api/apps/<id>/*` bleibt für Mitglieder berechtigter Gruppen aber erreichbar — auch die
Frontend-Route lädt, wenn man die URL kennt.

**Risiko:** gering — betrifft nur Nutzer, die ohnehin ein Recht auf die App haben. Relevant, wenn „Abschalten" als
Sperre verstanden wird (z. B. Pilot beendet, Daten sollen nicht mehr bearbeitet werden).

**Fix-Skizze:** In `requireAppAccess` vor der Rechteprüfung `getApp(appId)` (wendet die ENV-Klemme an) und bei
`!enabled` mit 403/404 „App nicht freigeschaltet" antworten. `GET /apps/:appId/my-permission` analog, damit
`RequireAppPermission` im Frontend eine passende Seite zeigt.

## L3 — Navigation zeigt Apps ohne Recht

**Befund:** `frontend/src/hooks/useApps.js` lädt `GET /apps` (`:21`) und filtert nur auf `enabled` (`:31`); die Sidebar
rendert diese Liste (`frontend/src/components/Sidebar.jsx:409`, `:422`). Das Recht des Users spielt keine Rolle.

**Auswirkung:** Nutzer sehen Apps in der Navigation, die beim Öffnen „Keine Berechtigung" zeigen. Kein Datenzugriff,
aber verwirrend und verrät, welche Apps die Instanz hat.

**Fix-Skizze:** Endpoint, der nur Apps mit effektiver Rolle für den User liefert (Admins: alle), und Sidebar/Launcher
darauf umstellen.

## L4 — App-Liste mit Gruppenrechten geht an jeden eingeloggten User

**Befund:** `GET /api/apps` (`backend/src/routes/apps.ts:86`) liefert allen eingeloggten Usern sämtliche Apps inkl.
`permissions.groups` (Gruppen-IDs und Rollen) — der Kommentar dort sagt selbst „could filter by user role later".

**Auswirkung:** Gruppen-IDs und Rechte-Konfiguration sind für alle sichtbar. Keine Inhaltsdaten.

**Fix-Skizze:** Für Nicht-Admins `permissions` aus der Antwort entfernen (bzw. mit L3 zusammen über den neuen
User-Endpoint lösen).

---

## Behebung (2026-10-07)

**Eine zentrale Prüfung für alle Kanäle:** `resolveAppAccess(userId, appId)` in `backend/src/apps/permissions.ts`
liefert die Rolle oder den Ablehnungsgrund (`not_found` / `disabled` / `unconfigured` / `no_permission`). „Freigeschaltet"
heißt Admin-Schalter **und** `ENABLED_APPS`-Whitelist (über `getApp`). Die Public-API prüft wie bisher selbst
(Freischaltung + Schlüssel-Scope).

| Lücke | Änderung |
|---|---|
| L1 | `AppFunctionTool.execute` prüft bei jedem Aufruf `resolveAppAccess` für den User des Agenten; ohne User keine Ausführung; Kontext mit echtem User und Scope `app:<app>:<funktion>` statt `app:*:*`. Werkzeuge werden für alle Apps registriert, die Prüfung zur Laufzeit macht Freischalten/Abschalten sofort wirksam. |
| L2 | `requireAppAccess` nutzt `resolveAppAccess` → 403 `app_disabled` bei abgeschalteter App. `my-permission` liefert zusätzlich `enabled`; die Oberfläche zeigt dann „App nicht freigeschaltet". |
| L3 | `GET /api/apps` und `/enabled` liefern Nicht-Admins nur Apps mit eigener Rolle (`myRole`). Navigation und Launcher zeigen damit nur nutzbare Apps. Admins sehen weiter alle (Verwaltung, „Wartet auf Konfiguration"). |
| L4 | Nicht-Admins bekommen keine `permissions` mehr (auch nicht über `GET /api/apps/:id`, dort 404 ohne Zugriff). |
| L5 (neu gefunden) | `GET /api/apps/:id/permissions` war ohne Admin-Schutz → jetzt `adminMiddleware`. `eligible-principals` (Personen-/Gruppenliste) nur noch für App-Nutzer und Admins. |

Nebenbei korrigiert: Der Kommentar in `RequireAppPermission.jsx` behauptete, Admins bekämen automatisch `owner` —
tatsächlich (und gewollt) brauchen auch Admins eine berechtigte Gruppe.

**Verhaltensänderungen, die Nutzer bemerken können:**
- Nutzer sehen in Navigation und App-Übersicht nur noch Apps, für die sie eine Rolle haben.
- Abgeschaltete Apps sind auch per direkter URL/API nicht mehr nutzbar (vorher für Berechtigte schon).
- Ein Agent mit App-Werkzeug funktioniert nur noch für Nutzer mit App-Recht.

**Verifikation:** `apps/permissions.test.ts` (5 Fälle: unbekannt, abgeschaltet, unkonfiguriert, keine Gruppe,
höchste Rolle); volle Suite 1.462 Tests grün; Typecheck ohne neue Fehler; Durchgangstest gegen die lokale Registry
(echte Routen, echte Gruppen, simulierte Anmeldung): Listen gefiltert, `/permissions` 403/200, `eligible-principals`
403/200, App-Route 200/403, Werkzeug verweigert ohne Recht/ohne User und arbeitet mit Recht; mit `ENABLED_APPS`-Sperre
App-Route 403 `app_disabled`, `my-permission` `enabled:false`, Werkzeug verweigert. Frontend-Build grün.
