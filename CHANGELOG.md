# Changelog

## 2026-05-01

### Feature: Phase-2 Auftrags-/Ideen-Berechtigungen fuer Projektmanagement
Aufbauend auf Phase 1 (App-Level-Permissions): jede Idee und jeder Auftrag hat jetzt eigene Permissions auf User- und Group-Ebene mit den Rollen owner / editor / viewer. Statusberichte erben vom Auftrag (kein eigenes Permission-Feld). Default ohne explizite Permissions: nur der Ersteller (`created_by`/`ownerId`) ist Owner.

- **Datenmodell**: neue `permissions: jsonb`-Spalte auf `paProjektideen` und `paProjektauftraege` (Migration `0007_pm_permissions.sql`). Format: `{ users: [{userId, role}], groups: [{groupId, role}] }`. YAML-Pendant inline in metadata.yaml.
- **`apps/projektmanagement/permissions.ts` (neu)**: Resolver `getEffectiveIdeeRole` / `getEffectiveAuftragRole` aggregieren `created_by`-Default + User-Permissions + Group-Permissions (hoechste Rolle gewinnt). Plus `replaceIdeePermissions` / `replaceAuftragPermissions` (owner-only) und `listAccessibleIdeeIds` / `listAccessibleAuftragIds` fuer Listen-Filter.
- **Route-Guards** (`projektmanagement/routes.ts`): Pro CRUD-Endpoint Helper `denyIfNotAppEditor`, `denyIfNotAppOwner`, `denyIfBelowIdeeRole`, `denyIfBelowAuftragRole`. POST = App-Editor+; PUT = Auftrags-Editor+; DELETE = Auftrags-Owner; Statusbericht-CRUD vererbt Auftrags-Rolle (Editor+ darf alles, inkl. Loeschen). Listen filtern auf zugaengliche IDs. Permissions-Endpoints (`GET/PUT /:id/permissions`) owner-only.
- **`/my-permission/idee/:id` + `/my-permission/auftrag/:id`**: Frontend-Endpoint fuer UI-Gating (gibt effektive Rolle des aktuellen Users, ohne 403).
- **`/api/apps/:appId/eligible-principals`**: User+Gruppen die App-Zugriff haben — Frontend-PermissionsModal filtert seinen User-Picker darauf, damit Auftrags-Member auch tatsaechlich auf die App kommen.
- **Idee → Auftrag Konvertierung** (`POST /projektideen/:id/erstelle-auftrag`): Konvertierender wird Auftrags-Owner via `created_by`. Permissions-Liste startet leer.
- **Bugfix**: Diverse Endpoints hatten hartkodiert `userId = 'user_default'` — jetzt aus `getCurrentUserId(c)`. Mit Phase-2 Berechtigungen war das ein blocker (kein User waere mehr Owner).
- **Frontend-Hooks**: `usePmResourcePermission(type, id)` laedt die effektive Rolle. `hasMinRole(role, required)` Helper. Listen-Pages (IdeenPage, ProjektePage) gaten "Neu"-Button auf App-Editor+. Wizard-Pages (IdeeWizardPage, WizardPage) gaten Save-Button auf Auftrags-Editor+, Loeschen auf Owner.
- **`OwnerActionsMenu`** (neu): "..."-Dropdown im Wizard-Header ersetzt den frueheren direkten Loeschen-Button. Items: "Berechtigungen verwalten" + "Loeschen".
- **`PermissionsModal`** (neu): User+Group-Picker (gefiltert auf eligible-principals), Rolle-Dropdown, Add/Remove/Update mit Hinweis auf den Original-Eigentuemer (kann nicht entfernt werden).
- **App-Settings-Tab** in `ProjektePage`: jetzt nur fuer App-Owner sichtbar (visibleTabs filter).
- **`scripts/seed-demo-pm-owners.ts`** (idempotent, ENV `SEED_DEMO_OWNERS=true`): haengt andreas_bachmann + ruhrpm als zusaetzliche Owner an alle existierenden Ideen/Auftraege. Zusaetzlich Bug-Fix: `created_by === 'user_default'` (Pre-Phase-2-Hardcode) wird auf andreas_bachmann umgesetzt. Ohne diesen Seed-Lauf waere keiner mehr Owner der alten Eintraege.

Der Plattform-Admin hat weiterhin **keinen** automatischen Zugriff (siehe Phase 1) — wenn der Admin auch in PM-Daten reinschauen soll, muss er explizit als App-Editor/Owner in einer Gruppe sein UND als User/Gruppe pro Auftrag berechtigt werden.

### Feature: Spaces + Agents zeigen nicht-berechtigte Elemente ausgegraut mit Owner-Hinweis
Gleiches Pattern wie bei Collections (Pilot): die Listen-Endpoints `/api/projects` und `/api/agents` liefern jetzt alle Eintraege mit `accessible/role/owner` Annotation; Frontend rendert nicht-berechtigte ausgegraut, mit Lock-Icon und "Zugriff anfragen bei <Name>"-Hinweis. System-Agents bleiben fuer alle uneingeschraenkt sichtbar/zugaenglich.

- **Backend `routes/projects.ts`**: `GET /` liefert ALLE Projekte; akzessibel ist wer Member ist ODER eine RBAC-Rolle hat. `groupCount` bleibt fuer alle, andere Felder (description, settings) bleiben fuer locked Frontend-seitig blockiert.
- **Backend `routes/agents.ts`**: `GET /` liefert System-Agents (immer accessible) plus alle User-Agents mit Annotation. Description/Capabilities werden im Frontend bei locked nicht angezeigt (kein Info-Leak).
- **Frontend `ProjectCard.jsx`**: locked-Variante mit opacity, Lock-Icon, Owner-Hinweis statt Member/Date-Footer. Description bei locked ausgeblendet.
- **Frontend `AgentsPage.jsx/AgentCard`**: locked-Variante analog. Lokales `LockIcon` durch zentralen `LockIcon` aus `Icons.jsx` ersetzt (zentral wiederverwendbar).
- **`Icons.jsx`**: neuer `LockIcon` (size/color/style props) — wird auch in System-Agent-Hint verwendet (Default-Groesse 20).

### Feature: Knowledge Base zeigt nicht-berechtigte Collections ausgegraut mit Owner-Hinweis
Bisher hat die `/api/knowledge/collections`-Liste serverseitig nur die fuer den User zugaenglichen Collections zurueckgegeben — alle anderen waren unsichtbar. Damit wussten User nicht was es im Workplace gibt und konnten Zugriff nicht gezielt anfragen. Neu: alle Collections werden zurueckgegeben; nicht-berechtigte sind in der UI ausgegraut, mit Lock-Icon, "Kein Zugriff"-Badge und Owner-Hinweis "Zugriff anfragen bei <Name>". Click auf gesperrte Karten ist deaktiviert.

- **Backend `rbac/accessControl.ts`**: neuer Helper `getResourceOwnerInfo(type, id)` — gibt User- oder Group-Owner mit Klar-Namen zurueck (User-Owner bevorzugt).
- **`routes/knowledge.ts` GET /collections**: gibt jetzt ALLE Collections zurueck mit `accessible: boolean`, `role: ResourceRole | null`, `owner: { principalType, principalId, name } | null`. Doc-Count + activate_when/never_activate_when bleiben fuer nicht-berechtigte leer (kein Information-Leak ueber Inhalt).
- **Frontend `KnowledgeBasePage.jsx`**: Karten-Render-Logik unterscheidet `locked` vs. normal — locked-Karten haben opacity 0.65, Lock-Icon oben rechts, "Kein Zugriff"-Badge, Owner-Hinweis statt Doc-Meta, kein Click-Handler. Stats-Bar zeigt "X (von Y) Collections" wenn nicht alle zugaenglich sind. 403-Edge-Case in `loadCollectionDetail` jetzt mit Status-Message statt stillen Fehlschlag.

Pilot-Pattern: Spaces (Projects) und Agents folgen mit gleichem Pattern.

### Aenderung: Plattform-Admin hat KEINEN automatischen Resource-Zugriff mehr
Globale Admins (`user.role === 'admin'`) bekamen bisher Auto-Override auf alle Apps, Collections, Spaces und Agents. Das erlaubt einem Admin, in vertrauliche Daten reinzuschauen (z.B. Personal-Collections), ohne dass der Owner zustimmt. Neues Verhalten: Admin = Plattform-Manager (Apps an/aus, Gruppen, Users, App-Permissions zuweisen via Settings), kein Daten-Auditor. Will der Admin in eine konkrete Resource reinschauen, muss der Owner ihn (oder eine Admin-Gruppe) explizit berechtigen.

- **`apps/permissions.ts/getUserAppPermission`**: Admin-Override entfernt. Admin sieht jetzt "Keine Berechtigung"-Page wie jeder andere User, wenn er in keiner berechtigten Gruppe steht.
- **`rbac/accessControl.ts`**: Admin-Bypass aus `checkAccess`, `getUserResourcePermissions` und `listAccessibleResources` entfernt. `isGlobalAdmin`-Flag bleibt als Info-Property erhalten (UI darf das anzeigen, gibt aber keinen Zugriff frei).
- **Settings-Endpoints unveraendert**: `/api/auth/users`, `/api/auth/groups`, `/api/apps/:id/permissions` (PUT) etc. laufen weiterhin ueber `adminMiddleware` — Plattform-Settings sind orthogonal zum Resource-Zugriff.

Folge: Bestehende Admins, die bislang implizit auf alle Apps/Collections zugreifen konnten, bekommen jetzt 403/„Keine Berechtigung". Sie muessen explizit in eine berechtigte Gruppe gehaengt werden, oder der Owner berechtigt sie direkt. Bei unkonfigurierten Apps sieht der Admin weiterhin "Wartet auf Konfiguration" mit Direkt-Link in die Settings.

### Bugfix: AppPermissionsBox zeigt Hinweis wenn keine Gruppen existieren
In Settings → Apps fehlte der "+ Gruppe hinzufuegen"-Button, wenn der Admin noch gar keine Benutzergruppen angelegt hatte — er sah nur die Warnung, dass die App noch nicht konfiguriert ist, hatte aber keinen Weg vorwaerts. Jetzt zeigt die Box einen Hinweis "Sie haben noch keine Benutzergruppen angelegt" mit Direkt-Link zu `/settings?tab=groups`.

