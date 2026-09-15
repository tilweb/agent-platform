# KI-Modelle-Seite: Vom Provider-Verwalter zum Modellkatalog (2026-09-15)

## Kontext

Das Konzept hinter der Seite hat sich geändert: Adacor agiert als **Modellrouter** —
Kunden beziehen alle Modelle über die Adacor-API (inkl. Abrechnung über eingekaufte
Kontingente), es entstehen keine eigenen Vertragsbeziehungen zu Modellanbietern. Die alte
Seite erzählte die interne Beschaffungssicht: Provider-Boxen als Vertragspartner, vier
Security-Tier-Banner (Schilde, Ampelfarben, Warn-Duktus) als Compliance-Raster. Für
Kunden-Admins ist das die falsche Botschaft — gewünscht ist: transparent wählen können,
welche Datenschutz-Exposure ok ist, ohne dass es sich komplex und unsteuerbar anfühlt
(„Adacor hat das im Griff"). Vorbild-Muster (Nele, Langdock): nur Data-Residency-Flagge
sichtbar, Details im Trust Center.

## Entscheidungen

- **Flacher Modellkatalog statt Provider-Boxen**: Eine Liste aller Modelle (aktiver
  Provider), alphabetisch, mit Suche und Fähigkeits-Filterchips (Alle/Chat/Vision/Bild/
  Audio/Embedding) plus Checkbox „Nur EU/EWR-Verarbeitung". Gegliedert in dezente
  **Data-Residency-Sektionen** (Deutschland → Europa → USA → International, Deutschland
  bewusst zuerst) — hält die Souveränitäts-Positionierung sichtbar, ohne den Warn-Duktus
  der alten Tier-Banner. Pro Zeile: Freigabe-Toggle,
  Name, Hersteller (aus Modell-ID abgeleitet, sekundär), Typ-Chip, Modell-ID,
  Fähigkeits-Chips, Kontextfenster, **Data-Residency-Flagge + Land**.
- **Psychologie des Datenschutz-Signals**: Sichtbar ist nur die Residency (Eigenschaft,
  keine Warnung). Volle Transparenz per Info-Dialog je Modell: Hersteller, RZ-Land,
  Betreiber + Firmensitz, ruhige Schutzniveau-Einordnung (Texte ohne Warn-Duktus,
  `dataProtectionSummaries`) und der Hinweis, dass AV/Prüfung/Subdienstleister zentral
  über Adacor laufen. Die Tier-Berechnung bleibt intern erhalten, ist aber kein
  visuelles Ordnungsprinzip mehr.
- **Management-Rahmen**: Eine ruhige Zeile unter dem Header („Alle Modelle werden über
  die Adacor-Plattform bereitgestellt…") ersetzt die vier Tier-Banner.
- **Freigabe je Modell** (`model.enabled`, Default aktiv): Der Admin sperrt/gibt Modelle
  frei — gesperrte Modelle verschwinden aus allen Auswahllisten (System-Standards,
  User-Präferenzen via `getModelsForPurpose`) und sind serverseitig nicht mehr als
  Default wählbar. Guards: Der aktuelle System-Standard eines Zwecks kann nicht gesperrt
  werden (Fehlermeldung), gesperrte Modelle können nicht als Standard gesetzt werden.
  **ENV-Pins (`ACTIVE_*`) umgehen die Sperre bewusst** — Ops-Entscheidung schlägt
  Katalog-Sperre. Agent-gebundene Modelle (locked model) sind ebenfalls nicht betroffen.
- **Technik nach hinten**: Provider-Verwaltung (CRUD, Base-URLs, Key-Variablen, Tests,
  „Neuer Provider") lebt in der eingeklappten Sektion „Technische Konfiguration
  (Provider)" — flache Liste ohne Tier-Gruppierung, Karten-UI unverändert.
- **Datenmodell**: `ModelConfig.enabled?: boolean` und
  `ModelConfig.datacenter_country?: string` (Residency-Override je Modell — ein Provider
  kann aus mehreren Regionen servieren; ohne Override gilt das Provider-Land). Beides im
  Modell-Modal pflegbar, ebenso jetzt `context_length`.
- **Nebenbefund behoben**: `updateModel` verlor bisher nicht explizit kopierte Felder
  (`protected`, `supported_aspects`, …) — jetzt Spread-Erhalt aller Felder.
- Geteilte Meta-Daten (Länder, Regionen, Tier-Berechnung, Typ-Farben) aus der Seite in
  `frontend/src/utils/providerMeta.js` ausgelagert; Katalog als eigene Komponente
  `frontend/src/components/ModelCatalog.jsx`.

## Änderungen

- `backend/src/types/providers.ts`: ModelConfig + `enabled`, `datacenter_country`.
- `backend/src/services/providers.ts`: updateModel (Spread-Erhalt, Sperr-Guard),
  setActiveModel/resolveActiveModel/getSystemDefaultModel (enabled-Checks; ENV-Pin ohne).
- `frontend/src/utils/providerMeta.js` (neu), `frontend/src/components/ModelCatalog.jsx`
  (neu), `frontend/src/pages/ProvidersPage.jsx` (Umbau), `frontend/src/hooks/useProviders.js`
  (Freigabe-Filter).

## Verifikation

- Service-Smoke-Test: Sperren des aktiven Chat-Standards wird abgelehnt; gesperrtes
  Modell nicht als Standard wählbar; Sperren/Freigeben persistiert ohne Feldverlust.
- ESLint (nur bekannte Alt-Fehler), `tsc --noEmit` ohne neue Fehler, Vite-Build grün.

## Offen / Ideen

- Optionaler Richtlinien-Schalter „Nur EU/EWR-Modelle zulassen" (Bulk-Sperre) — bewusst
  zurückgestellt, bis der Bedarf da ist.
- Residency-Daten je Modell pflegen (z.B. Lyceum: ES/FR/Nordics) — Feld existiert jetzt.
