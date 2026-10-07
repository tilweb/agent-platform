# Apps-Rahmen: bekannte Rechte- und Sichtbarkeitslücken im Pilot

**Datum:** 2026-10-07
**Status:** dokumentiert, **bewusst nicht behoben** (Entscheidung Andreas, 2026-10-07 — Fixes hießen Deploys auf
Kunden-Instanzen; Risiko gering)
**Anlass:** Bestandsaufnahme des Apps-Rahmens für das Konzept an das Produkt-Team
(`adacor/wp-app-wz-matcher`, `docs/konzept-apps-rahmen-2026-10-07.md`, dort §2 „Was gestört hat").

Diese Liste ist für den Pilot gedacht: Wer am Apps-Rahmen arbeitet oder eine App mit Public-Funktionen baut, sollte
sie kennen. Das Produkt-Konzept sieht für alle vier Punkte die Lösung vor (zentrale Zugriffsprüfung in allen Kanälen).

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

## Wann neu bewerten

- sobald eine weitere App Public-Funktionen bekommt (L1), insbesondere schreibende oder mit Personenbezug
- sobald ein Agent auf einer Instanz mit einem App-Werkzeug ausgestattet wird (L1)
- wenn „App abschalten" als Sperre zugesagt wird, etwa beim Ende eines Piloten (L2)