## 2026-04-30

### Feature: Gruppen-basiertes Berechtigungssystem fuer Apps (Phase 1)
Apps lassen sich jetzt feingranular pro Benutzergruppe freischalten. Drei-Stufen-Lifecycle: `enabled=false` (unsichtbar) → `enabled=true` ohne Gruppen (sichtbar, Aufruf zeigt "Wartet auf Konfiguration") → `enabled=true` mit Gruppen (berechtigte User sehen App, andere "Keine Berechtigung"). Rollen owner > editor > viewer (Phase 1 prueft nur Zugriff ja/nein, In-App-Granularitaet folgt in Phase 2). Globale Admins haben Owner-Override auf alle Apps.

- **Backend** `apps/permissions.ts`: `getUserAppPermission(userId, appId)` aggregiert User-Gruppen ↔ App-Permissions; `replaceAppPermissions`/`listAppPermissions` als Settings-Helper. `apps/permissions-middleware.ts`: `requireAppAccess(appId)` als Hono-Middleware (403 bei fehlender Berechtigung).
- **`apps/types.ts`**: `AppConfig.permissions.groups[]` mit `AppRole = 'owner'|'editor'|'viewer'`. `AppGroupPermission`-Interface fuer API.
- **`routes/apps.ts`**: `authMiddleware` jetzt auf alle `/api/apps/*` (Sub-Apps fehlte das vorher); 3 neue Endpunkte `GET/PUT /apps/:id/permissions`, `GET /apps/:id/my-permission`.
- **App-Module-Routes** (`projektmanagement`, `vertragsmanagement`, `lieferantenmanagement`, `vsm`, `wzbar-matcher`): jeweils `routes.use('*', requireAppAccess('appId'))`.
- **`apps/registry.ts/saveRegistry`**: strippt `publicFunctions` vor dem YAML-Write (Handler-Funktionen waren nicht serialisierbar).
- **Frontend**: `RequireAppPermission.jsx`-Wrapper umhuellt jede App-Route; `NotAuthorizedPage.jsx` + `WaitingForConfigurationPage.jsx` als generische Status-Pages. `AppPermissionsBox.jsx` rendert in Settings pro App eine Liste der berechtigten Gruppen mit Rolle-Dropdown + Hinzufuegen-Modal.

Smoke verifiziert: Admin (Override) → 200, demo1 ohne Gruppe → 403/Frontend "Keine Berechtigung", demo1 in editor-Gruppe → 200/App laeuft. Permissions persistiert in `registry.yaml.apps[id].permissions.groups`.

### Feature: Optimistic Concurrency Control fuer Idee, Auftrag, Statusbericht
Multi-User-Editing produziert jetzt keine Lost Updates mehr. Wenn Anna und Bob gleichzeitig dieselbe Idee/Auftrag/Statusbericht bearbeiten und Anna zuerst speichert, sieht Bob beim Save einen Konflikt-Modal: "Aktuelle Version laden (deine Aenderungen verwerfen)" oder "Trotzdem ueberschreiben (fremde Aenderungen verwerfen)". Vorher hat Bobs Save Annas Aenderungen still ueberschrieben.

- **Konzept**: Optimistic Concurrency Control via `version: number` Feld auf jeder Entitaet. Frontend sendet `expected_version` mit; Backend lehnt mit 409 ab wenn != current. Pendant zur HTTP-If-Match/ETag-Konvention.
- **`concurrency.ts`** (neu): `VersionConflictError`-Klasse + `withLock(id, fn)` Promise-Chain-Mutex serialisiert konkurrierende Saves auf YAML-Files (verhindert verschachtelte Read-Modify-Write-Schreiben). `checkVersion`-Helper.
- **Storage** (`idee-storage.ts`, `storage.ts`, `statusbericht-service.ts`): `updateXxx`-Funktionen mit `{ expectedVersion, force }`-Optionen, `version++` bei jedem erfolgreichen Save, Backward-Compat fuer Datensaetze ohne `version`-Feld.
- **Routes** (`routes.ts`): PUT-Endpunkte (Idee, Idee-Step, Auftrag, Auftrag-Step, Statusbericht) extrahieren `expected_version`+`force` aus dem Body, mappen `VersionConflictError` auf 409 mit `{ error: 'version_conflict', current: <fresh-entity> }`.
- **Frontend Hooks** (`useProjektideen.js`, `useProjektmanagement.js`): exportieren `VersionConflictError`-Klasse, ueberlasten Update-Funktionen um `{ expectedVersion, force }`-Option, werfen den Error bei 409.
- **Wizard-Pages** (`IdeeWizardPage.jsx`, `WizardPage.jsx`): tracken `serverVersion` ab Initial-Load, senden bei jedem Save mit, fangen 409 ab → oeffnen den Konflikt-Modal.
- **`ConflictResolutionModal.jsx`** (neu): generisch fuer alle drei Entitaeten, zeigt Server-Version + Updated-At, mit Reload- und Force-Overwrite-Buttons.

Smoke verifiziert: 20 parallele PUTs auf dieselbe Idee mit gleicher `expected_version: 1` → genau 1×200, 19×409. File auf Disk genau 1× ueberschrieben (kein Mischmasch). Force-Overwrite-Pfad funktioniert (v3 trotz staler v1).

Out-of-scope (Phase 2): WebSocket-Presence, Field-Level-Merge-UI, Per-Step-Versionierung, Audit-Log, Real-Time-CRDT.

### Fix: Projektauftrag-Import — fehlende 5 Basis-Felder ergaenzt
Der Auftrag-Wizard editierte 13 Basis-Felder, der Import extrahierte aber nur 7. Lange bestehende Lücke aus der Zeit, als der Wizard erweitert wurde, ohne den Import-Profile mitzuziehen — fiel beim Schema-Audit nach den heutigen Idee-Arbeiten auf.

Ergaenzt im `PROJEKTAUFTRAG_PROFILE.basis`: `project_id`, `project_status`, `project_driver`, `project_size`, `priority`. Mit Normalizer-Funktionen (`normalizeAuftragPriority`, `normalizeAuftragSize`, `normalizeAuftragDriver`, `normalizeAuftragProjectStatus`) für die Deutsch→English-Mapping-Schicht (Hoch→high, Klein→small, Strategisch→strategic, Initiierung→initiation, etc.). LLM-Guidelines explizit um die neuen Enum-Werte ergaenzt.

`mapToProjektauftrag` setzt die Felder via `as Record<string, unknown>`-Cast, weil sie im Projektauftrag-Type bisher nur als runtime-Properties existieren (vom Wizard direkt geschrieben). `countExtractedFields` zählt sie mit.

Damit ist der Auftrag-Import jetzt schema-koherent zum Wizard.

### Fix: Projektidee-Storage von Drizzle/Postgres auf YAML portiert (demo/messe-only)
Frueher heutiger Cherry-Pick aus main hatte versehentlich Drizzle-basierten Storage-Code auf demo/messe gebracht — auf einer Branch, die strukturell komplett YAML-Files nutzt. Folge: Idee-CRUD lief teilweise ueber leere Postgres-Tabellen, `createAuftragFromIdee` hat ein `UPDATE WHERE id=...` gegen 0 Rows gefeuert (silent no-op), `abgeleitete_auftraege` blieb immer leer.

Ergaenzt im `PROJEKTAUFTRAG_PROFILE.basis`: `project_id`, `project_status`, `project_driver`, `project_size`, `priority`. Mit Normalizer-Funktionen (`normalizeAuftragPriority`, `normalizeAuftragSize`, `normalizeAuftragDriver`, `normalizeAuftragProjectStatus`) für die Deutsch→English-Mapping-Schicht (Hoch→high, Klein→small, Strategisch→strategic, Initiierung→initiation, etc.). LLM-Guidelines explizit um die neuen Enum-Werte ergaenzt.

`mapToProjektauftrag` setzt die Felder via `as Record<string, unknown>`-Cast, weil sie im Projektauftrag-Type bisher nur als runtime-Properties existieren (vom Wizard direkt geschrieben). `countExtractedFields` zählt sie mit.

Damit ist der Auftrag-Import jetzt schema-koherent zum Wizard.

Dieser Commit portiert `idee-storage.ts` komplett auf das gleiche YAML-Pattern wie die Auftrag-Storage — pro Idee ein Verzeichnis unter `data/apps/projektmanagement/projektideen/<id>/metadata.yaml`. `loadAbgeleiteteAuftraege` globt jetzt alle Auftrag-YAMLs und filtert nach `idee_id`. `setAuftragIdeeId` schreibt `idee_id` als Feld direkt in die Auftrag-YAML.

- **`idee-storage.ts`**: komplette Neuimplementierung gegen Bun-File/Glob, gleiches Pattern wie `storage.ts` (Auftrag).
- **`idee-service.ts`**: nutzt jetzt den exportierten `setAuftragIdeeId` aus idee-storage statt einer inline-Drizzle-Funktion.
- **`types.ts`**: `Projektauftrag.idee_id?: string` (in YAML persistiert) + `idee?: { id; name }` (beim Read angereichert).
- **`storage.ts/getProjektauftrag`**: liest `idee_id` aus der Auftrag-YAML und macht ein File-Lookup auf die Idee-YAML, um `auftrag.idee = {id, name}` zu setzen — Pendant zum Drizzle-JOIN auf main.
- **`storage.ts/saveProjektauftrag`**: strippt `idee` vor dem YAML-Schreiben (analog `abgeleitete_auftraege` in idee-storage).
- **`WizardPage.jsx`**: Subtitle-Eintrag `Aus Idee: <verlinkter Name>` (Frontend-Port von main `7a4a32f`).
- **Drizzle-Migration `0004_projektideen.sql` entfernt** + Journal-Eintrag entfernt — die Tabelle wird auf demo/messe nicht gebraucht.

Smoke verifiziert: Idee anlegen → Auftrag aus Idee → Auftrag-YAML enthaelt `idee_id`, API liefert `idee: {id, name}`, Idee-Detail liefert `abgeleitete_auftraege`. Idee-Loeschung entfernt `idee_id` aus dem Auftrag-YAML, der Auftrag selbst bleibt bestehen.

