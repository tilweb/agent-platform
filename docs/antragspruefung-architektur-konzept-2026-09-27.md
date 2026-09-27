# Konzept: Weitere Antragsprüfungen (Grundsicherung im Alter) analog zu Wohngeld

## Kontext

Nach Wohngeld sollen weitere Antragsprüfungen folgen, zuerst „Grundsicherung im Alter und bei
Erwerbsminderung" (SGB XII, 4. Kapitel). Struktur, UX und UI sollen über alle Antragsarten gleich
bleiben. Zur Wahl stehen zwei Wege: (A) eine generische, konfigurierbare Antrags-App oder
(B) je Antragsart eine eigene App, die mit Agentic Coding analog nachgebaut und gepflegt wird.

Stand Wohngeld: rund 13.000 Zeilen Backend (`backend/src/apps/wohngeld/`), 7.900 Zeilen Frontend
(`frontend/src/apps/wohngeld/`), eigenes DB-Schema, 200+ Tests. Die Plattform-Bausteine
(DP-Profil, Extraction-Pipeline, LLM, Token-Messung, documentGenerator) sind bereits geteilt.

## Einschätzung

Die Richtung stimmt: **keine Konfigurationsebene für die Fachlichkeit.** Die Begründung dafür
ist allerdings eine andere als „Kopieren kostet nichts mehr".

**Warum eine Konfigurationsebene falsch wäre:**
Das Fachrecht unterscheidet sich im Kern und nicht nur in Parametern. Wohngeld prüft ohne zu
rechnen (§ 13 WoGG Einkommen, Haushaltsmitglieder). Die Grundsicherung ist dagegen eine
Bedarfsprüfung: Regelbedarfsstufe, Mehrbedarfe § 30, Angemessenheit der Unterkunftskosten nach
kommunalen Richtwerten, Einkommen § 82 ff., Schonvermögen § 90, Unterhaltsrückgriff nur über
100.000 € (§ 94 Abs. 1a), Nachweis der Altersgrenze oder dauerhaften Erwerbsminderung
(Ersuchen an die Rentenversicherung, § 45). Eine Konfiguration, die das abbildet, wird eine
eigene Regelsprache. Die ist schlechter testbar als Code und für Agenten schwerer zu bearbeiten
(Indirektion, Meta-Ebene, jede Änderung trifft alle Anträge).

**Was Agentic Coding billig gemacht hat, und was nicht:**
- Billig geworden: Code schreiben, nachbauen, eine Änderung in eine zweite App übertragen.
- Nicht billig geworden:
  1. **Wissen, dass es nachgezogen werden muss.** Driftet ein Fix nicht nach, fällt das niemandem auf.
  2. **Verifikation und Review.** Doppelter Code heißt doppelte Tests und doppelte Abnahme.
  3. **Compliance.** Audit, Löschkonzept, Art. 15/18, KI-Transparenz sind prüfrelevant. Dass
     Pflichten in einer App fehlen, weil sie nur in der anderen nachgezogen wurden, ist ein
     reales Risiko.
  4. **Kontext für Agenten.** Zwei fast gleiche 13k-Zeilen-Apps verdoppeln Suchtreffer, und
     Agenten landen in der falschen Kopie.

**Folgerung:** Die Gemeinsamkeit gehört nicht in Konfiguration, sondern in zwei andere Ebenen:
(1) einen kleinen geteilten **Kern als Bibliothek** für das, was identisch sein *muss*, und
(2) ein **schriftliches Muster plus Konformitätstests**, damit Agenten jede Antrags-App gleich
bauen. Im Agentic-Coding-Zeitalter ist das die eigentliche „Konfigurationsebene": Spezifikation
und Tests statt Laufzeit-Konfiguration.

## Empfohlene Struktur (drei Schichten)

| Schicht | Inhalt | Form |
|---|---|---|
| **Plattform** (besteht) | DP-Profile, Extraction, LLM, Token-Messung, documentGenerator | unverändert |
| **Antrags-Kern** (neu, klein) | Mechanik ohne Fachwissen: Audit-Log + Protokoll, Aufbewahrung/Legal-Hold/Art. 18, Auskunft-Export-Gerüst, KI-Verbrauch, Posteingang-Queue (Zustandsmaschine, Split, Fortschritt, Filestore, aufrufbare Einlieferung je App), Feldstatus-Mechanik (✓/✗), Notizen, Fristen/Wiedervorlage, Optimistic Locking; UI-Bausteine (PanelSection, SektionCard, FeldStatusMark, NotizPanel, SeitenVorschau, AuswertungsFortschritt, PruefschrittItem, ExtraktionsBaum, KiVerbrauch) | **Bibliothek**: Die Apps rufen Funktionen auf und rendern Komponenten. Keine Registry, kein konfigurationsgetriebenes Rendering. |
| **Fach-App je Antragsart** | Typen/Datenmodell, Prüfregeln (`checker/`), Einkommen/Bedarf, Extraktionsschemas + DP-Vorlage, Rechts-Korpus, Schreiben-/Bescheidtexte, Vorgangsseite mit Reitern, PersonCard, Demo-Seed | **eigener Code**, eigenes DB-Schema, eigene Tests. Wird mit Wohngeld als Vorlage angelegt und darf fachlich frei abweichen. |

