# Fachkonzept: DocuWare-Connection (Neubau im Produkt)

**Datum:** 2026-07-23
**Autor:** Andreas Bachmann (Piloten-/Co-Creation-Variante)
**Adressat:** Produkt-Dev-Team
**Status:** Anforderungs-/Fachkonzept zur Übergabe

---

## 1. Kontext & Zweck dieses Dokuments

Die DocuWare-Anbindung wurde in der **experimentellen Piloten-Variante** des Workplace
entwickelt und produktiv mit Kunden (u.a. Cofermin) erprobt. Dieses Dokument beschreibt
**fachliche Anforderungen, User Stories und die dabei gewonnenen Erkenntnisse**, damit das
Produkt-Team die DocuWare-Connection in der offiziellen Produktvariante **sauber neu bauen**
kann — ohne die Fallstricke erneut selbst zu entdecken.

**Wichtig zur Einordnung:** Die Piloten- und die Produkt-Codebasis divergieren seit Monaten.
Dieses Dokument ist **kein** Abbild des Produktcodes und schreibt keine konkrete Klassen-/Datei-
struktur vor. Die Verweise auf den Piloten-Code (Abschnitt 10) dienen nur als **Referenz-
implementierung** — „so haben wir es gebaut und was wir dabei gelernt haben". Übernommen werden
sollen die **Anforderungen und Erkenntnisse**, nicht 1:1 der Code.

**Zwei ausdrückliche Zusatzanforderungen des Auftraggebers:**
- **(a)** Die **Cofermin-Vorgangsmappe** soll später ebenfalls ins Produkt wandern. Der
  Connection-Umfang muss von Anfang an so gefasst sein, dass die Vorgangsmappe darauf aufsetzen
  kann (→ Abschnitt 6).
- **(b)** Das Dev-Team braucht initial **User Stories** für eine **gute Nutzung der Connection im
  Chat** (insb. Dokumentenansicht) (→ Abschnitt 5 + 7).

---

## 2. Scope & Abgrenzung

### 2.1 Was die Connection ist
Ein **generischer, mandantenfähiger DocuWare-Connector** auf Basis des allgemeinen
Connection-Provider-Systems (OAuth2). Die Connection ist reine **Transport-/Auth-Schicht** plus
eine Handvoll DocuWare-spezifischer Fähigkeiten (Suche, Schema-Discovery, Dokument-/Seiten-Abruf).

### 2.2 Was die Connection NICHT ist
Keine Fachlogik. Grouping zu „Vorgängen", Compliance-Prüfungen, NLU-Query-Übersetzung,
Feld-Mappings etc. gehören in die **konsumierende App** (z.B. Vorgangsmappe), nicht in die
Connection.

### 2.3 Read-only (v1)
Sowohl die Chat-Nutzung als auch die Vorgangsmappe sind heute **rein lesend** (Suchen, Metadaten,
Seiten-/PDF-Ansicht, Download). **Kein** Upload/Schreiben/Indexieren. Empfehlung: v1 bewusst
read-only halten; Schreib-Use-Cases später als eigenes, klar abgegrenztes Inkrement (→ Abschnitt 9).

### 2.4 Mandantenfähigkeit
Alles muss **tenant-agnostisch** sein: keine hardcodierten Cabinet-IDs, Feldnamen, Dialoge oder
Endpunkte. DocuWare-Feldnamen (`REFERENCE`, `DOCUMENT_TYPE`, …) sind kundenspezifisch und kommen
aus Konfiguration/Runtime, nie aus dem Connection-Code.

---

## 3. Fachliche Fähigkeiten der Connection (Soll-Funktionsumfang)