### Feature: Projektidee — In-Scope / Out-of-Scope (analog Auftrag)
Im Tab "Projektkontext" der Projektidee gibt es jetzt zwei Listen "Im Projektumfang (In-Scope)" und "Außerhalb des Projekts (Out-of-Scope)" — visuell und funktional 1:1 wie im Auftrag-Wizard (`Inhalt.jsx`). Die Felder werden durch alle Layer durchgereicht: Type, Storage-Default, LLM-Profile fuer Import, LLM-Mapper, Auftrag-aus-Idee-Mapping, Markdown/PDF/DOCX-Export und die Read-only-Übersicht.

- **`types.ts`**: `Projektidee.in_scope?: string[]` + `out_scope?: string[]`
- **`idee-service.ts`**: `emptyIdee()` Defaults; `createAuftragFromIdee()` reicht beide Arrays 1:1 in den Auftrag durch
- **`import-service.ts`**: `PROJEKTIDEE_PROFILE` um zwei Array-Felder erweitert; LLM-Guidelines explizit auf "Scope-Abgrenzung auf Whiteboards" hingewiesen; `mapToProjektidee` extrahiert + `countExtractedIdeeFields` zählt mit
- **`documentGenerator/idee-mapper.ts`**: zwei list-Sections im Export (zwischen Rahmenbedingungen und Business Case)
- **Frontend**: `Projektkontext.jsx` mit zwei Spalten (grüner Check / roter X-Header, Style 1:1 vom Auftrag-Inhalt-Tab); `IdeeUebersicht.jsx` Read-only mit zweispaltigem Bullet-List-Layout; `IdeeWizardPage.jsx/emptyIdee()` Defaults

Smoke verifiziert mit dem PMO-Whiteboard-Foto: LLM extrahiert 9 In-Scope-Items ("Einführung PMO", "Roll-out PMO", "Einführung P3M", ...) und erkennt explizit das Fehlen von Out-of-Scope-Angaben.

### Feature: Dokumenten-Import auch für Projektideen
Die Auftrag-Import-Pipeline (Vision-LLM für Whiteboard-Fotos, markitdown für xlsx/docx/pdf, SSE-Heartbeat-Stream) ist jetzt auch für Projektideen verfügbar. User können Brainstorm-Material, Workshop-Mitschriebe oder Konzept-PDFs hochladen und bekommen eine vorausgefüllte Projektidee.

- **Backend** (`import-service.ts`): Phasen 1+2 (File-Processing + Combine) als geteilten `processFilesToText()`-Helper extrahiert. Beide Importer (`importProjektauftrag` + neuer `importProjektidee`) nutzen ihn — Bug-Fixes an Vision/markitdown/xlsx-Reorder wirken automatisch in beiden Pipelines. Neues `PROJEKTIDEE_PROFILE` mit ideenfokussierten Feldern (basis, ziele, kontext.{ausgangslage,rahmenbedingungen}, investitionen[], nutzen[], unternehmensrisiken[]) — bewusst KEIN tasks/milestones/stakeholders. LLM-Guidelines weisen explizit an, solche Listen zu ignorieren und stattdessen Vision/Treiber/Business-Case zu interpretieren. `extractIdeeWithLLM` + `mapToProjektidee` analog zur Auftrag-Variante; Idee-Persistence via `createIdee`.
- **Backend** (`routes.ts`): neuer Endpoint `POST /projektideen/import` (multipart, MIME-Whitelist, 10-Files/50MB-Limit, `streamSSE`-Wrapper) — strukturell 1:1 wie `/projektauftraege/import`.
- **Frontend** (`ImportPage.jsx`): generisch via `mode='auftrag'|'idee'`-Prop. `MODE_CONFIG`-Tabelle für unterscheidende Pfade/Texte (Endpoint, Back-Link, Title, Subtitle, Done-Event, Redirect-Path, Stage-Labels). Per-File-Liste, SSE-Reader, Phasen-Hinweise, Progress-Bar, Heartbeat-Counter unverändert. Im Idee-Mode zusätzlicher Upload-Hinweis "Auch handgezeichnete Skizzen, Mind-Maps und Workshop-Mitschriebe werden interpretiert."
- **Frontend** (`App.jsx`, `IdeenPage.jsx`): neue Route `/apps/projektmanagement/ideen/import → <ImportPage mode="idee" />`, "Dokumente importieren"-Link im Ideen-Tab-Action-Bar.

Smoke verifiziert: Whiteboard-Foto eines PMO-Konzepts → 22 Felder extrahiert (Goals, Ausgangslage, Rahmenbedingungen, 3 Investitionen mit Beträgen, 3 Nutzen, 1 Unternehmensrisiko, Projektleiter, Auftraggeber, Prioritaet, Projektgroesse).

### Fix: Idee-Wizard — Layout & Form-Styling 1:1 angeglichen an den Auftrag-Wizard
Der erste Wurf des Idee-Wizards nutzte eigene Patterns (vertikale Sidebar, graue Inputs auf grauer Page) statt den bestehenden Auftrag-Wizard als Vorlage zu nehmen. User-Feedback: *"Warum sind die Tabs nun vertikal nicht wie bei Auftrag und Status horizontal? Warum hast du die jetzt so grau in grau schlecht lesbar gemacht obwohl du eine Mega Vorlage mit dem Projektauftrag hast?"*

- **`IdeeWizardPage.jsx`**: vertikale Sidebar entfernt, durch horizontale Pill-Step-Tabs ersetzt — Style-Block 1:1 von `WizardPage.jsx` (`stepTabs`, `stepTab`, `stepTabActive`, `stepTabCompleted`, `stepTabNumber*`). `getStepStatus()` portiert: besuchte Steps werden gruen markiert (`maxVisitedStep`-Tracking). Header-Pattern (App Detail Header), Navigation-Box (Rounded), Status-Badge im Subtitle alle vom Auftrag-Wizard uebernommen.
- **`IdeeBasis.jsx`**: Vorlage `Basis.jsx` — `formRow`-Grid (1fr 1fr), `input.backgroundColor: surface` statt `background`, Focus-Border-Animation auf `primary` via `onFocus`/`onBlur`, Hint-Texte unter Optional-Feldern.
- **`IdeeZiele.jsx`**: Vorlage `Ziele.jsx` — textarea-Style mit `surface`-bg + Focus-Animation, Hint-Text unter dem Feld, Tipp-Box im Info-Light-Style.
- **`Projektkontext.jsx`**: zwei textareas im gleichen Pattern, mit erklaerenden Hint-Texten.
- **`BusinessCase.jsx`**: Inputs bekamen `transition: border-color` fuer konsistentes Hover-Feedback. Surface-Card-Wrapper waren bereits korrekt.
- **`Unternehmensrisiken.jsx`**: Vorlage `Risiken.jsx` — `itemCard` mit surface-bg, Trash-Icon-removeButton, dashed `addButton` mit Hover-Border-Animation, korrektes `itemGrid`-Layout (3-Spalten + fullSpan).
- **`IdeeUebersicht.jsx`**: cardTitle-Style auf uppercase + muted-color umgestellt (analog `Uebersicht.jsx:sectionTitle`), bessere Hierarchie zwischen Card-Headern und Inhalt.

### Feature: Projektidee — separate Datenentitaet inkl. Wizard, Auftrag-Generierung und Dokumenten-Export
Die Projektmanagement-App bekommt eine fruehere Stufe als den Projektauftrag: eine **Projektidee** zum Erfassen von Vision, Treibern, Business Case und Risiken auf hoher Ebene. Eine Idee kann mehrere Auftraege erzeugen, ueberlebt diese und bleibt mit ihnen verknuepft (1:n).

- **Backend** (`backend/src/db/schema/projektmgmt.ts`, `idee-storage.ts`, `idee-service.ts`, Drizzle-Migration `0004_projektideen.sql`): neue `projektmgmt.projektideen` Tabelle, `projektauftraege.idee_id` FK (ON DELETE SET NULL — Auftrag ueberlebt). `createAuftragFromIdee()` mappt Stammdaten 1:1, Investitionen → Budget(positiv), Nutzen → Budget(negativ, ROI-Vorzeichen-Konvention), Unternehmensrisiken → Risks (neue IDs). 7 neue Routen unter `/projektideen` (CRUD + step-update + erstelle-auftrag + export).
- **Wizard** (`frontend/.../IdeeWizardPage.jsx` + 6 Step-Komponenten): 6 Tabs gemaess PDF-Vorlage — Basis, Ziele, Projektkontext, Business Case (Investitionen+Nutzen separat, ROI als Saldo-Fazit), Unternehmensrisiken, Uebersicht. Kein Roadmap/Vergleich/Personen — *"die anderen Eingaben sind zu frueh bei einer Idee."*
- **Tab-Integration** (`ProjektePage.jsx`): `Projektideen`-Tab zeigt jetzt die Liste inline (`<IdeenPage embedded />`); Standalone-Route `/apps/projektmanagement/ideen` bleibt erhalten. Header-Buttons (Import, Neuer Auftrag) werden auftraege-spezifisch.
- **Dokumenten-Export** (`backend/src/services/documentGenerator/{idee-mapper,markdownGenerator}.ts`, neuer `'md'`-Format-Branch): Idee als Markdown / PDF / DOCX exportierbar. Generischer Markdown-Generator (Pipe-Tables, keyvalue-Bullets) ist auch fuer den Auftrag-Export verfuegbar (Folge-Iteration). `ExportDropdown`-Komponente unterstuetzt `md` bereits.

Doku: `docs/projektidee-feature-2026-04-29.md` (Architektur-Entscheidungen, Mapping, Verifikation).

### Feature: Projektauftrag-Import — Granulare Fortschrittsanzeige via SSE
Vorher zeigte das Frontend einen Fake-Progress (hardcoded 10/25/40/80/100% mit kuenstlichen Setimeouts) ohne Bezug zum Backend-Status. Bei 30+ Sekunden Vision-LLM-Call (Whiteboard-Bilder) oder dichten xlsx-Toolboxen sah es aus als ob die App haengen wuerde.

