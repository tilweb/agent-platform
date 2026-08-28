# Changelog

## 2026-08-28

### Projektmanagement: Step-Headlines ohne Nummern + fehlende Tab-Headlines im Portfolio-Detail
Nachdem die Tab-Leisten in Projektauftrag und Statusbericht von Nummerierung auf Icons umgestellt
wurden, standen die Nummern noch in den Headlines der Projektauftrag-Steps („1. Basisdaten" …
„9. Historischer Vergleich") — entfernt (inkl. der Default-Titel der geteilten Komponenten
Personen/Ziele/Risiken). Im Portfolio-Detail fehlte bei mehreren Tabs die Headline komplett:
Übersicht, Basis, Roadmap, Kosten und Risiken haben jetzt eine Kopfzeile (Titel + Untertitel) im
gleichen Stil wie die Step-Headlines; Personen und Ziele hatten sie bereits über die geteilten
Step-Komponenten.

## 2026-08-26

### Agent-Loop: Iterations-Budgets angehoben + Synthese-Fallback statt hartem Error
Nutzer stießen auch bei klaren Abläufen an „Maximum iterations reached" — ein Ablauf
„KB durchsuchen → eingrenzen → Dokument lesen → analysieren" ist schon 3–4 Züge, und ein einzelner
behebbarer Tool-Fehler (z.B. `kb_search` ohne `collection_id`) kippte das enge Default-Budget von 5.
- **Defaults angehoben**: direkter Agent 5→**12**, delegiert 10→**20**, Supervisor 15→**25**; zusätzlich
  per ENV tunebar (`AGENT_MAX_ITERATIONS` / `_DELEGATED_` / `_SUPERVISOR_`, leer/0 = Default). Ein Agent
  kann sein Budget weiterhin per `maxIterations`-Frontmatter überschreiben.
- **Synthese-Fallback im Main-Loop**: Erreicht ein direkter Agent das Limit, brach der Loop bisher hart
  mit `error: Maximum iterations reached` ab — anders als der delegierte Loop, der längst einen
  Synthese-Aufruf macht. Der Main-Loop spiegelt dieses Verhalten jetzt: ein Aufruf ohne Tools erzeugt
  eine Best-Effort-Endantwort aus dem bereits Gesammelten (streamt normal, mit Hinweis auf das
  Schritt-Budget); nur wenn auch das leer bleibt, kommt der Error als letztes Mittel.
- Der konkret betroffene Agent „HR - Bewerbungsanalyse" hatte kein eigenes Budget (stoppte exakt bei 5)
  → durch den neuen Default 12 automatisch abgedeckt.

### LLM-Adapter: Retry auf transiente Server-Fehler (500/502/504)
Der Adacor-Embeddings-Endpunkt liefert sporadische 500er (gemessen ~1/20), obwohl der direkte
Folgeversuch sofort erfolgreich ist — ein einzelner Blip riss bisher einen ganzen WZ-Branchen-Lauf
oder eine KB-Indizierung ab, weil `isRetryable` im OpenAI-Adapter nur 429/503 wiederholte. Jetzt
werden auch 500/502/504 mit Backoff wiederholt (bestehende Retry-Schleifen + `MAX_RETRIES`). Live
verifiziert: 20× Embed über den Service = 20/20 erfolgreich, der eine 500-Blip wurde transparent
abgefangen. Der Fehler selbst ist Adacor-seitige Instabilität, kein Code-/Config-Fehler bei uns.

## 2026-08-22

### Übersichtsseiten: Kachel-Redesign auf Skills, Knowledge Base & Tabellen ausgerollt
Nach dem Agenten-Piloten dasselbe Scaffold (PageHeader · Suche · GroupTabs · kompakte `ResourceCard` · Hilfe-Panel)
auf die drei übrigen Übersichtsseiten angewendet:
- **Skills**: Gruppen-Tabs Alle · Custom · System, kompakte Kacheln (Icon · Name · `id`+Version · 2-Zeilen-Text ·
  Badges Workflow/Template/Deaktiviert/System, Edit nur bei Custom). Interne Hinweise (YAML-Pfade) durch
  kundengerechten Hilfe-Text ersetzt.
- **Knowledge Base**: Gruppen-Tabs Alle · Eigene · Geteilt · Gesperrt, kompakte Kacheln (Doc-Anzahl als Meta,
  Rollen-Badge nur bei geteilten, gesperrt ausgegraut). Create-Form unverändert.
- **Tabellen**: Suche + kompakte Kacheln (Icon · Name · „N Spalten · M Zeilen"); keine Gruppen (kein Ownership im
  Backend), Vorlagen weiter über den bestehenden Button.
- Einheitliche Empty-States, konsistentes Grid `minmax(280px)`. Detail-/Editor-Ansichten unverändert.

### Übersichtsseiten: Kachel-Redesign — geteiltes Scaffold + Agenten-Pilot
Erster Schritt zu einem einheitlichen, kompakten Kacheldesign für die Übersichtsseiten (Agenten, Skills,
Knowledge Base, Tabellen), die bisher riesige, uneinheitliche Kacheln und kaum Überblick hatten.
- **Neue geteilte Komponenten** in `frontend/src/components/overview/`: `PageHeader`, `SearchInput`,
  `GroupTabs` (Pill-Tabs mit Zählern), `ResourceCard`/`CardGrid`, `Badge`, `EmptyState`, `HelpPanel` +
  `grouping.js` (`deriveAccessGroups`/`filterBySearch`/`sortByName`). Bisher rollte jede Seite Card/Tabs/Suche
  inline — jetzt ein wiederverwendbares Scaffold.
