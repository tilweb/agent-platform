# Fachkonzept: Confluence-Connection (Neubau im Produkt)

**Datum:** 2026-07-23
**Autor:** Andreas Bachmann (Piloten-/Co-Creation-Variante)
**Adressat:** Produkt-Dev-Team
**Status:** Anforderungs-/Fachkonzept zur Übergabe

---

## 1. Kontext & Zweck dieses Dokuments

Die Confluence-Anbindung wurde in der **experimentellen Piloten-Variante** des Workplace gebaut.
Dieses Dokument beschreibt **fachliche Anforderungen, User Stories und die gewonnenen Erkenntnisse**,
damit das Produkt-Team die Confluence-Connection in der offiziellen Produktvariante **sauber neu
bauen** kann — ohne die Atlassian-Fallstricke erneut selbst zu entdecken.

**Einordnung (wie beim DocuWare-Fachkonzept):** Piloten- und Produkt-Codebasis divergieren. Verweise
auf den Piloten-Code (Abschnitt 10) sind **Referenz**, keine Vorgabe einer konkreten Datei-/Klassen-
struktur. Übernommen werden **Anforderungen und Erkenntnisse**.

**Unterschied zu DocuWare:** Für Confluence gibt es **keinen App-Bezug** — es existiert keine
konsumierende Fach-App wie die Vorgangsmappe. Damit entfällt der „Forward-Compat für eine App"-Teil.
Confluence wird heute rein **generisch** genutzt (Chat-Tools, Unified Search, KB-Import) — s.
Abschnitt 6. Der Schwerpunkt liegt daher auf **(b) guter Chat-Nutzung / Inhaltsdarstellung** und den
**Erkenntnissen**.

---

## 2. Scope & Abgrenzung

### 2.1 Was die Connection ist
Ein **generischer, mandantenfähiger Confluence-Connector** auf Basis des allgemeinen
Connection-Provider-Systems (Atlassian Cloud **OAuth2 3LO**). Reine **Transport-/Auth-Schicht** plus
Confluence-spezifische Fähigkeiten (Space-Discovery, CQL-Suche, Page-Read, Content-Format-Handling).

### 2.2 Read-only (v1)
Alle heutigen Nutzungen sind **rein lesend** (Suche, Seiten lesen, Spaces auflisten). **Kein**
Schreiben/Anlegen/Kommentieren. Empfehlung: v1 read-only halten; Schreib-Use-Cases (Seite anlegen,
Kommentar) später als eigenes Inkrement (erfordert ADF + `write:*`-Scopes + Reconsent, s. E5/E6).

### 2.3 Mandantenfähigkeit
Tenant-agnostisch: Client-ID/-Secret, Scopes und der aufgelöste **cloudId** sind pro Verbindung;
keine hardcodierten Site-URLs oder Space-Keys.

### 2.4 Kein App-Bezug, aber generische Konsumenten
Es gibt keine dedizierte Fach-App. Confluence wird aber von **mehreren generischen Plattform-
Bausteinen** konsumiert (Abschnitt 6) — der Connection-Vertrag muss diese bedienen.

---

## 3. Fachliche Fähigkeiten der Connection (Soll-Funktionsumfang)