- **Backend** (`import-service.ts` + `routes.ts`): `importProjektauftrag()` erhaelt einen optionalen `onEvent`-Callback und emittiert `started`/`file_*`/`extracting_*`/`combining`/`validating`/`creating`/`done`/`error`. File-Loop ist jetzt sequenziell statt parallel. `withHeartbeat`-Wrapper emittiert alle 3s einen `*_progress`-Event waehrend Vision/Markitdown/LLM-Calls. Route nutzt `streamSSE` aus `hono/streaming`.
- **Frontend** (`ImportPage.jsx`): konsumiert SSE-Stream via `fetch()` + `response.body.getReader()`. Per-File-Liste mit Status-Icons, Live-Sekunden-Counter pro aktiver Datei, Phasen-Hinweis-Box mit erwarteter Dauer.
- **Test-Runner** (`tools/pm-import-test/run-test.ts`): liest jetzt SSE-Stream statt JSON-Response.

## 2026-04-29

### Fix: Projektauftrag-Import — Bilder, xlsx-Toolbox-Reorder, Null-Validation
1. **Bilder**: `import-service.ts` griff auf `visionModel.provider.api_url`/`api_key` zu — diese Felder existieren nicht auf `ResolvedModel`. Korrekt sind `base_url`/`api_key` direkt. Fix laesst Image-Imports wieder funktionieren.
2. **xlsx-Reorder**: Excel-Toolboxen mit `Glossar`-Sheet (PMBOK-Definitionen) verdraengten die echten Projektdaten beim 30K-Char-Truncate. Neuer `reorderXlsxSheets()` sortiert Sheets nach Relevanz (P-Auftrag → Inhalt → Aufwand → Risk → Status → Glossar/Listen ans Ende).
3. **xlsx-Char-Budget**: eigener `MAX_COMBINED_CHARS_XLSX = 20000` (statt 30K) verhindert LLM-Timeouts bei dichten Tabellendaten.
4. **Null-String-Normalisierung im Validator**: LLMs liefern teils `"null"`/`"n/a"`/`"-"` als String — werden jetzt zu echtem `null` normalisiert.

Test-Tooling: `tools/pm-import-test/run-test.ts` + `analyze.ts`. End-to-end-Test mit 33 Beispiel-Files: vorher 0 Bilder + xlsx-Avg 66, jetzt 30/30 erfolgreich, Avg-Score 93.6.

### Feature: Storage-Foundation auf Scalingo Postgres + Flow.swiss S3 (Phase 1)
- Drizzle ORM (`drizzle-orm` + `postgres-js`) eingefuehrt; Connection lazy-initialisiert ueber `SCALINGO_POSTGRES`.
- 20 Schema-Files mit ~40 Tabellen ueber 18 dedizierte Postgres-Schemas (auth, chat, apps, kb, vertragsmgmt, projektmgmt, liefermgmt, vsm, wzbar, ...) — Mapping orientiert sich an den bestehenden YAML-Strukturen, IDs bleiben kompatibel.
- AWS-S3-SDK mit Flow.swiss-Endpoint (`os.alp1.flow.swiss`); zentrale Pfad-Konventionen in `backend/src/storage/paths.ts`; idempotente Bucket-Initialisierung beim Server-Start.
- Auto-Migration beim Container-Start (`runMigrations()` im `initialize()`-Flow), mit 10s-Timeout fuer lokale Dev (Scalingo-DB von ausserhalb nicht erreichbar).
- `drizzle-kit`-Scripts in `backend/package.json`: `db:generate`, `db:migrate`, `db:push`, `db:studio`.
- Backwards-kompatibel: alle bisherigen Workplace-Endpoints lesen/schreiben unveraendert YAML-Files. Phase 2 (Modul-Migration) folgt schrittweise mit Dual-Write-Pattern.
- Doku: `docs/storage-architecture.md` mit kompletter Schema-Uebersicht, S3-Layout und Migrations-Strategie.
- Verifiziert: S3-Bucket `workplace-poc-demo` angelegt, put/get/delete-Roundtrip erfolgreich; Postgres-Migration ist generiert (605-zeilige SQL) und wird beim ersten Scalingo-Deploy automatisch angewendet.

## 2026-04-26

### Feature: Multi-Customer-PoC-Konfiguration via ENV
- Neue ENV-Variable `ENABLED_APPS` (kommagetrennte App-IDs) — wenn gesetzt, sind nur die freigegebenen Apps im Workplace sichtbar (Sidebar, Apps-Launcher, Public-API). Wenn nicht gesetzt: bisheriges "alle Built-In-Apps verfuegbar"-Verhalten (Backward-Compat).
- ENV-Filter wirkt nur zur Laufzeit, persistiert NICHT in `registry.yaml` — der admin-kontrollierte `enabled`-Flag bleibt zwischen Deploys stabil. Wenn `ENABLED_APPS` spaeter wieder entfernt wird, kehren alle Apps automatisch in den Admin-Wunsch-State zurueck.
- `PUT /api/apps/:appId/enable` weist mit 403 `env_blocked` zurueck, wenn die App via ENV gesperrt ist.
- `GET /api/apps` liefert pro App ein `envBlocked: boolean`-Flag, damit das UI den Toggle deaktivieren und einen "via ENV deaktiviert"-Hinweis anzeigen kann (Settings -> Apps).
- Neue Helper `isAppEnvAllowed(appId)` und `getEnvEnabledAppIds()` aus `backend/src/apps/registry.ts` fuer eigene Anwendungen.