Grenzregel: In den Kern kommt nur, was (a) keine Fachbegriffe enthält und (b) aus Compliance-
oder Infrastrukturgründen überall gleich sein muss. Im Zweifel bleibt es in der App.
Bewusst **nicht** vorab generalisiert werden Checker-Engine, Einkommensberechnung,
Vorgangsseiten-Layout und Fall-Chat-Prompts. Das folgt der Dreierregel: erst beim dritten
Antrag verallgemeinern, wenn die Gemeinsamkeit belegt ist.

## Konsistenz über Muster statt Konfiguration

1. **Muster-Dokument** `docs/antragspruefung-muster.md` (später auch als `CLAUDE.md` im
   Apps-Ordner). Es legt fest:
   - Aufbau der Vorgangsseite: drei Spalten, Standard-Reiter, rechte Seitenleiste
     (Details / Prüfschritte / Dokumente)
   - Bedeutung der Prüfschritte: Vollständigkeit/Plausibilität, Anforderung/Info,
     offen/erledigt/verworfen
   - Posteingang-Ablauf
   - Governance-Pflichten: jede Schreib-Route auditiert, jede LLM-Aktion in `messeKiVerbrauch`,
     Review-Gate
   - Namens- und Ordnerkonventionen

   Das ist die Spezifikation, nach der Agenten jede neue Antrags-App bauen.
2. **Konformitätstests** je App, die das Muster maschinell prüfen: Jede Route mit Schreibzugriff
   ruft `audit` auf, jeder LLM-Aufruf läuft über den Messbereich, jede Prüfregel hat eine
   Beschreibung (analog `regeln.test.ts`).
3. **Änderungsdisziplin:** Eine UX-Änderung an einer App wird im Changelog als „Muster-Änderung"
   markiert. Dann entscheidet man bewusst, ob sie in den Kern gehört oder in alle Apps
   nachgezogen wird. Das kann auch als Agent-Auftrag laufen: „Muster-Änderung X in alle
   Antrags-Apps übertragen".

## Entscheidungen zu Scope und Posteingang (2026-09-27)

1. **Kernmehrwert beider Apps bleibt die Prüfung und das Management von Vollständigkeit und
   Plausibilität der Unterlagen.** Die Leistungsberechnung findet im Fachverfahren statt; die
   Apps rechnen keinen Zahlbetrag.
2. **Getrennter Posteingang je App.** Das passt zu zwei Stellen mit eigenen Zuständigkeiten und
   Rechten. Die Posteingang-Warteschlange liegt aber im Kern, und jede App bietet von Anfang an
   eine **programmatisch aufrufbare Einlieferung** (`einliefern(dateien, meta)`). Ein gemeinsamer
   Eingang ist später nur eine vorgeschaltete Weiterleitung an diese Funktion, kein Umbau.
   Ein Feld „Antragsart" in der Tabelle brächte wenig, weil jede App ohnehin ihre eigene Tabelle
   hat (präzisiert in `docs/antrag-kern-spec-2026-09-27.md`).
3. **Vorrang-Einschätzung Wohngeld ODER Grundsicherung erst mit einer Pilotkommune**, zusammen
   mit Übergabe und Abgleich mit dem jeweils anderen Fachverfahren. Die Einschätzung ist immer
   nur ein Hinweis für die Sachbearbeitung, keine Entscheidung.

## Vorrang-Einschätzung Wohngeld ↔ Grundsicherung

**Problem:** Beide Leistungen decken Wohnkosten und schließen sich gegenseitig aus (§ 7 WoGG).
In vielen Verwaltungen prüfen zwei getrennte Stellen mit weitgehend identischen Unterlagen.
Fälle werden hin- und hergereicht, Antragsteller verlieren Zeit und Ansprüche.

**Ziel (Pilot):** Aus den Unterlagen überschlägig Bedarf und Einkommen ermitteln und eine
Ersteinschätzung geben, die der Kommune den doppelten Durchlauf erspart.

**Fachliche Schärfung:**
- Der Vergleich lautet nicht „Einkommen gegen Bedarf", sondern *Einkommen plus voraussichtliches
  Wohngeld* gegen den *Grundsicherungsbedarf*. Nach § 7 Abs. 1 Satz 3 WoGG entfällt der Ausschluss,
  wenn Wohngeld die Hilfebedürftigkeit vermeidet; Grundsicherung ist nachrangig (§ 2 SGB XII).
  Die Einschätzung braucht damit auch eine **überschlägige Wohngeldberechnung (§ 19 WoGG)**,
  die in der Wohngeld-App bisher bewusst ausgeschlossen ist.
- Mindestens vier Ergebnisse mit Unsicherheitsband statt zwei:
  „Grundsicherung wahrscheinlich – Wohngeld ausgeschlossen" · „Wohngeld vorrangig" ·
  „Grenzfall – beide prüfen" · „voraussichtlich keins von beiden".