| # | Fähigkeit | Beschreibung | Konsument |
|---|-----------|--------------|-----------|
| F1 | **OAuth2/OIDC-Auth** | Authorization-Code-Flow mit Refresh, pro User; OIDC-User-Info | alle |
| F2 | **Cabinet-Discovery** | Liste der File Cabinets (IDs, Namen) | Chat, Setup |
| F3 | **Dialog-/Feld-Schema** | Filterbare Indexfelder eines Cabinets inkl. Typ/Label/Select-List-Hinweis, über Such-Dialog aufgelöst, gecached | Chat, Vorgangsmappe |
| F4 | **Select-Listen** | Erlaubte Werte für Keyword-/Auswahlfelder (Dropdown) | Chat, Vorgangsmappe |
| F5 | **Volltextsuche** | Einfache Suche ohne Schema-Wissen (`searchTerm`) | Chat |
| F6 | **Strukturierte Suche** | Präzisions-Filter über DialogExpression (exact/wildcard/range/OR), Batch-Ergebnis | Chat, Vorgangsmappe |
| F7 | **Dokument-Metadaten + Text** | Indexfelder + optional OCR-Text (Textshot) | Chat |
| F8 | **Sektionen** | Original + Anhänge, Seitenzahlen | Chat, Vorgangsmappe, Viewer |
| F9 | **Viewer-Assets (Proxy)** | Thumbnail, Seiten-Bild (page=1..N), PDF/Original — als **Backend-Proxy-URLs** (kein Token im Frontend) | Chat, Vorgangsmappe |

Diese neun Fähigkeiten bilden den **stabilen Vertrag**, auf den sowohl der Chat als auch spätere
Apps (Vorgangsmappe) aufsetzen.

---

## 4. Auth & Sicherheit (nicht-funktional, kritisch)

- **OAuth2 Authorization-Code + Refresh**, **pro User** (nicht org-weit). Jeder Nutzer verbindet
  sein eigenes DocuWare-Konto → dokumentbezogene Berechtigungen bleiben beim User.
- **OIDC:** `id_token` (Scope `openid`) liefert i.d.R. nur `sub`; **Profil (Name/E-Mail) per
  `/connect/userinfo` nachladen** (beide Pfade implementieren).
- **Token-Verschlüsselung at rest:** AES-256-GCM, Schlüssel aus `CONNECTION_ENCRYPTION_KEY`
  (64-hex/256-bit; zufälliges IV je Token). Schlüsselverlust ⇒ Tokens irreversibel (bei
  Key-Rotation einplanen).
- **Tokens erreichen NIE das Frontend.** Alle Binär-/Bild-Abrufe laufen über **serverseitige
  Proxy-Routen** (Session-Cookie-authentifiziert), die das User-Token backend-seitig injizieren.