- **Agenten-Seite als Referenz umgestellt**: Suche + Gruppen-Tabs (Alle · Eigene · Geteilt · Gesperrt · System
  mit Zählern) + kompakte Kacheln (Icon · Name · 2-Zeilen-Beschreibung · Status-Badges). Rollen-Badge nur bei
  **geteilten** Agenten (nicht redundant „Owner" auf jeder eigenen Kachel), keine Fähigkeiten-Zahl mehr.
  `?`-Hilfe-Panel (erklärt Agenten + die Gruppen) und **Tool-Katalog**-Einstieg (→ `/tools`). Editor/Detail
  unverändert. Skills, Knowledge Base und Tabellen folgen im gleichen Muster.

## 2026-08-21

### Chat: UX — Auto-Scroll folgt nur noch, wenn man unten ist (kein Zucken bei Tool-Calls)
Während Tool-Call-Bursts (Agent arbeitet, keine sichtbare Ausgabe) riss der Chat den Screen bei jeder
Aktivitätszeile hart nach unten (`scrollIntoView({behavior:'smooth'})` bei jeder `agentStatus`-Änderung) —
man konnte nicht hochscrollen und der Screen zuckte. Jetzt „stick to bottom": Die Ansicht folgt neuem Inhalt
nur, wenn man bereits nahe am unteren Rand ist; scrollt man hoch, bleibt die Position erhalten. Scroll ist
instant (kein Smooth-Restart je Zeile), beim eigenen Senden wird wieder ans Ende gepinnt. (`ChatWindow.jsx`.)

### KB-Upload: Fix — ENOENT beim Datei-Upload auf frischen Instanzen
Der Upload in eine Collection (`POST /knowledge/index`) schrieb die Datei nach
`data/knowledge-base/incoming/`, legte den Ordner aber nie an. Auf frisch deployten/ephemeren
Instanzen (z.B. Scalingo) existiert er nicht → `ENOENT: … open '…/incoming/<datei>.pdf'`. Behoben durch
`mkdir(.../incoming, { recursive: true })` vor dem Schreiben (analog `documentImporter.saveToIncoming`).
Wirkt erst nach Deploy auf die betroffene Instanz.

## 2026-08-15

### PM: Fix — Kapazitäts-Panel im Projektauftrag sprengte die Personen-Card
Die Monats-Tabelle im ausklappbaren Kapazitäts-Panel lief über den Card-Rand hinaus. Ursache: das
Flex-Content-Element hatte kein `min-width: 0`, wodurch es auf Tabellenbreite wuchs statt den vorhandenen
`overflow-x:auto`-Scroll zu nutzen. Behoben durch `minWidth: 0` an `itemContent` (`Personen.jsx`).

### PM: Kapazitätsplanung — Auslastungs-/Engpassansicht im Tab (pro MA ausklappbar)
Die Ressourcen- & Engpassansicht (wie im Portfolio) gibt es jetzt auch im Kapazitätsplanung-Tab selbst —
Sub-Tab „Auslastung & Engpässe" neben „Personen".
- **Heatmap über alle Personen × Monat**: Gesamt-Auslastung je Monat getönt (grün ≤85 % · gelb 85–100 % ·
  rot >100 %). Personen ohne Projektlink erscheinen ebenfalls (Linie-only).
- **Pro MA ausklappbar**: zeigt die Zusammensetzung je Monat — **Kapazität · Linie · Projekte
  (genehmigt/laufend) · Projektanfragen (Entwürfe) · frei**.
- **Szenario-Umschalter** „nur genehmigt/laufend" vs. „inkl. Projektanfragen".
- **Neuer Aggregat-Endpoint** `GET /kapazitaeten/auslastung` (`getKapazitaetOverview`): lädt die Aufträge
  **einmal** und verteilt den Bedarf je `person_id` (effizienter als N× `getPersonAuslastung`), RBAC-gefiltert.
- Frontend: `KapazitaetAuslastungView` + Sub-Tab in `KapazitaetsplanungView` + Hook `getKapazitaetOverview`.

### PM: Kapazitätsplanung — UX-Feinschliff (Name-Placeholder + frische Personenliste)
- **Neue Person**: das Namensfeld startet leer mit Placeholder „Name der Person" (statt vorbelegtem
  „Neue Person", das erst gelöscht werden musste).
- **Person-Zuordnung im Projektauftrag**: die Auswahl der zentralen Kapazitätspersonen wird jetzt beim
  Aufklappen des Panels frisch geladen — parallel (z.B. im Kapazitätsplanung-Tab) angelegte Personen erscheinen
  sofort, ohne den Auftrag erst speichern/neu laden zu müssen.

### PM: Kapazitätsplanung — Phase 3 (Ressourcen-Heatmap im Portfolio)
Abschluss: die geplante Ressourcen- & Engpassansicht im Portfolio-Dashboard ist jetzt live (ersetzt den
Platzhalter in Kachel 6).
- **Heatmap Rollen/Personen × Monat**: Zeilen umschaltbar **Rollen (aggregiert) ↔ Personen**, Spalten = Monate
  über den Portfolio-Zeitraum. Zellen getönt nach **Auslastung%** = (Linie + Projektbedarf) / Kapazität:
  grün ≤85 %, gelb 85–100 %, **rot >100 % (Engpass)**; Tooltip mit Kapazität/Linie/Bedarf.
- **Szenario-Umschalter**: „nur genehmigt/laufend" vs. „inkl. Entwürfe" (draft-Aufträge) — zeigt den Effekt
  geplanter Projekte auf die Auslastung.
- **Neuer Aggregat-Endpoint** `GET /portfolios/:id/capacity` (`getPortfolioCapacity`): sammelt die im Portfolio
  verknüpften Kapazitätspersonen und ihre **Gesamt-Auslastung** (Linie + alle verknüpften Projekte,
  **portfolioübergreifend** — echte Engpässe sichtbar), Rollen-Aggregat serverseitig, RBAC wie Dashboard.
- Frontend: `PortfolioCapacityHeatmap` + Hook `getPortfolioCapacity`. Beide Worktrees.

### PM: Kapazitätsplanung — Phase 2 (Auftrag-Verknüpfung + Projekt-Bedarf)
Zweiter Baustein: im Projektauftrag pro Teammitglied die Kapazität planen und die projekt­übergreifende
Belegung sehen.
- **Personen-Schritt im Auftrag** (`showKapazitaet`): je Teammitglied ein **ausklappbares Panel** —
  Verknüpfung mit einer zentralen Kapazitätsperson (`person_id`) + gewünschter **Projekt-Bedarf in PT/Monat**
  (Ø + Monats-Overrides über den Auftrags-Zeitraum). `TeamMember` um `person_id`/`projekt_bedarf` erweitert
  (migrationsfrei im `data`-JSONB).
- **Read-only-Belegungssicht** je Monat: Linie, Bedarf aus **anderen genehmigten/laufenden** Projekten
  (Split nach `status`: `draft` = Entwurf) und „verbleibend frei" — inkl. Rot-Markierung bei Engpass.
- **Neuer Aggregat-Endpoint** `GET /kapazitaeten/personen/:id/auslastung` (`kapazitaet-service.ts`):
  summiert Linie + Projektbedarf über **alle** verknüpften Aufträge, RBAC-gefiltert
  (`getEffectiveAuftragRole`), aktuellen Auftrag optional ausgeschlossen (`exclude`).
- Frontend: `AuftragKapazitaetPanel` + Verdrahtung in `Personen`/`WizardPage` + Hook `getPersonAuslastung`.
  Beide Worktrees (main Drizzle / railway YAML, signaturgleich; Frontend byte-identisch).
- Basis für Phase 3 (Portfolio-Heatmap).

### PM: Kapazitätsplanung — Phase 1 (Haupt-Tab + zentrale Personen-Entität)
Erster Baustein der Kapazitätsplanung (Ziel: Ressourcen-Heatmap im Portfolio):
- **Neuer Haupt-Tab „Kapazitätsplanung"** (neben Portfolios, `?tab=kapazitaeten`): zentrale, projekt­übergreifende
  Personen mit Rolle, **Wochenarbeitszeit %** und **Linien-Belegung** (Ø PT/Monat + Monats-Overrides). Live
  abgeleitet: **Kapazität/Monat = 17 × WAZ%/100** und „frei für Projekte" je Monat.
- **Neue Entität `paPersonen`** — main: Drizzle-Tabelle + handgeschriebene Migration `0033_kapazitaet_personen.sql`
  (+ Journal-Eintrag); railway: YAML unter `data/apps/projektmanagement/personen/{id}/metadata.yaml`.
  `kapazitaet-storage.ts` (signaturgleich DB↔YAML) + `routes/kapazitaeten.ts` (CRUD, App-Editor+ für Schreiben).
- Frontend: `KapazitaetsplanungView` + Tab in `ProjektePage` + 4 Hook-Methoden. Beide Worktrees.
- Basis für Phase 2 (Auftrag-Verknüpfung + Monats-Bedarf) und Phase 3 (Portfolio-Heatmap).

## 2026-08-08

### Document Processing: Segment-Editor in der Maske (statt nur Import/API)
Segmente ließen sich bisher nur per Profil-Import oder API pflegen — jetzt gibt es einen echten
Editor in den Profil-Einstellungen:
- **Neuer `SegmentsEditor`**: Segmenttypen hinzufügen/entfernen, je Typ Bezeichnung · ID (auto aus
  Bezeichnung, klein-alphanumerisch mit Bindestrichen) · Beschreibung (steuert die Seiten-Zuordnung,
  Pflicht ≥20 Zeichen) · Modus (Felder auslesen / nur erkennen) · „mehrfach möglich" · „Pflicht"; bei
  Modus „auslesen" ein eingebetteter Feld-Editor je Segment.
- **Feld-Editor als wiederverwendbare Komponente** `FieldsEditor` extrahiert (vorher 2× inline
  dupliziert) — genutzt für Profil-Felder und Segment-Felder; geteilte `fieldsArrayToObject`-Umwandlung.
- **Client-Validierung** spiegelt das Backend (`validators.ts`): ID-Regex, Builtin-Kollision
  (`leerseite`/`unbekannt`), Doppel-IDs, Beschreibung ≥20 Zeichen, classify-only ohne Felder,
  Listen brauchen eine Positions-Spalte.
- **Speichern**: `segments` wird jetzt im PUT-Payload mitgesendet (vorher nie) — Objekt bei
  vorhandenen Segmenten, `null` löscht, weggelassen = unberührt.
- **Backend-Bugfix**: Die PUT-Route wandelte `segments: null` in `undefined` um, wodurch
  `updateProject` (filtert nur `undefined`) die Segmente NICHT löschte — obwohl der Kommentar das
  versprach. `null` wird jetzt durchgereicht und löscht wie dokumentiert (beide Worktrees).
- Die read-only Segment-Übersicht in den Einstellungen ist durch den Editor ersetzt.

### Document Processing: UX-Hinweise & Onboarding (Verständlichkeit für Fachanwender)
UX-Audit aller Screens (Verarbeiten/Review, Einrichtung, Posteingang, Anlage) und gezielte
Erklärungstexte an den laienkritischen Stellen — nur Texte/Tooltips, keine Logikänderung:
- **Konfidenz & Farben & Status erklärt:** Legende über der Ergebnis-Tabelle („Ø" = Erkennungssicherheit,
  orange = unter Prüfschwelle), Tooltips an den Spaltenköpfen „Prüfung"/„Ø" und an den Filter-Chips
  (Auto-OK/Zu prüfen/Geprüft), Tooltip an den Feld-Konfidenzen im Review.
- **Ansehen vs. Speichern:** Review-Button erklärt per Tooltip, dass „Lernen" die KI verbessert und
  ungespeicherte Änderungen beim Blättern/Schließen verloren gehen; „● ungespeichert"-Indikator bei
  Änderungen; Onboarding-Zeile im Review („links Original, rechts Werte, orange zuerst prüfen").
- **Strategie-Auswahl:** Hilfetext unter beiden Strategie-Dropdowns (wann Hybrid/Vision-per-Page/
  Long-Text/Single-Pass) — vorher ohne jede Erklärung.
- **Erstkontakt:** Übersicht mit InfoBox („Profil"/„Felder" definiert, Verarbeiten vs. Posteingang
  gegenübergestellt), ausgebauter Empty-State mit CTA + Beispieldokument-Tipp, Tooltips an den Buttons
  Posteingang/Importieren; Posteingang-Leerzustand erklärt Teil-Dokument/zuzuordnen/Auto-Routing.
- **Feinschliff:** ◉-Symbol-Tooltip (Fundstelle), „(korrigiert)" jetzt blau statt orange (keine
  Verwechslung mit „unsicher"), Toleranz-Einheit erklärt, „Pipeline-Schwelle"→„Systemvorgabe",
  „Few-Shot"→„Beispielvorlage", Webhook „nur nötig wenn…/sonst leer lassen", Export nennt jetzt was
  NICHT enthalten ist (Webhook), Training-Tab-Einstieg mit Ablauf-InfoBox, read-only Segment-Übersicht
  in den Einstellungen (inkl. Hinweis, dass Segmente per Import/API gepflegt werden).

### Security: Code-Review Document Processing — behobene Befunde
Umfassende Code-Review der Extraction-/Document-Processing-Strecke
(`docs/code-review-document-processing-2026-08-08.md`), kritische Befunde direkt behoben:
- **[P0] Authentifizierung:** Die gesamte Document-Processing-Flaeche
  (`/api/extraction/projects/*`, `/api/extraction/inbox/*`) lag OHNE Session-Pruefung offen
  (unauth. Zugriff auf Profile, Batch-Upload und extrahierte Kunden-PII) — die Router hatten,
  anders als das Repo-Muster (routes/agents.ts), keine `authMiddleware`. Behoben:
  `extractionProjectRoutes.use('/*', authMiddleware)` + gleiches fuer den Posteingang. Live
  verifiziert: beide Praefixe liefern jetzt 401 ohne Cookie.
- **[P1] SSRF ueber Webhook-Ziel:** `isDeliverableUrl` pruefte nur das Protokoll. Jetzt Block
  interner Ziele (localhost/.local/.internal + IP-Literale) synchron bei der Konfiguration und
  zusaetzlich DNS-Aufloesung zur Zustell-Zeit (Hostnamen, die auf private IPs / 169.254.169.254
  zeigen). Bewusstes Opt-in `WEBHOOK_ALLOW_INTERNAL=1` fuer interne Consumer.
- **[P1] Batch-Upload ohne Limits:** `POST /projects/:id/batches` erzwingt jetzt max. 50 Dateien,
  50 MB je Datei, 200 MB gesamt (413) — vorher unbegrenzt und komplett im RAM.
- **[P2] Temp-Leak:** Der Sammelordner `/tmp/extraction-batch/<lauf>` wird nach dem Lauf
  rekursiv entfernt (vorher blieben leere Verzeichnisse liegen).
- Neue SSRF-Testfaelle in `webhook.test.ts` (privater IP-Erkenner, Block interner Ziele).

### Code-Review Document Processing — Folge-Befunde (#5/#6/#8)
Zweite Runde der Code-Review-Umsetzung:
- **[#5] Verwaiste Batch-Laeufe:** Ein fire-and-forget-Lauf blieb bei Prozess-Crash/Deploy fuer
  immer auf `processing` stehen (Frontend pollt endlos). Neue `recoverStaleRuns()` setzt beim
  Backend-Start alle `pending`/`processing`-Laeufe (+ deren offene Dateien) auf `failed` —
  eingehaengt in den Startup neben `recoverTasks` (beide Worktrees: Postgres- und YAML-Variante).
- **[#6] Triage-Loch bei Segment-Listen:** `resolveSegmentValue` (Review-Triage) fing per Regex nur
  EINE Klammer → verschachtelte Listen-Positionen (`rezept[1].positionen[0].menge`) blieben
  unaufloesbar, unsichere Positionszeilen in Segment-Profilen loesten NIE ein Review aus. Ersetzt
  durch einen Pfad-Walker (Segment-Instanz 1-basiert, Listenzeile 0-basiert); 4 neue Tests.
- **[#8] Temp-Namen:** `Math.random()`/`Date.now()` fuer Temp-Verzeichnisse/-Dateien durch
  `crypto.randomUUID()` ersetzt (kollisionssicher unter Last).
- Nebenbefund (railway-Variante): `getBatchRunFileDetail` gab `segments` nicht zurueck (Typluecke) —
  der Segment-Review-Detail-Endpunkt lieferte dort keine Segmente; behoben.

### Document Processing: Segment-Review zeigt Positionszeilen mit Fundstellen (#6 Frontend)
Nachzug zum Triage-Fix: `SegmentReviewPane` rendert Listenfelder eines Segments jetzt als
Positions-Tabelle (statt als JSON-Wert-Blob). `ListItemsEditor` (read-only) wurde additiv um
Zellen-Konfidenz und Box-Sprung erweitert — pro Positionszelle wird die Konfidenz (Warnfarbe
unter Schwelle) und, sofern eine Fundstelle vorliegt, ein klickbarer Sprung ins Dokument
angezeigt (`keyPrefix` loest `key.fid[zeile].feld` auf; die Zeilen-Boxen lagen bereits vor).
Damit ist Code-Review-Befund #6 vollstaendig geschlossen.

### Bugfix: Profil-Export/Import kannte die W10-Segmente nicht
Beim Pruefen der Weitergabe-Funktion (Anlass: Sani-Rezepte-Profil fuer weitere Kunden) fielen
zwei Luecken auf: Das Transfer-Paket (Welle 5) exportierte `segments` nicht — ein Segment-Profil
haette beim Transfer STILL seine Segmentdefinition verloren — und die Import-Validierung lehnte
Segment-Profile ab ("Paket enthaelt keine Felder"), weil deren Felder in den Segmenten leben.
Beides behoben (additiv-optional, alte Pakete bleiben gueltig, Paket-Version unveraendert);
Roundtrip fuer beide Profiltypen verifiziert (Segmente und Felder identisch nach Export→Import).

### Segmentierung (W10.4): Segment-Export + Webhook
- **XLSX fuer Segment-Profile:** flach = eine Zeile je Segment-Instanz (Segment/Instanz/Seiten/
  Konfidenz/Beleg + Union der Segment-Felder; classify-only und `unbekannt` bekommen bewusst
  eigene Zeilen), gruppiert = Hauptblatt-Zusammenfassung + Segmente-Blatt. Route und Public-API
  (batch.export) erben ueber den gemeinsamen Baustein export-xlsx.ts.
- **Webhook:** segments[] je Datei additiv im Payload.
- Verifiziert am Demo-Lauf (8 Zeilen, Datum nur in der Formular-Zeile, XLSX real gelesen);
  2 neue Tests (293 gruen). Segmentlose Profile unveraendert.

### Segmentierung (W10.3): Segment-Gliederung im Vollbild-Review
- **Review:** Miniaturen mit farbigen Segment-Markern (Farbe je Typ, Tooltip mit Label+Instanz);
  rechte Spalte als Gliederung — Segment-Ueberschriften (Klick springt zur Seite) mit Konfidenz,
  Felder mit Fundstellen-Sprung, classify-only als Beleg-Kachel, `unbekannt` rot. Ergebnistabelle:
  Segmente-Spalte bei Segment-Profilen. Segmentlose Profile unveraendert.
- **Demo-Lauf** (lokal, `segment-demo-formularpaket`): voller Batch-Pfad liefert 8/8 Segmente
  exakt — die vier Einwilligungen desselben Ausstellers werden mit der W10.2-Prompt-Fassung
  sauber getrennt; Triage legt die einzige echte Unsicherheit (unterschrieben, 0.3) zur Pruefung vor.
- **Bewusst verschoben:** Grenz-/Typkorrektur + Lern-Signal brauchen gespeicherte Originale am
  Lauf (heute existieren nach dem Lauf nur gerenderte Seiten) — Speicher-Entscheidung ist
  dokumentierte Voraussetzung, der Hinweis steht sichtbar im Review.

### Segmentierung (W10.2): gescopte Extraktion je Segment + Neustart-Tuning
- **Gescopte Extraktion:** Profile mit `segments` extrahieren jetzt JE Segment ueber die
  bestehende Pipeline (Sub-PDF via buildPartPdf + Sub-Schema des Typs) — Merger, OCR-Fusion,
  Boxen, Kataloge gelten je Segment unveraendert, kein neuer Extraktionscode. classify-only-
  Segmente bekommen einen Kurzbeleg ohne Modellaufruf. Aggregation: data.<segId> (repeatable als
  Array), Konfidenzen/Boxen namespaced, Box-Seiten absolut. Persistenz (batch_run_files.segments),
  Public-API additiv, Review-Triage prueft namespaced Konfidenzen.
- **E2E bewiesen** am unterschriebenen Formular-Scan: handschriftliches Datum aus dem Formular-
  Segment extrahiert (Box auf absoluter Seite), classify-only-Instanzen, auto_ok. Ehinger-
  Stichprobe: segmentloser Pfad unveraendert.
- **Neustart-Tuning mit ehrlichem Protokoll** (3 Messlaeufe ueber alle 18 Dokumente): die naive
  Schaerfung "Aussteller-Wechsel ⇒ Neustart" verklebte Instanzen DESSELBEN Ausstellers
  (77/93 exakt, Recall -2,7pp); die ausstellerunabhaengige Fassung (eigene Titel-Ueberschrift,
  Zaehlungs-Neustart, sichtbarer Abschluss) bringt **80/93 exakt** (+8 auf ±1 Seite), Grenzen
  93,4/94,7 %, 12 von 18 Dokumenten perfekt. Protokoll im Konzept §12.

### Segmentierung (W10.1): Datenmodell + Segmentierer — Vorgang → Segmente
Erste Umsetzungswelle des Segmentierungs-Konzepts (Reducto-Ansatz, Konzept §3-4):
- **Datenmodell:** `segments` am Profil (SegmentTypeDef: Prosa-Beschreibung, Feldsatz,
  classify-only, repeatable, required) + `segments` am Batch-Ergebnis (SegmentInstance[]),
  Migration 0032, Validator (validateProjectSegments), POST/PUT-Routen. Eingebaute Typen
  `leerseite` und `unbekannt`. Kein `segments` = heutiges Verhalten, keine Migration noetig.
- **Segmentierer** (extraction/segmentation/segmenter.ts): Seiten-Klassifikation je Seite
  (Vision, 150 dpi, guided_json mit enum-Typ + Neustart-Marker + Konfidenz, Modellbindung,
  45s-Abort) + deterministische Grenzbildung: Typwechsel ⇒ Grenze, Neustart trennt Instanzen
  desselben repeatable-Typs, Leerseiten trennen ohne Alarm, `unbekannt` und fehlende
  Pflicht-Segmente werden Befunde, Glaettung nur bei niedriger Konfidenz UND gleichem
  Nachbartyp beidseits (Einseiter sind der Normalfall — Evaluations-Erkenntnis).
- **Pilot-Werkzeug** tools/segment-pilot/ mit 10 Familien-Profilen (profiles.json, generisch,
  ohne Personendaten); Ground Truth, Mapping und Messergebnisse bleiben per .gitignore lokal
  (personenbezogene Beispiel-Dokumente — bewusste Entscheidung).
- **Messlauf ueber alle 18 Beispiel-Dokumente (179 Seiten):** Seitentyp-Accuracy 95,5 %,
  Grenzen 92,2 % Precision / 94,7 % Recall, 78/93 Segmente exakt (+8 auf ±1 Seite), 0 Fehlalarme.
  Beide Negativfaelle korrekt, Messpaar born-digital ↔ Scan identisch 8/8. Die 15 Abweichungen
  sind zwei benennbare Fehlerklassen (Neustart-Recall bei gleichen Typen; semantische
  Hybrid-Seiten) — Arbeitsliste fuer W10.2. Ergebnis im Konzept §11.
- 10 neue Unit-Tests fuer die Grenzbildung (291 gruen; Railway-Variante speichert Profile als YAML — segments laeuft dort ohne Migration mit).

### Segmentierung (W10.0): 18 Beispiel-Dokumente evaluiert — Ground Truth steht
Alle 18 PDFs aus docs/SplitDocuments Seite fuer Seite visuell gesichtet und gelabelt:
**179 Seiten, 93 Segmente, 20 Typen** (tools/segment-pilot/groundtruth/documents.json,
lueckenlos validiert; Auswertung in Konzept §10). Fuenf Dokumentfamilien: Bewerbungsmappen,
Versicherungs-/Rechnungspakete, Formular-Pakete (inkl. Messpaar born-digital ↔ unterschriebener
Scan), Geschaefts-/Behoerdendokumente, bewusste Negativ-/Grenzfaelle (13-seitiger Lebenslauf =
EIN Segment; Ausweiskopie Vorder-/Rueckseite = ein Nachweis). Beobachtete Grenzsignale
(Briefkopf-Wechsel, Neustart interner Seitennummerierung, Formatwechsel, Trennblaetter,
Quasi-Leerseiten) fliessen als Prior in die Typbeschreibungen. Zwei Konsequenzen fuer W10.1:
Leerseite/Trennblatt als eingebauter Typ; Glaettung darf Einseiter nicht pauschal verdaechtigen
(57 der 93 Segmente sind einseitig). Damit kann W10.1 starten.

### Konzept: Segmentierung — Vorgang → Segmente → Felder (Welle 10)
Fachkonzept fuer typisierte Segmente innerhalb EINES Vorgangs
(docs/document-processing-segmentierung-konzept-2026-08-08.md), Anlass: Kundenfall
Stadtverwaltung (Anschreiben + Formular + Nachweis in einem Scan) und Reducto Split als
Marktreferenz. Kernpunkte:
- Das heutige Modell kennt nur "trennen in unabhaengige Dokumente" (Posteingang) oder "ein
  monolithisches Dokument = ein Profil" — der Fall braucht das Dritte: zusammenhalten UND
  unterscheiden. Nebenbefund: der Merger mischt heute Seiten verschiedener Natur
  (first-non-null greift Werte vom falschen Teil) — Segment-Scoping macht das strukturell
  unmoeglich.
- Zielmodell: `segments` am Profil (Prosa-Beschreibung + Feldsatz je Typ, classify-only fuer
  Nachweise, repeatable, required), Segment-Instanzen am Lauf-Ergebnis, Seiten-Klassifikation
  statt Paar-Urteil (guided_json, 150 dpi — Klassifikation vertraegt das, Feld-Extraktion nicht),
  gescopte Extraktion je Segment ueber die BESTEHENDE Pipeline (pageSelection + Sub-Schema).
- Bestehende Profile sind der Sonderfall "ein Segmenttyp" — keine Migration. Umsetzungsplan
  W10.1-W10.5 mit Messplan; Pilot wartet auf Beispiel-Scans des Kunden.

### Welle 9: Kosten & Robustheit — DPI gemessen (200 bleibt), async-OCR, echte Timeouts
- **DPI-Messung entschieden:** Kompletter Ehinger-Lauf mit 150 dpi (`EXTRACTION_VISION_DPI`, neu
  konfigurierbar) gegen die 200-dpi-Basis: Referenznummer 8/12 statt 10/12, Recall 34/39 statt
  39/39, **5 erfundene Positionen** auf dem Stempel-Beleg. Die −24 % Token sind das nicht wert —
  **200 dpi bleibt Default**, der Schalter bleibt fuer kuenftige Modelle. Rohdaten:
  run-150dpi.json / run-200dpi.json.
- **Tesseract async** (Bun.spawn, Parallelitaet 2): der Event-Loop blockiert nicht mehr je
  OCR-Seite — unter Last stand vorher der ganze Server. Toter computeOcrBoxes entfernt.
- **Echte Request-Timeouts:** non-streaming LLM-Calls brechen jetzt per AbortSignal ab (Default
  120s, Vision/Posteingang 45s synchron zur Retry-Uhr) — vorher lief ein haengender Request nach
  dem Promise.race-Timeout unsichtbar weiter und band einen vLLM-Slot. Streaming (Chat) bewusst
  ohne Abort.
- **Eval-Alignment ausgewiesen:** Champion/Challenger misst text-basiert; bei Vision-Profilen
  sagt "Regeln & Qualitaet" das jetzt dazu (EvalScore.aligned), statt eine Messung der
  Produktionsstrecke zu suggerieren. Echte Vision-Messung braeuchte gespeicherte Seitenbilder je
  Beispiel — dokumentierte Folgearbeit.

### Welle 8: Ein Dokument-Konverter statt neun Kopien — Docling-vorbereitet
Der Markitdown-HTTP-Call war ~9x kopiert (Chat-Anhaenge, Importe, KB-Indexierung, Vertrags-
management, Document Processing, Gmail/GDrive), mit SSRF-Allowlist an nur 2 und Timeout an nur 1
der 9 Stellen. Jetzt zentral in `services/documentConverter.ts`:
- **Ein Fetch, EINE Allowlist (adacor.ai/localhost), ein Timeout (120s)**, zentrale MIME-Erkennung
  und JSON-oder-Text-Antwortbehandlung. Live geprueft: Scan konvertiert unveraendert; eine
  Allowlist-fremde URL wird jetzt an JEDER Stelle abgewiesen. VM- und Profil-Generierung verlieren
  ihren Temp-Datei-Umweg.
- **Docling-Routing eingebaut** (aktiv per `DOCLING_API_URL`, Adacor-Endpunkt mit demselben
  Vertrag wie documentMarkdown): Office/HTML/CSV → Docling, PDF mit Textlayer (pdftotext-
  Stichprobe) → Docling, Scans → wie bisher (Vision-Pfad; Docling-OCR ist auf Scans schwach).
  Jeder Docling-Fehler faellt einzeln auf Markitdown zurueck.
- **Benchmark-Werkzeug** `tools/konverter-benchmark/` mit gemessener Markitdown-Baseline — die
  born-digitale PM-Spezifikation kommt heute mit 0 Tabellenzeilen/0 Ueberschriften zurueck; der
  Docling-Vergleich laeuft mit demselben Aufruf, sobald der Endpunkt steht.
- 6 neue Tests (281 gruen), inkl. handgebautem born-digital-PDF fuer die Textlayer-Erkennung.

### Welle 7: Vertrauen & Grounding — OCR-Fusion, erzwungenes JSON, deterministisches Sampling
Ergebnis der kritischen Standortbestimmung gegen Mistral Document AI, Azure Document Intelligence
und Docling (docs/document-processing-standortbestimmung-2026-08-08.md). Die messbare Luecke war
pixel-verankertes Vertrauen — die Feld-Konfidenz stand auf Heuristik + LLM-Selbsteinschaetzung.
- **OCR-Fusion** (services/extraction/fusion.ts): Die Tesseract-Woerter (bisher nur Fundstellen-
  Rahmen) verifizieren jetzt jeden Wert. Belegt → Konfidenz 0.95, LLM-Konfidenz-Call entfaellt;
  zahlenartig unbelegt → Konfidenz 0.4 + Befund "im OCR-Text nicht belegt" → "Zu pruefen".
  Zahl-Zellen numerisch verglichen (Papier "5,00" ↔ Modell 5). **Positionszeilen bekommen
  Fundstellen-Boxen** (Anker = ziffernhaltiger Zellwert, Bande durch Nachbar-Anker begrenzt,
  identische Artikelnummern der Reihe nach). Null-Mengen bewusst nicht pruefbar (leere Zelle).
- **Serverseitig erzwungenes JSON** im Vision-Pfad: response_format json_schema am Adacor-vLLM
  verifiziert (erzwingt auch gegen Prosa-Prompt, laeuft mit Bild in ~2s ohne Haenger; das nackte
  guided_json-Feld wird still ignoriert). Nullbare Typen je Feld — das Function-Schema haette beim
  Guided Decode Werte fuer unsichtbare Felder erzwungen. Kill-Switch EXTRACTION_GUIDED_JSON=0.
- **temperature 0 + max_tokens 8192** fuer ALLE Extraktions-Calls (vorher: Server-Default-Temperatur,
  kein Limit). Chat-Pfad unveraendert.
- **Stille Fehler sind jetzt Befunde:** uebersprungene Seite, unlesbare Modellantwort, gekappte
  Seiten (max_pages) → severity error → erzwungenes "Zu pruefen". Vorher nur console.warn.
- **Hybrid repariert:** Scan ohne Textlayer routet direkt in die volle vision-per-page-Strategie
  (3 statt 5+ Calls, mit Boxen/Seitenbildern); Vision-Fallback respektiert jetzt die Modellbindung
  (lief vorher auf dem Session-Modell!), feuert erst ab 2 offenen Feldern, Pauschal-0.85 ersetzt
  durch das Fusion-Urteil.
- **Regression auf allen 24 Ehinger-Belegen:** Qualitaet unveraendert 100 % (39/39 Positionen,
  12/12 Kopffelder), 17,7 statt 20,3 s je Beleg. Triage 18 auto_ok / 5 zu pruefen — die 5 sind
  genau die richtigen: beide Handschrift-Belege (vorher stille auto_oks!), der Stempel-Beleg,
  eine fremde Einheit, eine unsichere Liste. 17 neue Tests (299 gruen).

## 2026-08-07

### UI: "Verarbeiten" — kompakte Kopfleiste + Vollbild-Review je Dokument
Der Bereich stapelte Upload, Lauf-Liste, Ergebnistabelle und das aufgeklappte Dokument in EINER
Spalte: die Seite wuchs mit jedem Lauf, und fuer Vorschau plus Positionstabelle blieb eine
Restspalte (Beschreibungen abgeschnitten).
- **Kopfleiste statt zwei Sektionen:** Laeufe sind jetzt eine Auswahlliste (Zeitpunkt, Umfang,
  Status), der Upload klappt auf Knopfdruck auf — beim ersten Mal offen. Der Kopf bleibt damit
  gleich hoch, egal wie viele Laeufe es gibt. Der **neueste Lauf wird automatisch geoeffnet**.
- **Vollbild-Review:** Klick auf eine Zeile oeffnet das Dokument als Overlay — links die Seite gross
  mit den Fundstellen-Rahmen und einer Miniaturen-Leiste, rechts die Felder mit Platz.
  Esc schliesst, Pfeiltasten blaettern durch die **gefilterte** Liste (auf "Zu pruefen" gefiltert
  geht man genau die Problemfaelle durch), Klick auf ein Feld springt zur Fundstelle, Klick auf
  eine Box springt zum Feld.
- **Unsichere Felder zuerst:** Felder unter der Review-Schwelle des Profils stehen im Review oben
  unter "Unsicher — zuerst pruefen", der Rest darunter. Geprueft wird dort, wo das Risiko sitzt.
- Die Detailansicht in der Tabellenzeile entfaellt damit (`BatchFileDetail` → `ReviewModal`).

### UI: Profil-Detail nach Betrieb und Einrichtung getrennt
Die vier gleichrangigen Reiter (Training · Verarbeiten · Regeln · Einstellungen) verschwiegen, dass
sie zwei verschiedene Dinge sind: **Verarbeiten** ist der taegliche Betrieb, alles andere richtet man
einmal ein. Jetzt eine senkrechte Navigation mit zwei Gruppen — Muster 1:1 von der Einstellungsseite
uebernommen (240er Spalte, Gruppenueberschriften, gleiche Aktiv-/Hover-Styles):
- **BETRIEB** → Verarbeiten · **EINRICHTUNG** → Training · Regeln & Qualitaet · Einstellungen
- **Der Einstieg ist jetzt „Verarbeiten"** statt „Training". Ein eingerichtetes Profil wird taeglich
  zum Verarbeiten geoeffnet; das Anlernen ist der seltene Fall.
- **Alle Regeln an einem Ort:** Die selbst definierten **Pruefregeln** lagen bisher unter
  „Einstellungen", die aus Korrekturen **gelernten Regeln** unter „Regeln" — zwei Regelarten an zwei
  Orten. Der Pruefregel-Editor ist jetzt im Bereich „Regeln & Qualitaet", mit eigenem
  Speichern-Button (Teil-Update `PUT {rules}`).
- Verifiziert an der laufenden Instanz, beide Richtungen: Das Regel-Update laesst Felder,
  Anweisungen, Name und Strategie unveraendert; und eine bestehende Regel ueberlebt das Speichern in
  den Einstellungen, das `rules` bewusst nicht mehr mitsendet.
- Die Hinweise im Regel-Editor („lege oben ein Feld an") zeigten nach dem Umzug ins Leere und
  verweisen jetzt auf „Einstellungen".

### Umbenennung: "Extraktion" heisst jetzt "Document Processing", das Projekt heisst "Profil"
Der alte Name benannte den *Schritt*, nicht das *Ergebnis*, und musste zugleich fuer die App, den
Vorgang und das Konfigurationsobjekt herhalten — daran ist er gescheitert. Ebenfalls verworfen:
"OCR" (zu klein — OCR ist Pixel → Zeichen; Tesseract laeuft hier nur fuer die Fundstellen-Rahmen)
und "Document Intelligence" (Anbieter-Label von Azure).
- **App: Document Processing** (so auch in der Sidebar), Untertitel „Dokumente automatisch auslesen,
  pruefen und weitergeben".
- **Profil** statt „Extraktionsprojekt". Warum nicht „Dokumentart": Bei Ehinger sind alle vier
  Objekte dieselbe Dokumentart — vier Mal Lieferschein, nur von vier Absendern mit vier Layouts.
  Geschnitten sind sie danach, *wie* die Post eines Absenders gelesen wird.
- **auslesen** statt „extrahieren" als Vorgang; „Posteingang" bleibt.
- Umbenannt wurde nur, was Menschen lesen: 44 Strings in der Oberflaeche, der Sidebar-Eintrag und
  elf deutsche Fehlermeldungen des Backends, die in der UI erscheinen. **Code, Modulpfade,
  API-Scopes (`app:extraktion:*`), Function-Ids und Parameter (`project_id`) bleiben unveraendert** —
  das ist ein veroeffentlichter Vertrag, an dem die EMMA-Anbindung haengt.
- Die Benennung ist als §0 im Fachkonzept dokumentiert; die beiden aelteren, datierten Dokumente
  tragen einen Verweis darauf, statt nachtraeglich umgeschrieben zu werden.

## 2026-08-06

### Ops: Neue Kunden-Instanz `workplace-ruhrpm-netzwerkpartner` (Scalingo, inkl. Custom-Domain)
Neue Customer-Instanz für RuhrPM-Netzwerkpartner provisioniert (Runbook `docs/runbook-neue-kundeninstanz.md`):
- App + Postgres (`starter-512`) im Projekt `workplace-pilots`; **eigener Flow.swiss-S3-Account** (Bucket
  `workplace-ruhrpm-netzwerkpartner`, `FLOW_S3_MASTER`-Hash ≠ demo/masterclass verifiziert); frische Secrets
  (`SESSION_SECRET`, `CONNECTION_ENCRYPTION_KEY` = 64 Hex).
- Customer-Modus, `ENABLED_APPS=projektmanagement`, Branding Default, keine Connections; ⚪ Vault-Keys aus
  `workplace-ihk-darmstadt` (ohne 🔴-Secrets).
- Deploy aus `main` (`d19e743`); interim Health 200, `[s3] bucket … created`, Migrations applied.
- **Custom-Domain `ruhrpm-netzwerkpartner.workplace-lab.adacor.dev`**: CNAME war gesetzt → `domains-add` → URL-
  Variablen umgestellt (`VITE_API_URL=/api` unverändert) → `restart`. Verifiziert: Health 200, HSTS, Login-CSRF
  400 (kein „Forbidden"), TLS provisioniert.

### Ops: Neue Kunden-Instanz `workplace-ruhrpm-masterclass` (Scalingo)
Neue Customer-Instanz für die RuhrPM-Masterclass provisioniert (Runbook `docs/runbook-neue-kundeninstanz.md`):
- App + Postgres (`starter-512`) im Projekt `workplace-pilots`; **eigener Flow.swiss-S3-Account** (Bucket
  `workplace-ruhrpm-masterclass`, `FLOW_S3_MASTER`-Hash ≠ Nachbarn verifiziert); frische Secrets (`SESSION_SECRET`,
  `CONNECTION_ENCRYPTION_KEY` = 64 Hex).
- Customer-Modus (kein Seed), `ENABLED_APPS=projektmanagement`, Branding Default, keine Connections; ⚪ Vault-Keys
  (LLM/Model-Routing/Infra) aus `workplace-ihk-darmstadt` übernommen (ohne 🔴-Secrets).
- Deploy aus `main` (`587ef31`); Health 200, HSTS, `[s3] bucket … created`, Migrations applied. Interim-URL
  `https://workplace-ruhrpm-masterclass.osc-fr1.scalingo.io`; DNS/Custom-Domain folgt später.

### WZ-Branchen-Matcher: Katalog auf WZ 2025 aktualisiert (Führungsnullen-Fix + 7-stellige Codes)
Neue Schlüsseltabelle (WZ2025-CSV) mit dem aktuellen Katalog abgeglichen und eingespielt:
- **Befund**: Der Katalog war inhaltlich bereits WZ2025 (0 Text-Abweichungen auf 2042 gemeinsamen Codes), aber
  überall als „WZ 2008" beschriftet. Dazu ein Daten-Bug: der Primärsektor (Abteilungen 01–09 — Land-/Forst­
  wirtschaft, Fischerei, Bergbau) hatte durch Excel-Zahlenformat **fehlende Führungsnullen** (z. B. Steinkohlen­
  bergbau als `5100` statt `05100`); 57 vierstellige Klassen fehlten ganz.
- **Katalog neu aus der sauberen CSV gebaut**: 2112 → **2192 Einträge** (Führungsnullen korrekt, fehlende Codes
  ergänzt), Scope auf **4–7-stellig** erweitert (23 nationale 7-Steller wie „Reparatur von Baumaschinen" + 3 neue
  6-Steller, u. a. „Barbiersalons"). Embeddings: 2160 wiederverwendet (textgleich), nur 32 neu erzeugt.
- **Umbeschriftet**: alle „WZ-2008"→„WZ 2025", „4–6-stellig"→„4–7-stellig" (Prompts, Tool-Beschreibungen, UI,
  registry.yaml). `neighborhood` MAX_LEVEL 6→7.
- Builder liest jetzt `docs/WZ2025-Schluesseltabelle.csv` (Latin-1) statt xlsx, mit Embedding-Wiederverwendung.
  Verifiziert per Retrieval-Smoke-Test (05100 Steinkohle, 962101 Barbiersalons, 3312011 Reparatur von Baumaschinen).
  Beide Worktrees, Source + Assets byte-identisch.

## 2026-08-06

### WZ-Branchen-Matcher: Katalog auf WZ 2025 aktualisiert (Führungsnullen-Fix + 7-stellige Codes)
Neue Schlüsseltabelle (WZ2025-CSV) mit dem aktuellen Katalog abgeglichen und eingespielt:
- **Befund**: Der Katalog war inhaltlich bereits WZ2025 (0 Text-Abweichungen auf 2042 gemeinsamen Codes), aber
  überall als „WZ 2008" beschriftet. Dazu ein Daten-Bug: der Primärsektor (Abteilungen 01–09 — Land-/Forst­
  wirtschaft, Fischerei, Bergbau) hatte durch Excel-Zahlenformat **fehlende Führungsnullen** (z. B. Steinkohlen­
  bergbau als `5100` statt `05100`); 57 vierstellige Klassen fehlten ganz.
- **Katalog neu aus der sauberen CSV gebaut**: 2112 → **2192 Einträge** (Führungsnullen korrekt, fehlende Codes
  ergänzt), Scope auf **4–7-stellig** erweitert (23 nationale 7-Steller wie „Reparatur von Baumaschinen" + 3 neue
  6-Steller, u. a. „Barbiersalons"). Embeddings: 2160 wiederverwendet (textgleich), nur 32 neu erzeugt.
- **Umbeschriftet**: alle „WZ-2008"→„WZ 2025", „4–6-stellig"→„4–7-stellig" (Prompts, Tool-Beschreibungen, UI,
  registry.yaml). `neighborhood` MAX_LEVEL 6→7.
- Builder liest jetzt `docs/WZ2025-Schluesseltabelle.csv` (Latin-1) statt xlsx, mit Embedding-Wiederverwendung.
  Verifiziert per Retrieval-Smoke-Test (05100 Steinkohle, 962101 Barbiersalons, 3312011 Reparatur von Baumaschinen).
  Beide Worktrees, Source + Assets byte-identisch.

## 2026-08-05

### Feature: Extraktion — flacher XLSX-Export, Export über die API, Posteingang ohne Split
Die drei Lücken, die der Ehinger-Vergleich benannt hatte, sind geschlossen:
- **Flaches XLSX** (`export.xlsx?format=flat`, im Export-Menü als „Excel flach"): EIN Blatt, eine
  Zeile je Position, Belegdaten wiederholt, dazu die Spalten „Pruefung" und „Befunde". Das ist das
  Format, das zeilenweise lesende Zielsysteme (RPA, ERP-Import) erwarten — bisher mussten sie
  Hauptblatt und Zusatzblatt über die Dateispalte selbst zusammenführen. Belege ohne Positionen und
  fehlgeschlagene Dateien bekommen bewusst trotzdem eine Zeile, sonst verschwinden sie still aus dem
  Export. Route und API teilen sich den neuen Baustein `learning/export-xlsx.ts`.
- **`extraktion/batch.export`** (Public-API): liefert dieselbe Datei base64-kodiert samt Zeilenzahl,
  `format: flat|grouped`. Damit holt ein Integrator das Ergebnis ohne Session-Auth ab —
  `export.xlsx` hing bisher an der Anmeldung im Browser.
- **Posteingang ohne Split**: `split=false` am Upload (UI-Häkchen „Sammel-Scans an Dokumentgrenzen
  trennen", Default unverändert an) behandelt jede Datei als EIN Dokument. Für Quellen mit „eine
  Datei = ein Vorgang" entfällt damit auch das Seitenpaar-Urteil, also ein KI-Aufruf je
  Seitenübergang.
- Verifiziert an echten Belegen: flaches XLSX mit 10 Positionszeilen über die API abgerufen und
  gelesen; 3-seitiger Lieferschein mit `split=false` → ein Teil über alle Seiten, korrekt
  klassifiziert und geroutet. Nebenbefund: derselbe Beleg **mit** Trennung ergab ebenfalls nur einen
  Teil — der konservative Splitter zerschneidet ihn nicht. 7 neue Tests (282 gesamt grün).

### Ehinger-Analyse: Ground Truth verdoppelt (12 von 24 Belegen gelabelt)
Die Messung aus dem n8n-Vergleich steht jetzt auf der doppelten Stichprobe — 12 manuell gelabelte
Belege mit 39 Positionen (Sonepar 4 · Elektro Braun 4 · UniElektro 2 · Eldis 2). Die Ergebnisse
halten: Positionen **39/39**, Mengen und Einheiten **100 %**, **0 erfundene Positionen**,
Lieferscheinnummer und Lieferdatum **12/12**. Referenznummer **10/12** — beide Fehlschläge sind
Sonepar-Belege, bei denen die Nummer als unbeschriftete Zahl über der ersten Position steht; beide
wurden **nicht falsch geraten**, sondern mit Konfidenz 0 als unsicher geliefert. Gemessene
Stellschraube: Mit `referenznummer` als Pflichtfeld fängt die Review-Triage **beide** Fälle, bei
4 statt 2 Reviews auf 23 Belegen. Neu geprüfte Härtefälle: zwei Positionen mit identischer
Artikelnummer bleiben erhalten (Dedupe greift nur bei exakten Duplikaten), und ein Eldis-Zweiseiter
trifft alle 8 Positionen, obwohl Seite 2 nur eine einzelne Position plus Packmittel-Block trägt.

### Bugfix: Vision-Extraktion kannte die Spalten von Positionslisten nicht
Gefunden beim Ehinger-Pilotversuch: Die Vision-Strategie baut ihr Zielschema als Freitext-JSON —
und gab für `list`-Felder nur `"positionen": []` aus, **ohne die Spalten**. Das Modell erfand
daraufhin eigene Schlüssel (`artikel_nr`, `details`, Menge samt Einheit in einem Textfeld), die
weder der Merger noch die Wertelisten- und Regelprüfung wiederfinden. Im Function-Calling-Pfad
(Text-Strategien) stand die Struktur längst — betroffen war ausschließlich die **Scan-Strecke**,
also genau der Weg für Dokumente ohne Textlayer. Jetzt rendert `buildVisionJsonInstruction` die
Positions-Spalten samt Typ, Label und Hinweis. Messbar an echten Belegen: ein Lieferschein lieferte
vorher 1 statt 2 Positionen und fremde Spaltennamen, danach 2/2 bzw. 10/10 mit korrekten Feldern.
Neuer Test deckt die Struktur ab (275 gesamt grün).

### Analyse: Ehinger-Lieferscheine — n8n-Workflow vs. Extraktionsfeature (gemessen)
Bewertung, ob unser Extraktionsfeature den bestehenden n8n-Workflow bei Kunde Ehinger ablösen kann —
nicht geschätzt, sondern über alle **24 echten Scans** (54 Seiten) gemessen, gegen manuell gelabelte
Ground Truth statt gegen einen Modell-Output. Ergebnis: Lieferanten-Klassifikation **24/24** (inkl.
korrekter Ablehnung eines Fremdlieferanten), auf der gelabelten Stichprobe **22/22 Positionen**,
Mengen und Einheiten **100 %**, **0 erfundene Positionen**, ein einziger Fehler (nicht gefundene
Referenznummer, Konfidenz 0 — also erkannt, nicht geraten). Die von n8n selbst als „sehr fragil"
markierte **handschriftliche Mengenkorrektur** wurde in beiden vorkommenden Fällen korrekt gelöst
(durchgestrichene 6 → geliefert 2). Aufwand: **1 LLM-Aufruf je Seite** statt 5, keine externen
Dienste. Drei Produktlücken benannt (flacher XLSX-Export, XLSX über die API, Eingang ohne Split).
Details: `docs/ehinger-n8n-vs-extraktion-2026-08-04.md`, reproduzierbarer Pilot in
`tools/ehinger-pilot/`.

## 2026-08-04

### Feature: Extraktion läuft auf einem festen Modell (Adacor Qwen 3.5 Instruct)
Die Extraktion nutzte bisher das *aktive* System-Modell — und `resolveActiveModel` zieht davor noch
die **Modellwahl des Nutzers für die laufende Session**. Damit hing die Qualität einer Extraktion
daran, was jemand gerade im Chat eingestellt hatte, und ein hängendes Chat-Modell legte das ganze
Feature lahm. Genau das trat heute auf: Das aktive Chat-Modell **Nebius/Kimi-K3 antwortete 120 s
lang nicht** auf das Prompt „Antworte nur mit: ok", während Adacor in 0,3–1,0 s lieferte
(`/models`, `qwen3-5-a3b-35b-256k`, `mistral-3-24b-128k` je HTTP 200) — Batch-Läufe scheiterten mit
„The operation timed out", Vision-Läufe liefen in ihre 45-s-Timeouts.
- **Neu `backend/src/extraction/model.ts`**: Das Feature bindet sein Modell selbst — **Adacor
  Qwen 3.5 Instruct 35B** (`chat` + `function_calling` + `vision`, deckt alle vier Strategien ab).
  Die Session-/Nutzerwahl spielt für die Extraktion keine Rolle mehr.
- **Gilt für alle LLM-Aufrufe des Features**: die vier Strategien, den Repair-Call, die
  Konfidenz-Selbstbewertung (bisher gar nicht überschreibbar — `scoreConfidences` bekam dafür einen
  `modelOverride`), die Bild-Beschreibung, die Regel-Ableitung, die Schema-Inferenz sowie Split und
  Klassifikation im Posteingang.
- **Zwei Ausnahmen bleiben**: das projekteigene Modell (Projekt-Einstellungen → „KI-Modell") schlägt
  die Bindung weiterhin, und `EXTRACTION_LLM_PROVIDER` / `EXTRACTION_LLM_MODEL` erlauben Instanzen
  ohne Adacor-Zugang eine andere Wahl. Gleiches Muster wie bei Echo-Loop (`ECHOLOOP_LLM_*`).
- Das Audit-Label (`audit.model`) nennt jetzt das tatsächlich genutzte Modell statt
  „system-standard". Verifiziert: ein `vision-per-page`-Lauf, der vorher in Timeouts lief, geht
  durch und weist `adacor/qwen3-5-a3b-35b-256k` aus. 3 neue Tests (274 gesamt grün).

### UX: Extraktion — fehlende Erklärtexte ergänzt (Wellen 5/6)
Eine Durchsicht der Oberfläche nach drei Lücken, die beim Testen aufgefallen sind:
- **Werteliste aus einer Tabellenspalte** hatte gar keinen Erklärtext (der vorhandene hing nur am
  Zweig „Feste Liste"). Jetzt steht dort, dass die Spaltenwerte zwar zum Angleichen und Prüfen
  dienen, aber **bewusst nicht in den Extraktions-Prompt** gehen (Tabellen können zu groß sein) —
  und dass eine geänderte Tabelle sofort gilt.
- **„Abweichung" und „automatisch angleichen"** waren nur beschriftet. Jetzt erklärt der Text die
  tatsächliche Wirkung, inklusive des Unterschieds zwischen an/aus (angeglichen + protokolliert vs.
  Rohwert bleibt stehen, nur Befund).
- **Beim Anlegen** wies nichts darauf hin, dass Prüfregeln und Webhook erst in den Einstellungen
  dazukommen und das Anlernen im Training-Tab passiert — ein Hinweis dazu steht jetzt über dem
  „Projekt erstellen"-Button.

### Bugfix: Extraktion — Prüfregel-Buttons taten scheinbar nichts (Welle 5)
„+ Summen-Check" und „+ Stammdaten-Abgleich" reagierten in manchen Projekten nicht auf Klicks. Sie
waren `disabled` (fehlendes Listen-Feld, fehlendes Zahl-Feld, keine Tabelle) — aber Inline-Styles
kennen kein `:disabled`, der gesperrte Button sah also **exakt aus wie ein klickbarer, der nichts
tut**. Für zwei der vier Sperrgründe fehlte zudem jede Erklärung.
- Gesperrte Buttons sind jetzt sichtbar ausgegraut, und der Grund steht **im Klartext unter den
  Buttons** (nicht nur als Tooltip): welches Feld bzw. welche Tabelle fehlt und wo man sie anlegt.
- Ein Summen-Check wird nur noch angeboten, wenn es ein Listen-Feld **mit Zahl-Spalte** gibt —
  vorher liess sich in solchen Projekten eine Regel anlegen, die nie vollständig ausfüllbar war.
- Neue Regeln sind sofort gültig vorbelegt (erste Zahl-Spalte, erste Tabellenspalte). Vorher blieb
  `item_field` leer, und das Speichern scheiterte an „Prüfregel: Spalte "" existiert nicht" —
  verifiziert: die neue Vorbelegung speichert durch, die alte wurde abgelehnt.

### Bugfix: Extraktion — Werteliste war praktisch nicht eintippbar (Welle 6)
Im Feld „Zulässige Werte" ließ sich nur ein einziger Begriff eingeben: kein Leerzeichen am
Wortende, kein Zeilenumbruch. Ursache war das Textfeld selbst — sein Inhalt wurde bei **jedem
Tastendruck** aus den geparsten Werten neu gerendert, und der Parser normalisiert (`trim()` je Zeile,
leere Zeilen raus). Damit verschwand das gerade getippte Leerzeichen sofort wieder, und eine neu
begonnene (noch leere) Zeile ebenso. Der Rohtext lebt jetzt im lokalen State des Editors; nach außen
gehen weiterhin die geparsten Werte, und von außen gesetzte Werte (Projektwechsel, Feldvorschlag aus
einem Beispieldokument) überschreiben die eigene Eingabe nicht mehr. Verifiziert mit einer
Tastendruck-Simulation über die echten Parse-Helfer: getippter und angezeigter Text bleiben
zeichengleich, die geparste Werteliste stimmt, externes Setzen schlägt weiterhin durch.

## 2026-08-03

### Feature: Extraktion — kontrollierte Wertelisten als Ground Truth (Ausbau-Welle 6)
Für sehr viele Felder ist der Wertevorrat vorab bekannt und endlich — Einheiten, Statuscodes,
Kostenstellen, Dokumentarten, Lieferanten. Ohne hinterlegte Liste rät die Extraktion frei und
liefert mal „Stk", mal „Stück", mal „stk."; bei hoher Konfidenz fällt das niemandem auf, und die
Daten sind für jede Auswertung unbrauchbar. Jetzt lässt sich je Feld **und je Positions-Spalte**
eine Werteliste hinterlegen (statisch gepflegt oder aus einer Tabellenspalte), die an drei Stellen
wirkt:
- **Im Prompt**: Die Werte stehen in der Feldbeschreibung — nachweislich in *beiden* Prompt-Pfaden
  (Function-Schema und Vision-Freitext-JSON), ohne Änderung an einer einzigen Strategie.
  Bewusst **weiche Bindung** statt hartem `enum`: Ein `enum` zwänge das Modell, auch bei einem echten
  Ausreißer einen Listenwert zu liefern — der Fehler wäre unsichtbar statt sichtbar.
- **Beim Angleichen**: Ein eindeutig zuordenbarer Wert wird auf die kanonische Schreibweise gesetzt.
  Vier Stufen, jede nur bei **genau einem** Kandidaten: exakt (normalisiert) → gepflegtes Synonym →
  Präfix/Enthalten ab 6 Zeichen („Muster Bau" → „Muster Bau GmbH") → Tippfehler (Levenshtein
  ≤ max(1, ⌊len/8⌋)). Zwei gleich nahe Kandidaten heißt: **nicht** angleichen, sondern melden.
  Deterministisch, kein LLM-Call. Jede Ersetzung wird als `info`-Befund mit dem Rohwert protokolliert
  (neue dritte Stufe neben `error`/`warn`; blockiert nichts).
- **In der Prüfung**: Ein Wert außerhalb der Liste ist ein Befund und hebt die Datei auf
  „Zu prüfen" (W5-Mechanik), mit den nächstliegenden Katalogwerten als Hilfestellung.
- **Ohne Migration**: `catalog` hängt an der Feld-Definition, die als Ganzes in `projects.fields`
  (jsonb) bzw. im `project.yaml` liegt — reist auch durch Export/Import mit. UI: Editor je Feld und
  Spalte (Quelle, Werte mit Schreibvarianten nach `=`, „automatisch angleichen", Wirkung).
  Public-API `projects.list` liefert `allowed_values`.
- Verifiziert end-to-end: Dokument mit „acme ag"/„Stück" → Modell liefert direkt „Acme AG"/„Stk";
  Einheit „Sack" wurde **nicht** in die Liste gezwungen → Befund + „Zu prüfen". Korrektur mit
  „ACME Aktiengesellschaft"/„stück" → beide angeglichen, zwei `info`-Protokolle, gespeicherter Stand
  kanonisch. Tabellen-Katalog: „muster bau" → „Muster Bau GmbH"; Tabelle gelöscht → `warn` statt
  Absturz; `auto_map:false` → Rohwert bleibt, stattdessen Befund. Details:
  `docs/extraktion-wertelisten-2026-08-03.md`. 25 neue Tests (271 gesamt grün).

### Feature: Extraktion — Ähnlichkeits-Few-Shot (Ausbau-Welle 5, Baustein 5, Welle abgeschlossen)
Die Few-Shot-Beispiele wurden bisher nach „Korrekturen zuerst, dann jung" gewählt. Das trägt,
solange ein Projekt **einen** Dokumenttyp sieht — sobald mehrere Ausprägungen zusammenkommen,
füttert es den Prompt mit Beispielen, die zum aktuellen Dokument nichts sagen. Jetzt wird das
Anfragedokument mit den Beispielen verglichen (Kosinus auf Embeddings) und die Auswahl **gemischt**:
erst die ähnlichsten (bis 3, ab Score 0,5), dann die bisherige Ordnung. Die Korrektur-zuerst-Logik
ist das, was den Lern-Loop informativ macht — Ähnlichkeit ergänzt sie, ersetzt sie nicht.
- `learning/similarity.ts` (pur/testbar: `cosine`, `rankBySimilarity`, `blendSelection`) +
  `learning/embeddings.ts` als fehlertolerantes Vorspiel zum LLM-Service (8 s Timeout,
  `null` statt Fehler). Erster Nutzer des seit Längerem konfigurierten, aber ungenutzten
  Embedding-Modells (`multilingual-e5-large`, 1024 Dim.).
- Embedding entsteht beim Speichern eines Beispiels; fehlende werden beim ersten
  Auswahllauf **im Hintergrund nachgetragen** (max. 20, mit Lock). Migration `0031`, additiv.
- **Kein Risiko ohne Embeddings**: Ist kein Modell konfiguriert, hängt der Dienst oder steht
  `EXTRACTION_SIMILARITY_FEWSHOT=0`, bleibt exakt das alte Verhalten — verifiziert.
- Verifiziert end-to-end an einem Projekt mit zwei Dokumenttypen (3 Rechnungen, 3 Arbeitszeugnisse):
  Rechnungs-Anfrage → **nur Rechnungs-Beispiele**, Zeugnis-Anfrage → **nur Zeugnis-Beispiele**;
  ohne Anfragetext bzw. mit Kill-Switch dieselbe Auswahl wie vorher (die 3 jüngsten). Backfill
  getestet: 2 geleerte Embeddings wurden automatisch nachgezogen. 8 neue Tests (246 gesamt grün).

### Betrieb: Extraktion — Seitenbilder raus aus der Datenzeile (Ausbau-Welle 5, Baustein 4)
Die gerenderten Seitenbilder einer Vision-Extraktion lagen als base64-`dataUri` in der
`detail`-Spalte der Datei-Zeile — **1,2–1,3 MB pro Dokument** (gemessen an bestehenden Läufen), die
bei jedem Backup und jeder Replikation mitgeschleppt wurden, obwohl sie nur beim Aufklappen einer
Zeile gebraucht werden. Die Bytes liegen jetzt außerhalb der Zeile, in der Zeile bleibt eine
Referenz (Seite + Größe): **552 Byte** für denselben Fall.
- Neues Modul `learning/page-store.ts` — die zweite bewusst divergente Datei des Features:
  Scalingo legt die PNGs in **S3** (`extraction-pages/{runId}/{fileId}/p{n}.png`, neuer Helper
  `s3Paths.batchPageImage` mit Traversal-Schutz), Railway als **Volume-Datei** unter
  `data/extraction-batch-pages/`. Beim Löschen eines Laufs wird mit aufgeräumt.
- **Ausgeliefert wird same-origin** über eine neue Route
  `GET …/batches/:runId/files/:fileId/pages/:page` — signierte S3-URLs wären im Browser an der
  CSP (`img-src 'self' data: blob:`) gescheitert.
- **Fail-Soft**: Ist keine Ablage verfügbar (lokale Entwicklung ohne S3) oder scheitert das
  Schreiben, behält das Bild seinen `dataUri` — eine Extraktion scheitert nie an der Vorschau.
- **Kein Backfill**: Alte Läufe behalten ihre Inline-Bilder und werden unverändert angezeigt
  (verifiziert an einem Bestandslauf mit 1,17 MB `dataUri`).
- Verifiziert end-to-end: Vision-Lauf über ein Test-PDF → `detail` 552 Byte statt >1 MB, Seiten-Route
  liefert das PNG (1654×2339), Boxen und Werte korrekt, S3-Objekt vorhanden (82 KB) und nach dem
  Löschen des Laufs weg. 4 neue Tests im Scalingo-Worktree, 6 im Railway-Worktree (dort inklusive
  Datei-Roundtrip und Traversal-Abwehr).

### Feature: Extraktion — API-Batch + Webhooks (Ausbau-Welle 5, Baustein 3)
Das Feature war nur über die UI bedienbar — jede Verarbeitung brauchte einen Menschen. Die
Extraktion ist jetzt **headless ansprechbar**, über das bestehende Public-API-Framework
(Bearer-Key, Scopes, Rate-Limit, Audit, OpenAPI kommen dadurch geschenkt):
- **Vier Functions** unter `/api/public/v1/extraktion/…`: `projects.list` (welche Projekte/Felder
  gibt es), `extract` (ein Dokument synchron), `batch.create` (bis 20 Dokumente, antwortet sofort
  mit `run_id`), `batch.get` (Status + Ergebnisse). Dokumente als base64; Deckel 10 MB je Dokument
  / 25 MB je Anfrage. Intern läuft exakt die UI-Strecke (`createBatchRun` + `runBatchExtraction`)
  inklusive Review-Triage (W3), Audit (W2) und Prüfregeln (W5-1).
- **Virtuelle App statt Registry-Eintrag** (`public-api/virtual-apps.ts`): Ein echter
  Registry-Eintrag hätte über die Sidebar einen Navigationspunkt auf `/apps/extraktion` erzeugt,
  der ins Leere führt. Virtuelle Apps existieren nur im Code — erscheinen aber in Discovery,
  `openapi.json` und im Permissions-Katalog der API-Key-Verwaltung. Abschaltbar per
  `EXTRACTION_PUBLIC_API=0`.
- **Webhooks**: `callback_url` je Anfrage, sonst der Projekt-Default aus den Einstellungen
  (gilt auch für UI-Läufe). Zustellung bei Lauf-Ende mit `X-Workplace-Signature`
  (HMAC-SHA256 über den Rumpf, Schlüssel je Projekt), 3 Versuche mit Backoff, keine
  Redirect-Verfolgung, 4xx wird nicht wiederholt. Der Zustellstand steht am Lauf und als Badge in
  der Lauf-Liste. Das Webhook-Ziel wandert **bewusst nicht** ins Export-Paket (Betriebsgeheimnis).
- **Framework-Ergänzung `PublicFunctionError`**: Fachliche Fehler (unbekanntes Projekt,
  überschrittener Deckel) kamen bisher als generischer 500 `internal_error` beim Integrator an.
  Jetzt liefern sie Status + Klartext (413 `payload_too_large`, 404 `not_found`, 400
  `invalid_request`); alles Übrige bleibt weiterhin ein 500 ohne Interna.
- Verifiziert end-to-end: Discovery und `openapi.json` listen die vier Functions;
  `batch.create` mit zwei Dokumenten + `callback_url` → Lauf lief durch, Webhook traf ein,
  **Signatur vom Empfänger unabhängig nachgerechnet = identisch**, Regel-Befund und
  `needs_review` im Payload; Projekt-Default-Webhook feuerte auch für einen UI-Lauf;
  21 Dokumente → 413 mit Klartext, unbekannter Lauf → 404, Key ohne Scope → 403.
  19 neue Tests (234 gesamt grün).

### Feature: Extraktion — Schema-Inferenz beim Onboarding (Ausbau-Welle 5, Baustein 2)
Der Einstieg in ein neues Extraktionsprojekt war reine Handarbeit (Feldliste tippen, Typen raten,
Positionstabellen selbst modellieren). Im Anlege-Dialog gibt es jetzt eine Dropzone **„Felder aus
Beispieldokument vorschlagen"**: ein LLM-Call liest ein typisches Dokument und schlägt Projektname,
Beschreibung und die Feldliste vor — **inklusive Positionstabelle als `list`-Feld**. Der Vorschlag
ersetzt den Feld-Editor-Stand und ist frei bearbeitbar; angelegt wird erst per Button.
- `learning/schema-infer.ts`: `parseInferredFields` (pur/testbar) sanitisiert IDs (snake_case,
  Umlaute, Dedup, `felder` reserviert), verwirft ungültige Typen, Listen ohne Spalten und
  verschachtelte Listen, cappt auf 30 Felder und lässt den Vorschlag zur Sicherheit durch
  `validateProjectFields` laufen — lieber ein kleinerer, sauberer Entwurf als ein halbgarer.
- `ingestPlainText` (neu) macht auch **Scans** nutzbar: kein Textlayer → erste Seiten rendern und per
  Vision beschreiben; reine Bilder direkt per Vision. Route `POST /projects/infer-schema`
  (multipart oder `{text}`), vor den `:id`-Routen registriert.
- Verifiziert end-to-end an einem Lieferschein: 11 Felder vorgeschlagen (Datum als `date`,
  Gewicht/Menge als `number`, „Lieferung vollständig" als `boolean`, Positionen als Liste mit
  5 Spalten); das daraus angelegte Projekt extrahierte das Dokument vollständig korrekt
  (3 Positionen, Summe 2.080 kg). 11 neue Tests (215 gesamt grün).

### Feature: Extraktion — fachliche Prüfregeln (Ausbau-Welle 5, Baustein 1)
Bisher prüfte das Feature nur **Typ/Format** (Validator) und **Konfidenz** (Review-Triage, Welle 3).
Beides sagt nichts darüber, ob ein Ergebnis *fachlich* stimmt: Eine Rechnung, deren Positionen nicht
zum Gesamtbetrag summieren, war mit hoher Konfidenz trotzdem „auto_ok". Neu sind zwei Regeltypen je
Projekt (`rules`), konfigurierbar in den Projekt-Einstellungen:
- **Summen-Check** — die Werte einer Positions-Spalte müssen (mit Toleranz, Default 0,01) ein
  skalares Zielfeld ergeben. Deutsche Zahlformate werden normalisiert; leeres Zielfeld oder leere
  Liste erzeugen bewusst **keinen** Befund (sonst Dauer-Alarm bei unvollständigen Dokumenten).
- **Stammdaten-Abgleich** — der Feldwert muss in einer Spalte einer **Tabelle** (Tables-Feature)
  vorkommen (normalisierter Vergleich: trim/casefold). Nicht ladbare Quelle → `warn` statt falscher
  Sicherheit.
- **Wirkung**: Ein `error`-Befund hebt die Batch-Datei **unabhängig von der Konfidenz** auf
  „Zu prüfen" (`computeReviewStatus`) und wird in Batch-Detail und Training-Tab im Klartext
  angezeigt. Nach „Übernehmen & lernen" werden die Befunde gegen den korrigierten Stand neu bewertet.
- `learning/rules.ts` (pur/testbar, Wertequelle als Callback — Andockpunkt für W6),
  `validateProjectRules` beim Speichern und beim Bundle-Import, Regeln reisen im Export-Paket mit.
  Migration `0029` (`projects.rules`, `batch_run_files.validations`), additiv ohne Backfill.
- Verifiziert end-to-end (lokal, Port 3011, echte Extraktion): Testrechnung mit falscher Summe
  (Positionen 1.500,50 vs. Gesamtbetrag 2.100,00) und unbekanntem Lieferanten erzeugt beide Befunde;
  bei **Review-Schwelle 0,1** (Konfidenzen 0,5–0,7, Triage könnte nicht auslösen) steht die Datei
  trotzdem auf „Zu prüfen" — die Regel allein kippt sie. Korrektur per „Übernehmen & lernen" →
  0 Befunde. Export/Import überträgt die Regeln. 26 neue Unit-Tests (204 gesamt grün).

## 2026-07-29

### PM: tsc-Cleanup Projektmanagement-Modul (0 Fehler)
Alle vorbestehenden TypeScript-Fehler im `apps/projektmanagement`-Modul behoben (main 21, railway 28) —
`noUncheckedIndexedAccess`-Guards, `instanceof File`-Typumgebung (FormData-Cast), Buffer→BodyInit-Casts,
LLM-`source`-Union-Cast, Doppel-Export `updateProjektauftrag` (index.ts).
- **2 echte Bugs (nur railway)**: doppelte Object-Keys — in `createProjektauftrag` (id/created_at/updated_at/
  created_by standen vor UND nach `...data`) und in der `import-service`-Größen-Map (`'gross'` doppelt). Beide
  wurden bereinigt bzw. an die main-Variante angeglichen.
- Reines Typing/Cleanup ohne Verhaltensänderung (außer den 2 Bug-Fixes). Übrige Module (services/connections/…)
  bleiben dokumentierte Tech-Debt.

### PM: Projektidee — abgeleitete Projektaufträge manuell verknüpfbar (Test-Feedback Block 4)
- Neue Basisdaten-Sektion **„Abgeleitete Projektaufträge"**: vorhandene Projektaufträge **verknüpfen/lösen**
  (setzt/löscht `auftrag.idee_id`) — nicht mehr nur die automatische Erzeugung über „Auftrag aus Idee erstellen".
- Backend (beide Worktrees, DB + YAML): `GET …/auftraege/available` (freie, auf Editor+ gefiltert),
  `POST …/auftraege/:id/link` + `…/unlink`; Storage `listUnlinkedAuftragRefs` / `getAuftragIdeeId` / `setAuftragIdee`.
- RBAC: Verknüpfen/Lösen erfordert Editor auf **Idee UND Auftrag**; Guards gegen Fremd-Verknüpfung/-Lösen (409).
- Hook: `getAvailableAuftraegeForIdee` / `linkAuftragToIdee` / `unlinkAuftragFromIdee`.

### PM: Projektidee — Unternehmensrisiken = Projektauftrag-Risiken-Maske (Test-Feedback Block 3)
- Der Idee-Tab **„Unternehmensrisiken"** nutzt jetzt die vollständige **Projektauftrag-Risiken-Maske** (schlanker
  Adapter): **Art (Bedrohung/Chance)**, **Risikotyp**, Beschreibung, Wahrscheinlichkeit/Auswirkung + **Risikomatrix**.
  Überschrift „Unternehmensrisiken" + Erläuterung bleiben erhalten.
- `Risiken.jsx` um `title`/`subtitle`-Props erweitert (Defaults = Projektauftrag unverändert) → teilbar.
- `Risk`-Typ um `nature` (threat/chance) ergänzt; Übersicht + Export zeigen Risiken in neuer Struktur
  (Art · Risikotyp · Beschreibung · Wahrsch. · Auswirkung).
- „Auftrag aus Idee erstellen" überträgt Risiken jetzt strukturgleich (vorher gingen Idee-Typwerte verloren).
- Migration: bestehende Idee-Risiken (alte Typwerte + Gegenmaßnahme) zeigen leere Art/Risikotyp-Felder.
- Beide Worktrees; types.ts je Worktree, idee-mapper + Frontend byte-identisch.

### PM: Klassifizierungs-Matrix — Quadranten-Texte konfigurierbar (Test-Feedback Block 2)
- Neue Config-Liste **`stakeholder_quadrants`** (die 4 Quadranten-Texte der Interesse×Einfluss-Matrix); Labels
  editierbar, Schlüssel gesperrt (wie `idee_status`/`portfolio_status`). Erscheint via DEFAULT_CONFIG-Merge auch
  bei bestehenden Instanzen und im Config-Export/Import.
- **StakeholderMatrix** liest die Quadranten-Texte aus der Config (Fallback = Standardtexte) — wirkt überall, wo
  die Matrix genutzt wird: **Projektidee, Projektauftrag, Portfolio**.
- **X-Achsenbeschriftung mit Zeilenumbruch** (lange Werte wie „1 - extrem gering" brechen um statt zu überlappen),
  Achsentitel tiefer, mehr Bodenabstand.
- Config-Usage von `project_driver` um „Projektidee (Basis)" ergänzt.
- Beide Worktrees; storage.ts je Worktree, config-io + Frontend byte-identisch.

### PM: Projektidee — Test-Feedback Block 1 (Nummerierung, Projekttreiber-Select, Config-Labels, Personen)
- **Nummerierung raus**: alle Wissensgebiet-Überschriften ohne führende Nummer (Basis, Personen, Ziele,
  Projektkontext, Business Case, Unternehmensrisiken, Übersicht) — behebt zugleich die seit „Personen" (Step 2)
  verschobene Nummerierung.
- **Projekttreiber** ist jetzt ein **Auswahlfeld** aus der Config-Liste `project_driver` (vorher Freitext).
- **Übersicht + Export** lösen Projekttyp / Projektgröße / Projektstatus / Priorität / Projekttreiber jetzt über
  die **Config-Listen** auf statt über hartkodierte Label-Maps — behebt „wird nicht angezeigt" (Custom-Werte)
  und „Schlüssel statt Name" (Projektstatus).
- **Personen** (Projektteam + Stakeholder) erscheinen jetzt in **Übersicht** und **Export**.
- **Business-Case-Beträge** werden formatiert dargestellt („X.XXX,XX €"), beim Editieren roh.
- **Datum** einheitlich DD.MM.YYYY in Übersicht + Export.
- Beide Worktrees; Frontend + idee-mapper byte-identisch, Route reicht die App-Config an den Export-Mapper.

### PM: Portfolio-Kosten überarbeitet (Test-Feedback: Umbenennungen + Plan / Ist+Forecast / △ Kosten)
- **Umbenennungen**: „Prognose (EAC)" → **Kosten-Prognose**, „Plan-Ende" → **Termin-Ende (PA)**,
  „Prognose-Termin" → **Termin-Prognose**.
- **Neue Kennzahlen**: **Plan** (Summe der Plan-Monate, zusätzlich zu Budget), **Forecast** (Summe der
  Forecast-Zukunftsmonate = ETC), **Ist + Forecast** (verbrauchtes Budget + Forecast, vergangene Monate Ist /
  künftige Forecast — kein Doppelzählen) und **△ Kosten** (Kosten-Prognose − Budget, dargestellt als
  „+… € (+… %)", farbcodiert).
- **KPIs**: Budget · Plan · Ist + Forecast · Kosten-Prognose · △ Kosten · Ideen. **Chart-Balken**: Budget · Plan ·
  Ist+Forecast · Kosten-Prognose. **Tabelle** um Plan / Ist / Forecast / Ist+Forecast / △ Kosten erweitert
  (horizontal scrollbar), Termin-Spalten umbenannt.
- Backend-Aggregat `getPortfolioCosts` (+ `computeProjektCost`) liefert plan / forecast / ist_plus_forecast /
  delta_kosten (+ pct) je Projekt und in der Summe. Beide Worktrees, Aggregator + Frontend byte-identisch.

### PM: Portfolio-Roadmap + Dashboard — Abhängigkeiten auch für Projektideen
Abhängigkeiten (Vorgänger → Nachfolger) ließen sich bisher nur zwischen Projekten pflegen. Jetzt sind auch
**Projektideen** als Endpunkt wählbar — die Dropdowns sind nach „Projekte" / „Projektideen" gruppiert. Projekt-
und Ideen-IDs (`projekt-…` / `idee-…`) sind kollisionsfrei, das Kind wird aus dem ID-Präfix abgeleitet (kein
neues Datenfeld). Der Gantt zeichnet die Pfeile auch für Ideen-Balken; die Dashboard-Kachel „Kritische
Abhängigkeiten" berücksichtigt Ideen-Abhängigkeiten (mit „(Idee)"-Kennzeichnung). Backend: Roadmap- und
Dashboard-Aggregat lösen Ideen-Endpunkte mit auf. Beide Worktrees, Frontend + Aggregator byte-identisch.

### PM: Portfolio-Detail — Tab „Basis": Portfolio-ID editierbar (fachliche Kennung)
Das ID-Feld im Basis-Tab ist jetzt frei editierbar — analog zur „Projekt-ID" bei Projekten und Projektideen.
Es ist eine **fachliche Kennung** (`portfolio_id`, z. B. „PF-2026-001"), NICHT der technische Primärschlüssel;
migrationsfrei im metadata-JSONB (DB) bzw. Top-Level (YAML) persistiert. Wird über PUT/POST durchgereicht.
Beide Worktrees (DB + YAML), Frontend byte-identisch.

### PM: Portfolio-Liste — Projekte + Projektideen je Portfolio auflisten
In der Portfolio-Übersicht (Einstieg ins Tool) zeigt jede Zeile jetzt nicht mehr nur die Anzahl, sondern die
tatsächlich zugeordneten **Projekte** (neutrale Chips) und **Projektideen** (blaue Chips) — mit „keine zugeordnet",
falls leer. Lädt Projekte + Ideen je Portfolio parallel. Frontend byte-identisch (beide Worktrees).

### PM: Portfolio-Detail — Tab „Übersicht" als Executive Dashboard (RuhrPM-Vorlage)
Der Übersicht-Tab wurde nach der RuhrPM-Dashboard-Vorlage zu einem Executive Dashboard umgebaut — alle Kacheln
auf einer Seite:
- **KPI-Reihe**: Gesamtstatus (regel-abgeleiteter Sammel-Ampelstatus), Aktive Projekte (+ kritisch/beobachtet),
  Projektideen (+ im Funnel), Budget-Forecast (EAC-Summe, %-Abweichung ggü. Plan).
- **Ampelübersicht** (Grün/Gelb/Rot), **Budgetübersicht** (Plan/Ist/Forecast-Balken), **Kritische Hinweise**
  (regel-basiert aus roten Projekten, Top-Risiken, Budget-Überschreitung, Terminverzug — KI-Narrativ-Ersatz).
- **Idea-to-Project-Funnel** (5 Stufen aus Projektidee-Status + `project_status`), **Projektübersicht**
  (Status/Fortschritt/Budget/Forecast/Hinweis), **Kritische Abhängigkeiten** (aus den Roadmap-Dependencies).
- **Top-Risiken** und **Letzte Statusberichte** bleiben erhalten.
- **Ressourcen- & Engpassansicht**: bewusst als Platzhalter — die Heatmap braucht ein Ressourcen-/Kapazitäts­modell
  (Rollen-Kapazität + Allokation je Monat), das noch nicht erfasst wird.
- Aggregat `getPortfolioDashboard` erweitert (gesamtstatus, budget.forecast_*, ideen-Funnel, kritische_hinweise,
  projekte_detail, dependencies) — keine neuen Datenquellen, alles regel-abgeleitet. Beide Worktrees (DB + YAML),
  Frontend byte-identisch; Aggregator byte-identisch.

### PM: Portfolio-Detail — Tab „Risiken" (Aggregat + Dashboard-Tracking-Markierung)
Der letzte Platzhalter-Tab „Risiken" ist umgesetzt: aggregiert alle Risiken aus dem letzten genehmigten
Statusbericht aller zugeordneten Projekte in eine sortierbare Tabelle (Projekt, Typ, Risiko, Wahrscheinlichkeit
× Auswirkung = Score, Ampel, Status, Verantwortlich).
- Pro Risiko lässt sich per Häkchen markieren, ob es später im **PMO-Dashboard** verfolgt werden soll —
  gespeichert am Portfolio als `tracked_risks` (stabile Marker-Keys `projektId:auftrag_risk_id|id`, SB-stabil).
  Savable Tab (zentraler Header-Speichern-Button), migrationsfrei (metadata-JSONB / YAML).
- Neuer Aggregat-Endpoint `GET /portfolios/:id/risks` (`getPortfolioRisks`, RBAC-gefiltert wie das Dashboard);
  PUT nimmt `tracked_risks` entgegen. Die eigentliche Dashboard-Auswertung folgt später.
- Damit sind alle Portfolio-Tabs (Basis · Personen · Ziele · Roadmap · Kosten · Risiken) umgesetzt; das
  Platzhalter-Gerüst wurde entfernt. In beiden Worktrees (DB + YAML), Frontend byte-identisch.

### PM: Portfolio-Detail — Tab „Kosten" (Aggregat aus Projekten + Projektideen)
Der Platzhalter-Tab „Kosten" ist umgesetzt: eine read-only Kostenübersicht über alle zugeordneten Projekte
und Projektideen.
- **KPIs**: Summe Budget / Ist / Prognose (EAC) über alle Projekte + Investitionsschätzung der Projektideen.
- **Gestapelter Kostenvergleich** (neue `PortfolioCostChart`-Komponente, Custom-SVG): pro Kennzahl
  (Budget/Ist/Prognose) eine Spalte, gestapelt nach Projektanteil — zeigt Portfolio-Summe + Zusammensetzung.
- **Detailtabelle** je Projekt: Budget, Ist, Prognose (EAC), Plan-Ende, Prognose-Termin, Δ Tage. Ideen mit
  ihrer Investitionsschätzung separat.
- Kennzahlen je Projekt aus dem **letzten genehmigten Statusbericht**: Budget = `cost_budget`, Ist = Σ
  `cost_months.ist`, **Prognose (EAC) = Budget ÷ CPI**, **Prognose-Termin via SPI** — dieselben Earned-Value-
  Formeln wie im Statusbericht, serverseitig portiert. Ideen: Σ `business_case.investitionen`.
- Neuer Aggregat-Endpoint `GET /portfolios/:id/costs` (`getPortfolioCosts`, RBAC-gefiltert wie das Dashboard).
- In beiden Worktrees (DB + YAML), Frontend byte-identisch.

### PM: Portfolio-Detail — zentraler Speichern-Button im Header (wie Projektauftrag)
Der Speichern-Button aller Portfolio-Tabs (Basis, Personen, Ziele, Roadmap) sitzt jetzt — analog zum
Projektauftrag — **oben rechts im Header** (mit Save-Icon, Glow bei ungespeicherten Änderungen, Label
„Speichern / Speichern * / Speichern…") statt am Ende des jeweiligen Tab-Inhalts. Der aktive Tab meldet
seinen Dirty-/Saving-Zustand nach oben und stellt `save()` per Ref bereit (`forwardRef`/`useImperativeHandle`);
der Header-Button spricht den aktiven Tab an. Frontend byte-identisch in beiden Worktrees.

### PM: Portfolio-Detail — Tab „Roadmap" (Gantt aus Projekten + Projektideen)
Der Platzhalter-Tab „Roadmap" ist umgesetzt: ein Gantt-Diagramm der zugeordneten Projekte und Projektideen
nach Startdatum (wiederverwendete `GanttRoadmap`-Komponente).
- **Balkenfarbe** je Projekt = Ampel des **letzten genehmigten (finalen) Statusberichts** (grün/gelb/rot),
  sonst grau; **Projektideen immer grau**. Termine der Projekte kommen aus dem Projektauftrag, die Ampel via
  `pickLatestSb` (dieselbe Logik wie das Portfolio-Dashboard).
- **Abhängigkeiten** zwischen Projekten (Vorgänger → Nachfolger) werden hier gepflegt und als
  Finish-to-Start-**Verbindungspfeile** im Gantt dargestellt. Persistenz am Portfolio (Top-Level in der YAML,
  metadata-JSONB auf DB) — migrationsfrei; Speichern mit optimistischer Versionierung.
- Neuer Aggregat-Endpoint `GET /portfolios/:id/roadmap` (RBAC-gefiltert wie das Dashboard). `GanttRoadmap` um
  optionalen `color`-Override und `dependencies`-Prop erweitert (additiv, Projektauftrag-Nutzung unverändert).
- In beiden Worktrees (DB + YAML), Frontend byte-identisch.

### PM: Portfolio-Detail — Tab „Ziele" (Portfolioziele + Erfolgskriterien)
Der Platzhalter-Tab „Ziele" ist umgesetzt — analog zur Ziele-Maske des Projektauftrags (geteilte
`Ziele`-Komponente, per Label-Props parametrisiert), nur mit Portfoliowording: **Portfolioziele** (Freitext)
und **Erfolgskriterien** (Liste). Persistenz am Portfolio: Top-Level in der YAML (demo/messe), metadata-JSONB
auf DB (main) — migrationsfrei. Speichern mit optimistischer Versionierung wie in den übrigen Tabs. In beiden
Worktrees; Frontend byte-identisch.

### PM: Portfolio-Detail — Tab „Personen" (Portfolioteam + Portfolio-Stakeholder)
Der Platzhalter-Tab „Personen" ist jetzt voll umgesetzt — komplett analog zur Personen-Maske des
Projektauftrags (geteilte `Personen`-Komponente, per Label-Props parametrisiert), nur mit den Bezeichnungen
**Portfolioteam** und **Portfolio-Stakeholder**. Team- und Stakeholder-Einträge (inkl. Interesse/Einfluss-
Klassifizierung + Matrix) werden am Portfolio persistiert: metadata-JSONB auf DB (main), Top-Level in der
YAML (demo/messe) — migrationsfrei. Speichern mit optimistischer Versionierung wie im Basis-Tab. In beiden
Worktrees; Frontend byte-identisch.

### PM: Portfolio-Detail neu strukturiert — Icon-Tabs + Tab „Basis"
Die Portfolio-Detailseite folgt jetzt der Projektauftrag-Logik: **Icon-Tab-Leiste** (geteilte `StepNav`,
Icons per Titel) mit der Zielstruktur **Übersicht · Basis · Personen · Ziele · Roadmap · Kosten · Risiken**.
Personen/Ziele/Roadmap/Kosten/Risiken sind vorerst Platzhalter (folgen Schritt für Schritt).
- **Tab „Basis" (voll):** Stammdaten (ID, Name, Portfoliotyp, Portfoliostatus, Portfoliotreiber,
  Kurzbeschreibung, Start-/Enddatum) mit zentral pflegbaren Select-Optionen; **Projekt-Zuordnung** (aus dem
  bisherigen „Projekte"-Tab übernommen) **plus neue Projektideen-Zuordnung**; Portfolio löschen. Die Tabs
  „Projekte", „Strategie" und „Einstellungen" entfallen (gehen in Basis auf; `strategy`-Feld bleibt erhalten
  für den späteren Ziele-Tab).
- **3 neue zentrale Config-Listen** (Einstellungen → Auswahloptionen, inkl. CSV/Excel-Export):
  `portfolio_type`, `portfolio_driver`, `portfolio_status`. Bei `portfolio_status` sind die Schlüssel
  `active`/`archived` fixiert (Archivierung/Filter/Badges) — nur Anzeigename editierbar.
- **Datenmodell:** neue Portfolio-Basisfelder (Typ/Treiber/Start/Ende) migrationsfrei (YAML: Top-Level);
  **Portfolio ↔ Projektidee** über `idee.portfolioId` (neue Endpoints `/portfolios/:id/ideen[/available]` +
  Zuordnen/Entfernen, RBAC).
- In **beiden Worktrees** umgesetzt (DB + YAML), Frontend byte-identisch.

### Feature: Extraktion — Posteingang / Eingangsstrecke (Ausbau-Welle 4)
Aus dem Extraktions-Werkzeug wird eine **Dokumenten-Eingangsstrecke**: Der neue
**Posteingang** nimmt gemischte Scans entgegen, trennt Sammel-PDFs an erkannten
Dokumentgrenzen, klassifiziert jedes Teil-Dokument gegen die Projekt-Kataloge und routet
sichere Treffer automatisch als Batch-Lauf ins Zielprojekt (die W3-Review-Triage ist dort
das zweite Netz). Unsichere Teile warten mit Vorschau + Vorschlag auf manuelle Zuordnung.
- **Split** (`extraction/inbox/split.ts` + neues `services/extraction/pdf-split.ts`):
  je Seitenübergang ein Vision-Urteil (erprobter Prompt aus `docs/document-split/`,
  als TS-Konstante eingebettet — Railway-Image hat kein docs/); nur ein klares „true"
  trennt (konservativ, Call-Fehler = kein Schnitt). Teil-PDFs via `pdfseparate`+`pdfunite`
  (poppler, bereits in Aptfile/Dockerfile); Fallback auf „ein Teil + Hinweis" wenn der
  Splitter fehlt/scheitert (z.B. verschlüsselte PDFs). Seiten-Cap `INBOX_MAX_PAGES` (60).
- **Klassifikation** (`inbox/classify.ts`): 1 Vision-Call auf die erste Seite je Teil
  gegen den Projekt-Katalog (id/Name/Beschreibung/Feld-Labels) mit strengen
  Confidence-Regeln (Muster classifyContract); Antwort-Parsing mit Fallbacks
  (unbekannte ID → null, Clamping, Alternativen gefiltert).
- **Auto-Routing**: Teile mit Konfidenz ≥ `INBOX_AUTO_ROUTE_THRESHOLD` (0.8) werden je
  Projekt zu EINEM Batch-Lauf gebündelt (`createBatchRun` + `runBatchExtraction`
  wiederverwendet); Projekt-vor-Routing-Check (gelöscht → bleibt unassigned).
- **Persistenz** (`inbox/store.ts`, divergent): Scalingo = Postgres-Metadaten
  (Migration `0027`: `inbox_uploads` + `inbox_parts`, echte FK-Cascade) + PDF-Bytes in
  **S3** (`extraction-inbox/{uploadId}/…`, neue `s3Paths`-Helper — ephemeres FS!);
  Railway = YAML + Dateien unter `data/extraction-inbox/`. DELETE räumt Bytes mit ab.
- **Routen** (`routes/extraction-inbox.ts` unter `/api/extraction/inbox`): Multi-Upload
  (fire-and-forget, 50-MB-Cap), Liste/Detail (Polling), manuelle Zuordnung
  (`…/parts/:partId/route`), Löschen. Stale-Sweep: processing älter 30 min → failed.
- **UI**: Header-Button „Posteingang" (mit Offen-Zähler) auf der Projektliste; neue
  Posteingang-Ansicht mit Multi-Dropzone, Status-Polling, aufklappbaren Eingängen:
  je Teil Thumbnail (40-dpi-Preview), Seitenbereich, Klassifikation mit Konfidenz +
  Alternativen, Projekt-Auswahl + „Zuordnen & verarbeiten" bzw. „→ Projekt, Lauf
  gestartet"-Link.
- **Verifiziert:** 152 Backend-Tests grün (16 neue: Grenz-Ranges, Verdikt-Parsing,
  Klassifikations-Parsing, Teil-Dateinamen); E2E lokal: zusammengeklebtes 2-Dokumente-PDF
  (Rechnung+Lieferschein, via eigenem PDF-Generator + pdfunite) → Split erkannte die
  Grenze, beide Teile mit 0.95 korrekt klassifiziert und **automatisch geroutet**, beide
  Ziel-Batch-Läufe completed mit korrekt extrahierten Feldern + Review `auto_ok`
  (W4→W1–W3-Kette geschlossen); kaputtes PDF → failed mit klarer Meldung; DELETE
  entfernte alle 3 S3-Objekte; Migration 0027 beim Boot. Railway gespiegelt
  (YAML/FS-Store + Smoke-Roundtrip). Doku: `docs/extraktion-posteingang-2026-07-29.md`.

## 2026-07-28

### Feature: Extraktion — Review-Workflow im Batch (Ausbau-Welle 3)
Der Produktivbetrieb lernt jetzt mit: Jede Batch-Datei ist direkt in der Detailansicht
**korrigierbar**, „Übernehmen & lernen" macht die Korrektur zum Trainingsbeispiel —
das Schwungrad Nutzung→Lernen. Dazu **Konfidenz-Triage** je Datei und eine
**Kalibrierungs-Statistik**, die zeigt, ob die Konfidenz echte Fehler voraussagt.
- **Triage** (`learning/review.ts`): nach jeder Batch-Extraktion wird je Datei
  `auto_ok` oder `needs_review` berechnet — `needs_review`, wenn ein Feld unter der
  Schwelle liegt UND (Wert vorhanden ODER Pflichtfeld); leere optionale Felder lösen
  bewusst keinen Dauer-Alarm aus. Schwelle: neues `extraction.review_threshold`
  (Einstellungen, optional) → sonst `confidence_threshold` → 0.6.
- **Lernen aus dem Batch**: Batch-Dateien speichern jetzt den `document_text`
  (Migration `0026`; Railway: YAML-Feld; nur im Detail-Endpoint, nicht im Polling).
  Neue Route `POST …/batches/:runId/files/:fileId/learn` → `train()` mit
  initial/corrected → Datei erhält die korrigierten Werte + Status **„Geprüft"**
  (Original bleibt im Trainingsbeispiel erhalten). Ab dem dritten Beispiel greift
  automatisch der W2-Champion/Challenger-Lauf.
- **Kalibrierung** (`learning.calibration`, Aggregat in 5 Konfidenz-Buckets, kein
  neuer Storage): `train()` nimmt optional `field_confidences` und zählt je Feld,
  ob die initiale Extraktion tatsächlich korrekt war (typ-normalisiert via W2-
  `compareField` — Formatabweichungen zählen nicht als Fehler). Gespeist aus beiden
  Korrekturwegen (Training-Tab sendet seine Konfidenzen jetzt mit; Batch-Review
  sowieso). RulesTab „Qualität" zeigt ab 10 Stichproben je Bucket „Konfidenz X–Y% →
  Z% tatsächlich korrekt" + Überkonfidenz-Hinweis.
- **UI (Verarbeiten-Tab)**: Spalte „Prüfung" mit Badges (Zu prüfen/Auto-OK/Geprüft),
  Zähler im Lauf-Header, Filter-Chips; Detailansicht ist ein Korrektur-Formular
  (gemeinsame neue `FieldInputControl` für Skalare — auch das Training-Formular
  nutzt sie jetzt — plus `ListItemsEditor` für Positionen), mit Konfidenz je Feld
  und (korrigiert)-Markierung. Alte Läufe ohne Dokumenttext: Hinweis, Lernen inaktiv.
- **Verifiziert:** 136 Backend-Tests grün (13 neue Review-Tests: Triage-Regeln,
  Bucket-Mathe, Format-Normalisierung); E2E lokal: Pflichtfeld leer → `needs_review`,
  learn-Route → Beispiel mit 2 Korrekturen, Datei `reviewed` mit korrigierten Werten,
  Kalibrierung gefüllt (Bucket 4 korrekt); document_text nur im Detail-Response;
  Migration 0026 beim Boot. Railway gespiegelt (YAML-Variante + Smoke-Test:
  reviewStatus in Summary, documentText nur im Detail).
  Doku: `docs/extraktion-review-workflow-2026-07-28.md`.

## 2026-07-27

### Feature: Extraktion — Eval-Harness & Audit (Ausbau-Welle 2)
Der Lern-Loop misst sich jetzt selbst: Jede Guideline-Regeneration läuft als
**Champion/Challenger-Eval** gegen die Trainingsbeispiele — nur messbar bessere oder
gleich gute Regeln werden übernommen. Regel-Regressionen sind damit ausgeschlossen.
- **Eval-Mechanik** (`learning/eval.ts`): Beispiele werden text-only re-extrahiert
  (gespeicherter `document_text`, single-pass mit Auto-Eskalation, **ohne Few-Shot** —
  Leakage-Vermeidung, gemessen wird genau das, was sich ändert) und Feld für Feld
  normalisiert gegen die Ground Truth (`corrected_extraction`) verglichen: DE-Zahlen
  (Epsilon), Datumsformate, Whitespace/Case, Bool-Varianten, **Listen als ordnungs-
  unabhängiges Multiset**. Metriken: Accuracy je Feld + Overall (Prozent).
- **Champion/Challenger** (`runGuidelineUpdate` in `learning/service.ts`): läuft im
  **Hintergrund** (train blockiert nicht mehr; UI pollt `learning.eval.status`).
  Champion-Score wird gecacht (Eval-Set-Hash aus Beispiel-IDs+Modell+Cap) und nur bei
  geändertem Set neu gemessen. Cap `EXTRACTION_EVAL_CAP` (20, neueste zuerst),
  Concurrency `EXTRACTION_EVAL_CONCURRENCY` (3). Bei Eval-Fehlern (>50 % Ausfälle)
  bleiben die Regeln unverändert (sicherer Default). In-Memory-Lock je Projekt.
- **Engine additiv**: neuer Config-Schalter `llm_confidence` (Default true) schaltet
  die LLM-Selbstbewertung der Confidence ab — Eval-Läufe nutzen nur die Heuristik.
- **Ergebnis-Zustand** in `learning.eval` (jsonb/YAML, keine Projekt-Migration):
  `champion` (Overall + je Feld + Modell + Version), `last_run`
  (accepted/rejected/measured/error inkl. Delta), `history` (Cap 20).
- **Audit an jedem Ergebnis**: `extract()` liefert `audit { guideline_version, model,
  strategy }`; Batch-Dateien speichern es (Migration `0025` Spalte `audit` jsonb;
  Railway: YAML-Feld) und Summary/Detail geben es zurück.
- **UI (RulesTab)**: neuer Abschnitt **„Qualität (gemessen)"** — gemessene Genauigkeit
  groß, Feld-Accuracy-Grid (grün/gelb/rot), letzter Lauf („Regel-Update verworfen:
  −x Pp …"), Verlauf; Buttons „Voll-Eval starten" (`POST /projects/:id/evaluate`) und
  „Neu ableiten & messen"; Live-Polling während des Laufs. Batch-Detail zeigt eine
  Audit-Zeile (Strategie · Modell · Regeln vN).
- **Verifiziert:** 123 Backend-Tests grün (19 neue Eval-Tests: Normalisierung,
  Listen-Multiset, Accuracy-Mathe, Hash, Akzeptanz); E2E lokal: 3 korrigierte
  Trainings → Hintergrund-Update (running→idle), Champion 100 % auf 3 Beispielen,
  Regeln v1 übernommen, generierte Regel griff im Folge-Batch nachweislich;
  Voll-Eval `measured`; Lock verhindert Parallel-Läufe (`started:false`); Batch-Audit
  in Summary+Detail; Migration 0025 beim Boot. Railway gespiegelt (YAML-Variante von
  `batch-runs.ts` + Smoke-Test). Doku: `docs/extraktion-eval-harness-2026-07-27.md`.

### Feature: Extraktion — Listen-Felder / Positionsdaten (Line-Items, Ausbau-Welle 1)
Extraktionsprojekte können jetzt **wiederholende Positionen** extrahieren (Rechnungs-/
Lieferschein-/Rezeptpositionen): neuer Feldtyp **„Liste / Positionen"** mit frei definierbaren
Spalten (Text/Zahl/Datum/Ja-Nein, eine Ebene tief). Erste Welle des Ausbaus Richtung
„bestes Tool im Space" (W1 Line-Items → W2 Eval → W3 Review → W4 Eingangsstrecke → W5 API).
- **Engine unverändert** — sie konnte Array-Gruppen bereits (`ArrayGroupDefinition`,
  Schema-Builder, Union-Merge, Validator). Der Projekt-Layer nutzt sie jetzt: jedes list-Feld
  wird im Adapter zur eigenen Array-Gruppe (`pipeline-adapter.ts`); `extract()` entpackt das
  Array unter seiner fieldId (fehlend → immer `[]`).
- **Dedupe** (`learning/list-utils.ts`): Union-Merge konkateniert Chunk-/Seiten-Arrays —
  exakte Duplikate (normalisiert über alle Spalten) werden im Learning-Layer entfernt.
  Grenze: fachlich identische Zeilen kollabieren → unterscheidende Spalte (Pos-Nr/Menge) hilft.
- **Lern-Loop**: corrections erfassen Listen als ein Diff-Eintrag (was/corrected_to als JSON);
  Few-Shot + Guideline-Generator rendern Listen als JSON statt `[object Object]`, inkl.
  Positions-Zähler-Hinweis; Guideline-Prompt prüft explizit fehlende/überzählige Positionen
  und Zeilen-Erkennung (Zwischensummen/Rabatte/Versand sind keine Positionen).
- **Validierung** (`learning/validators.ts` → POST/PUT + Import): Liste braucht ≥1 Spalte,
  Spalten skalar+Label, fieldId `felder` reserviert (Namespace-Kollision Pipeline).
- **Exporte**: XLSX bekommt **pro Listen-Feld ein eigenes Tabellenblatt** (eine Zeile je
  Position, Spalte „Datei"); dafür kann `generateDocument`/Excel jetzt **Multi-Sheet**
  (`DocumentSection.sheet`, andere Formate ignorieren es). Hauptblatt/Batch-Tabelle zeigen
  „N Positionen"; to-table schreibt Listen als JSON-Text-Spalte; CSV: JSON in der Zelle.
- **Frontend** (`ExtractionProjectsPage.jsx`): Spalten-Subeditor im Feld-Editor (Anlage +
  Einstellungen), editierbare **Positions-Tabelle** im Training (Zeilen hinzufügen/löschen,
  typgerechte Zellen), read-only Positions-Tabelle im Batch-Detail. Wichtig: `editedValues`
  wird jetzt tief kopiert (`structuredClone`), sonst erkennt der Korrektur-Vergleich
  Zell-Änderungen nicht.
- **Keine Migration** (fields ist jsonb/YAML); Boxes für Listen bewusst nicht (OCR skippt
  Array-Gruppen). `required` in Spalten ist nur UI-Marker (Vision-Kollaps-Schutz wie bei
  Skalarfeldern).
- **Verifiziert:** 104 Backend-Tests grün (neu: Adapter-Gruppen-Mapping, Round-trip, Few-Shot-
  Rendering, 7 Dedupe-Fälle); E2E lokal: Projekt mit Positionen-Liste → Extraktion (3 Positionen,
  DE-Zahlen konvertiert) → Training-Korrektur (ein Listen-Diff) → Zweitlauf nutzt Few-Shot →
  Batch 2 Dateien → XLSX mit Blättern „Daten"+„Positionen" → to-table 2 Zeilen →
  Export/Import-Roundtrip (item_fields überleben) → Validierungs-400er. Railway gespiegelt
  (16 Dateien 1:1, YAML-Roundtrip per Smoke-Test). Doku: `docs/extraktion-line-items-2026-07-27.md`.

## 2026-07-24

### PM: Step-Tabs mit Icons statt Nummern-Kreisen
Die Wizard-Steps in Projektidee, Projektauftrag und Statusbericht zeigen in der Step-Leiste jetzt **Icons**
(im Stil der Menü-Icons) statt nummerierter Kreise — die Nummerierung hatte Nutzer verwirrt. Umgesetzt in
der gemeinsamen `StepNav.jsx` über eine zentrale Titel→Icon-Zuordnung (`STEP_ICONS`): derselbe Step **nach
Bezeichnung** (nicht Nummer) trägt in allen drei Bereichen dasselbe Icon (Basis=Document, Personen=User,
Ziele=Target, Roadmap=Timeline, Kosten=BarChart, Risiken=AlertTriangle, Übersicht=Apps, …). Icons erben
`currentColor`, die Aktiv/Erledigt-Färbung (primary/success) bleibt. Reine Frontend-Änderung, beide Worktrees.

### PM: Listenansichten Projektideen & Portfolios an Projekte angeglichen
Die drei Top-Level-Listen (Tabs in `ProjektePage`) haben jetzt denselben Aufbau — **Aktionsleiste →
Stats-Grid (4 Karten) → Such-/Filterzeile → Zeilen-Liste**. Führend war die bestehende **Projekte**-
Implementierung; ihr Muster wurde 1:1 auf **Projektideen** (`IdeenPage.jsx`) und **Portfolios**
(`PortfolioList.jsx`) übertragen (vorher: Karten-Grid ohne Zahlen/Suche).
- Projektideen: Kennzahlen Gesamt · In Prüfung · Genehmigt · Abgeleitete Aufträge; Suchfeld +
  Status-Filter; Zeilen-Liste mit Status-Badge rechts. Standalone- und Embedded-Modus identisch.
- Portfolios: Kennzahlen Gesamt · Aktiv · Archiviert · **Budget gesamt** (Summe der Gesamtbudgets aller in
  Portfolios enthaltenen Projekte, via Projekt-ID = Auftrags-ID); Suchfeld + Status-Filter (jetzt
  clientseitig, alle Portfolios geladen); „Neues Portfolio" öffnet weiter das Create-Modal.
- Filterung via `useMemo` (statt setState-im-Effect); reine Frontend-Änderung, in beiden Worktrees identisch.

### PM: Wissenspool-Chat im Projektauftrag-Slate
Das rechte Slate im Projektauftrag-Wizard hat einen dritten Tab **Chat**, mit dem man gegen den
Wissenspool des **aktuellen Schritts** sprechen kann. Antworten sind auf das Masterclass-Wissen des
Steps **und die aktuellen Eingaben des Nutzers** geerdet und **streamen** token-weise (SSE). Tab-
Reihenfolge jetzt **Chat (Default) → KI-Analyse → Wissen**; der Button „KI-Analyse starten" wurde von
über den Tabs **in den KI-Analyse-Tab** verschoben (war zuvor verwirrend). Chat-Verlauf ist **ephemeral
pro Step** (kein Storage; beim Reload zurückgesetzt).
- Backend: neuer Streaming-Endpoint `POST /knowledge/:step/chat` (`llmService.streamChat`); neue Exporte
  `buildStepChatSystemPrompt` + `extractStepData` in `analysis.ts` (nutzt bestehendes
  `generateAnalysisPrompt` + `STEP_DATA_EXTRACTORS`, inkl. neuem Basis-Extractor für Step 1).
- Frontend: neue `StepChat.jsx` (SSE-Reader nach dem Muster aus `ImportPage`), Tab-Umbau in
  `KnowledgePanel.jsx`, ephemerer Verlauf in `WizardPage.jsx` (analog `stepAnalyses`, aber nicht gespeichert).
- Layout: das rechte Slate ist **sticky** (bleibt beim Scrollen im Viewport, feste Höhe = Viewport minus
  Header), während Seite/Formular unverändert natürlich weiterscrollen — so bleibt die Chat-Eingabe sichtbar,
  ohne das bestehende Wizard-Layout anzutasten.
- Assistenten-Antworten rendern **Markdown** (`react-markdown`, kompakter Komponenten-Satz; ohne remark-gfm,
  um Dependency-Gleichstand beider Worktrees zu wahren).
- Nebenbei-Fix: `generateAnalysisPrompt` (`knowledge.ts`) crasht nicht mehr, wenn die Prüfkriterien eines
  Steps als (leeres) Objekt statt Array vorliegen — traf Steps 6/7 und führte zu „Chat fehlgeschlagen".
- In beiden Worktrees identisch (`analysis.ts`/`knowledge.ts`/Frontend kopiert, `routes.ts`-Block eingefügt).

### Fix(PM): KI-Analyse im Roadmap-Schritt war leer
Die KI-Analyse im Projektauftrag-Wizard zeigte im **Roadmap-Schritt** (der als einziger zwei
Backend-Steps zusammenführt: Meilensteine + Hauptaufgaben) immer Score 0 und leere Stärken/
Verbesserungen/Empfehlungen/Konsistenz. Ursache: der Merge in `KnowledgePanel.jsx` las die falschen
Felder (`r.score`/`r.staerken`/`r.konsistenz` statt `r.masterclassAnalysis.*`/`r.konsistenzAnalysis.*`)
und erzeugte eine flache Struktur, die `AnalysisResult` nicht rendern konnte. Merge liest jetzt aus
`masterclassAnalysis`/`konsistenzAnalysis` und baut wieder dieselbe verschachtelte Struktur (Score-
Mittel, präfixierte Stärken/Schwächen/Hinweise, schlechtester Konsistenz-Status, Findings als Objekte
mit präfixiertem Bereich). Nur Frontend; in beiden Worktrees identisch.

### PM: Import/Export der Auswahllisten (CSV/Excel) inkl. leerem Template
Auswahllisten der Projektmanagement-App (19 Listen + Abschluss-Checkliste) lassen sich in den
Einstellungen jetzt als **Excel** (ein Tabellenblatt pro Liste) oder **CSV** (flach: `liste,
schluessel,anzeige`) exportieren und importieren — als Datei-Transport zwischen getrennten Kunden-
Instanzen (so entstehen faktisch branchenspezifische Sets). Zusätzlich ein **leeres Template** zum
Download (editierbare Listen leer, gesperrte Liste `idee_status` mit fixen Schlüsseln vorbefüllt).
Import läuft über eine **Vorschau mit Diff** (pro Liste neu/geändert/entfernt, Checkbox): angehakte
Listen werden komplett ersetzt, nicht angehakte bleiben unverändert; gesperrte Wert-Listen
übernehmen nur Anzeigenamen. Alle Endpoints App-Owner-only.
- Neu: `backend/src/apps/projektmanagement/config-io.ts` (+ Tests), Endpoints in `routes.ts`
  (`GET config/export`, `GET config/template`, `POST config/import/preview|apply`).
- Neu: `frontend/.../components/ConfigImportModal.jsx`, Aktionsleiste in `Einstellungen.jsx`,
  Hook-Methoden in `useProjektmanagement.js`. Nutzt bestehendes ExcelJS (keine neue Dependency).
- Identisch im Scalingo/DB-Worktree (main) umgesetzt — läuft über die gemeinsame
  `getConfig()`/`saveConfig()`-Abstraktion.

## 2026-06-22

### Config-Fix: Qwen 3.5 als vision-fähig korrigiert + Standalone Split-Test-Tool
- **`providers.yaml`**: `qwen3-5-a3b-35b-256k` (Instruct) und `qwen3-5-a3b-35bthinking-256k`
  (Thinking) haben jetzt die `vision`-Capability. Empirisch am Adacor-Endpoint verifiziert —
  beide verarbeiten Bilder einwandfrei. Vorher blockierte die Plattform (`loop.ts`
  Capability-Check) Bildaufgaben für diese Modelle → Ursache, dass Vision-Anwendungsfälle
  (z. B. Dokument-Split-Prüfung) mit Qwen 3.5 „gar nicht funktionierten".
- **`tools/document-split-test.ts`** (neu): standalone Bun-Skript (keine Framework-Imports)
  zur Grenzprüfung von Dokument-Splits via Vision-LLM. CLI-Argumente (Seiten, Modelle,
  Prompt, Base-URL, Key); läuft beim Kunden mit nur Bun + API-Key.

### PM-App: Verdrahtete Config-Listen — Schlüssel in der UI gesperrt
Listen, deren Schlüssel (value) im Code fest verdrahtet sind (Status-Zuordnung/Badges/Filter),
sind in den PM-Einstellungen jetzt geschützt: **Schlüssel read-only, kein Hinzufügen/Löschen,
nur der Anzeigename ist editierbar** — mit Hinweis „🔒 Schlüssel fixiert". Verhindert, dass die
automatische Status-Zuordnung durch Schlüssel-Änderungen bricht. Aktuell betrifft das die Liste
**Projektidee-Status** (`idee_status`); generischer Mechanismus (`LOCKED_KEY_FIELDS`) für künftige
verdrahtete Listen. Datei: `frontend/src/apps/projektmanagement/components/Einstellungen.jsx`.

### PM-App: Step-bezogener, additiver Dokument-Import im Projektauftrag-Wizard
Zusätzlich zum bestehenden Voll-Import gibt es jetzt pro Wizard-Step (1–7) einen
**„Aus Dokument importieren"**-Button. Er extrahiert nur die Felder des aktuellen Steps
und ergänzt **additiv**:
- **Listen-Einträge** (Kriterien, Aufgaben, Meilensteine, Quality Gates, Budget, Risiken,
  Team, Stakeholder, In/Out-Scope) werden **angehängt** — bestehende nie ersetzt/gelöscht
  (rein additiv, keine Dedup).
- **Skalar-Felder** (Basis-Felder, Ziele, Umfang) werden **nur gefüllt, wenn leer**.
- Merge passiert im Frontend in den Live-State; danach normaler „Speichern"-Flow.
- Wiederverwendet die bestehende Extraktions-Pipeline (`processFilesToText` → Step-Teilprofil
  → forced function call); neuer stateless SSE-Endpoint `POST /projektauftraege/import-step/:step`.
- Nur Projektauftrag (nicht Projektidee). Dateien: `import-service.ts` (`buildStepProfile`,
  `extractStepFromFiles`, Quality-Gates-Gruppe), `routes.ts` (Endpoint), neue
  `components/StepImportButton.jsx`, `WizardPage.jsx` (Button + `mergeStepImport`).
- Kein neues Dependency, keine DB-Migration.

### PM-App: Personen im Statusbericht — Veränderungen dokumentierbar
Der Personen-Tab im Statusbericht war read-only. Jetzt lassen sich je Person
**Veränderungen im Projektverlauf** erfassen — konsistent zum Snapshot+Tracking-Muster
der anderen SB-Abschnitte (Ziele/Roadmap/Risiken):
- Stammdaten (Name, Rolle, Gruppe, …) bleiben **read-only Snapshot** (mit Drift-Hinweis).
- Pro Person editierbar: **Status** (Unverändert / Neu hinzugekommen / Ausgeschieden /
  Rolle-Daten geändert) + **Bemerkung** (berichtsbezogen). Tracking wird bei SB-Erstellung
  aus dem letzten Bericht übernommen.
- Dateien: `types.ts` (`PersonTracking` + `organization_tracking`/`stakeholders_tracking`),
  `statusbericht-service.ts` (Prefill), `StatusberichtPersonen.jsx` (editierbar),
  `WizardPage.jsx` (onChange). Keine DB-Migration (jsonb).

### PM-App: Neue Gantt-Roadmap (Projektauftrag + Statusbericht)
Die bisherige Linien-Timeline (unleserlich bei nahen Terminen, nur Meilensteine + QG)
wurde durch eine **Gantt-/Zeitachsen-Darstellung** ersetzt:
- **Treppenstufen-Lanes** (Greedy-Packing) → keine Überlappung mehr bei nah beieinander
  liegenden Ereignissen.
- Zeigt **Hauptaufgaben (Balken)**, **Meilensteine (Raute)** und **Quality Gates (Schild)**
  auf einer Zeitachse mit Monats-/Quartals-Ticks und **Heute-Marker**.
- **Hover-Tooltip** + **Klick springt zum Listeneintrag** (scrollt + hebt die Card hervor).
- **Vollbild-Modal** für lange Laufzeiten; Monat/Quartal-Umschaltung der Achse.
- **Statusbericht**: gleiche Grafik mit **Ampel-Farben**, Task-**Fortschritt** und
  **Ist-Datum**-Markern/Abweichung (nutzt das vorhandene Tracking) — inkl. Hauptaufgaben.
- Neue, wiederverwendbare Komponente `GanttRoadmap.jsx` (custom SVG, kein Dependency) +
  `RoadmapModal.jsx` + Helfer `roadmap-utils.js`; Item-Modell Portfolio-ready vorbereitet.
- Alte `MilestoneTimeline.jsx` und interner `SollIstTimeline` entfernt.

### PM-App: Projektidee-Basisdaten an die Config angebunden
Die Basisdaten-Auswahlfelder der Projektidee waren hartkodiert. Jetzt kommen sie — wie im
Projektauftrag — aus der App-Config:
- **Neue konfigurierbare Liste „Projektidee-Status"** (`idee_status`) in den Einstellungen
  (Default: Entwurf/In Prüfung/Genehmigt/Abgelehnt/Archiviert). Werte bleiben stabil
  (Badges/Filter sind daran verdrahtet), Labels editierbar.
- **Projektstatus** in der Idee ist jetzt ein **Dropdown** (Config `project_status`, dieselbe
  Liste wie im Projektauftrag) statt Freitext.
- Projekttyp, Projektgröße, Priorität ebenfalls aus der Config (`project_type`, `project_size`,
  `priority`) — keine duplizierten Listen mehr in `IdeeBasis.jsx`.
- Dateien: `backend/.../storage.ts` (Default `idee_status`), `Einstellungen.jsx` (neue Liste),
  `components/idee-steps/IdeeBasis.jsx` (Config-Anbindung).

### PM-App: Sicherheitsabfrage vor „Auftrag aus Idee erstellen"
Bevor aus einer Projektidee ein Projektauftrag erzeugt wird, erscheint nun ein echtes
Bestätigungs-Modal (`ConfirmModal`) statt der Aktion ohne Rückfrage. Erst nach Bestätigung
wird gespeichert + der Auftrag erstellt. Datei: `frontend/src/apps/projektmanagement/IdeeWizardPage.jsx`.

### Fix(PM): KI-Gesamtbewertung crasht nicht mehr bei unvollständigen Schritt-Analysen
Die Gesamtbewertung brach in manchen Projekten mit
`undefined is not an object (evaluating 'analysis.masterclassAnalysis.score')` ab.
Ursache: `parseGesamtResponse` (`analysis.ts`) griff ungeschützt auf
`analysis.masterclassAnalysis.score`/`.hinweise[0]` zu — bei älteren/teilweise
gespeicherten Schritt-Analysen ohne `masterclassAnalysis` führte das zum Absturz.
Behoben durch defensives Optional-Chaining + Fallbacks (Schritt wird übersprungen
statt zu crashen). Datei: `backend/src/apps/projektmanagement/analysis.ts`.

### PM-App: KI-Analyse kennt jetzt die erfassbaren Felder (Konzept→Feld-Mapping)
Die Schritt-Analyse (Stärken/Verbesserungspotential im KnowledgePanel) bekam bisher nur
die Eingabewerte + Masterclass-Best-Practices — **nicht** das Datenmodell. Dadurch schlug
das LLM Verbesserungen vor, die im Tool gar nicht erfassbar sind, oder meldete bereits über
ein Feld Abgedecktes (z. B. Auftraggeber via Rolle/Gruppe) als fehlend.
- Neuer, code-eigener `STEP_FIELD_SCHEMA` (Schritte 2–7) beschreibt je Schritt die
  erfassbaren Felder **und** das Mapping von Masterclass-Konzepten auf vorhandene Felder
  (z. B. Auftraggeber→Gruppe/Rolle, Verantwortlichkeiten→Aufgabe, Stellvertreter→Bemerkung,
  kein separater Jobtitel).
- `buildUserPrompt`: injiziert die Sektion „Im Tool erfassbare Felder …".
- `buildSystemPrompt`: Regeln — nur einpflegbare Vorschläge; bereits per Feld Abgedecktes
  anerkennen statt als fehlend melden; Freitext-Bezug; keine nicht existierenden Felder fordern.
- Datei: `backend/src/apps/projektmanagement/analysis.ts`. Keine UI-/Datenmodell-Änderung.

## 2026-06-21

### PM-App: Personen-Maske erweitert + in Projektidee & Statusbericht verfügbar
Die Eingabemaske „Personen" wurde ausgebaut und modulübergreifend nutzbar gemacht:
- **Neue Felder** in den Projektteam-Zeilen (analog Toolbox): **Aufgabe** (Freitext),
  **Gruppe** (neue konfigurierbare Liste, Basiswerte Auftraggeber/Projektteam/Stakeholder),
  **Bemerkung** (Freitext). Stakeholder-Tab und Klassifizierungs-Matrix unverändert.
- **Projektidee**: Die Personen-Maske ist nun als eigener Schritt (Step 2) verfügbar —
  dieselbe Komponente wie im Projektauftrag (`steps/Personen.jsx`, via Adapter
  `idee-steps/IdeePersonen.jsx`). Zusätzlich Feld **Geplanter Einsatz** (Zahl + %/PT,
  `{ wert, einheit }`) je Person — Grundlage für spätere Ressourcen-/Portfolio-Planung.
  Der Idee-Wizard lädt dafür jetzt die App-Config.
- **Statusbericht**: neuer **read-only Tab „Personen"** (Snapshot bei SB-Erstellung +
  Drift-Hinweis, analog Ziele/Roadmap) — listet Projektteam + Stakeholder auf.
- **Config**: neue Liste **„Gruppe"** in den PM-Einstellungen (Backend-Default in
  `storage.ts`, UI in `Einstellungen.jsx`).
- Persistenz ohne DB-Migration (jsonb-Blobs); Backend-Typen (`TeamMember`, `Projektidee`,
  `Statusbericht`) entsprechend ergänzt.

### PM-App: Tab-Reihenfolge am Projektlebenszyklus ausgerichtet
Die Top-Level-Navigation der Projektmanagement-App folgt nun dem Lebenszyklus:
**Projektideen → Projekte → Portfolios**. Der Tab **Einstellungen** wird ans rechte
Ende der Tab-Leiste geschoben (`marginLeft: auto`).
- Datei: `frontend/src/apps/projektmanagement/ProjektePage.jsx` (TABS-Array umgeordnet,
  Render mit Rechts-Ausrichtung für `einstellungen`).

### PM-App: Konfigurierbare Listen zeigen ihren Einsatzort
In den PM-Einstellungen (Auswahloptionen) steht nun unter jeder Listenbezeichnung
ein Untertitel **„Verwendet in: …"**, der das Modul/die Eingabemaske nennt, in der
die Liste genutzt wird (z. B. Wahrscheinlichkeit → Projekt-Wizard (Risiken),
Statusberichte, Abschlussbericht). Die bisher in einzelne Labels gebackenen Zusätze
wie „(Statusberichte)" wurden in den strukturierten Untertitel überführt.
- Datei: `frontend/src/apps/projektmanagement/components/Einstellungen.jsx`
  (`FIELD_USAGE`-Map + Untertitel-Rendering, Labels bereinigt).

### PM-App: Einheitliche Step-Navigation (Projektauftrag, Projektidee, Statusbericht)
Die Step-/Sub-Navigation der drei Projektauftrag-basierten Masken ist vereinheitlicht —
auf Basis des Projektauftrags. Neue gemeinsame Komponente **`StepNav`** (nummerierte
Kreis-Tabs) ersetzt drei zuvor unterschiedliche, duplizierte Implementierungen:
- **Statusbericht** erhält jetzt **Nummerierung + Kreise** (vorher reiner Text ohne Nummern);
  „SB #N" links, Export/Speichern rechts (via `leading`/`trailing`-Props).
- **Einheitliche, rein inhaltsbasierte „erledigt"-Logik** überall: aktueller Schritt = teal,
  Pflichtdaten vorhanden = grün, sonst grau. Kein positionsbasiertes „Schein-Grün" mehr für
  bereits passierte, aber leere Schritte (vorher führte das zu flackernder Übersicht-Färbung
  je nach Navigation). Die Projektidee nutzt damit nicht mehr die abweichende besuchsbasierte
  Logik (`maxVisitedStep` entfernt).
- **Übersicht-Schritte** (ohne eigenen Inhalt) werden grün, sobald alle vorherigen Schritte
  erledigt sind — einheitlich bei Projektidee (Step 6) und Projektauftrag (Step 8).
- Dateien: `frontend/src/apps/projektmanagement/components/StepNav.jsx` (neu),
  `WizardPage.jsx` (Step-Nav + Statusbericht-Sub-Nav via StepNav, `isSbStepCompleted`/
  `getSbStepStatus`, alte Styles entfernt), `IdeeWizardPage.jsx` (StepNav, `isStepCompleted`).

## 2026-06-16

### Feature: Modell-Auswahl je Extraktionsprojekt in der UI (analog zu Agenten)
Das `model_override` eines Extraktionsprojekts war bisher nur per Script setzbar und in der UI
unsichtbar. Jetzt gibt es — wie bei Agenten — ein Dropdown **„KI-Modell (optional)"** bei der
Projektanlage und in den Einstellungen.
- Listet die aktiven Chat-/Vision-Modelle (über den `useProviders`-Hook); vision-fähige sind mit
  „· Vision" markiert (Vision-Strategien brauchen ein vision-fähiges Modell). „System-Standard
  verwenden" = kein Override.
- Gespeichert als `extraction.model_override = { provider_id, model_id }` bzw. `null`. Die
  Backend-Pipeline wendet den Override bereits in allen Strategien + im Repair-Pass an; ein aktuell
  gesetztes, aber nicht (mehr) in der Provider-Liste vorhandenes Modell bleibt im Dropdown erhalten.
- Reines Frontend (`ExtractionProjectsPage.jsx`, neue `ModelOverrideSelect`-Komponente). Aus dem
  Scalingo-Worktree gespiegelt; Build grün.

### Feature: Export & Import von Extraktionsprojekten (Weitergabe als Vorlage)
Ein gut angelerntes Projekt lässt sich als portables **.json-Paket** exportieren und auf einer
anderen Workplace-Instanz importieren — z. B. eine bewährte, allgemeingültige Vorlage für andere
Kunden, ohne sie in den Seed zu zwingen.
- **Inhalt:** Schema (Felder), Domänen-Anweisungen und gelernte **Guidelines** sind immer dabei
  (generalisiert, PII-frei). Die rohen **Trainingsbeispiele** (enthalten Originaldokumente/PII)
  wandern nur mit, wenn beim Export explizit angehakt — Default: ohne.
- **Import** legt **immer ein neues Projekt** an (frische ID; Name bei Kollision mit „(Import)"-
  Suffix). Guidelines + Lern-Metadaten werden wiederhergestellt; enthaltene Beispiele angelegt
  (Korrekturen werden neu abgeleitet).
- **Backend:** neue `extraction/learning/transfer.ts` (`exportProject`/`importProject`) — baut nur
  auf bestehenden CRUD-Funktionen auf, daher in beiden Worktrees (Postgres/YAML) identisch, **keine
  neue Storage-Divergenz**. Routen: `GET /projects/:id/export?examples=` (JSON-Download) und
  `POST /projects/import` (JSON oder Datei-Upload).
- **Frontend (`ExtractionProjectsPage.jsx`):** „Importieren"-Button in der Projektliste
  (JSON-Upload, öffnet danach das neue Projekt) und Bereich „Export & Weitergabe" in den
  Einstellungen (Checkbox „Trainingsbeispiele einschließen" + Download).
- **Verifiziert:** YAML-Transfer-Pfad per Smoke-Test bestätigt (Import mit Guidelines/Learning/
  Beispiel, Re-Export-Roundtrip, Cleanup); tsc ohne neue Fehler, Build grün. Aus dem Scalingo-
  Worktree gespiegelt (1:1, da nur gemeinsame CRUD-Funktionen genutzt; dort E2E gegen laufendes
  Backend verifiziert).

## 2026-06-15

### Fix: Batch-Ergebnistabelle bei vielen Feldern (Layout-Überlauf)
Bei Projekten mit vielen Feldern (z. B. 21 bei den Sani-Rezepten) lief die Ergebnistabelle weit
über den Bildschirm hinaus. Ursache: fehlendes `min-width: 0` am Flex-Content-Bereich (die Tabelle
zwang den ganzen Bereich breiter statt zu scrollen). Jetzt scrollt die Tabelle **horizontal
innerhalb der Karte**, die **Datei-Spalte ist beim Scrollen fixiert** (sticky), und lange Feldwerte
werden einzeilig gekürzt (Ellipsis + Tooltip mit dem vollen Wert). Vollständige Werte weiterhin in
der aufklappbaren Detailansicht und im Export.

### Feature: Manuelle Batch-Extraktion — „Verarbeiten"-Tab (Nutzungsdimension UI)
Neuer Tab in den Extraktions-Projekten, über den man per **Multi-Upload** mehrere Dokumente durch
ein angelerntes Projekt jagt, den **Status je Dokument** verfolgt, **Ergebnisse** prüft und
**exportiert**. Erste der drei geplanten Nutzungsdimensionen (UI; API + App/Agent/Skill folgen).
- **Serverseitige Persistenz + Hintergrund-Verarbeitung:** Upload startet einen Lauf (fire-and-
  forget), der die Dokumente mit begrenzter Parallelität (pLimit 3, `EXTRACTION_BATCH_CONCURRENCY`)
  durch den bestehenden `extract()`-Pfad verarbeitet; das Frontend pollt den Status. Lauf-Historie
  + Ergebnisse überstehen Reload/Navigation. Fail-Soft je Datei, Temp-Cleanup.
- **Backend:** neue `extraction/learning/batch-runs.ts` (Persistenz: **YAML** unter
  `data/extraction-projects/{id}/batch-runs/{runId}/`) und `batch-service.ts`
  (`runBatchExtraction`). Routen unter `/projects/:id/batches`: Start (multipart), Historie,
  Run+Summaries, Datei-Detail (boxes+pageImages on-demand), `export.xlsx` (`generateDocument`),
  `to-table` (Felder→Tables-Columns, `createTable`+`addRow`), Delete. Zwei Datentier: Summary fürs
  Polling, schwere Detail-Daten (Seitenbilder) nur beim Aufklappen. Keine neuen Dependencies.
- **Frontend (`ExtractionProjectsPage.jsx`):** `BatchTab` mit Multi-Dropzone, Fortschritt +
  Status-Badges, Lauf-Historie, Ergebnistabelle (Zeile=Dokument, Spalten=Felder, Ø-Confidence),
  aufklappbarer Detail-Vorschau (wiederverwendetes `BoxOverlay`), `ExportDropdown`
  (CSV/XLSX/JSON) + „In Tabelle schreiben".
- **Verifiziert:** Aus dem Scalingo-Worktree gespiegelt (nur `batch-runs.ts` als YAML-Variante, Rest
  1:1 zur dort per E2E verifizierten Implementierung). tsc ohne neue Fehler, Frontend-Build grün;
  YAML-Persistenz per isoliertem Smoke-Test bestätigt (create→status→upsert→list/get/detail→delete).
  Doku: `docs/batch-extraktion-ui-2026-06-15.md`.

## 2026-06-14

### Feature: Extraktions-Projekte — Klick-zum-Feld-Navigation (Bounding-Boxes interaktiv)
Die OCR-Bounding-Boxes im Training-Tab sind jetzt **bidirektional klickbar** — der Nutzer
springt direkt zwischen Markierung im Dokument und Eingabefeld hin und her, um Fehlerwerte
schneller zu korrigieren.
- **Box → Feld:** Klick auf eine Markierung im Dokument scrollt rechts zum zugehörigen
  Eingabefeld und setzt den Fokus hinein (sofort korrigierbar). Header-Hinweis „Markierung
  anklicken zum Bearbeiten".
- **Feld → Box:** Klick auf den `◉`-Marker am Feldlabel scrollt das Dokument zur Box und
  lässt sie kurz aufblitzen (`@keyframes boxpulse`), inkl. Feld-Label-Tooltip.
- **Frontend:** `ExtractionProjectsPage.jsx` — `BoxOverlay` um `onBoxClick`/`scrollToField`
  (+ `boxRefs`/`scrollIntoView`) erweitert; TrainingTab mit `fieldRowRefs` + Handlers
  `focusFieldFromBox` / `locateOnDoc`. Reines UI, keine Backend-Änderung.
- **Verifiziert:** Frontend-Build grün (beide Worktrees). In beiden Worktrees gespiegelt.

## 2026-06-12

### Fix: Google-Sheets-Schreibfehler "Unable to parse range: Sheet1!A2" (Locale-Tab-Name)
Bei DE-Google-Konten heißt das erste Tabellenblatt **"Tabelle1"**, nicht "Sheet1" — der Agent
riet "Sheet1" und das Schreiben scheiterte. Behoben im `google-workspace`-Connector:
- `gsheets_create_spreadsheet` gibt jetzt den echten **`firstSheetTitle`** + einen Hinweis
  zurück (intern auch der Default auf "Tabelle1" statt "Sheet1").
- Tool-Beschreibungen von `gsheets_write_range`/`gsheets_read_range`: Bereich **ohne
  Tabellennamen** (z.B. "A1:A6") trifft automatisch die erste Tabelle (empfohlen); mit
  Tabellenname exakt den `firstSheetTitle` nutzen, **nicht "Sheet1" raten**.
Beide Worktrees.

## 2026-06-11

### Fix: Supervisor-Routing für Google Sheets/Docs (delegierte an google-drive statt google-workspace)
Der Supervisor delegierte „erstelle ein Google Sheet" an den **read-only** `google-drive`-Agenten
statt an `google-workspace` (Sheets/Docs anlegen+schreiben) → Sheet wurde nie erstellt. Ursache:
zwei hartkodierte Stellen kannten den neuen `google-workspace`-Agenten nicht. Behoben:
- `data/agents/supervisor/config.md`: explizite Google-Agenten-Wahl ergänzt — `google-workspace`
  für Sheets/Docs **anlegen/schreiben**, `google-drive` nur **lesen**; Beispiel-Delegation für
  „Erstelle ein Google Sheet …" hinzugefügt.
- `delegate_to_agent`-Tool-Beschreibung: `google-workspace` in die Agentenliste aufgenommen,
  `google-drive` als read-only markiert.
Beide Worktrees.

### Tuning: Schwelle für Task-Auslagerung bei Delegation hochgesetzt (inline statt Hintergrund)
Bisher wurde eine Delegation an einen Agenten mit `maxIterations > 10`
(`MAX_DELEGATED_ITERATIONS`) automatisch in einen Hintergrund-Task ausgelagert — das stört
längere Workflow-Ketten im Chat (und die Task-Übergabe an Agenten ist weniger zuverlässig).
Neu: eigene, entkoppelte Schwelle `BACKGROUND_TASK_ITERATION_THRESHOLD` (Default **30**,
per ENV `BACKGROUND_TASK_THRESHOLD` tunebar) nur für die Auslagerungs-Entscheidung
(`loop.ts`). Der Iterations-Cap selbst (`MAX_DELEGATED_ITERATIONS`) bleibt unverändert, d.h.
Agenten mit Budget ≤ Schwelle laufen jetzt **synchron inline** im Chat. Beide Worktrees.

### Feature: Google Docs & Sheets Connector (read+write, ohne Google-Verifizierung)
Neuer Connection-Provider `google-workspace` ("Google Docs & Sheets") — ein Connect für
Sheets **und** Docs, nutzt die **zentrale Adacor-Google-App** (`GOOGLE_CLIENT_ID/SECRET`,
per-User-OAuth wie Drive/Mail). Bewusst Scope **`drive.file`** (non-sensitive) → **keine
Google-Freigabe/Verifizierung nötig**, auch in Production. Damit legt der Agent **eigene**
Sheets/Docs an und liest+schreibt sie voll (sowie per Picker freigegebene Dateien) — nicht
beliebige bestehende Privatdateien (das bräuchte sensible Scopes + Verifizierung).
- Tools: `gsheets_create_spreadsheet`, `gsheets_write_range`, `gsheets_read_range`,
  `gdocs_create_document`, `gdocs_append_text`, `gdocs_read_document`.
- Generische OAuth-Connect/Callback-Routen greifen automatisch (Provider registriert).
- Setup-Hinweis: im zentralen Projekt Sheets-API + Docs-API aktivieren, Scope `drive.file`
  am Consent-Screen ergänzen, Callback `…/api/connections/google-workspace/callback` je
  Instanz im selben Client.
- Beide Worktrees, tsc 0 Fehler.

### Doku: Google-Connector-Anleitung auf zentrales Adacor-Modell korrigiert
Die Setup-Anleitung (`setupGuide`) der Google-Drive- und Google-Mail-Connector beschrieb
fälschlich ein **Pro-Instanz-Setup** (jeder Admin legt ein eigenes Google-Projekt + OAuth-App
an, nur localhost-Callback) — für den Adacor-SaaS-Betrieb irreführend, weil es so aussah, als
müsse jeder Kunde Workplace selbst bei Google registrieren. Umgeschrieben auf das korrekte
**Multi-Tenant-Modell**: **eine** zentrale Adacor-OAuth-App für alle Instanzen, je Instanz nur
die Callback-URL im selben Client ergänzen, gleiche `GOOGLE_CLIENT_ID/SECRET` überall; klare
Rollentrennung **Admin=Adacor (einmal)** vs. **Endnutzer=1-Klick-Verbinden (nie Google
Console)**; Testing-Mode für Workshop, einmalige Google-Verifizierung nur für Production.
Beide Worktrees, Code-Logik unverändert.

### Fix: Bounding-Boxes via OCR (Tesseract) statt Vision-Modell — pixelgenau
Die Vision-Modell-Boxen waren im UI systematisch ~eine Zeile nach oben verschoben.
Umgestellt auf **OCR-Lokalisierung**: Modell liefert Werte, Tesseract liefert die
pixelgenauen Wort-Boxen, auf die die Werte gematcht werden.
- Neu `services/extraction/ocr.ts` (`ocrWordBoxes` via stdin/`OMP_THREAD_LIMIT`,
  `locateValue` inkl. DE-Datumsformate, `computeOcrBoxes`). `vision-per-page` ruft das
  Modell wieder nur fuer Werte; Felder ohne klaren OCR-Treffer bekommen keine Box.
- System-Dependency `tesseract-ocr` (+deu/eng) im Dockerfile (`apk add`). Fehlt es, laeuft
  die Extraktion ohne Boxen weiter.
- **Beide Worktrees**.

### Extraktions-Projekte: Bounding-Box-Overlay — erkannte Felder im Dokument verorten
Vision-per-page liefert pro Feld eine **Bounding-Box**; das UI zeigt die erkannten Werte
als Rechtecke über dem gerenderten Dokument (Hover Feld ↔ Box).
- Vision liefert `{value, bbox}` (`extract-call.ts` + `normalizeBbox`); `vision-per-page`
  trennt Wert/Box und sammelt Seitenbilder. Neue Typen `FieldBox`/`PageImage` durch die
  Pipeline bis in den `extract()`-Response. `pdf.ts` liefert Seiten-Pixelmaße.
- Frontend `BoxOverlay`-Komponente + ◉-Marker an markierten Feldern.
- Sani-Projekt auf Qwen (`model_override`) — beste Extraktion + Boxen.
- v1: nur `vision-per-page`; Box-Genauigkeit = Modellqualität (ausreichend für „Fundstelle").
- **Beide Worktrees**.

## 2026-06-07

### Extraktions-Projekte: Lern-Loop im UI transparent gemacht
Erklaerende Info-Boxen (neue `InfoBox`-Komponente) im Training-Tab (was
„Bestätigen & Lernen" bewirkt), bei der Beispiel-Liste (Few-Shot) und im Regeln-Tab
(auto-generiert vs. feste Anweisungen, Prompt-Reihenfolge). Reines Frontend. **Beide Worktrees**.

## 2026-06-06

### Fix: hybrid-Vision-Fallback ebenfalls auf Freitext-JSON (Folge-Fix)
Wie vision-per-page nutzte auch der Vision-Fallback in `hybrid` Function-Calling auf
Bildern → dieselben Haenger/leeren Felder. Jetzt Freitext-JSON + Timeout/Retry +
Seiten-Skip. E2E auf Bicker via hybrid: konsistent 21/21 Felder in ~6s. **Beide Worktrees**.

## 2026-06-05

### Doku: Connection-Packages-Konzept um Identitätsmodelle & Kommerz erweitert
`docs/konzept-connection-packages-2026-06-05.md` erweitert (beide Worktrees, identisch).
Bisher deckte das Konzept nur den OBO-Fall ab (Nutzer verbindet eigenes Konto, Assistent
handelt in seinem Namen). Neu ergänzt:
- **Abschnitt 7 „Identitätsmodelle & Betriebsmodi"**: Trennung der Achsen *Identität*
  (OBO-User vs. Dienst-Identität) und *Auth-Mechanismus* (OAuth vs. API-Key/Service-Account
  — deckt Integrationen ohne OAuth2 ab); Connection = *Integration* + 1..N *Identitäten*;
  drei Betriebsmodi (A persönlich/OBO, B1 geteiltes Wissen, B2 autonom/geplant); mehrere
  Dienst-Identitäten pro Integration; Governance-Kippeffekt (Daten-Gateway); 3-Tore-Modell
  (Scope/Build/Nutzung), Pflicht-Scope-Beschreibung als Schutzgrenze, Bindungs-Leitplanken
  (keine In-Chat-Wechsel, OBO=Aufrufer, kein OBO→Dienst-Fallback), HR-Assistent-Beispiel.
- **Abschnitt 8 „Kommerzielle Betrachtung"**: autonome Dienst-Assistenten (B2) sprengen das
  Per-Seat-Modell → eigene Preis-/Budget-Achse (Service-Seat/Credits/Hybrid) + Kosten-Governance.
- Anpassungen an Fundament (Identitäts-Hinweis), Connection-Baustein, Rollen-Tabelle
  (neu: Assistenten-Erbauer), offene Designfragen (Automatisierungs-Runtime, Kostenmodell)
  und Glossar (Integration, Identität, OBO, Dienst-Identität, Betriebsmodus).

### Fix: vision-per-page — Freitext-JSON statt erzwungenem Function-Calling (Root Cause der leeren Felder)
Die Vision-Extraktion lieferte leere Felder bzw. hing teils >1min, obwohl dasselbe
Bild im Chat (Qwen, Freitext) perfekt gelesen wurde. Ursache: **erzwungenes
Function-Calling auf Bildern** bringt das vLLM-Serving zum Haengen. Test: Function-Call
auf Bild TIMEOUT/3-4 Felder; **Freitext-JSON 19/21 in ~5s** (beide Modelle).

`vision-per-page` ruft das Modell jetzt OHNE Tool/Function-Schema auf und bittet um ein
JSON-Objekt (`extract-call.ts:buildVisionJsonInstruction` + `parseJsonObject`).
E2E konsistent 18-19/21 Felder in ~9-13s inkl. der vorher fehlenden BSNR/LANR/menge.
Text-Strategien bleiben bei Function-Calling. Offen: hybrid-Vision-Fallback (Folge-Fix).
- **Beide Worktrees**.

### Extraktions-Projekte: Training-Upload-UX — Spinner, Fortschritt, Dokument-Vorschau
Beim Hochladen im Training-Tab war bisher intransparent, ob/was passiert. Neu:
- **Status-Karte mit Spinner** statt stillem „Extrahiere…": Dateiname, Elapsed-Timer
  („laeuft seit Ns") und die Pipeline-Schritte (rendern → Vision pro Seite →
  zusammenfuehren) inkl. Hinweis auf moegliche Dauer.
- **Dokument-Vorschau** der hochgeladenen Datei (PDF via <object>, Bilder via <img>)
  sofort beim Upload und in der Ergebnis-Ansicht — die linke Spalte zeigt jetzt das
  echte Dokument statt des verstuemmelten Markitdown-Roh-Texts (der ist nur noch
  optional einklappbar).
- Reines Frontend (`ExtractionProjectsPage.jsx`), Object-URLs werden sauber freigegeben.
- Folge-Schritt: Vorschau der gerenderten Seiten-Bilder, die die Vision-KI tatsaechlich
  sieht (braucht Backend-Endpoint).

## 2026-06-04

### Fix: Extraktion robust gegen hängenden/langsamen Inferenz-Endpoint
- **Markitdown best-effort für PDFs** (`learning/service.ts`): 15s-Timeout + try/catch;
  PDF-Extraktion laeuft auch ohne Markitdown weiter (Vision braucht nur den rawBuffer).
- **Timeout + Retry um den Vision-Call** (`vision-per-page.ts` + `extract-call.ts`):
  45s-Timeout + 1 Retry pro Seite; haengt eine Seite, wird sie uebersprungen statt die
  ganze Extraktion zu blockieren.
- Hinweis: Die Vision-Inferenz (mistral-3-24b) ist serverseitig zeitweise instabil
  (haengt/sparse), Text-Chat laeuft sauber — infrastrukturseitig.
- **Beide Worktrees**.

### Fix: Vision-Extraktion lieferte unvollständige Felder (Kollaps auf Pflichtfelder)
Beim Live-Test der Sani-Rezepte fielen Extraktionen teils auf genau die 5
Pflichtfelder zurück (Rest leer), obwohl die rohe Vision-Antwort alle 21 Felder
enthielt. Zwei Code-Ursachen behoben:

- **Pflichtfelder im Function-Schema** (`learning/pipeline-adapter.ts`): Das
  Vision-Modell (Mistral 3 24B) erfuellt ein `required`-Schema unter Last manchmal
  MINIMAL. Der Adapter setzt jetzt **keine `required`-Markierung** mehr ins
  Extraktions-Schema (A/B: required → 20/5/5, optional → 20/20/20).
- **Text-Repair überschrieb Vision-Ergebnisse** (`services/extraction/pipeline.ts`):
  `validation_repair` wird bei `vision-per-page` jetzt uebersprungen (dort ist der
  text leer/Markitdown-Muell; Repair haette gute Vision-Daten ersetzt).
- **Sani-`instructions` entschärft** (weniger „null"-Sprache, „extrahiere
  vollstaendig", BSNR/LANR als Paar).
- Teil der Schwankung ist endpoint-seitig (adacor-Vision liefert unter Last sparse).
- **Beide Worktrees**.

### Extraktion: Sani-Rezepte-Projekt + stabiles instructions-Feld + PDF-Vision-Fix
Erstes produktives Extraktions-Projekt (Sanitätshaus-Rezepte, gescannte Muster-16-/
Privatrezepte) plus zwei dafür nötige Erweiterungen am Projekte-Feature.

- **Stabiles `instructions`-Feld** am Projekt (`ExtractionProject.instructions?`):
  hand-gepflegte Domänen-Anweisungen, die der Lern-Loop NICHT überschreibt (anders als
  `guidelines`). Adapter rendert `instructions → guidelines → Few-Shot` in
  `profile.guidelines`. Persistenz im **YAML-Storage** (`project.yaml`) — kein DB-Change
  (anders als Scalingo, das eine Spalte via Migration bekommt). Routes (POST/PUT) +
  Frontend-Textarea (Create + Settings).
- **PDF-`rawBuffer` im Projekte-`extract()`**: `ingest()` liefert für PDFs jetzt die
  Roh-Bytes mit (`mimeType: application/pdf`), damit `vision-per-page`/`hybrid` die
  Seiten rendern können. Vorher wurde nur (oft verstümmelter) Markitdown-Text erzeugt →
  Vision hatte keine Quelle. PDF-Rendering an den echten Scans verifiziert.
- **Setup-Skript** `backend/scripts/create-sani-rezepte-project.ts` (idempotent): legt
  das Projekt mit 21 Feldern (je Format-`description`), Strategie `vision-per-page` und
  den Domänen-`instructions` (Versatz → nach Format statt Position; Unterschrift →
  darunter lesen + BSNR quer-prüfen + bei Verdeckung null/niedrige Confidence; blasser
  Druck/Durchscheinen; Seite-2-Stempel ignorieren) an.
- 2 neue Adapter-Tests (instructions-Reihenfolge); Tests grün.
- **Beide Worktrees**: main (Scalingo, DB-Spalte) und demo/messe (Railway, YAML).

### Extraktions-Projekte nutzen jetzt die Heavy-Pipeline (Engine-Tausch)
Das Learning/Few-Shot-Extraktions-Feature (`backend/src/extraction/learning/`) fuhr
einen eigenen Single-Pass-Pfad. Jetzt nutzt `extract()` die generische
Heavy-Pipeline (`runPipeline()`) — inkl. Chunking, vision-per-page/hybrid,
Confidence-Scoring und Merge. API, UI und Learning-Zyklus (train/guidelines) bleiben.

- **Adapter** `learning/pipeline-adapter.ts`: flache Projekt-Felder → synthetische
  Gruppe (`felder`); `extract()` entpackt nach der Pipeline wieder zu flach.
  Gelernte Guidelines + Few-Shot → `ExtractionProfile.guidelines`.
- **Guidelines-Hook** `services/extraction/strategies/prompt.ts:appendGuidelines()`
  in allen vier Strategien (backward-safe — Vertragsmanagement unveraendert).
- **`extract()` umverdrahtet** (`learning/service.ts`): `ingest` → `PreparedFile[]`
  → `runPipeline` → entpacken. Bildquellen: `prepareVision` bleibt nur fuer die
  `document_text`-Erfassung.
- **Strategie pro Projekt konfigurierbar** (Default `hybrid`):
  `ExtractionProject.extraction?`, Routes (POST/PUT), Frontend-Dropdown. Persistenz
  im **YAML-Storage** (`data/extraction-projects/<id>/project.yaml`) — kein
  DB-Change (anders als Scalingo, das die Spalte via Migration bekommt).
- **Retry-mit-Validierungs-Feedback in die Pipeline portiert**: strategie-agnostischer
  Repair im Orchestrator (`pipeline.ts` + neues `extract-call.ts`), opt-in via
  `config.validation_repair` (Projekt-Adapter setzt true; Vertragsmanagement off).
- **Bugfix mitgezogen**: `prepareVision` initialisierte den Vision-Adapter mit
  `visionModel.provider.api_url`/`.api_key` (existieren nicht → `baseUrl=undefined`).
  Korrigiert auf `visionModel.base_url`/`.api_key` (der Fix war auf main/Scalingo
  schon drin, fehlte auf demo/messe). Noetig, da die Migration `prepareVision` fuer
  Bild-Projekte real nutzt.
- 12 neue Tests, bestehende 31 gruen. Doku: `docs/extraction-projects-heavy-pipeline-2026-06-04.md` (im main-Worktree).
- **Beide Worktrees**: main (Scalingo, Postgres) und demo/messe (Railway, YAML-Storage).

### Vertragsmanagement — Standard-Schemas von single-pass auf hybrid umgestellt
Bisher liefen die Schemas `nda`, `dienstleistung`, `arbeitsvertrag` und
`lizenzvertrag` ohne `extraction:`-Block → Default `single-pass`. Single-Pass
vergibt pauschal Confidence 1.0 pro befuelltem Feld (kein echtes Scoring, da nur
eine Quelle). Folge: die Low-Confidence-Markierung im ContractDetail (gelbe
Wellenlinie < threshold) war fuer diese — haeufigsten — Vertragstypen praktisch
tot, und Scans/Handschrift wurden nie per Vision nachverarbeitet.

- **Schemas** (`{nda,dienstleistung,arbeitsvertrag,lizenzvertrag}.yaml`, je in
  `backend/data/...` + `data/...`): neuer Block
  `extraction: { strategy: hybrid, vision_fallback: true,
  confidence_threshold: 0.7 }`. Pass 1 (long-text-chunked) liefert echte
  Feld-Confidence; bei >=2 Low-Confidence-Feldern pro Seite startet der
  Vision-Fallback (pdftocairo → Vision-LLM). Hybrid degradiert sauber auf
  Text-only, wenn kein PDF/poppler vorhanden ist (kein Import-Abbruch).
- **System-Dependency poppler-utils** in beiden Deployments ergaenzt, sonst
  liefe der Vision-Teil ins Leere: Scalingo `Aptfile` (`poppler-utils`),
  Railway `Dockerfile` (`apk add ... poppler-utils`).
- Kosten/Latenz: diese Vertragstypen machen jetzt mehrere LLM-Calls
  (chunked) statt einem, plus optional Vision-Calls bei Low-Confidence.
- **Beide Worktrees**: main (Scalingo) und demo/messe (Railway).

### Extraktion — veraltete P0-Phasen-Kommentare aufgeraeumt (Doc-only)
Reine Kommentar-/Doc-Bereinigung im Heavy-Pipeline-Modul
(`backend/src/services/extraction/`). Die Kommentare stammten aus dem P0-Skelett
und behaupteten, Strategien/Confidence-Scoring kaemen "spaeter" — alle vier
Strategien sind laengst registriert (P0–P5, 2026-05-18..20). Kein Verhaltens-
oder API-Change; 31 Extraction-Tests unveraendert gruen.

- `pipeline.ts`: "sobald P1 implementiert ist" → reale Eskalations-Beschreibung;
  "kommen in P1/P3/P4 dazu" entfernt; Fehlertext "noch nicht verfuegbar (P1)" →
  "nicht registriert".
- `strategies/index.ts`: "Spaetere Phasen registrieren …" entfernt.
- `strategies/single-pass.ts`: "Confidence-Scoring kommt in P1 im Orchestrator"
  → korrekt: Single-Pass behaelt bewusst triviale 1.0-Confidences, echtes
  Scoring (`confidence.ts`) lebt in den Multi-Pass-Strategien.
- `strategies/vision-per-page.ts`: "kann eskalieren (P4-Job)" → korrekt: keine
  Eskalation, Fehler propagiert mit Installations-Hinweis.
- `types.ts`: zwei "P5"-Labels → "Async-Job-Backend (deferred)" (P5 war real das
  Provider-Profil, nicht das Job-Backend).
- **Beide Worktrees**: main (Scalingo) und demo/messe (Railway).

### MCP: Per-User-OAuth (Notion) — Login pro User via Dynamic Client Registration
Aufbauend auf dem Remote-Transport (2026-06-02): vollständiger **OAuth-2.1-Flow
pro User** für Remote-MCP-Server, die ohne Admin-App-Registrierung auskommen
(Dynamic Client Registration). Jeder User verbindet sein eigenes Konto per
1-Klick-Login — primärer Use-Case: der offizielle **Notion** Hosted-MCP-Server
(`https://mcp.notion.com/mcp`). Inkl. eines fertigen **Notion-Assistent-Agents**.

- **OAuth-Adapter** (`mcp/oauth/provider.ts` + `index.ts`): `McpOAuthClientProvider`
  implementiert das SDK-`OAuthClientProvider`-Interface; das MCP-SDK übernimmt
  Discovery, DCR (RFC 7591), PKCE und Token-Rotation. Persistenz über das
  bestehende `connections`-Storage (YAML in diesem Branch): DCR-Client pro Server
  in der Server-Config, Token pro User, State/Verifier über `oauth_states`.
- **Per-User-Sessions** (`mcp/userSessions.ts`): pro `(userId, serverId)` eine
  eigene MCP-Session mit `authProvider`, Caching + Idle-Eviction (15 Min).
- **Per-User-Tools** (`mcp/tool.ts` `McpOAuthToolWrapper`): global registriert,
  zur Laufzeit wird `context.userId` → User-Session aufgelöst.
- **Discovery + Lazy-Re-Registrierung** (`mcp/manager.ts`): Tools nach erstem
  Connect global registriert; beim Chat-Start re-registriert nach Neustart
  (`ensureUserOAuthToolsRegistered`). OAuth-Server: kein globaler Auto-Connect.
- **Routes** (`routes/chat.ts`): `GET /api/mcp/servers/:id/oauth/{connect,status,callback}`.
- **Config/Typen**: `McpServerConfig.auth: 'none' | 'oauth'` + `oauthClient`;
  Preset **„Notion (OAuth)"**.
- **UI** (`McpServersPage.jsx`, `McpServerEditor.jsx`): per-User-„Verbinden
  (Login)"-Button + Status; Editor mit Auth-Dropdown.
- **Notion-Agent** (`data/agents/notion-assistant/config.md`): 14 Notion-Tools;
  Prompt mit Lese-Autonomie, DE/EN-Synonym-Retry, DB-Listing via `collection://`,
  `create-pages`-Format-Hinweis, Anti-Wiederholungs-Disziplin. `maxIterations: 10`
  (synchrone statt Hintergrund-Delegation).

#### Bugfixes im Zuge dessen
- `services/taskExecutor.ts`: Hintergrund-Tasks reichen die `userId` durch (sonst
  „nicht verbunden" bei per-User-OAuth-Tools).
- `mcp/tool.ts`: MCP-Tool-Description-Cap 1024 → 8192 (sonst wurde die
  Aufruf-Format-Spec reicher Tools abgeschnitten). Zugleich kam mit der
  Spiegelung das Description-Sanitizing (Security) in diesen Branch.

- **Beide Worktrees**: main (Scalingo) und demo/messe (Railway).
- Doku: `docs/mcp-oauth-notion-2026-06-04.md`.

## 2026-06-02

### MCP: Remote-Transport (Streamable HTTP + SSE) — Anbindung offizieller Remote-Server (z.B. Google Gmail MCP)
Bisher konnte die Plattform nur **lokale stdio-MCP-Server** (Subprozess via
`command`/`args`/`env`) anbinden. Neu: **Remote-MCP-Server** ueber Streamable
HTTP oder SSE inkl. Auth-Header — damit lassen sich von Anbietern gehostete
Server wie der offizielle Google **Gmail MCP Server** (`gmailmcp.googleapis.com`)
direkt in der UI konfigurieren.

- **Typen** (`backend/src/mcp/types.ts`): `McpServerConfig` um `transport`
  (`'stdio' | 'http' | 'sse'`, Default `stdio`), `url` und `headers` erweitert.
- **Connection** (`backend/src/mcp/connection.ts`): `connect()` verzweigt nach
  Transport. Neue Factories `createStdioTransport()` (unveraendert) und
  `createRemoteTransport()` (`StreamableHTTPClientTransport` /
  `SSEClientTransport`). Header-Werte unterstuetzen `${ENV_VAR}`-Substitution
  (z.B. `Authorization: Bearer ${GMAIL_OAUTH_TOKEN}`). Bei SSE werden Header
  zusaetzlich der EventSource-Verbindung mitgegeben.
- **Config** (`backend/src/mcp/config.ts`): `updateMcpServer()` reicht die neuen
  Felder durch (sonst Verlust beim Edit). Neue Presets `gmail-google` (Gmail
  Remote/HTTP) und `remote-http` (generisches Streamable-HTTP-Template).
- **API** (`routes/chat.ts`): `POST /api/mcp/servers` validiert jetzt `command`
  (stdio) **oder** `url` (http/sse) statt `command` hart vorauszusetzen.
- **Frontend** (`McpServerEditor.jsx`, `McpServersPage.jsx`): Transport-Auswahl
  (stdio/HTTP/SSE); bei Remote werden statt Command/Args/Env ein **URL**-Feld
  und **HTTP-Header** (Key/Value, z.B. `Authorization`) angezeigt. Server- und
  Preset-Karten zeigen bei Remote-Servern die URL statt des Commands.
- **Beide Worktrees**: main (Scalingo) und demo/messe (Railway).
- Doku: `docs/mcp-remote-transport-2026-06-02.md`.

## 2026-05-16

### Projektmanagement — Projektstatus statt Lifecycle in der UI
Konsolidierung der Status-Anzeige: das manuell gepflegte `project_status`-Feld
(Basis-Tab, Werte aus App-Config) ist die eine Wahrheit im UI. Phase-A-
`lifecycle`-Spalte bleibt aus Backward-Compat, wird aber nicht mehr UI-aktiv.

- WizardPage-Header: Status-Badge zeigt `auftrag.project_status` statt
  `auftrag.status`. Label aus appConfig.
- Übersicht-Tab: Lifecycle-Karte → Projektstatus-Karte.
- Phase F-Modal beim „Als Final markieren": zeigt eine Selectbox mit den
  `project_status`-Optionen aus der App-Config. Callback heißt
  `onProjektStatusUpdate`, schreibt via `updateProjektauftrag` mit
  `expectedVersion` (Concurrency-safe).

### WZ-Branchen-Matcher — Neighborhood in Public-API exponiert
Neue Public-Function `getNeighborhood` unter
`POST /api/public/v1/wzbar-matcher/getNeighborhood`. Input: `{ code }`
(4-6-stellig). Output: `{ code, nodes: NeighborhoodNode[] }` mit Eltern/
Geschwistern/Kindern auf den Ebenen 4-6 und Markierung des aktuellen Codes
(`isCurrent`). Damit koennen externe Konsumenten (z. B. EMMA) das Umfeld
eines Match-Ergebnisses inspizieren und manuell auf benachbarte Codes
wechseln — vorher nur via interne Hono-Route (Session-Cookie) erreichbar.
Rate-Limit: 120/min.

### Projektmanagement — App-Rolle als Permission-Floor (Slack/GitHub-Modell)
Identisch zum main-Worktree. Die App-Rolle propagiert jetzt automatisch auf
alle Ressourcen der App: `effektive Rolle = MAX(App-Rolle, Resource-Rolle)`.
App-Owner-Gruppe (PMO/Führung) sieht und bearbeitet alle Aufträge/Ideen
unabhängig von expliziten Resource-Permissions. Resource-Permissions können
nur erhöhen, nie senken. `resolveRole()` bekommt `appRole`-Floor; die vier
Wrapper (`getEffectiveIdeeRole`, `getEffectiveAuftragRole`, `listAccessible…`)
laden die App-Rolle pro Request via `getUserAppPermission`.

### Projektmanagement — Default-Permissions auf Resource-Ebene
Identisch zum main-Worktree. Neuer Helper `defaultOwnerPermissions(userId)`
in `permissions.ts`. Neu erzeugte Projektaufträge, Projektideen und Projekte
bekommen Ersteller als expliziten Owner in `permissions.users[]` — kein
`permissions: null` mehr. Caller können via `data.permissions` weiterhin
überschreiben. `created_by`-Fallback im Resolver bleibt als Backstop für
Legacy-Daten.

### Bugfix: User-Memory wurde nutzeruebergreifend gemischt
- `buildSupervisorPrompt` (`backend/src/agents/loop.ts`) rief `loadUserMemory()`
  ohne `userId` auf. Folge: Jeder Supervisor-Prompt — fuer jeden eingeloggten
  User — bekam den Inhalt von `data/memory/users/default.yaml` injiziert. Fix:
  `userId` wird durchgereicht; ohne `userId` wird die Memory-Sektion komplett
  ausgelassen (kein Fallback mehr auf `default.yaml`).
- Das `user_memory` Tool (`backend/src/tools/special/user-memory.ts`) reichte
  `userId` weder beim Lesen (`get`) noch beim Schreiben (`save`/`delete`)
  durch. Folge: Alle Schreibvorgaenge landeten in `default.yaml` und wurden
  dadurch fuer alle Nutzer sichtbar. Fix: `context.userId` wird aus dem
  `ToolContext` gelesen und an `loadUserMemory`, `addAboutItem`,
  `addInstruction`, `addContextItem` und `deleteMemoryItem` durchgereicht.
  Ohne `userId` lehnt das Tool die Operation ab.
- Empfohlene Migration nach Deploy: `data/memory/users/default.yaml` auf dem
  Railway-Volume pruefen und ggf. leeren — dort sind die akkumulierten
  Cross-User-Eintraege seit Beginn.

### Projektmanagement — Abschlussbericht (Phase F, Backend + Frontend)
Identisch zum main-Worktree, hier YAML-Storage statt Drizzle/Postgres.

- 5. Top-Level-Tab im Projekt-Detail (`?tab=abschluss`), Single-Form mit
  Akkordeon-Sektionen. Pre-Fill aus letztem SB (Goals, Roadmap, EVM, Risiko-
  Tracking) + Projektauftrag (Scope, Stakeholder, Org, Budget-Plan, Risiken-
  Plan). Abschluss-spezifisch: Key-Findings, Stakeholder-Akzeptanz (Ampel
  pro Stakeholder), Uebergabe, Folgeprojekt-Empfehlung, Abnahme.
- Soll/Ist-Dashboard (computed): Termin-Abweichung, Budget-Abweichung %,
  Ziel-Erfuellung, Risiko-Bilanz, Stakeholder-Akzeptanz-Verteilung.
- Status `draft`/`final`; Modal beim Final-Save „Projekt-Lifecycle auf
  `closed`?". Owner-only: Loeschen + Wiedereroeffnen.
- KI-Entwurf-Button befuellt Management-Summary, Key-Findings, Folgeprojekt-
  Empfehlung (LLM auf Basis SBs + Auftrag + Lessons Learned).
- Lessons Learned-Sektion live aus `paLessonsLearned`.
- Export PDF/DOCX/XLSX ueber den geteilten `mapAbschlussberichtToDocument`-
  Mapper.
- YAML-Storage: `data/apps/projektmanagement/projektauftraege/{id}/
  abschlussbericht.yaml`, mit `withLock` + `VersionConflictError`.
- Übersicht-Tab: Abschluss-Karte aktualisiert mit Status + Link.

### Projektmanagement — Lessons Learned (Phase E, Backend + Frontend)
Identisch zum main-Worktree, hier YAML-Storage statt Drizzle/Postgres.

- 4. Top-Level-Tab im Projekt-Detail (`?tab=lessons`), Blade-Layout (Liste
  links, Detail rechts), SWOT-orientiert (Strength/Weakness/Opportunity/
  Threat) pro Themengebiet (Basis…Projektabschluss).
- Default-Ansicht zeigt KI-Suggest-Button. Endpoint liest die letzten 5
  Statusberichte und laesst den LLM-Coach 3–7 SWOT-orientierte Lessons
  Learned ableiten. Vorschlaege sind nicht persistiert.
- CRUD: `GET/POST/PUT/DELETE /projektauftraege/:projektId/lessons-learned[/:llId]`,
  plus `POST .../suggest`. Permissions erben vom Auftrag.
- YAML-Storage unter `data/apps/projektmanagement/projektauftraege/{id}/
  lessons-learned/{ll-id}.yaml` mit `withLock` + `VersionConflictError`.
- DEFAULT_CONFIG bekommt `lesson_themengebiet` + `lesson_kategorie`;
  Einstellungen-Tab listet die Keys.
- Neue Komponente `LessonsLearnedView.jsx` (analog main).

### Projektmanagement Entity-Restruktur — Phase C (Listen-Page-Tabs)
Listen-Page `ProjektePage` zeigt jetzt die Top-Level-Entities als Tabs:
**Projekte | Projektideen | Portfolios | Einstellungen**. Identisch zum
main-Worktree (Phase C ist reines Frontend).

- Tabs umgestellt: `auftraege` → `projekte` (Default), `ideen` bleibt,
  `portfolio` → `portfolios` (sichtbar mit Empty-State, Phase D),
  `einstellungen` bleibt; entfernt: `statusberichte` und `abschluss`.
- URL-Aliase fuer alte Bookmarks (`auftraege/statusberichte/abschluss/portfolio`).
- Coming-Soon-Badges entfernt; `PortfoliosPlaceholder`-Komponente fuer den
  Empty-State.
- Action-Button-Label „Neuer Projektauftrag" → „Neues Projekt".

## 2026-05-06

### Projektmanagement Entity-Restruktur — Phase B (Frontend Tab-Container)
Detail-Ansicht eines Projekts startet jetzt in einer **Übersicht** statt im
Projektauftrag-Wizard. Der bisherige Segmented-Mode-Toggle (Projektauftrag /
Statusbericht) im Header verschwindet; stattdessen gibt es eine echte Top-Level-
Tab-Bar **Übersicht | Projektauftrag | Statusberichte**. Identisch zum main-
Worktree.

- **In-place-Refactor von `WizardPage.jsx`**: Mode-State akzeptiert jetzt
  `uebersicht | auftrag | statusberichte`, Default bei bestehendem Projekt =
  `uebersicht`. Tab-State synct mit URL `?tab=...`.
- **Neue Komponente `ProjektUebersichtPanel.jsx`**: vier Karten (Lifecycle,
  Schluesseldaten, letzter Statusbericht, Platzhalter Abschluss). Liest
  Lifecycle aus `/api/apps/projektmanagement/projekte/:id`.
- **Hook**: `useProjektmanagement` exportiert jetzt `getProjekt(id)`.
- **Bei neuen Projekten** (`/apps/projektmanagement/neu`) bleibt die Tab-Bar
  ausgeblendet — Wizard ist allein zustaendig fuer die Erstanlage.

### Projektmanagement Entity-Restruktur — Phase A (Backend, beide Worktrees)
Vorbereitung fuer den vollen PM-Lifecycle (Projektidee → Projekt → Auftrag → Statusberichte → Lessons Learned → Abschluss → Portfolio). Heute ist `paProjektauftraege` *de facto* das Projekt — das passt nicht zur Vision, in der `Projekt` die Identitaet traegt und `Auftrag/SB/LL/Abschluss` Sub-Resources sind. Phase A liefert die neue Top-Level-Entity parallel zum Auftrag; IDs werden 1:1 uebernommen, damit alte URLs/Bookmarks weiter funktionieren. Doku: `docs/projektmanagement-entity-restruktur-2026-05-06.md` (im main-Worktree).

- **demo/messe (YAML + Bun)**: neue TS-Interfaces (`Projekt`, `ProjektCreateInput`, `ProjektUpdateInput`, `ProjektLifecycle`) — camelCase, bewusst abweichend von snake_case-Konvention bei Auftrag/Idee, damit Frontend-Cherry-pick aus main 1:1 passt. Storage ueber `data/apps/projektmanagement/projekte/{id}/metadata.yaml` mit `withLock` + `VersionConflictError` (analog Auftrag). API-Shape identisch zu main: `GET/POST/PUT/DELETE /api/apps/projektmanagement/projekte[/:id]`; `PUT` mappt `VersionConflictError` → HTTP 409. Migrations-Script `scripts/migrate-projekte.ts` (idempotent, handhabt fehlendes `projektauftraege/`-Verzeichnis ohne Crash).
- **main (Postgres + Drizzle)**: parallele Implementierung mit Drizzle-Tabelle `projektmgmt.projekte` + `0010_projekt_entity.sql`-Migration + `migrate-projekte.ts`-Script (6 bestehende Auftraege erfolgreich migriert).
- **Entscheidungen**: 1:1-IDs (kein Linkbruch), Portfolio 0..1 pro Projekt, Projektname am Projekt (nicht am Auftrag), Lifecycle explizit + Auto-Vorschlaege (Stub).

### WZ-Branchen-Matcher — 4-6-stellige Codes + Multi-Tätigkeits-Erkennung
Erstes Kunden-Feedback umgesetzt: a) IHK trifft regelmaessig auf 5-/6-stellige WZ-Schluessel (Unterklasse / Detail-Unterklasse), nicht nur auf 4-stellige Klassen. b) Eintragungen vom Amtsgericht enthalten oft mehrere distinkte Taetigkeiten (Beispiel "Baulicher Brandschutz, Trockenbau und Umzuege"); IHK kann bis zu 3 Schluessel pro Unternehmen hinterlegen.

- **Catalog 4-6 Stellen**: `catalog-builder.ts` Regex von `^\d{4}$` auf `^\d{4,6}$` gelockert. Catalog wuchs von 720 auf **2112 Eintraege** (662×4-stellig, 923×5-stellig, 530×6-stellig). Embeddings (Multilingual E5 Large, 1024dim) neu generiert.
- **Pre-Splitter** (`splitter.ts`, neu): LLM-Function-Call zerlegt Input in 1-3 distinkte Taetigkeiten. Variationen ("Hochbau, Tiefbau") werden gebuendelt; Aufzaehlungen ("Brandschutz, Trockenbau, Umzuege") werden gesplittet. Hard-Cap auf 3.
- **Service-Pipeline**: `service.ts match()` ruft jetzt `splitActivities()` und klassifiziert pro Taetigkeit parallel via `Promise.all`. Aggregierter `MultiMatchResult { activities: ActivityMatch[] }` wird persistiert.
- **Klassifikator-Prompt**: bevorzugt feinste eindeutige Ebene (Unterklasse > Klasse), faellt auf naechsthoehere Ebene zurueck wenn die Beschreibung die feinere Tiefe nicht eindeutig hergibt.
- **Public-Function-Schema**: `wzbar-matcher__classify` Output von `{ primary, alternatives }` auf `{ activities: [{ activity, primary, alternatives }] }`. Tool-Description aktualisiert. Breaking Change.
- **Storage Read-Fallback**: alte Records (`result.primary`) werden beim Read transparent in `MultiMatchResult` mit einer Activity eingepackt — History bleibt lesbar ohne DB-Migration.
- **Frontend Multi-Block-Layout**: `MatcherPage.jsx` zeigt pro Taetigkeit einen eigenen Block mit Header. Bei Single-Activity wird der Header weggelassen (sieht aus wie vorher). Subtitle aktualisiert. `HistoryList` zeigt Codes der Hauptmatches als ` · `-Liste.
- **Test-Ergebnis (live)**: "Baulicher Brandschutz, Trockenbau und Umzuege" → 439991 Brandsanierung (85%) · 433101 Akustik- und Trockenbau (95%) · 49420 Umzugstransporte (95%). "Schlachten von Gefluegel" → 10120 (100%, single block).
- **Umfeld-Modal**: Im MatchCard neben dem Confidence-Pill ein "Umfeld"-Button (ListIcon). Oeffnet ein Modal mit der hierarchischen Nachbarschaft des Codes — alle Codes im Catalog mit gleichem 4-stelligen Klassen-Praefix, gruppiert nach Klasse / Unterklasse / Detail-Unterklasse, eingerueckt nach Tiefe, aktueller Code visuell hervorgehoben. Pro Zeile ein Copy-Button. Beispiel fuer 439991: zeigt 4399 → 43991/43999 → 439991/439992/439993, sodass die IHK selbst entscheiden kann, ob die feinere Tiefe wirklich passt oder eine flachere Ebene besser ist. Endpoint: `GET /api/apps/wzbar-matcher/neighborhood/:code`.

Hinweis: auf `demo/messe` (Railway) bleibt das `storage.ts` YAML-File-basiert (statt Postgres wie auf `main`). Der `normalizeResult()`-Read-Fallback wurde aber portiert, sodass alte YAML-Match-Records nahtlos im neuen Multi-Activity-UI angezeigt werden.

## 2026-05-03

### Scalingo-Deployment via Custom-Buildpack — v0.1.0 production-verified
Setup fuer Scalingo-Deployment auf `main`. Scalingo unterstuetzt nur Buildpacks (kein Dockerfile-Build). Bun ist offiziell nicht supported, also bauen wir ein eigenes Custom-Buildpack statt Bun→Node-Refactor. Ende-zu-Ende auf `workplace-demo.osc-fr1.scalingo.io` verifiziert (Login + HSTS + ffmpeg).

- **Neues Buildpack-Repo** `tilweb/scalingo-agent-platform-buildpack` (separates GitHub-Repo, Tag `v0.1.0`): `bin/detect`, `bin/compile`, `bin/release`. Installiert Node 22.13.0 LTS + Bun 1.3.7 + ffmpeg 7.0.2 static (alle gepinnt im Cache), baut Frontend (`NPM_CONFIG_PRODUCTION=false npm ci` + `npm run build`), installiert Backend-Deps (`bun install --frozen-lockfile --production`), kopiert Bun + ffmpeg-Binaries in den Slug nach `/app/.bun/bin/` und `/app/.ffmpeg/bin/`, raeumt `frontend/node_modules` (~200 MB) auf — Slug schrumpft von ~801 MiB auf ~414 MiB.
- **ffmpeg statisch** statt apt: apt-Paket auf Ubuntu 22.04 hat Soft-Dep auf libpulsecommon-16.x die nicht im Stack ist, Crash-Loading mit `libpulsecommon-16.1.so: cannot open shared object`. Statisches Binary von johnvansickle.com hat keine System-Lib-Abhaengigkeiten.
- **Node 22 LTS** statt Node 20: Vite 7 verlangt Engine `^20.19.0 || >=22.12.0` — Node 20.18.0 zu alt.
- **`NPM_CONFIG_PRODUCTION=false`** beim Frontend-Install: App-ENV setzt `NODE_ENV=production`, sonst skipt `npm ci` die devDependencies (Vite + @vitejs/plugin-react sind dort) und Build bricht mit `vite: not found`. Vite-Build-Output bleibt produktion-optimiert (Vite handhabt das selbst).
- **Postgres-ENV-Aliasing** im Custom-Buildpack `.profile.d/agent-platform.sh`: Scalingo-Postgres-Addon setzt `SCALINGO_POSTGRESQL_URL`, unser Code liest `SCALINGO_POSTGRES`, Drizzle-Tools wollen `DATABASE_URL`. Aliasing in alle drei Richtungen — ohne den Fix waere Boot mit "SCALINGO_POSTGRES not set" gescheitert.
- **App-Repo neue Files**: `.buildpacks` (Multi-Buildpack-Reihenfolge: apt + custom@v0.1.0), `Aptfile` (`ca-certificates` only — ffmpeg via Custom-Buildpack), `Procfile` (`web: cd backend && bun run src/index.ts`).
- **`Dockerfile` (Root) entfernt** nach erfolgreichem Deploy — Scalingo nutzt nur die Buildpack-Pipeline.
- **Doku**: `docs/scalingo-deploy.md` auf Buildpack-Flow umgeschrieben, `CONNECTION_ENCRYPTION_KEY`-Hinweis (muss exakt 64 Hex-Zeichen sein) ergaenzt, `FAL_API_KEY`→`FAL_AI_API_KEY` in CLI-Beispielen korrigiert.
- **`backend/CLAUDE.md`**: Note zu Lokal-Bun + Production-Bun (kein Refactor).
- **NODE_ENV**: muss als App-ENV explizit gesetzt werden (`scalingo --app workplace-demo env-set NODE_ENV=production`); `scalingo.json`-Defaults greifen nur beim "Deploy on Scalingo"-Button-Flow, nicht bei manuell angelegten Apps. Ohne diese Var serviert Hono kein Frontend (`/` → 404).

`demo/messe`-Worktree (Railway, Bun + Dockerfile) bleibt vollstaendig unangetastet.

### Security-Fixes Cleanup-Sprint — Branch `feature/security-fixes-2026-05-03`
Letzte Lows + Info-Findings — viele kosmetisch, einer mit echtem Sicherheitswert (L6).

- **L3** `auth/middleware.ts` Session-Extension umformuliert: `lastExtendedAtMs` + `sinceLastExtendMs` statt `Math.abs(...)`-Konstrukt. Verhalten unveraendert, Lesbarkeit verbessert.
- **L6** IPv6-SSRF-Check substanziell gehaertet: neue `expandIPv6()`-Funktion strippt Zone-IDs/Klammern, expandiert `::` zu 8 Hex-Gruppen, behandelt IPv4-mapped Form. Block-Set erweitert um site-local (fec0::/10), discard-only (100::/64), multicast (ff00::/8) und 6to4-zu-RFC1918 (2002::-Praefix mit privatem IPv4-Anteil). Standalone-Tests: 18/18 Cases pass.
- **L7** `BRAVE_API_KEY` in `.env.example` dokumentiert (Custom-Tool-Referenz war ohne Template-Eintrag).
- **I1** Verifikation: Tool-Outputs sind bereits korrekt mit `role: 'tool'` markiert (3 Sites in `agents/loop.ts`). Review-Agent hatte das falsch klassifiziert — kein Code-Change.
- **I5** `.github/workflows/security-audit.yml` mit `bun audit` (backend) + `npm audit --production` (frontend) auf PR/push/main + woechentlicher Schedule. `continue-on-error: true` — sichtbar, nicht blockend. `audit`-Scripts in beiden `package.json`. Erstlauf zeigt 27 Backend-Vulns (10 high, 16 moderate; davon zwei Hono-Cookie-Issues real relevant) und 1 Frontend-Vuln (yaml stack overflow) — Behebung als separater Dep-Update-Track.

### Security-Fixes Compliance-Bundle M11 + I4 — Branch `feature/security-fixes-2026-05-03`
Audit-Log auf Compliance-Niveau gebracht.

- **M11** `writeAuditEntry` nutzt jetzt `fs.appendFile` (POSIX-O_APPEND-atomar) statt read-modify-write. Vorher gingen unter Concurrent-Login Audit-Eintraege verloren — Smoke mit 5 parallelen failed-logins bestaetigt: alle Eintraege landen jetzt in der Datei. Plus `cleanupOldAuditLogs()` mit `AUDIT_RETENTION_DAYS` (default 90, 0 = aus), beim Boot + alle 24h. Hash-Chain-Tamper-Detection ausgelassen — Append-Only-Storage (S3 Object-Lock) waere die richtige Hardening-Stufe darueber, gehoert in einen Infra-Plan.
- **I4** `auditLogin(success=false, username, ...)` pseudonymisiert den Username via sha256-Praefix (`usr_<16-hex>`). Der bei Failed-Login eingegebene String gehoert oft keinem echten Account (Tippfehler, Bot-Scan) und waere damit Eingabe-PII ohne legitime Grundlage. Korrelation fuer Brute-Force-Erkennung bleibt (gleicher Input → gleicher Hash). Successful-Login behaelt Klartext (eigene User-Aktion, DSGVO-zulaessige Grundlage).

### Security-Fixes M6 + M7 + M9 — Branch `feature/security-fixes-2026-05-03`
Drei Phase-3-Findings geschlossen, plus ein realer Pfad-Traversal-Bug aufgeraeumt.

- **M6** `sanitizeRelPath` zusaetzlich gegen URL-encoded Traversal (Doppel-Decode), Unicode-NFC, Control-Chars + Lone-Surrogates. Plus echter Bug in `routes/chat.ts:2481`: `${kbBase}/incoming/${file.name}` schrieb User-Filename direkt — jetzt `basename()` + Extension-Whitelist. Gleicher Defense-in-Depth-Check in `services/indexer.ts:convertDocument`.
- **M7** Zwei vorher anonyme KB-Endpoints (`POST /api/knowledge/index`, `POST /api/knowledge/collections`) jetzt mit `authMiddleware`. Mit Scalingo-pro-Tenant-Architektur (eine Instanz pro Customer) reicht User-Level-Auth — Group-Permissions auf Collections sind out-of-scope, da Collections innerhalb einer Tenant-Instanz by-design shared sind.
- **M9** HSTS-Header `Strict-Transport-Security: max-age=31536000; includeSubDomains` nur in `NODE_ENV=production`. `preload` bewusst nicht (einseitige Chrome-Liste). CSP `unsafe-inline` fuer Styles bleibt — React-Inline-Style-Pattern, Migration ist eigener Track.
- Smoke verifiziert: beide KB-Endpoints → 401 ohne Cookie, HSTS-Header in Prod-Mode gesetzt.

### Security-Fixes M3 + M4 — Branch `feature/security-fixes-2026-05-03`
Phase 3 fortgesetzt mit den naechsten zwei Mediums.

- **M3** Zentraler `safeLogger` mit `redact()`-Logik fuer Auth-Felder, Bearer-Tokens, api_key-Querystrings und Basic-Auth-URLs. Migration ueber `services/llm.ts`, `services/llm/adapters/openai.ts`, `tools/custom/CustomApiTool.ts`, `mcp/manager.ts` — die Custom-Tool-/MCP-/LLM-Pfade, in denen Tokens am leichtesten in Error-Bodies leaken konnten.
- **M4 Sofort** `.env.example` um 7 fehlende OAuth-Vars ergaenzt (FAL_AI, JIRA, PIPEDRIVE, YOUTRACK, DOCUWARE) plus Banner am Anfang mit Hygiene-Empfehlungen (Dev-Keys von Production trennen, Production-Secrets in Scalingo-ENV/Vault, nicht auf Dev-Maschine). Tooling-Schritt (1Password/Doppler) und Rotation-Policy bewusst NICHT Teil dieses Commits — User-Entscheidung.
- TS-Status: 168 (2 Cascade-Fixes durch Refactor).

### Security-Fixes Phase 3 Quick-Wins — Branch `feature/security-fixes-2026-05-03`
10 weitere Findings aus dem Medium/Low-Bucket geschlossen — alle als mechanische, klar umrissene Fixes.

- **M1** create-admin.ts in Production nur mit TTY oder `ALLOW_RECOVERY_SCRIPT=true`. **M5** Login-Timing: Dummy-Argon2-Verify auch bei unbekanntem Username (Smoke: 144ms statt <1ms — Username-Enumeration ist zu). **M8** SSE-Stream-Endpoint prueft `pending.userId === getCurrentUserId(c)`. **M10** `createGroup/updateGroup` validieren `memberIds` gegen die users-Tabelle. **M12** `APP_ROLES`/`AUFTRAGS_ROLES` als zentrale const-Tuple plus Type-Guard. **M13** `MARKITDOWN_API_URL` Whitelist auf `*.adacor.ai`/localhost.
- **L1** Initial-Passwort von 9 → 16 Bytes (≈128 Bit). **L2** `deleteCookie` mit `SESSION_CONFIG.cookieOptions`. **L4** `POST/DELETE /api/auth/users` zusaetzlich mit `sensitiveRateLimit`. **L5** `web_fetch` in Production generische Fehlermeldung.
- TS-Status: 170 (unveraendert).
- Nicht gepusht — User reviewed und pusht selbst.

### Security-Fixes Phase 2 (High) + TS Quick-Wins — Branch `feature/security-fixes-2026-05-03`
Phase 2 mit allen High-Findings und einer Vorab-Bereinigung von Type-Drift.

- **TS Quick-Wins** (commit `9d325e6`): 22 TS-Fehler entfernt, davon ~10 echte Bugs. Highlight: in `extraction/service.ts` und `extraction/learning/service.ts` wurde der Vision-LLM mit `provider.api_url`/`provider.api_key` initialisiert — beide Felder existieren NICHT auf `ProviderConfig`. Korrekt sind `visionModel.base_url` / `visionModel.api_key` aus dem `ResolvedModel`-Wrapper; vorher liefen Vision-Calls je nach Provider mit `baseUrl=undefined`. Plus 5 TS1117 Duplicate-Property-Bugs in PM-Service/Import-Service (z.B. `gross` doppelt im Mapping, `id`/`created_at` doppelt vor und nach `...data`).
- **Phase 2** (commit `4dc1bf0`): H1 (Skill/MCP Trust-Boundary mit `[BEGIN/END UNTRUSTED SKILL]`-Markern + Sanitization), H2 (Vision-LLM nur `data:`-URIs), H3 (Rate-Limits user-basiert + neuer `importRateLimit` 20/10min auf alle Import-Endpoints), H4 (Total-Size 200 MB fuer Multi-File-Uploads), H5 (Argon2id parallelism in `needsRehash`), H6 (Attachment-IDs auf `randomUUID`), H7 (`skillRoutes` mit auth+admin), H8 (ID-/Filename-Regex-Validation in allen `storage/paths.ts`-Buildern), H9 (`SEED_DEMO_DATA`-Guard in Production).
- Smoke verifiziert: `/api/custom-tools`, `/api/skills` ohne Cookie → 401.
- TS-Status: 170 verbleibende preexistierende Errors (keine durch Fixes hinzugefuegt).
- Nicht gepusht — User reviewed und pusht selbst.

### Security-Fixes Phase 1 (Critical) — Branch `feature/security-fixes-2026-05-03`
Phase-1-Fixes aus dem Security-Review umgesetzt. 6 Commits, je ein Critical pro Commit.

- **C1** — `customToolRoutes` mit `authMiddleware + adminMiddleware` geschuetzt; `adminMiddleware` zentral in `auth/middleware.ts`. Verifiziert: `GET /api/custom-tools` ohne Cookie → HTTP 401 (vorher 200).
- **C2** — `c.req.header('x-user-id')` in lieferantenmanagement (19x) und VSM (4x) durch `getCurrentUserId(c)` ersetzt.
- **C3** — als deferred markiert, Beta-Banner in `ContractsPage.jsx` setzt User-Erwartung.
- **C4** — `contentDispositionHeader()`-Helper mit Whitelist (PDF, raster Bilder = inline; sonst attachment + RFC-5987-escaped filename). Anwendet auf vertragsmanagement und Chat-Attachments.
- **C5** — `MarkdownRenderer` in VSM AnalyseTab durch `react-markdown` + `remark-gfm` ersetzt. Letzter `dangerouslySetInnerHTML` im Frontend ist weg.
- **C6** — `web_fetch` mit `redirect: 'manual'`, max 3 Hops, Re-Validation pro Hop, Loop-Detection.

Nicht gepusht — User reviewed und pusht selbst.

### Security-Review main-Worktree
Umfangreiche Security-Review des main-Branches (Drizzle/Postgres + S3) durchgefuehrt. Drei Explore-Agenten parallel ueber Auth/RBAC, File-Storage und LLM/SSRF/Frontend, anschliessend manuelle Verifikation der Critical-Findings durch direkte Code-Reads.

- **6 Critical** (C1–C6): unauthentifizierte Custom-Tool-API → SSRF; Lieferantenmanagement vertraut `x-user-id`-Header → Impersonation; Vertragsmanagement Attachment-Download ohne Resource-Level-Ownership → IDOR; `Content-Disposition: inline` + user-kontrollierte Filenames → Stored-XSS; `dangerouslySetInnerHTML` mit LLM-Output ohne Sanitization in VSM AnalyseTab; `web_fetch` folgt Redirects ohne Re-Validation → SSRF-Bypass.
- **9 High** (H1–H9): Skill-/MCP-Instructions ohne Trust-Boundary, Vision-LLM als SSRF-Proxy, IP-basierte (statt User-basierte) Rate-Limits, fehlendes Total-Size-Limit fuer Multi-File-Upload, Argon2id-Rehash prueft Parallelism nicht, Attachment-IDs schwache Entropie, Skill-Mgmt analog zu C1, Storage-Path ohne ID-Validation, `SEED_DEMO_DATA` ohne Production-Guard.
- **13 Medium**, **7 Low**, **5 Info** (Defense-in-Depth, Compliance).
- Eine Agent-Behauptung ("`.env` in Git committed") wurde als **falsch** identifiziert — `.env` ist korrekt gitignored, kein Leak in Git-History.
- Bericht: `docs/security-review-2026-05-03.md` mit Findings, Severity-Uebersicht, Critical-Files-Mapping, Remediation-Roadmap, Glossar und Code-Snippets als Nachweis.
- Fix-Plan: `docs/security-fixes-2026-05-03.md` mit konkreten Diffs fuer alle Critical (C1–C6) und High (H1–H9), plus Tabelle fuer Medium/Low.
- User-Entscheidungen: C5 → Refactor durch `react-markdown` (Option C, Sub-Entscheidung remark-gfm-Dep offen). C3 → DEFERRED, PM-Phase-2-Pattern fuer Vertragsmanagement separat. M2 → CLOSED nach GET-Audit (0 state-changing GETs gefunden, `SameSite=lax` ausreichend). Phase-1-Scope reduziert auf C1, C2, C4, C5, C6 (~1 Tag).

## 2026-05-02

### Feature: Vertragsmanagement Multi-File-Import mit Auto-Detection
Vertragsimport ueberarbeitet auf das gleiche Pipeline-Konzept wie der Projektmanagement-Import: Multi-File (Hauptvertrag + Anlagen + Toolbox-xlsx in einem Vorgang), automatische Vertragstyp-Erkennung mit User-Bestaetigung, Function-Calling-Extraktion mit dynamischem Schema, Provenance-Tracking, Re-Extraktion bei Korrektur des Vertragstyps.

- **`services/multiFileImporter.ts` (neu)**: Phasen 1+2 (Vision-LLM, Markitdown, xlsx-Reorder, Heartbeats, SSE-Events) extrahiert aus PM in einen shared Service. PM nutzt das jetzt; VM (und spaeter Lieferantenmanagement / VSM / wzbar-matcher) koennen es ebenfalls einbinden.
- **`apps/vertragsmanagement/import-service.ts` (neu)**: Pipeline mit eigener Phase 2.5 (LLM-Klassifikator → detected/confidence/alternatives/fileRoles), Phase 3 (Function-Schema dynamisch aus dem ContractSchema gebaut), Phasen 4+5 (Validation, Multi-Attachment-Persistierung). Plus `reextractContract()` fuer User-Korrektur des Vertragstyps ohne Phase 1+2 zu wiederholen — alter Stand wird in `extracted_history[]` archiviert.
- **Klassifikator-Prompt**: explizite Confidence-Regeln (0.90+ wenn Typ explizit genannt, < 0.50 wenn kein Typ wirklich passt — "lieber niedrige Confidence als falsche Sicherheit"). Verhindert dass z.B. eine AVV mit 92% als NDA klassifiziert wird.
- **Datenmodell** (auf demo/messe inline in metadata.yaml; main: separate Tabelle `contract_attachments` + neue jsonb-Spalten): `primary_attachment_id`, `type_detection`, `provenance`, `extracted_history`, `attachments[]`. Bestehende Single-File-Felder bleiben fuer Backwards-Compat.
- **`apps/vertragsmanagement/storage.ts`**: `saveAttachmentWithBytes(att, bytes, markdown)` als gekapselter Helper — Implementation auf demo/messe Filesystem-basiert. Storage-Detail bleibt vor dem Import-Service verborgen.
- **Routes**: `POST /contracts/import` (SSE-Stream), `POST /contracts/:id/reextract` (SSE), `GET /contracts/:id/attachments/:aid` (Download), `PUT /contracts/:id/attachments/:aid/role` (Document-Role korrigieren), `PUT /contracts/:id/primary-attachment`.
- **Frontend `ImportPage.jsx` (neu, VM-spezifisch)**: kopiert vom PM-Wizard mit zusaetzlichem Confirmation-Step nach dem Import. UI zeigt erkannten Vertragstyp + Confidence-Badge (rot bei < 70%), Alternativen-Liste, Override-Dropdown. Buttons "Diesen Typ bestaetigen" oder "Mit gewaehltem Typ neu extrahieren" (triggert /reextract). User-Korrektur passiert beim Import — nicht erst nachgelagert im Detail-View.
- **`ContractDetail.jsx`**: neuer Tab "Dokumente" mit allen Anhaengen (Filename + Document-Role-Dropdown + Hauptvertrag-Marker + Download). "auto-erkannt 85%"-Badge im Header oeffnet das gleiche Re-Extraktion-Modal — sekundaerer Korrekturpfad, falls man nach dem Import doch noch mal ran muss.
- **PM-Import** unveraendert verhalten — nutzt jetzt den shared `multiFileImporter`. Kein Refactor sichtbar fuer User.

## 2026-05-01

### Aenderung: Self-Registration deaktiviert, Bootstrap-Admin via Setup-Mode + Recovery-Script
Login-Maske hat keine "Registrieren"-Toggle-Option mehr. Das Register-Formular erscheint **nur automatisch** wenn die Instanz noch keinen User hat (Bootstrap-Admin). Sobald ein User existiert, ist nur noch der Login-Pfad sichtbar — neue User legt der Admin in Settings → Benutzer an.

- **Backend `routes/auth.ts/POST /register`**: Erlaubt nur wenn `!hasUsers()`. Sonst 403 mit Hinweis "Self-registration is disabled. Ask an admin to create an account.". ENV `REGISTRATION_DISABLED` ist obsolet — die Regel ist hartkodiert.
- **`/auth/status`**: `registrationEnabled`-Feld entfernt. `initialized`/`requiresSetup` reicht.
- **Frontend `LoginPage.jsx`**: Toggle "Create Account ↔ Sign In" weg. `showRegister = (initialized === false)`.
- **`AuthContext.jsx`**: `registrationEnabled`-State raus.

### Feature: Recovery-Script fuer verwaiste Instanz (`scripts/create-admin.ts`)
Wenn alle Admins deaktiviert/geloescht sind und niemand mehr in die Plattform reinkommt: `bun run scripts/create-admin.ts` (interaktiv) oder mit `RECOVERY_USERNAME=… RECOVERY_PASSWORD=…` (non-interactive). Existierender User wird auf admin promoted + reaktiviert + optional Passwort-Reset; neuer User wird angelegt.

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