**Was schon vor dem Pilot gebaut wird (ohne Berechnung):**
- **Grunddaten-Vertrag:** Jede App liefert über eine Funktion „Grunddaten für die
  Vorrangprüfung" dieselbe Datenform: Haushalt, Einkommen nach Art, Wohnkosten aufgeteilt
  (Kaltmiete, Nebenkosten, Heizung), Vermögen, Alter bzw. Erwerbsminderung. Kein gemeinsames
  Fachmodell im Kern, sondern ein Vertrag mit einem Test je App. Die spätere Einschätzung ist
  dann eine Rechnung über vorhandene Daten, keine neue Auswertung der Unterlagen.
- **Qualitative Vorrang-Hinweise** als Prüfschritte vom Typ Info (feste Regeln, keine Rechnung),
  z. B. „Grundsicherungsbescheid liegt bei → Wohngeld ausgeschlossen" oder „Regelaltersgrenze
  erreicht, geringe Rente als einziges Einkommen, Vermögen unter Schonbetrag → Grundsicherung
  mitprüfen". In der Wohngeld-App gibt es mit der Ausschluss-Logik nach § 7 bereits einen
  Ansatzpunkt.
- **Hinweis zum Antragsdatum bei Weiterleitung** (§ 16 Abs. 2 SGB I): Ein Antrag bei der
  unzuständigen Stelle wahrt das Antragsdatum, wenn er weitergeleitet wird. Mit dokumentiertem
  Eingangsdatum.

**Später (Pilot):** Die Einschätzung als eigenes, deterministisches Modul, das nur am
Grunddaten-Vertrag hängt und von beiden Apps genutzt wird.

## Risiken, früh zu klären

- **KI-Verordnung (AI Act):** Anhang III Nr. 5a nennt Systeme, mit denen Behörden die
  Berechtigung für Sozialleistungen bewerten, als Hochrisiko. Die Ausnahme für vorbereitende
  Tätigkeiten (Art. 6 Abs. 3) entfällt bei Profiling, und eine Einschätzung der wirtschaftlichen
  Lage kann darunter fallen. **Design-Konsequenz: Die Einschätzung ist deterministischer Code,
  nicht das Sprachmodell.** Das LLM liest nur Unterlagen aus. Das ist das stärkste Argument, dass
  die Einschätzung kein KI-System im Sinne der Verordnung ist. Keine Rechtsberatung: vor dem Pilot
  mit DSB bzw. Rechtsabteilung prüfen und als Nachtrag zur bestehenden AI-Act-Bewertung
  dokumentieren.
- **Sozialdatenschutz bei der Übergabe:** Einen Fall mit Unterlagen an die andere Stelle zu
  übergeben, ist eine Übermittlung von Sozialdaten. Innerhalb einer Kommune in der Regel über
  § 69 SGB X gedeckt, muss aber im Verzeichnis der Verarbeitungstätigkeiten und im Rollenmodell
  abgebildet werden. Gehört in den Pilot.

## Vorgehen

1. **Kern aus Wohngeld herauslösen, bevor kopiert wird**, einschließlich der Posteingang-
   Warteschlange mit aufrufbarer Einlieferung (Spec: `docs/antrag-kern-spec-2026-09-27.md`). Wer erst kopiert und später herauslöst, hat schon
   Drift. Ziel: `backend/src/apps/_antrag-kern/` bzw. `frontend/src/apps/_antrag-kern/`.
   Wohngeld nutzt den Kern danach; die Tests belegen, dass sich nichts ändert.
2. **Muster-Dokument schreiben**, abgeleitet aus dem realen Wohngeld-Stand.
3. **Grundsicherungs-App** mit Vollständigkeits- und Plausibilitätsprüfung bauen: zuerst
   Fach-Recherche und Regelkatalog (wie bei Wohngeld), dann Datenmodell, Checker, UI nach Muster.
   Dabei den **Grunddaten-Vertrag in beiden Apps** anlegen.
4. **Qualitative Vorrang-Hinweise und Hinweis zum Antragsdatum** in beiden Apps einbauen.
5. **Pilotkommune:** Einschätzung als deterministisches Modul, Übergabe zwischen den Stellen,
   Abgleich mit den Fachverfahren, AI-Act- und Datenschutz-Nachtrag.
6. **Nach der Grundsicherung** prüfen, was sich tatsächlich doppelt, und erst dann entscheiden,
   ob mehr in den Kern wandert.

## Noch offen

- **Governance-Dokumente** (DSFA, VVT, TOM) je Antragsart oder als gemeinsamer Rahmen mit
  fachlichen Anhängen?

## Verifikation (bei Umsetzung)

- Kern-Extraktion: alle Wohngeld-Tests bleiben grün, Build ok, Klick-Smoke der Vorgangsseite
  und des Posteingangs unverändert.
- Grundsicherung: Goldfälle als Abnahmetest der Regel-Engine (wie beim Wohngeld-Goldfall),
  Konformitätstests grün.
- Grunddaten-Vertrag: Test je App, dass die Grunddaten aus einem Goldfall vollständig und in
  der vereinbarten Form geliefert werden.