- **Auto-Refresh** beim ersten Zugriff nach Ablauf; scheitert der Refresh → sauberer Auth-Fehler
  („bitte neu verbinden"), provider-spezifische Felder (`apiDomain`) über den Refresh hinweg erhalten.
- **Admin-Freischaltung pro Provider/Instanz** (rollenbasiert): Provider kann pro Instanz
  aktiviert/deaktiviert werden, bevor User sich verbinden dürfen.

---

## 5. User Stories

Format: *Als \<Rolle\> möchte ich \<Ziel\>, damit \<Nutzen\>.* + Akzeptanzkriterien (AK).

### 5.1 Setup & Verbindung (Admin/User)

**US-1 — Provider konfigurieren (Admin/Betrieb)**
Als Betreiber möchte ich DocuWare pro Instanz über Konfiguration (Client-ID/-Secret, Org-URL,
**tenant-spezifische** Authorization-/Token-URL, Scopes) einrichten, damit die Anbindung
mandantenspezifisch funktioniert.
- AK: Alle Endpunkte sind konfigurierbar (nicht aus der Org-URL abgeleitet — s. Erkenntnis E1).
- AK: Fehlende/ungültige Config führt zu klarer Fehlermeldung, nicht zu stillem Fehlschlag.

**US-2 — Provider freischalten (Admin)**
Als Admin möchte ich DocuWare für meine Instanz aktivieren/deaktivieren, damit User es nur bei
Freigabe sehen.

**US-3 — Eigenes Konto verbinden (User)**
Als Nutzer möchte ich mein DocuWare-Konto per „Verbinden" (OAuth) koppeln, damit ich mit meinen
Rechten auf Dokumente zugreife.
- AK: Nach Zustimmung landet der Flow direkt am Callback (kein 404-Consent-Screen, s. E2).
- AK: Verbindungsstatus + verbundener User (Name/E-Mail) sind sichtbar; „Trennen" möglich.
- AK: Access-Token läuft ab, wird aber transparent per Refresh erneuert (kein erneuter Login nötig,
  solange `offline_access` gewährt ist, s. E8).

### 5.2 Nutzung im Chat (Kern von Anforderung b)

**US-4 — Dokumente per Chat suchen (Volltext)**
Als Nutzer möchte ich im Chat natürlichsprachlich nach Dokumenten suchen („finde Rechnungen von
Wianco aus 2024"), damit der Agent die passenden Dokumente findet.
- AK: Agent nutzt Volltext- **oder** strukturierte Suche; Ergebnisliste mit Titel, Datum, Typ,
  wichtigsten Indexfeldern.
- AK: Bei präzisen Filtern (Feld = Wert, Datumsbereich) nutzt der Agent die strukturierte Suche
  inkl. vorheriger Feld-/Select-List-Discovery.

**US-5 — Suchtreffer inline sehen (Dokumentenansicht) ⭐**
Als Nutzer möchte ich Suchtreffer **direkt im Chat als Vorschau** sehen (Thumbnail + Titel +
Kerndaten), damit ich Dokumente erkenne, ohne den Chat zu verlassen.
- AK: Thumbnails werden **inline im Chat-Verlauf** gerendert (nicht als kaputter Bild-Link, nicht
  „neuer Tab") — analog zu den bestehenden Chat-Komponenten `GeneratedImage`/`ExportedDocument`.
- AK: Relative Proxy-URLs werden korrekt gegen die API-Basis aufgelöst (s. Erkenntnis E11).

**US-6 — Dokument im Chat durchblättern ⭐**
Als Nutzer möchte ich ein gefundenes Dokument **im Chat seitenweise durchblättern** (Vor/Zurück,
Seitenzähler „3 / 12"), damit ich den Inhalt prüfe, ohne es herunterzuladen.
- AK: Dedizierte Viewer-Komponente im Chat mit Seitennavigation über die `pages/{n}`-Proxy-Route.
- AK: Multi-Sektion-Dokumente (Original + Anhänge) sind auswählbar (Sektions-Picker).

**US-7 — PDF/Original im Chat ansehen & herunterladen ⭐**
Als Nutzer möchte ich das vollständige Dokument als **PDF inline** (iframe/Viewer) ansehen oder das
**Original herunterladen**, damit ich es vollständig lesen/archivieren kann.
- AK: PDF wird inline dargestellt; Download-Button für Original/PDF vorhanden.

**US-8 — Quellenbezug / Rücksprung**
Als Nutzer möchte ich pro angezeigtem Dokument einen klaren Bezug zur Quelle (Cabinet, Doc-ID,
Indexfelder) und ggf. einen Deep-Link, damit die Antwort nachvollziehbar/zitierbar ist.

> **Kern-Erkenntnis für (b):** Backend-Fähigkeiten & Proxy-Routen sind vorhanden und robust — die
> **Lücke liegt rein im Chat-Frontend** (keine Inline-Render-/Viewer-Komponenten). US-5..US-8 sind
> überwiegend Frontend-Arbeit. Details & Gaps in Abschnitt 7.

### 5.3 Vorgangsmappe-Forward-Compat (Anforderung a)

**US-9 — Vorgänge als Konsument der Connection**
Als Vorgangsmappe-App möchte ich über die generische Connection strukturiert suchen, das
Feld-Schema abrufen und Seiten/PDF anzeigen, damit ich Dokumente zu einem „Vorgang" (per
Referenzfeld) gruppieren und darstellen kann — **ohne** eigene DocuWare-Auth/-Transportlogik.
- AK: Die Connection stellt genau die Fähigkeiten F1, F3, F6, F8, F9 stabil bereit (s. Abschnitt 6).
- AK: Fachlogik (Grouping, Compliance, NLU, Feld-Mapping) bleibt in der App.

---

## 6. Anforderung (a): Forward-Compat für die Vorgangsmappe

Die Vorgangsmappe ist ein **reiner Konsument** der generischen Connection. Damit sie später ohne
Reibung ins Produkt migriert, muss die Connection folgende Fähigkeiten als stabilen Vertrag
anbieten:

| Von der Connection benötigt | Zweck in der Vorgangsmappe |
|---|---|
| **F1** Tokens je User (inkl. `apiDomain`, `accessToken`, Auto-Refresh) | Auth-Kontext für alle Calls |
| **F3** Feld-/Dialog-Schema (gecached) | Feldnamen/Typen für Filter-Validierung & NLU-Schema |
| **F4** Select-Listen | Werte-Vorschläge/Validierung für Keyword-Filter |
| **F6** Strukturierte Suche (Filter, Wildcard, Range, OR, Batch bis ~100) | Suche nach Referenz, Compliance-Check, Freitext-Filter |
| **F8** Sektionen | Seiten-/Anhang-Ermittlung für den Viewer |
| **F9** Viewer-Assets: Seiten-Bild + PDF/Original (Proxy) inkl. **Sektions-Fallback** | Dokument-Ansicht (Seiten & PDF) |

**Klare Grenzlinie (App vs. Connection):**

| Gehört in die **App** (Vorgangsmappe) | Gehört in die **Connection** |
|---|---|
| Grouping zu „Vorgang" per Referenzfeld (Post-Processing) | Strukturierte Suche + Ergebnis (Indexfelder as-is) |
| Compliance-Engine (Dokumenttypen, Incoterms, Pflicht-Matrix; eigene DB) | — (orthogonal, Connection darf nicht stören) |
| NLU (natürlichsprachliche Query → Filter-JSON) | Feld-Schema als Input für die NLU |
| Feld-Mapping/Cabinet-Konfig (kundenspezifisch, YAML) | Tenant-agnostisch, nimmt Feldnamen entgegen |
| Titel-Aufbereitung, Status-Pills, Sortierung | Rohdaten (Indexfelder, Seitenzahl, Store-Datum) |

**Konsequenz für den Neubau:** Wenn F1/F3/F4/F6/F8/F9 sauber und app-neutral geschnitten sind, ist
die spätere Vorgangsmappe-Migration überwiegend eine **Routing-/Frontend-Frage**, kein
Connection-Umbau. Die Vorgangsmappe liefert bereits eine **wiederverwendbare Viewer-Komponente**
(Seitennavigation + PDF-iframe + Sektions-Handling), die als Vorlage für den Chat-Viewer (US-6/US-7)
dienen kann.

---

## 7. Anforderung (b): Gute Chat-Nutzung & Dokumentenansicht — Ist-Zustand & Soll

### 7.1 Ist-Zustand
- **Backend/Tools/Proxy:** vollständig & robust (Suche, Metadaten, Sektionen, Thumbnail/Seiten/PDF
  über Session-authentifizierte Proxy-Routen; Tokens serverseitig).
- **Tool-Ausgaben:** Markdown-Strings + Proxy-URLs. Das Viewer-URL-Tool liefert bewusst **URLs statt
  Binärdaten** (ein LLM kann mit Pixeln nichts anfangen).
- **Chat-Frontend:** rendert die Tool-Ausgaben als Markdown. **Es gibt keine DocuWare-spezifische
  Render-/Viewer-Komponente.** Bilder werden nicht inline dargestellt, PDF nicht eingebettet.

### 7.2 Konkrete Gaps (heute)
1. **Kein Inline-Bild:** Thumbnails/Seiten erscheinen nicht im Chat (nur Link → neuer Tab).
2. **Relative URL-Auflösung:** Proxy-URLs sind relativ (`/api/connections/docuware/…`) und werden
   im Markdown-Renderer nicht zuverlässig gegen die API-Basis aufgelöst → kaputte Bilder.
3. **Keine Seitennavigation:** Template-URL `pages/{n}` vorhanden, aber kein Vor/Zurück-UI.
4. **Kein Inline-PDF:** `/file` liefert PDF, aber keine iframe-/pdf.js-Einbettung.
5. **Kein Sektions-Picker:** Multi-Sektion-Dokumente nicht wählbar dargestellt.
6. **Kein Quellenbezug** zurück zum Treffer/Metadaten in der Chat-Historie.
7. **Tool-Verkettung nötig:** Für Vorschauen muss der Agent `search` **und** `get_document_viewer_urls`
   aufrufen; ruft er nur `search`, fehlen die Viewer-URLs.

### 7.3 Soll (Anforderungen für „native" Chat-Ansicht)
- **CR-1:** Dedizierte Chat-Render-Komponente für DocuWare-Treffer (Thumbnail + Titel + Kerndaten
  inline), analog `GeneratedImage`/`ExportedDocument`.
- **CR-2:** In-Chat-**Dokument-Viewer** mit Seitennavigation (Seitenzähler), Sektions-Auswahl und
  **Inline-PDF**. Die vorhandene Vorgangsmappe-Viewer-Komponente als Basis wiederverwenden.
- **CR-3:** Korrekte Auflösung relativer Proxy-URLs gegen die API-Basis (build-/runtime-sicher).
- **CR-4:** Stabiles, maschinenlesbares **Tool-Ausgabeformat** (nicht nur Markdown-Prosa), damit das
  Frontend Treffer/Assets zuverlässig als Komponenten rendern kann (z.B. strukturierte „document
  card"-Payload mit Cabinet-ID, Doc-ID, Titel, Feldern, Viewer-URL-Set).
- **CR-5:** Quellen-/Citation-Block je Dokument (Cabinet, Doc-ID, Indexfelder, Deep-Link).
- **CR-6 (optional):** Agent-Guidance/Prompt, damit bei „zeig mir das Dokument" automatisch die
  Viewer-URLs mitgeliefert werden (Tool-Verkettung oder kombiniertes Such-+Viewer-Ergebnis).

> **Empfehlung:** CR-1..CR-3 sind der Kern für ein „es fühlt sich nativ an"-Erlebnis und
> überwiegend Frontend. CR-4 ist die Voraussetzung dafür, dass das Frontend nicht Markdown parsen
> muss — beim Neubau **von Anfang an** ein strukturiertes Tool-Ergebnis vorsehen (nicht wie im
> Piloten reine Markdown-Strings).

---

## 8. Erkenntnisse & Design-Rationale (damit nichts doppelt erarbeitet wird)

### 8.1 Warum der Tool-Zuschnitt so ist
DocuWare ist **nicht ein Tool**, sondern mehrere klar getrennte UX-Flüsse. Der Zuschnitt in
spezialisierte Tools reduziert die LLM-Komplexität (Single Responsibility), erlaubt
unterschiedliche Caching-/Validierungsstrategien und feinere Berechtigungen:

- **Discovery-Kette:** `list_cabinets` → `list_cabinet_fields` (Feld-Schema) → `get_field_select_list`
  (Werte). Select-Listen sind **pro Feld optional und teuer** (je ein API-Call) → eigenes Tool.
- **Suche zweigeteilt:** *Volltext* (kein Schema nötig, schneller Einstieg) vs. *strukturiert*
  (DialogExpression, präzise, aber Feld-Discovery + Validierung nötig). Der Aufwand unterscheidet
  sich drastisch → nicht in ein Tool zwängen.
- **Viewer-URLs statt Binärdaten:** Ein Tool, das Pixel zurückgibt, ist für ein LLM nutzlos und
  würde Tokens/Assets falsch platzieren. Stattdessen **Backend-Proxy-URLs** → Sicherheit + LLM-tauglich.
- **Sektionen als eigenes Tool:** Für den Viewer wird mind. die erste Sektion gebraucht; manche
  Tenants verlangen Sektions-IDs sogar für Seiten-Bilder.

### 8.2 DocuWare-API-Fallstricke (hart erlernt — bitte übernehmen)

| # | Erkenntnis | Konsequenz für den Neubau |
|---|-----------|---------------------------|
| **E1** | **OAuth-2024-Migration:** Authorization-/Token-Endpunkte liegen seit ~2024 auf zentralem IdP `login-emea.docuware.cloud/<tenant>/…` und sind **nicht** aus der Org-URL ableitbar. | Endpunkte **konfigurierbar** machen (aus DocuWare-App-Registrierung exakt übernehmen), nicht konstruieren. |
| **E2** | **WAF blockt Alt-Pfade:** Der alte Org-Pfad `/DocuWare/Platform/Account/Authorize` wird teils per WAF abgewiesen („Request blocked by DocuWare firewall"). | Nicht auf Org-Pfad-Fallback verlassen; tenant-Endpunkte sind Pflicht. |
| **E3** | **Kein `prompt=consent`:** Der neue IdP redirectet danach auf `/<tenant>/consent`, das 404t. | Parameter weglassen → Flow geht direkt Login → Callback. |
| **E4** | **OIDC-Claims unvollständig:** `id_token` enthält oft nur `sub`; Name/E-Mail per `/connect/userinfo` (IdentityServer) nachladen. | Beide Pfade implementieren (Claims + userinfo-Fallback). |
| **E5** | **Platform-API liefert ohne Accept-Header XML/SOAP.** | `Accept: application/json` **explizit** setzen, sonst Parse-Fehler. |
| **E6** | **Seiten-Bilder: Doc-Level vs. Section-Level tenant-/versionsabhängig.** | Proxy probiert Doc-Level zuerst, bei 404/415 Sektions-ID auflösen und Section-Level retryen. |
| **E7** | **DialogExpression-Value-Semantik** (aus Tenant-Probes): 1 Wert ohne `*` = exact; 1 Wert mit `*` = wildcard; 2 Werte bei Date/Numeric/Decimal = Range; mehrere Text-Werte = OR. | Diese Semantik ist **undokumentiert** — direkt übernehmen, spart Reverse-Engineering. |
| **E8** | **`offline_access` ist Pflicht** für Refresh-Token; sonst Access-Token nach ~60 Min tot. | Scope setzen; Connection sonst stündlich unbrauchbar. |
| **E9** | **Scopes tenant-abhängig:** Kunden-IdP unterstützt evtl. `dwprofile`/`offline_access` nicht → `invalid_scope`. | Scopes **überschreibbar** konfigurieren (Default `docuware.platform openid dwprofile offline_access`). |
| **E10** | **Mehrere Such-Dialoge pro Cabinet:** Dialog muss aufgelöst werden (Hint per ID/Name/Substring → Default → erster Search-Dialog). Detail-Call kostet 100–300 ms. | Dialog-Resolver + **In-Memory-Cache (~10 Min, cabinet-keyed)**; Feld-Route und Such-Route teilen den Cache. |
| **E11** | **Relative Proxy-URLs** werden im Chat-Markdown nicht sauber aufgelöst. | Im Frontend gegen API-Basis auflösen (CR-3). |
| **E12** | **ID-Validierung/Path-Traversal:** Cabinet/Doc/Section-IDs streng validieren, Seiten-Nr. deckeln, URL-encoden. | Konservative Muster (GUID/numerisch + safe chars), Page-Cap. |

### 8.3 Sicherheits-/Betriebs-Patterns (bewährt)
- Tokens **nie** ans Frontend; ausschließlich Session-authentifizierte **Proxy-Routen**.
- **AES-256-GCM** at rest, Key aus Env (64-hex), IV je Token; Key-Rotation einplanen.
- **Transparenter Refresh** beim ersten Zugriff; bei Fehlschlag sauberer „reconnect"-Fehler.
- **Caching:** Dialog-Details ~10 Min; Proxy-Responses privat/session-gebunden (Thumbnails länger,
  Seiten-Bilder kürzer). Reduziert API-Last spürbar.
- **Admin-Gating pro Provider/Instanz** vor User-Self-Connect.

### 8.4 Historie (laut Git-Verlauf der Piloten-Variante, zur Einordnung)
- **~2026-03:** Erststart DocuWare (OAuth-Provider-Pattern, Volltextsuche, Dokument-Fetch, Cabinets).
- **~2026-05-04:** OAuth-2024-IdP-Fix (E1–E5): tenant-Endpunkte, `prompt=consent` raus,
  OIDC+userinfo, Accept-Header.
- **~2026-05-22:** Ausbau: strukturierte Suche (DialogExpression), Feld-Discovery, Select-Listen,
  Dialog-Resolver mit Cache, Sektionen, Viewer-Proxy-Routen (Thumbnail/Seite/PDF) — Grundlage der
  Vorgangsmappe.

---

## 9. Nicht-funktionale Anforderungen & Empfehlungen

- **Mandantenfähig:** keine hardcodierten Feldnamen/Cabinets/Endpunkte; alles konfigurierbar.
- **Read-only v1:** Upload/Schreiben bewusst ausklammern; falls später nötig, als separates
  Inkrement mit eigener Berechtigung/Fachkonzept.
- **Resiliente API-Aufrufe:** Accept-Header, Doc-/Section-Fallback, Fehlermapping (401/403 →
  reconnect, 404 → not found, 415 → Fallback).
- **Performance:** Dialog-/Schema-Caching, sinnvolle Batch-Limits (DialogExpression ~100/Query).
- **Beobachtbarkeit:** klare Logs bei Auth-/Refresh-Fehlern (ohne Tokens im Klartext).
- **Strukturierte Tool-Ergebnisse** (CR-4) statt reiner Markdown-Strings — von Anfang an.

---

## 10. Referenz-Implementierung (Piloten-Variante, nur als Vorlage)

> Nicht 1:1 übernehmen — divergierende Codebasis. Dient dem Dev-Team als Nachschlage-/Vergleichs-
> punkt für Details.

```
backend/src/connections/
├── providers/index.ts                 # Registrierung (DocuWare unter 9 Providern)
├── providers/docuware/
│   ├── provider.ts                     # OAuth2-Provider, Setup-Guide, getTools()
│   ├── config.ts                       # Env, URL-Builder, API-Endpunkte, Quirk-Kommentare (E1–E6)
│   ├── dialogs.ts                      # Dialog-Resolver + 10-Min-Cache (E10)
│   ├── search.ts                       # Strukturierte Suche, Value-Semantik (E7)
│   └── tools/                          # 8 Tools (list/fields/select-list/fulltext/structured/
│                                       #  get-document/sections/viewer-urls)
├── registry.ts                         # Per-User-Token-Mgmt + Auto-Refresh
├── crypto.ts                           # AES-256-GCM (CONNECTION_ENCRYPTION_KEY)
└── base/OAuthProvider.ts               # OAuth2-Basisklasse
backend/src/routes/connections-docuware.ts   # Proxy-Routen (thumbnail/pages/file/fields/search)
frontend/src/apps/vorgangsmappe/components/DocumentViewer.jsx   # wiederverwendbarer Viewer (Basis für Chat-Viewer)
frontend/src/components/ChatWindow.jsx        # GeneratedImage/ExportedDocument als Render-Muster
data/apps/vorgangsmappe/config.yaml           # Beispiel tenant-spezifisches Feld-Mapping
```

**Env-Konfiguration (Referenz):** `DOCUWARE_CLIENT_ID`, `DOCUWARE_CLIENT_SECRET`,
`DOCUWARE_ORG_URL`, `DOCUWARE_AUTHORIZATION_URL`, `DOCUWARE_TOKEN_URL`, `DOCUWARE_SCOPES`,
`CONNECTION_ENCRYPTION_KEY`.

---

## 11. Zusammenfassung für das Dev-Team

1. **Connection = Transport/Auth + 9 Fähigkeiten** (Abschnitt 3). Fachlogik bleibt draußen.
2. **Read-only, mandantenfähig, pro-User-OAuth**, Tokens verschlüsselt & nie im Frontend.
3. **Anforderung (a):** F1/F3/F4/F6/F8/F9 app-neutral schneiden → Vorgangsmappe migriert später
   fast reibungsfrei (Grenzlinie in Abschnitt 6).
4. **Anforderung (b):** Backend ist da — **die Chat-Erfahrung fehlt im Frontend**. Dedizierte
   Inline-Karten + Dokument-Viewer (Seiten/PDF/Sektionen) + strukturierte Tool-Ergebnisse
   (US-5..US-8, CR-1..CR-6). Vorgangsmappe-Viewer als Basis.
5. **Erkenntnisse (Abschnitt 8):** die DocuWare-Fallstricke E1–E12 sparen Wochen Reverse-
   Engineering — bitte direkt einplanen.