| # | Fähigkeit | Beschreibung | Status im Piloten |
|---|-----------|--------------|-------------------|
| F1 | **OAuth2-3LO + cloudId** | Auth über `auth.atlassian.com`, danach `accessible-resources` → **cloudId** je Verbindung; Refresh (rotierend!) | ✅ vorhanden |
| F2 | **Space-Discovery** | Spaces auflisten (global/personal), Cursor-Pagination (`_links.next`) | ⚠️ vorhanden, aber ohne echte Cursor-Pagination (nur Hinweis „mehr vorhanden") |
| F3 | **CQL-Suche** | Volltext über Seiten + Blogposts, optional Space-Filter (`type in (page,blogpost) AND (title~ OR text~)`) | ✅ vorhanden (V1) |
| F4 | **Page-Read** | Seite per ID **oder** Titel+Space; Metadaten (Version, Status, Datum) + Body | ✅ vorhanden (V2, Titel-Lookup via V1) |
| F5 | **Content-Format → LLM/Anzeige** | Storage-XHTML in strukturiertes Markdown wandeln (Tabellen, Codeblöcke, Panels, Links erhalten) | ❌ nur simple Regex→Plaintext (verlustbehaftet) |
| F6 | **Attachments/Bilder (Proxy)** | Bilder/Anhänge einer Seite serverseitig proxien (kein Token im Frontend) — analog DocuWare-Viewer | ❌ nicht vorhanden |
| F7 | **Multi-Instance** | Nutzer mit Zugriff auf mehrere Confluence-Instanzen (mehrere cloudIds) | ❌ nur erste Instanz wird genutzt |

F1–F4 sind der heutige stabile Kern. **F5–F7 sind die wesentlichen Lücken**, die den Neubau
aufwerten (s. Abschnitt 7 + 8).

---

## 4. Auth & Sicherheit (nicht-funktional, kritisch)

- **OAuth2 Authorization-Code 3LO** über `auth.atlassian.com/authorize` + `/oauth/token`,
  `audience=api.atlassian.com`, **pro User**.
- **cloudId-Auflösung (Pflicht-Extra-Hop):** Das OAuth-Response enthält **keinen** cloudId. Nach dem
  Token-Tausch `GET /oauth/token/accessible-resources` aufrufen und die (erste) Confluence-Instanz als
  **`cloudId` je Verbindung** speichern. Alle API-Calls laufen danach über das Gateway
  `api.atlassian.com/ex/confluence/{cloudId}/…`.
- **Scopes:** granular V2 (`read:page:confluence`, `read:space:confluence`, `read:content:confluence`,
  `read:content.metadata:confluence`, `search:confluence`) **plus** klassische V1-Scopes für die
  CQL-Suche (`read:confluence-content.all`, `read:confluence-space.summary`), `read:me` für User-Info,
  **`offline_access`** für Refresh-Tokens.
- **⚠️ Rotierende Refresh-Tokens (höchste Betriebs-Priorität):** Atlassian gibt bei jedem Refresh
  einen **neuen** Refresh-Token zurück und **invalidiert den alten**. Wird der neue nicht gespeichert,
  ist die Verbindung **dauerhaft tot** (kein erneuter Refresh möglich). Der Neubau muss garantieren,
  dass `refresh_token` aus jeder Token-Antwort persistiert wird (mit Log-Bestätigung).
- **Token-Verschlüsselung at rest:** AES-256-GCM, Key aus `CONNECTION_ENCRYPTION_KEY` (64-hex),
  zufälliges IV; DB sieht nur Ciphertext. Key-Verlust ⇒ Tokens irreversibel.
- **Tokens erreichen NIE das Frontend.** Tool-Ausführung + jeder API-Call laufen serverseitig; das
  gilt auch für einen künftigen Attachment-Proxy (F6).
- **Admin-Freischaltung pro Provider/Instanz** vor User-Self-Connect.
- **Scope-Reconsent:** Ändern sich die Scopes (z.B. Schreib-Scopes später), müssen bestehende User
  **neu zustimmen** — kein stilles Upgrade. Beim Rollout einplanen (sonst rätselhafte 403).

---

## 5. User Stories

Format: *Als \<Rolle\> möchte ich \<Ziel\>, damit \<Nutzen\>.* + Akzeptanzkriterien (AK).

### 5.1 Setup & Verbindung

**US-1 — Provider konfigurieren (Betrieb):** Als Betreiber möchte ich Confluence pro Instanz über
`CONFLUENCE_CLIENT_ID`/`CONFLUENCE_CLIENT_SECRET` (+ Scopes) einrichten, damit die Anbindung
funktioniert. AK: fehlende Config → klarer Fehler, kein stiller Fehlschlag.

**US-2 — Provider freischalten (Admin):** Als Admin möchte ich Confluence für meine Instanz
aktivieren/deaktivieren.

**US-3 — Eigenes Konto verbinden (User):** Als Nutzer möchte ich mein Atlassian/Confluence-Konto per
OAuth koppeln, damit ich mit **meinen** Rechten suche/lese.
- AK: Nach Zustimmung wird cloudId ermittelt und gespeichert; Verbindungsstatus + verbundener User
  sichtbar; „Trennen" möglich.
- AK: Token-Ablauf wird transparent per Refresh erneuert (rotierender Refresh-Token korrekt
  übernommen); kein erzwungener Re-Login, solange `offline_access` gewährt ist.

### 5.2 Nutzung im Chat (Kern von Anforderung b)

**US-4 — Wissen per Chat finden (CQL-Suche):** Als Nutzer möchte ich im Chat nach Confluence-Inhalten
suchen („was steht im Onboarding-Space zu Urlaub?"), damit der Agent passende Seiten findet.
- AK: Treffer mit Titel, Space, Datum, Snippet und **Deep-Link** zur Original-Seite; optional
  Space-Filter.

**US-5 — Seiteninhalt lesbar im Chat ⭐:** Als Nutzer möchte ich den Inhalt einer Seite **strukturiert
und lesbar** im Chat sehen (Überschriften, **Tabellen**, Listen, Codeblöcke, Panels), damit ich die
Information ohne Wechsel nach Confluence nutzen kann.
- AK: Storage-XHTML wird nach **Markdown** gewandelt (nicht Plaintext); Tabellen/Codeblöcke/Panels
  bleiben erhalten (F5).
- AK: Lange Seiten werden **getrunct** mit „mehr anzeigen"/Deep-Link (kein Full-Dump → Token-Bloat).

**US-6 — Bilder/Diagramme sehen ⭐:** Als Nutzer möchte ich in-Page-Bilder/Diagramme im Chat sehen,
damit visuelle Specs nutzbar sind.
- AK: Bilder/Anhänge über einen **serverseitigen Proxy** (kein Token im Frontend, analog DocuWare) —
  heute komplett fehlend (F6).

**US-7 — Quellenbezug/Deep-Link:** Als Nutzer möchte ich pro Seite einen klaren „In Confluence öffnen"-
Link + Space/Version, damit die Antwort nachvollziehbar/zitierbar ist.

**US-8 — Spaces/Hierarchie browsen (optional):** Als Nutzer möchte ich Spaces und deren Seiten
**navigieren** (nicht nur suchen), damit ich mich in unbekannten Bereichen orientiere.
- AK: Cursor-Pagination sauber implementiert (F2); ggf. Child-Pages/Ancestor-Navigation.

### 5.3 Generische Konsumenten (kein Chat)

**US-9 — Unified Search:** Als Nutzer möchte ich Confluence-Treffer in der plattformweiten Suche
sehen. **US-10 — KB-Import:** Als Nutzer möchte ich eine Confluence-Seite in die Knowledge Base
importieren. **US-11 — Chat-Kontext:** Als Nutzer möchte ich eine Seite als Kontext-Chip an einen Chat
anheften.
- AK für alle: nutzen denselben Connection-Vertrag (F3/F4/F5) — von einer besseren Markdown-Konversion
  (F5) profitieren sie unmittelbar (heute geht Struktur schon vor dem Import verloren).

---

## 6. Generische Konsumenten & Scope-Konsequenzen (statt App-Forward-Compat)

Da es keine Fach-App gibt, muss der Connection-Vertrag diese **generischen Plattform-Konsumenten**
bedienen:

| Konsument | Nutzt | Konsequenz für die Connection |
|---|---|---|
| **Chat-Agent-Tools** | F3 Suche, F4 Read, (künftig F5/F6) | strukturiertes, LLM-taugliches Ergebnis |
| **Unified Search** | F3 Suche | einheitliches Treffer-Schema (Titel, Space, Snippet, Deep-Link) |
| **KB-Import** | F4 Read | **F5 Markdown** entscheidend — sonst wird Struktur schon vor dem Indexieren zerstört |
| **Chat-Kontext (Reader-Chip)** | F4 Read | getrunctes, sauberes Markdown + Quellbezug |

**Wichtig:** Die verlustbehaftete Plaintext-Konversion (F5-Lücke) trifft **alle** Konsumenten
gleichzeitig. Eine ordentliche Storage-XHTML→Markdown-Konversion ist daher der **größte
Einzelhebel** und sollte **zentral in der Connection** liegen (nicht pro Konsument nachgebaut).

---

## 7. Anforderung (b): Gute Chat-Nutzung & Inhaltsdarstellung — Ist / Gaps / Soll

### 7.1 Ist-Zustand
- **Auth/cloudId/Suche/Read:** funktionsfähig (CQL-Suche V1, Page-Read V2, Space-Liste V2).
- **Tool-Ausgaben:** Markdown-**Strings** (Prosa), keine strukturierten Objekte.
- **Content-Konversion:** Storage-XHTML wird per **Regex zu Plaintext** gestrippt.
- **Frontend:** Rendering nur als Markdown; **keine** Confluence-spezifische Komponente; **kein**
  Attachment-/Bild-Proxy.

### 7.2 Konkrete Gaps
1. **Struktur-/Formatverlust:** Tabellen, Panels/Callouts, Codeblöcke, Makros, Rich-Formatting gehen
   verloren (nur Plaintext).
2. **Bilder/Anhänge fehlen komplett:** kein Proxy → in-Page-Grafiken unsichtbar.
3. **Keine Truncation:** ganze Seiten landen im Chat → Layout-/Token-Bloat.
4. **Kein Deep-Link/Citation-Block** zurück zur Original-Seite in der Chat-Historie.
5. **Nur Suche, kein Browsing:** keine Hierarchie-/Space-Navigation; Pagination nur angedeutet.
6. **Reine Markdown-Prosa** als Tool-Output → Frontend kann Treffer nicht als Komponenten rendern.

### 7.3 Soll (Anforderungen)
- **CR-1 (größter Hebel):** **Storage-XHTML → Markdown**-Konversion (Tabellen, Codeblöcke, Panels,
  Listen, Links erhalten) — **zentral in der Connection** (nützt Chat, Unified Search, KB-Import).
- **CR-2:** **Truncation + „mehr anzeigen"/Deep-Link** für lange Seiten; Body nicht ungekürzt dumpen.
- **CR-3:** **Attachment-/Bild-Proxy** (Session-authentifiziert, Token serverseitig) analog DocuWare;
  Bilder inline im Chat.
- **CR-4:** **Strukturierte Tool-Ergebnisse** (JSON: Titel, Space, Doc-ID, Version, Deep-Link,
  Body-Markdown) statt reiner Strings, damit das Frontend „page cards"/Preview rendern kann.
- **CR-5:** **Deep-Link/Citation-Block** je Seite (Space, Version, „In Confluence öffnen").
- **CR-6 (optional):** Space-/Hierarchie-**Browsing** mit echter Cursor-Pagination (F2/F7).

> **Empfehlung:** CR-1 zuerst — er wirkt sofort für alle Konsumenten. CR-3 (Bild-Proxy) und CR-4
> (strukturierte Outputs) heben das Chat-Erlebnis auf „nativ".

---

## 8. Erkenntnisse & Design-Rationale (damit nichts doppelt erarbeitet wird)

### 8.1 Warum der Tool-Zuschnitt so ist
Drei Tools nach LLM-Nutzungsmuster getrennt: **`confluence_search`** (Discovery, query-getrieben),
**`confluence_list_spaces`** (Navigation/Enumeration), **`confluence_read_page`** (Retrieval per ID
oder Titel+Space, zweiphasig). Kein Monolith-„get-confluence" — der Agent soll erst finden, dann
gezielt lesen. Jeder Flow hat eigene Fehlerbehandlung (401/403, cloudId-Validierung).

### 8.2 Atlassian-/Confluence-API-Fallstricke (hart erlernt — bitte übernehmen)

| # | Erkenntnis | Konsequenz für den Neubau |
|---|-----------|---------------------------|
| **E1** | **cloudId nicht im OAuth-Response.** Extra-Hop `accessible-resources` nötig; cloudId ist **verbindungs-**, nicht user-scoped. | cloudId nach Auth ermitteln und je Verbindung persistieren; über Refresh hinweg erhalten. |
| **E2** | **cloudId ging beim Refresh verloren** (realer Bug, Fix `0636c7b`) → alle Calls 404. | Beim Refresh provider-spezifische Felder (cloudId) explizit übernehmen. |
| **E3** | **Gateway-Modell:** alle Calls über `api.atlassian.com/ex/confluence/{cloudId}/…`, nicht Site-URL. | Basis-URL mit cloudId bauen; IP-Allowlisting betrifft Atlassian-Ranges, nicht die Kunden-Site. |
| **E4** | **V1/V2-Split:** V2 hat **keine CQL-Suche** → Suche muss über **V1** `/wiki/rest/api/search`; Read/Spaces über **V2**. | Bewusst gemischt implementieren; Scopes für beide Welten. |
| **E5** | **Scope-Fragmentierung:** granulare V2-Scopes **plus** klassische V1-Scopes (für CQL) nötig; `read:me` für User-Info (fehlte anfangs → 401, Fix `e6f5bb3`). | Scope-Liste vollständig; bei Änderung **Reconsent** einplanen (kein stilles Upgrade). |
| **E6** | **`offline_access` Pflicht** für Refresh-Token. | ohne → Verbindung nach ~1 h tot. |
| **E7** | **Rotierende Refresh-Tokens (kritisch):** Atlassian invalidiert den alten Refresh-Token bei jedem Refresh. | Neuen `refresh_token` **immer** aus der Antwort speichern (mit Log-Nachweis) — sonst Verbindung dauerhaft kaputt. |
| **E8** | **Storage-XHTML ≠ ADF ≠ View.** Read nutzt `body-format=storage`; heute nur Regex→Plaintext (verlustbehaftet). | Ordentliche **XHTML→Markdown**-Konversion (Bibliothek) statt Regex (CR-1). ADF erst bei Schreib-Ops. |
| **E9** | **CQL-Eigenheiten:** `~` = Fuzzy/Phrase (kein Regex); Query-Escaping heute manueller String-Concat. | CQL-Builder/Escaping robust lösen (Injection vermeiden). |
| **E10** | **Pagination:** V2 liefert `_links.next` (Cursor); heute nur „mehr vorhanden"-Hinweis, keine echte Iteration. | Cursor-Pagination implementieren; große Instanzen sonst unvollständig. |
| **E11** | **Kein 429-Handling.** | Backoff/Retry + Rate-Limit-Header auswerten. |
| **E12** | **Scope vs. Seiten-Berechtigung:** OAuth-Scope ≠ Confluence-Page-Permission; beides kann 403 erzeugen. | Fehlermeldung differenzieren (Scope- vs. Berechtigungsproblem). |
| **E13** | **Multi-Instance:** nur die erste cloudId wird genutzt. | Alle zugänglichen Instanzen speichern; Instanz-Auswahl ermöglichen. |

### 8.3 Sicherheits-/Betriebs-Patterns (bewährt)
- Tokens **nie** ans Frontend; alles serverseitig (auch künftiger Attachment-Proxy).
- **AES-256-GCM** at rest, Key aus Env, IV je Token; Key-Rotation einplanen.
- **Transparenter Refresh** beim ersten Zugriff; bei Fehlschlag sauberer „reconnect"-Fehler.
- **Admin-Gating pro Provider/Instanz** vor User-Self-Connect; deaktivieren sperrt neue Verbindungen
  (bestehende bleiben verschlüsselt liegen — kein Bulk-Disconnect vorgesehen, ggf. ergänzen).

### 8.4 Historie (laut Git-Verlauf der Piloten-Variante)
- **~2026-02-20:** Provider-Plugin-Architektur, Confluence als Provider aufgenommen.
- **~2026-04-01:** intensive Härtung an einem Tag: `read:me`-Scope-Fix (401), **cloudId-Refresh-Fix**
  (`0636c7b`), Umstieg auf **granulare V2-Scopes** (V1 `/space` = 410 Gone), **Suche zurück auf V1-CQL**
  (`bb8c998`, V2 ohne CQL) inkl. body-format-Fallback.
- Keine CHANGELOG-Einträge — Lernpfad steckt in den Commit-Messages.

---

## 9. Nicht-funktionale Anforderungen & Empfehlungen

- **Mandantenfähig & read-only v1**; Schreib-Ops (ADF + write-Scopes + Reconsent) separat.
- **Zentrale Content-Konversion (CR-1)** als größter Qualitätshebel für alle Konsumenten.
- **Resiliente API-Aufrufe:** cloudId-Handling, V1/V2 bewusst, 429-Backoff, differenzierte Fehler.
- **Refresh-Token-Rotation garantiert** persistieren (Betriebsrisiko #1).
- **Strukturierte Tool-Ergebnisse** von Anfang an (nicht Markdown-Prosa).
- **Beobachtbarkeit:** Logs für Auth/Refresh/cloudId (ohne Tokens im Klartext).

---

## 10. Referenz-Implementierung (Piloten-Variante, nur als Vorlage)

> Nicht 1:1 übernehmen — divergierende Codebasis.

```
backend/src/connections/
├── providers/index.ts                  # Registrierung (Confluence unter 9 Providern)
├── providers/confluence/
│   ├── provider.ts                     # OAuth2-3LO-Provider, cloudId-Validierung, getTools()
│   ├── config.ts                       # Scopes, Auth/Token-URLs, accessible-resources, API-Basis (V1/V2)
│   └── tools/
│       ├── search.ts                   # CQL-Suche (V1), Snippet, Markdown-Output
│       ├── read-page.ts                # Page-Read (V2 + Titel-Lookup V1), Storage→Plaintext (E8-Gap)
│       └── list-spaces.ts              # Space-Enumeration (V2), Pagination-Hinweis (E10-Gap)
├── registry.ts                         # Per-User-Token-Mgmt + Refresh (cloudId-Preservation, E2)
├── crypto.ts                           # AES-256-GCM (CONNECTION_ENCRYPTION_KEY)
└── base/OAuthProvider.ts               # OAuth2-Basisklasse (Refresh-Token-Handling, E7)
frontend/src/components/ChatWindow.jsx  # Markdown-Rendering; GeneratedImage/ExportedDocument als Muster
```

**Env-Konfiguration (Referenz):** `CONFLUENCE_CLIENT_ID`, `CONFLUENCE_CLIENT_SECRET`,
`CONNECTION_ENCRYPTION_KEY`. Callback: `/api/connections/confluence/callback`.

**Kein** Confluence-Proxy-Route heute (Kontrast zu `routes/connections-docuware.ts`) → CR-3.

---

## 11. Zusammenfassung für das Dev-Team

1. **Connection = Transport/Auth + Fähigkeiten F1–F7.** Read-only, mandantenfähig, pro-User-3LO,
   Tokens verschlüsselt & nie im Frontend.
2. **Kein App-Bezug**, aber **generische Konsumenten** (Chat, Unified Search, KB-Import, Chat-Kontext)
   — Vertrag muss diese bedienen (Abschnitt 6).
3. **Anforderung (b) / größte Lücken:** **F5 Content→Markdown** (CR-1, wirkt für alle Konsumenten),
   **F6 Bild-/Attachment-Proxy** (CR-3), **Truncation + Deep-Link** (CR-2/CR-5), **strukturierte
   Tool-Ergebnisse** (CR-4), optional **Browsing/Pagination** (CR-6).
4. **Erkenntnisse E1–E13:** Atlassian ist multi-hop & multi-version — cloudId-Extra-Hop,
   Gateway-Basis-URL, V1/V2-Split (CQL nur V1), Scope-Fragmentierung + Reconsent, **rotierende
   Refresh-Tokens** (Betriebsrisiko #1), Storage-XHTML-Konversion. Direkt einplanen spart Wochen.