### Feature: Branding-Endpoint fuer Customer-Workplaces
- Neuer Endpoint `GET /api/branding` (unauth'd) liefert `{title, logoUrl, loginSubtitle}` aus den ENVs `PLATFORM_TITLE`, `PLATFORM_LOGO_URL`, `PLATFORM_LOGIN_SUBTITLE`. Defaults: "Workplace" / null / null.
- Frontend-Hook `useBranding()` (in `frontend/src/hooks/useBranding.jsx`) laedt das beim App-Boot in einen React-Context.
- Touchpoints: Sidebar-Header (Title + Logo), LoginPage (Title + Logo + Subtitle), Browser-Tab-Title (`document.title` zur Laufzeit).
- Externe HTTPS-Logo-URLs werden automatisch zur CSP `img-src`-Whitelist hinzugefuegt (Origin aus `PLATFORM_LOGO_URL` extrahiert).
- Logos koennen alternativ unter `frontend/public/branding/<kunde>.png` mit-deployed werden — `PLATFORM_LOGO_URL=/branding/<kunde>.png`.

### Doku: Customer-PoC-Setup-Guide
- Neue Doku `docs/customer-poc-setup.md` mit Step-by-Step fuer neue PoC-Services: Railway-Service, ENV-Template, Initial-Admin, Anlegen einer customer-spezifischen App (Backend + Frontend + optionaler Public-API-Function) — in <30 Min vom leeren Service zur eingeloggten "Hello, Customer X"-App.

## 2026-04-24

### Fix: seed-demo-users — Pfad-Aufloesung im Docker-Volume korrigiert
- Die Pfad-Auto-Detection im Seed-Script hat in Docker zuerst `../data` versucht. Dieser Pfad ist aber ein Symlink auf `/app/data/backend-data/`; `stat` folgte dem Symlink, fand ein Directory und nutzte es. Folge: neu angelegte User (ruhrpm, people1, yneo-ai) landeten in `/app/data/backend-data/auth/users/` — der Backend-Auth-Service liest aber aus `/app/data/auth/users/`. Login schlug mit 401 fehl.
- Fix: Reihenfolge der Kandidaten umgedreht — `../../data` (direkter Mount) zuerst, `../data` nur als Fallback fuer den lokalen Dev-Fall. Beim naechsten Deploy werden betroffene User idempotent im richtigen Verzeichnis neu angelegt.

### Fix: Built-in Apps registrieren sich beim Server-Start in der Registry
- Auf Railway war die `wzbar-matcher`-App nach Deploy weder in der Sidebar noch in den Einstellungen sichtbar, obwohl sie in `backend/data/apps/registry.yaml` committed war. Ursache: das Dockerfile kopiert die Registry zwar via `cp -f` ins Volume, aber dieser Sync ist anfaellig gegenueber Mount-Layout-Varianten und Volume-Caches.
- Neue `syncBuiltInApps()`-Funktion wird im `initialize()`-Flow aufgerufen und merged idempotent alle in-Code definierten App-Configs (`vertragsmanagement`, `projektmanagement`, `lieferantenmanagement`, `vsm`, `wzbar-matcher`) in die Registry. Der admin-kontrollierte `enabled`-Flag bleibt erhalten; statische Felder (name, description, icon, routes) werden bei Bedarf aus dem Code refreshed.
- Entkoppelt App-Verfuegbarkeit vom Dockerfile-Volume-Sync.

### Feature: Agent-Tool-Bridge fuer Public-Functions (Etappe 2b)
- Jede `publicFunction` eines Apps wird beim Server-Start automatisch als Tool im ToolRegistry registriert (Name: `<appId>__<functionId>`, z.B. `wzbar-matcher__classify`).
- Agents koennen die Funktion direkt aufrufen — ohne HTTP-Round-Trip, ohne API-Key. Die PublicFunctionContext wird aus dem ToolContext synthetisiert (userId aus der Session).
- Input-Schema der publicFunction ist zugleich das Parameters-Schema fuer das LLM-Function-Calling. Kein Duplizieren von Schemas.
- Handler-Fehler werden als lesbare Strings an den Agent zurueckgegeben; der Agent-Loop fasst sie ueber die ueblichen Tool-Error-Pfade ab.

### Feature: OpenAPI-Export fuer Public-API (Etappe 2c)
- `GET /api/public/v1/openapi.json` liefert eine OpenAPI-3.1-Spec aller publicFunctions aller enabled Apps (unauth'd — ermoeglicht Code-Gen vor Key-Erhalt).
- Enthaelt Bearer-Auth-Security-Scheme, alle Endpoints mit Request-/Response-Schemas, fehlerhafte Status-Codes (400/401/403/429/500) und Tags pro App.
- Nutzt die bestehenden JsonSchemas direkt — keine Schema-Konvertierung noetig.
- Integratoren koennen mit Tools wie openapi-generator direkt Client-Libraries fuer Java/TypeScript/Python/etc. bauen.

### Feature: API-Keys-Verwaltung in Einstellungen (Etappe 2a)
- Neuer Admin-Tab "API-Keys" unter Einstellungen → System.
- Liste aller Keys mit Label, Scope, Permissions, Rate-Limit, letzter Nutzung und Status.
- "Neuer Key"-Modal: Label, Scope-Typ (Service/Org/User), Permissions-Checklist aus allen verfuegbaren Public-Functions, Rate-Limit, optional Ablaufdatum.
- Raw-Key-Anzeige nach Erstellung mit Warnung "nur einmal sichtbar" und Copy-to-Clipboard.
- Widerrufen mit Bestaetigungsdialog.
- Backend-Routes `GET/POST/DELETE /api/admin/api-keys`, `GET /api/admin/api-keys/permissions` (admin-only, Session-Auth). Reuse der bestehenden service.ts aus dem Public-API-Framework.

### Feature: Public-API-Framework fuer Apps (Etappe 1)
- Neues Framework, das jeder App ermoeglicht, einzelne Funktionen als authentifizierte HTTP-API freizugeben — ohne pro App neu auth/rate-limit/validation zu bauen.
- Endpoints unter versioniertem Namespace `/api/public/v1/*`:
  - `GET /health` — unauth'd Liveness-Check
  - `GET /` — scope-gefilterte Discovery (Apps + Functions, die der Key aufrufen darf, inkl. Input-/Output-Schema)
  - `POST /:appId/:functionId` — Funktions-Dispatch
- API-Key-Auth via `Authorization: Bearer apk_<prefix>.<secret>`; Secret argon2id-gehasht gespeichert unter `data/auth/api-keys/<id>.yaml` (gitignored).
- Scope-Modelle: `service` / `org` / `user` — Permissions im Format `app:<id>:<functionId>` mit Wildcards (`app:*:*`, `app:wzbar-matcher:*`).
- Per-Key-Rate-Limit mit sliding window, konfigurierbar pro Key im YAML. Antwort-Header `X-RateLimit-Limit/Remaining/Reset` + `Retry-After`.
- Minimaler JSON-Schema-Validator (dependency-free) fuer Input-Validation; strukturierte Fehler-Responses `{error, code, details?}`.
- Append-only Audit-Log als JSONL unter `data/audit/api-public/<YYYY-MM>.jsonl` — jede Anfrage mit Key-ID, Scope, Status, Dauer; keine Request/Response-Bodies.
- CLI `scripts/api-keys.ts` mit `create | list | show | revoke`; Raw-Key wird nur einmal beim Anlegen ausgegeben.
- Erste Public-Function: `POST /api/public/v1/wzbar-matcher/classify` — schlankes Output-Format (Primary + Alternativen mit Code/Kurztext/Langtext/Konfidenz/Begründung), ohne interne Audit-IDs oder Modell-Informationen.
- `AppConfig` um optionales Feld `publicFunctions` erweitert; bestehende Apps bleiben unberuehrt.

### Feature: WZ-Branchen-Matcher App (`wzbar-matcher`)
- Neue Workplace-App zur Klassifikation freier Tätigkeitstexte auf 4-stellige WZ-2008-Schlüssel (für IHK-Anlage in EMMA).
- Zweistufige Pipeline: Semantic Retrieval (Embeddings) → LLM-Re-Ranking via Forced Function Calling.
- Liefert Primary Match + bis zu 3 Alternativen mit Konfidenz und deutscher Begründung.
- Katalog-Builder: extrahiert 662 gültige 4-stellige Codes aus `docs/WZBAR-Schluesseltabelle.xlsx` (abgelaufene Codes werden gefiltert).
- Embedding-Index: 662 Einträge × 1024 dim via Adacor AI `multilingual-e5-large`, idempotent per Input-Hash.
- Audit-Log: jede Anfrage wird als YAML unter `data/apps/wzbar-matcher/matches/` persistiert.
- Neuer Embedding-Provider `adacor-embeddings` in `providers.yaml` (eigene Base-URL `https://api.adacor.ai/embeddings/privateai/v1`).
- `OpenAIAdapter.embed()` und `LLMService.embed()` neu — wiederverwendbar für weitere Embedding-Use-Cases.
- Frontend-UI: Textarea mit Cmd/Ctrl+Enter, farbcodierte Konfidenz-Badges, Copy-Button pro Code, Historie der letzten 20 Anfragen.
- Neue Icons: `ClassifierIcon`, `CopyIcon`.
- Endpoints: `POST /api/apps/wzbar-matcher/match`, `GET /history`, `GET /matches/:id`, `GET /status`.

## 2026-04-16

### Feature: Projektauftrag Import aus Dokumenten
- Multi-Dokument-Upload (bis zu 10 Dateien): PDF, Word, Excel, PowerPoint, Bilder, Text
- Automatische Textextraktion via Markitdown API (Dokumente) und Vision-LLM (Bilder)
- LLM-basierte Extraktion aller Projektauftrag-Felder per Forced Function Calling
- Automatisches Mapping auf die 7-Schritte-Wizard-Struktur inkl. IDs und Enum-Normalisierung
- Neue Import-Seite mit Drag & Drop, Dateiliste, Fortschrittsanzeige
- Import-Button auf der Projektmanagement-Übersichtsseite
- Neuer Backend-Endpoint: POST /api/apps/projektmanagement/projektauftraege/import

### Fix: Projektauftrag-Export fehlte Felder und KI-Analyse war komplett defekt
- Projektbeschreibung (description) wird jetzt exportiert
- Aufgaben-Tabelle enthält jetzt Start-/Enddatum
- Budget-Tabelle enthält jetzt Kategorie
- Organisation enthält jetzt E-Mail und Verfügbarkeit
- Stakeholder enthält jetzt Erwartungen
- Metadata nutzt echtes Erstelldatum + Änderungsdatum statt aktuellem Datum
- Gesamtbewertung: Feldnamen korrigiert (hauptstaerken statt strengths, hauptrisiken statt weaknesses, handlungsempfehlungen statt recommendations)
- Gesamtbewertung: Score, Projektreife, Risikolevel, StepScores, Risikofaktoren werden jetzt exportiert
- Schritt-Analysen (stepAnalyses) werden als Übersichtstabelle exportiert
- Wahrscheinlichkeit/Auswirkung/Interesse/Einfluss werden als deutsche Labels exportiert
- Task-Status 'open' wird jetzt korrekt als 'Offen' gemappt

### Redesign: PDF- und Word-Export modernisiert
- Neue Farbpalette: Warm-Slate + Teal-Akzent statt schweres Dunkelblau
- Section-Titel: Teal-Akzentbalken links statt Unterstrich
- Tabellen: Heller Header, nur horizontale Linien, kein dunkler Navy-Hintergrund
- Key-Value: Feine gestrichelte Trennlinien
- Listen: Teal-farbene Bullets
- Footer mit Dokumenttitel + Seitenzahl
- Calibri-Font für Word, bessere Typografie-Hierarchie

### Feat: Statusbericht-Export als PDF, Word und Excel
- Neuer Endpoint: GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId/export/:format
- Mapping-Funktion mapStatusberichtToDocument() mit allen Sektionen:
  Berichts-Info, Management Summary, Ziele + Kriterien-Tracking, Meilensteine (Soll/Ist),
  Aufgaben, Quality Gates, Kosten-Übersicht + Monatstabelle, Risiken
- ExportDropdown in Statusbericht-Tab-Leiste integriert
- Gleiches modernes Design wie Projektauftrag-Export

### Feat: Earned Value Management + Risikobewegung im Statusbericht-Export
- EVM-Kennzahlen: CPI, SPI, Earned Value als Key-Value-Section mit farbigen Ampel-Dots
- Kumulierte Kostenentwicklung: Monats-Tabelle mit Plan, Ist, EV, CPI, SPI
- Terminprognose: Soll-Ende vs. EAC-Termin (berechnet via SPI), Abweichung in Tagen
- Budgetprognose: Budget vs. EAC (Budget/CPI), Abweichung in EUR
- Risikobewegung (Soll → Ist): Vergleich Projektauftrag-Risiken mit Statusbericht-Tracking
  (Wahrscheinlichkeit/Auswirkung), Trend-Berechnung (verbessert/verschlechtert/unverändert)
- Zusammenfassung der Risikobewegung mit Anzahl pro Trend-Kategorie

## 2026-04-14

### Fix: Image-to-Image ging an falschen fal.ai Endpoint (generierte statt editierte)
- fal.ai hat separate Endpoints: `/model-id` (text-to-image) vs `/model-id/edit` (image-to-image)
- Adapter sendet jetzt bei sourceImage automatisch an `/edit` Sub-Endpoint
- aspect_ratio wird bei img2img auf 'auto' gesetzt (erhält Seitenverhältnis des Quellbildes)

### Fix: "JSON undefined" Artefakt bei Bildgenerierung + edit_image Bild nicht angezeigt
- Frontend: Leere Code-Bloecke (```json ... ```) nach JSON-Extraktion werden entfernt
- Frontend: LLM-Echo von generated_image/exported_document JSON wird aus dem Text entfernt
- Backend: revisedPrompt aus Tool-Ergebnis-JSON entfernt (blaeht LLM-Kontext auf, wird in Metadaten gespeichert)
- Backend: edit_image Tool-Ergebnis wird jetzt in importantToolResults getrackt (fehlte, daher wurde Bild-JSON nie injiziert)
- Agent-Config: Bild-Generator soll Tool-Ergebnis-JSON nicht mehr in Antwort wiederholen (System injiziert automatisch)

## 2026-03-28

### Feature: Drei neue Connection-Provider (Google Mail, Jira, Docuware)
- **Google Mail**: Emails suchen (gmail_search_emails), lesen (gmail_read_email), Labels auflisten (gmail_list_labels). Nutzt dieselben Google-Credentials wie Drive.
- **Jira**: Issues per JQL suchen (jira_search_issues), Details abrufen (jira_get_issue), Projekte auflisten (jira_list_projects). Eigene Atlassian-Credentials.
- **Docuware**: Dokumente suchen (docuware_search_documents), Metadaten/Inhalt abrufen (docuware_get_document), Schraenke auflisten (docuware_list_cabinets). Org-spezifische OAuth-URLs.
- Frontend: MailIcon hinzugefuegt, getProviderIcon um google-mail, jira, docuware und pipedrive erweitert
- **Suche**: Google Mail als Datenquelle in der unified Search integriert (Tab + Ergebnisse mit Absender/Datum, Link oeffnet Thread in Gmail)

### Feature: Risiko-Neubewertung + Bewegungsmatrix in Statusberichten
- Risiken im Statusbericht erhalten Wahrscheinlichkeit/Auswirkung-Dropdowns zur Neubewertung
- Neue Risikobewegungsmatrix: zeigt Original-Position (Projektauftrag, gestrichelte Kreise) neben aktueller Bewertung (solide Kreise mit Ampelfarbe)
- Pfeile visualisieren Bewegungsrichtung jedes Risikos in der Matrix
- Delta-Zusammenfassung: "X verbessert, Y verschlechtert, Z unveraendert"
- Separate Matrizen fuer Bedrohungen und Chancen
- Pre-Fill: Wahrscheinlichkeit/Auswirkung werden vom Projektauftrag uebernommen
- Bugfix: Risiko-Typ (Bedrohung/Chance) wird jetzt korrekt vom Auftrag uebernommen

### Feature: Soll/Ist Timeline in Statusbericht-Roadmap
- Horizontale SVG-Timeline mit zwei Reihen: Soll-Termine (oben) und Ist-Termine (unten, gestrichelt)
- Ampelfarben aus dem Tracking fuer Meilensteine und Quality Gates
- Verbindungslinien zwischen Soll und Ist zeigen Verzoegerungen oder fruehe Fertigstellung
- Heute-Marker, Tooltips mit Details, Legende, responsive Breite

## 2026-03-27

### Feature: Statusberichte fuer Projektmanagement
- Statusberichte als neues Modul: Projektfortschritt mit Ampel-System (Gruen/Gelb/Rot) dokumentieren
- Fünf Tabs: Basis (Ampel, Datum, Management Summary), Ziele (Projektziele + Erfolgskriterien-Tracking), Roadmap (Meilensteine, Hauptaufgaben, Quality Gates), Kosten (Earned Value Management mit CPI/SPI, Prognosewerten und S-Kurven-Chart), Risiken (Bedrohungen + Chancen mit Strategie, Status, Verantwortlich, Datumsfelder, Ampel, Beschreibung, Auswirkung, Massnahmen)
- Modus-Umschaltung im Wizard: Segmented Control wechselt zwischen Projektauftrag und Statusberichte
- Blade-Navigation: Linke Sidebar zeigt chronologische Liste der Berichte mit Ampel-Punkt
- Criteria-Snapshot: Erfolgskriterien werden bei Erstellung kopiert, Drift-Erkennung bei Aenderungen
- Pre-Fill-Logik: Folgeberichte uebernehmen Tracking-Daten vom letzten Bericht
- Dashboard in ProjektePage: Statusberichte-Tab zeigt aktive Projekte mit letzter Ampel
- Backend: 6 neue REST-Endpoints (CRUD + Dashboard), eigener Service + Storage
- Statusberichte leben als YAML-Dateien unter {projektId}/statusberichte/

## 2026-03-25

### Feature: Einstellungen — Subtabs + Masterclass-Editor
- Einstellungen-Tab aufgeteilt in Subtabs: "Auswahloptionen" (bestehend) und "Masterclass" (neu)
- Strukturierter Formular-Editor fuer PM-Masterclass-Wissen pro Wizard-Schritt (7 Steps)
- Farblich gestaltete Sektionskarten: Meta, Pruefkriterien, Typische Fehler, Tipps, Kernkonzepte
- Rekursiver Tree-Editor fuer verschachtelte Wissensstrukturen (Text/Liste/Abschnitt)
- YAML-Serialisierung komplett im Backend — kein YAML-Bruchrisiko im Frontend
- Backend: PUT /knowledge/:step akzeptiert JSON-Objekte, serialisiert zu YAML
- Cache-Invalidierung bei Aenderungen
- Dynamische Sektionen: unbekannte YAML-Keys werden automatisch in KnowledgePanel + Editor angezeigt

### Feature: Risikomatrix-Visualisierung
- Neuer Subreiter "Risikomatrix" im Risiken-Tab neben "Eingabe"
- Zwei klassische Risikomatrizen: Bedrohungen und Chancen (getrennt dargestellt)
- Ampelfarben-System (rot/gelb/gruen) fuer Zellenfarben basierend auf normalisiertem Risikoscore
- Kreisgroesse variiert nach Auswirkung (MIN_R=12 bis MAX_R=24)
- Dynamische Achsen aus konfigurierbaren Einstellungen (beliebige Labels/Skalen)
- Kollisionsbehandlung bei mehreren Risiken in derselben Zelle
- Hover-Tooltip mit Beschreibung und Gegenmassnahme
- Neues Feld "Art" (Bedrohung/Chance) bei der Risiko-Eingabe

### Feature: Konfigurierbare Risiko-Selects
- Wahrscheinlichkeit und Auswirkung jetzt ueber Einstellungen-Tab pflegbar
- Backend: probability und impact in DEFAULT_CONFIG ergaenzt
- Risiken.jsx nutzt Config-Werte statt hardcoded Optionen

### Feature: Kosten-Tab (ehem. Budget)
- "Budget" in "Kosten" umbenannt (Tab-Titel, Ueberschriften, Buttons)
- Neues Feld "Aktivierbarkeit" (Ja/Nein) pro Kostenposition

### Feature: Quality Gates im Roadmap-Tab
- Neue "Quality Gates" Section mit Bezeichnung und Datum
- Rautenfoermiges Icon (Diamond) zur Unterscheidung von Meilensteinen
- Integration in Meilenstein-Timeline mit eigenem Nummernkreis
- Quality Gates immer in Warnfarbe dargestellt (nicht gruen wenn vergangen)

### Feature: Stakeholder-Klassifizierungsmatrix
- Neuer Subreiter "Klassifizierung" im Personen-Tab
- Custom SVG-Matrix mit Interesse (X-Achse) und Einfluss (Y-Achse)
- Zeigt alle Personen (Team + Stakeholder) als Avatar-Kreise mit Initialen
- Dynamische Achsen: passt sich an beliebige Config-Werte an (Text-Labels, Zahlenskalen, etc.)
- Kollisionsbehandlung bei mehreren Personen in derselben Zelle
- Quadranten-Labels (Beobachten, Informieren, Zufriedenstellen, Eng einbinden)
- Hover-Tooltip mit Name, Rolle und Typ

### Feature: Projekt ID Feld
- Neues Textfeld "Projekt ID" im Basisdaten-Tab neben Projektname

## 2026-03-23

### Feature: Einstellungen-Tab — Konfigurierbare Select-Optionen
- Neuer "Einstellungen"-Tab in der Projektmanagement-App (nach Portfolio)
- 10 konfigurierbare Felder: Projekttyp, Projektgroesse, Prioritaet, Projekttreiber, Projektstatus, Projektauftragsstatus, Rolle, Status, Interesse, Einfluss
- Backend: GET/PUT /api/apps/projektmanagement/config mit JSON-Persistenz + Defaults
- Basis.jsx und Personen.jsx befuellen alle Selectboxen dynamisch aus der Config
- Rolle-Feld in Personen von Freitext zu Select umgestellt

### Feature: Basisdaten erweitert — Projektklassifizierung
- "Status" umbenannt in "Projektauftragsstatus"
- Neue Felder: Projektstatus (Initiierung bis Gestoppt), Projekttreiber (Strategisch/Gesetzlich/Operativ), Projektgroesse (Klein/Mittel/Gross), Prioritaet (Niedrig bis Kritisch)

### Refactor: Personen-Tab — Projektteam & Stakeholder vereinheitlicht
- Projektteam: E-Mail und Verfuegbarkeit entfernt, Interesse + Einfluss + Status (intern/extern) + Unternehmen ergaenzt
- Stakeholder: Status-Feld (intern/extern) ergaenzt
- Beide Gruppen haben jetzt einheitliche Felder fuer Interesse, Einfluss und Status

### Feature: Meilenstein-Timeline im Roadmap-Tab
- Horizontale SVG-Timeline zeigt Meilensteine proportional auf einer Zeitachse
- Vergangene Meilensteine gruen, zukuenftige teal, "Heute"-Marker als gestrichelte Linie
- Tooltip bei Hover zeigt Meilenstein-Beschreibung
- Responsive via ResizeObserver, nur sichtbar bei >= 2 Meilensteinen mit Datum
- Keine neue Dependency (reines Custom SVG)

### Refactor: Wizard-Tabs Restrukturierung — Roadmap, Budget/Risiken-Split, File-Rename
- Aufgaben + Meilensteine zu "Roadmap"-Tab zusammengefuehrt (Meilensteine oben, Hauptaufgaben unten)
- Budget & Risiken in separate Tabs "Budget" und "Risiken" aufgeteilt
- StepX-Prefix aus allen Dateinamen entfernt (Step1Basis.jsx → Basis.jsx etc.)
- Wording "Aufgaben" → "Hauptaufgaben" durchgaengig angepasst
- KnowledgePanel: BACKEND_STEP_MAP auf Arrays umgestellt, Multi-Step-Analyse fuer Roadmap, shared Analyse fuer Budget/Risiken
- Uebersicht: UI-to-Backend stepAnalyses Key-Transformation hinzugefuegt
- Neue Tab-Reihenfolge: Basis, Personen, Ziele, Inhalt, Roadmap, Budget, Risiken, Uebersicht, Vergleich

### Fix: Chat-Modellauswahl wird an delegierte Agenten weitergereicht
- Wenn der User im Chat das Modell aendert, gilt das jetzt auch fuer delegierte Agenten (sofern diese kein eigenes locked Model haben)
- Vorher hatte die Modellauswahl kaum Effekt, weil der Supervisor nur routet und die Agenten ihr eigenes Default-Modell nutzten

### Fix: Deployment ueberschreibt keine User-Daten mehr
- Dockerfile hat bei jedem Start agents/, skills/, config/ und backend/data/apps/ komplett geloescht und durch Seed-Daten ersetzt
- User-erstellte Agenten, Custom Skills und App-Daten (Vertraege, Lieferanten, Projektauftraege, VSM) gingen bei jedem Deployment verloren
- Jetzt: System-Agents werden einzeln aktualisiert, User-erstellte Agenten bleiben erhalten
- Skills: Nur skills/system/ wird ersetzt, skills/custom/ bleibt unberuehrt
- Apps: Nur registry.yaml, config.json, schemas und vorlagen werden aktualisiert — User-Daten (contracts, suppliers, projekte) bleiben erhalten

### Fix: PDF-Upload — Supervisor delegiert nicht mehr unnoetig an chat-document-reader
- Supervisor hat Dokumentinhalt bereits direkt im Prompt, delegierte aber trotzdem — Agent halluzinierte dann attachment_id
- Attachment-IDs werden jetzt auch bei Dokumenten im Supervisor-Prompt angezeigt (vorher nur bei Bildern)
- Priorisierungsregeln verschaerft: Supervisor soll bei hochgeladenen Dokumenten direkt antworten statt zu delegieren

## 2026-03-22

### Feature: KI Workplace CLI (basierend auf Mistral Vibe)
- Mistral Vibe (Apache 2.0) geklont und als eigenes CLI Tool adaptiert
- Adacor AI (Qwen3 30B) als Default-Provider konfiguriert
- Branding: "KI Workplace CLI" statt "Mistral Vibe" (Banner, System-Prompt, Commit-Signatur, Help-Texte)
- Neuer CLI-Befehl `workplace` (zusaetzlich zu `vibe`)
- Config-Home: `~/.workplace-cli/` (statt `~/.vibe/`)
- Projekt-Config: `.workplace/` (statt `.vibe/`)
- Env-Prefix: `WORKPLACE_*` (statt `VIBE_*`)
- Fix: tool_choice wird nur mit tools gesendet (Adacor API Kompatibilitaet)
- Installation: `uv tool install -e tools/workplace-cli`

## 2026-03-18

### Feature: Value Stream Mapping App
- Neue App "Value Stream Mapping" im Workplace-Framework
- Uebersichtsseite mit Projekt-Cards, Stats, Filter und Suche
- Detailansicht mit drei Tabs: Eingabe, Visualisierung, Analyse
- Eingabe: 7 Datenbereiche (Meta-Daten, Kunde, Produkt, Lieferanten, Prozessschritte, Informationsfluss, Personal) - basierend auf dem Python-Piloten
- Visualisierung: SVG-basierte Wertstrom-Darstellung mit Materialfluss, Timeline, KPI-Dashboard, Engpass-Markierung und Informationsfluss
- Analyse: KI-gestuetzte Auswertung mit umfassendem Lean-Manufacturing-Report (Engpass-Analyse, 8 Verschwendungsarten, Massnahmenempfehlungen mit ROI, IST/SOLL-Prognose, Roadmap)
- Backend: Hono Routes, File-based Storage, LLM-Integration fuer Analyse
- Frontend: Lazy-loaded Pages, useVsm Hook, Sidebar-Icon

## 2026-03-17

### Bugfix: /model zeigt nur noch Chat-faehige Modelle
- Model-Switch-Command zeigte alle Modelle inkl. Whisper (STT), TTS und Bildgenerierung
- Fix: `getModelOptions()` filtert jetzt nach `chat`-Capability

### Bugfix: Chat-Suche zeigt Chats anderer User
- Alle Such-Endpoints (Chat-Search, Unified Search, Smart Chat Search) hatten keine userId-Filterung
- Fix: userId wird durchgereicht, eingeloggte User sehen nur eigene Chats
- ChatSidebar sendet jetzt `credentials: include` fuer Auth-Cookie

### Bugfix: Text-basierte Tool-Calls (Qwen3) werden nicht ausgefuehrt
- Root Cause 1: Exit-Condition in der Hauptloop prueft `finishReason === 'stop'`, was text-extrahierte Tool-Calls blockiert
- Root Cause 2: Qwen3 `<tool_call>...</tool_call>` XML-Tags wurden nicht erkannt
- Fix: Exit-Condition korrigiert, `<tool_call>` Tags werden in allen Pfaden gestripped
- Bonus: JSON-Extraktion fuer verschachtelte Arguments nutzt jetzt `extractBalancedJson` statt fragile Regex

### Feature: Nebius Flux Dev Bildgenerierungs-Modell
- Neuer Provider `nebius-flux-dev` mit Flux.1 Dev Modell (1024x1024, 512x512)
- Nutzt Nebius Token Factory API (EU/Finnland)

### Bugfix: Suche findet keine Knowledge-Base-Dokumente
- searchService.ts nutzte Regex zum Parsen der collections.yaml, der Anfuehrungszeichen um Werte erwartete
- collections.yaml hat aber keine Anfuehrungszeichen — Regex matchte nichts
- Fix: YAML-Parser statt Regex fuer collections.yaml und manifest.yaml (beide Suchfunktionen)

### Bugfix: PDF-Upload mit Grossbuchstaben-Extension (.PDF) scheitert
- Bun.file() erkennt Dateien mit Extension in Grossbuchstaben nicht korrekt (liefert application/octet-stream statt application/pdf)
- Fix: MIME-Type wird jetzt explizit anhand der Extension bestimmt (case-insensitive) in indexer.ts und attachments.ts
- Betrifft auch .DOCX, .XLSX und andere Office-Formate mit Grossbuchstaben-Extension

## 2026-03-15

### Bugfix: "Unbekannte Gruppe" bei Agent-Berechtigung
- Nach Hinzufuegen einer Gruppe wurde "Unbekannte Gruppe" angezeigt, weil die API-Response kein `name`/`memberCount` enthielt
- Fix: Nach addAccess() wird die komplette Berechtigungsliste neu geladen statt das unvollstaendige Objekt direkt in den State zu haengen

### Bugfix: Spaces bei Gruppen-Berechtigung nicht sichtbar und nicht zugreifbar
- Projects/Spaces wurden nur ueber direkte Mitgliedschaft gefiltert, nicht ueber RBAC-Gruppen
- Fix: listProjects und alle Permission-Checks nutzen jetzt RBAC (wie Agents und Collections)
- Fehlermeldungen von "Projekt" auf "Space" umgestellt
- Space-Cards zeigen jetzt auch die Anzahl berechtigter Gruppen an

### Refactoring: document_count aus collections.yaml entfernt
- Dokumenten-Anzahl wird jetzt dynamisch vom Dateisystem gezaehlt statt statisch in collections.yaml gepflegt
- Entfernt fehleranfaellige Sync-Logik aus indexer, documentImporter, knowledge-routes und chat-routes
- Behebt falsche "0 Dokumente"-Anzeige bei HR Vereinbarkeit und HR-Vorlagen

## 2026-03-14

### Feature: Railway Demo Deployment (Messe-Pilot)
- Multi-Stage Dockerfile: Frontend-Build (node:20-alpine) + Bun-Runtime (oven/bun:1-alpine)
- Single-Service-Architektur: Backend servt gebautes Frontend (same-origin, kein CORS)
- Idempotentes Seed-Script fuer Demo-Accounts (demo1-demo4)
- Self-Registration per ENV-Flag deaktivierbar (REGISTRATION_DISABLED=true)
- Railway-Konfiguration (railway.toml) mit Health-Check und Restart-Policy
- Volume-Initialisierung beim ersten Start (kopiert Seed-Daten falls leer)
- Frontend Login-Seite versteckt Register-Link wenn Registration deaktiviert

## 2026-03-13

### Feature: Lernende Dokumenten-Extraktion (Redesign)
- Altes Profil-System komplett ersetzt durch lernendes, intent-basiertes System
- Neues Datenmodell: Extraction Projects mit flachen Feldern (Text, Zahl, Datum, Boolean)
- Training-Loop: Dokument hochladen → Extraktion → User korrigiert → System lernt
- Few-Shot Learning: Beste korrigierte Beispiele fliessen automatisch in kuenftige Extraktionen ein
- Auto-Guideline-Generierung: Ab 3 Beispielen werden Extraktionsregeln per LLM abgeleitet
- 4-Schichten-Prompt-Architektur: Base + Felddefinitionen + Gelernte Regeln + Few-Shot Beispiele
- Neues Frontend: Projekt-Grid, Erstellformular, Detailansicht mit 3 Tabs (Training, Regeln, Einstellungen)
- Training-View: Split-View (Dokumenttext links, editierbares Formular rechts)
- REST API: /api/extraction/projects/ (CRUD + Extract + Train + Regenerate)
- Alte Profile/Routes entfernt (backend/src/extraction/profiles.ts, routes/extraction.ts, ExtractionProfilesPage)

### Feature: Dokumenten-Extraktions-Pipeline
- Neue konfigurierbare Pipeline zur strukturierten Datenextraktion aus Dokumenten
- 5-Stufen-Pipeline: Ingest → Resolve → Prepare (Vision) → Extract (Function Calling) → Validate + Retry
- YAML-basierte Extraktionsprofile (data/extraction-profiles/) fuer verschiedene Dokumenttypen
- Function Calling statt Regex-JSON-Parsing fuer zuverlaessige strukturierte Ausgabe
- Automatische Validierung mit Typ-Pruefung, Auto-Korrektur (Datumsformate, Zahlenformate) und Retry
- Vision-Support: Bilder/Scans werden via Vision-LLM zu Text konvertiert, dann extrahiert
- Neues `extract_document` Tool fuer Agents
- REST API: /api/extraction/ (Profile CRUD + Extraktion + Auto-Erkennung)
- Frontend: Extraktion-Seite mit Profil-Verwaltung, JSON-Editor und Test-Werkbank
- LLM-Service erweitert um toolChoice-Parameter fuer forced Function Calling
- Beispielprofil: Lieferschein (Kopfdaten + Positionen)
- KI-Assistent im Editor: Aus einem Beispieldokument automatisch ein Extraktionsprofil generieren lassen

## 2026-03-12

### Fix: Lieferantenmanagement Code Review Findings 9-14
- Input-Validierung fuer alle POST/PUT Endpoints (validation.ts Modul mit 10 Validatoren)
- Konsistentes Error-Logging (console.error in allen catch-Bloecken)
- BIA-Pflichtfelder werden jetzt validiert (sla_relevanz, datenschutz_niveau, vertraulichkeit, kundenbezug, ausschreibungsvolumen)
- Datums-Strings werden via Regex + Date-Parse validiert (YYYY-MM-DD)
- calculateGesamtrisiko Edge-Case dokumentiert (0 aktive Leistungen → default 'low')
- LieferantenConfig.teams Feld im Type ergaenzt

### Feature: Lieferantenmanagement Dokumentenmanagement
- Dokumenten-Upload und -Verwaltung pro Lieferant (Zertifikate, AVVs, NDAs, Audit-Berichte etc.)
- 5 neue API-Endpoints (Upload, Liste, Metadaten, Download, Loeschen)
- Neuer "Dokumente"-Tab in der Lieferanten-Detailansicht mit Typ-Filter
- Upload-Modal mit Drag-and-Drop, Typ-Auswahl und Notizen
- Inline Upload-Buttons in der Regulatorik-Form (AVV, NDA, Rahmenvertrag)
- Changelog-Integration fuer Dokumenten-Upload und -Loeschung
- Max 50 MB, erlaubte Typen: PDF, DOCX, DOC, XLSX, PNG, JPG

## 2026-03-12

### Feature: Lieferantenmanagement App
- Neue App zur Verwaltung von Lieferanten, Risikobewertung und Compliance
- Backend: CRUD fuer Suppliers, Leistungen, Ansprechpartner, Zertifizierungen, Audits
- BIA-Bewertung mit Maximalprinzip (ISMS-SRO konform)
- 5-Phasen-Lifecycle (Vorbereitung bis Beendigung) mit Validierung
- Regulatorik-Tracking (AVV, NDA, Rahmenvertrag) pro Leistung
- DORA-Compliance-Uebersicht
- Auditplan-Generierung basierend auf BIA-Level und Review-Zyklen
- Append-only JSONL Changelog pro Lieferant
- CSV-Export
- Frontend: Sidebar-Navigation (Dashboard, Lieferanten, Risiko, Compliance, DORA, Pruefungen)
- Detail-Seite mit horizontalen Tabs (Stammdaten, Leistungen, Regulatorik, Pruefungen, Lifecycle, Historie)
- Risikomatrix-Visualisierung
- Stats-Dashboard mit ablaufenden Dokumenten
- Team-Zuordnung fuer Leistungen und Audits (konfigurierbar ueber Einstellungen)
- Settings-Sektion: Teams verwalten, BIA-Bewertungskriterien konfigurieren
- Automatische Review-Terminierung basierend auf BIA-Ergebnis (very_high=12 Monate, high=36 Monate)
- Dashboard: Stat-Cards klickbar mit Filter-Navigation, ueberfaellige Reviews hervorgehoben
- Pill-Style Tabs in Detailansicht, Lifecycle als Badge im Header
- Pruefungs-Scope: Neues Feld (Fachpruefung/Compliance-Pruefung) auf Audits
- Scope-Regeln: BIA very_high/high erfordern Fach- + Compliance-Pruefung, medium/low nur Fachpruefung
- Auditplan zeigt erforderliche Scopes pro Leistung basierend auf BIA-Stufe
- Settings: Scopes und Scope-Regeln (Checkbox-Matrix) konfigurierbar
- Auditplan: Dynamische Statusberechnung (offen/teilweise/erledigt) basierend auf tatsaechlich abgeschlossenen Audits
- Auditplan: Erledigte Scopes visuell mit Haekchen markiert
- Auditplan: Jahresnavigation - Plaene fuer beliebige Jahre anzeigen und generieren (Pfeil-Buttons + "Heute"-Shortcut)
- Auditplan: CSV-Export pro Jahr (Lieferant, Leistung, BIA-Stufe, erforderliche/erledigte Pruefungen, Status)
- Auditplan: Klickbare Scope-Icons — ohne Pruefung: vorausgefuellte Anlage-Maske, mit Pruefung: Navigation zum Lieferanten-Tab
- Regulatorik: Toggle-Switches statt Checkboxen (wie LLM-Modell-Verwaltung)
- Regulatorik: DORA-konform von Checkbox zu Auswahl (Ja/Nein/Nicht anwendbar), rueckwaertskompatibel mit alten boolean-Werten
- DORA-Tab: Bugfix Property-Pfad (rahmenvertrag_dora_konform → rahmenvertrag.dora_konform), N/A-Status angezeigt

## 2026-03-06

### Feature: Task-Progress-Card im Chat bei Background-Tasks
- Auto-Background-Tasks (Supervisor → Researcher Delegation) emittieren jetzt ein `task_created` SSE-Event
- Frontend zeigt nun die TaskStatusBlock-Card mit Spinner und Fortschritt direkt im Chat
- Keine Frontend-Aenderung noetig — nur fehlender Event-Push im Backend ergaenzt

### Bugfix: 400 LLM API Fehler bei Deep Research
- Root Cause: Web-Fetch-Inhalte mit Control Characters und Lone Surrogates brechen den JSON-Parser der API
- Content-Sanitization in `web-fetch.ts`: Entfernt Control Characters und invalide Unicode-Zeichen
- Message-Sanitization im OpenAI-Adapter: Alle Messages werden vor dem API-Call bereinigt
- Context-Window-Management: Alte Tool-Ergebnisse werden auf 2000 Zeichen gekuerzt (letzte 6 Messages bleiben voll)
- Synthese-Messages werden aggressiver auf 1000 Zeichen gekuerzt (Ergebnisse stehen im Scratchpad)

### Bugfix: Background-Tasks nicht in der UI sichtbar
- Root Cause: `userId` wurde beim Erstellen von Background-Tasks nicht mitgegeben
- Tasks ohne `userId` werden durch den User-Filter in der API ausgeblendet
- Fix: `userId` wird jetzt im `createTask`-Aufruf der Auto-Background-Logik uebergeben

## 2026-03-05

### Deep Research Agent — Grundlegender Redesign
- Per-Agent `maxIterations` Konfiguration (Frontmatter-Feld, Default bleibt 10)
- Researcher Agent: 30 Iterationen, 4-Phasen-Workflow (Planung → Recherche → Reflexion → Synthese)
- Scratchpad-Pattern: Agent schreibt Zwischenergebnisse in `results/research-scratchpad.md`
- Explizite Mandates fuer `web_fetch` Nutzung (Qwen3-optimiert: "DU MUSST", Minimum-Budgets)
- Reflexions-Phase vor Synthese zur Lueckenanalyse und Widerspruchspruefung
- `parseFrontmatter` unterstuetzt jetzt numerische Werte (fuer maxIterations)
- `file_write` Tool: Neuer `append: true` Parameter zum Anhaengen an bestehende Dateien
- Researcher Scratchpad-Fix: Erkenntnisse werden per `append` laufend ins Scratchpad geschrieben
- Dynamische Scratchpad-Dateinamen: `results/research-<thema>.md` statt fixer Dateiname
- Deep Research laeuft automatisch als Background-Task: Delegation an Agents mit hohem `maxIterations` erstellt automatisch einen Task statt synchron zu blockieren
- `runAgentLoop` respektiert jetzt agent-spezifische `maxIterations` (wichtig fuer Task-Executor)
- `extractJsonToolCalls` erkennt jetzt auch `create_task`-Argumente im Text (Pattern 4)

### Web Fetch Tool fuer Deep Research
- Neues `web_fetch` Tool: Liest Webseiten und konvertiert HTML zu lesbarem Text
- Researcher Agent kann jetzt gefundene URLs tatsaechlich lesen statt nur Snippets
- SSRF-Schutz, 15s Timeout, Content-Limit (15K/30K Zeichen) integriert

### Bugfix: Delegierte Agenten verlieren Antwort ("without response")
- Root Cause: MAX_ITERATIONS=5 zu niedrig — Agent verbraucht alle Iterationen fuer Tool-Calls, keine uebrig fuer Synthese
- Delegierte Agents haben jetzt 10 Iterationen (statt 5)
- Fallback: Wenn Loop ohne Ergebnis endet, wird eine Synthese-Iteration ohne Tools erzwungen
- Exit-Condition Fix: `finishReason=stop` bricht nicht mehr ab wenn extracted Tool-Calls vorhanden

### Bugfix: Delegierte Agenten streifen jetzt Think-Bloecke
- `<think>`-Tags von Qwen3/DeepSeek in delegierten Agenten werden nun korrekt herausgefiltert
- Verhindert aufgeblaehte Message-History und API-Parser-Fehler (400 "Unterminated string")
- Debug-Logging bei 400-Fehlern zeigt jetzt Body-Groesse und Message-Details

### Bugfix: Doppelte Skill-Instruktionen in Message-History
- Nach `load_skill` wurden die Skill-Anweisungen doppelt gesendet: im System-Prompt UND im Tool-Result
- Bei grossen Skills (z.B. Arbeitsvertrag ~13KB) fuehrte das zu ~38KB Body-Groesse und 400-Fehlern
- Tool-Result wird jetzt nach Extraktion der Instruktionen gekuerzt (Platzhalter statt voller Text)
- Fix gilt fuer Haupt-Loop und Delegated-Agent-Loop

## 2026-03-02

### Agent Aktiv/Inaktiv-Steuerung
- Neues `active`-Feld in der Agent-Konfiguration (Default: true)
- Inaktive Agenten werden aus Chat-Auswahl und Delegation ausgeblendet
- In der Admin-Ansicht bleiben inaktive Agenten sichtbar mit "Inaktiv"-Badge
- Toggle in der Agent-Detailansicht unter "Verfügbarkeit"

### Skill-Deaktivierung (skillMode: none)
- Dritte Option "Keine Skills" im Skill-Zugriff-Dropdown
- Agent kann bei `skillMode: none` keine Skills nutzen und `load_skill` wird abgelehnt

### Bugfix: skillMode/skills korrekt speichern
- `skillMode` und `skills` werden jetzt in POST/PUT API-Routes korrekt durchgereicht

## 2026-02-28

### Agent Log Observability
- Neues Agent-Log-Panel zur Echtzeit-Beobachtung der Agent-Aktivitaeten
- Audit-Logging fuer Agent-Aktionen
