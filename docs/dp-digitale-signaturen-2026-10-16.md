# DP: Elektronische PDF-Signaturen auslesen (Stufe 2)

Stand: 2026-10-16 · umgesetzt, nicht gepusht

## Kontext

Bisher fand DP Signaturfelder per Byte-Suche (`/Type /Sig` mit Inhalt) und schrieb nur
`{{digitale signatur: im PDF elektronisch signiert am …}}` an die letzte Unterschriftsseite. Welcher Partei die
Signatur gehört, riet das Modell aus Ort und Datum. Unbekannt blieben: wer signiert hat, welche Art Signatur es ist
und ob die Datei nach der Signatur noch verändert wurde.

Anlass aus dem eigenen Korpus: Vertrag **V5** ist elektronisch signiert, die Signatur deckt aber nur 386 KB der
1,04 MB großen Datei. Nach der Signatur wurde auf Seite 1 der Vermerk „Anlage 2" eingefügt. Bei V5 hatte das Modell
außerdem eine Unterschrift dem leeren Kundenfeld zugeschlagen. Eine falsch bestätigte Unterschrift ist der teuerste
Fehler der Vertragsauswertung, und die digitale Signatur ist das härteste Signal dafür.

Strategische Einordnung (Gespräch 2026-10-16): Signaturen in drei Stufen. Stufe 1 Erkennen (gab es), **Stufe 2
Auslesen und Deckung (dieses Dokument)**, Stufe 3 rechtliche Validierung (Zertifikatskette, EU-Vertrauensliste,
Sperrstatus) nur auf Kundenwunsch und dann über die EU-Bibliothek DSS als eigenen Dienst, nicht selbst gebaut.

## Entscheidungen

1. **`pdfsig` (poppler) statt neuer Bibliothek.** poppler-utils ist schon Plattform-Abhängigkeit (Aptfile,
   `pdftocairo`/`pdftotext`). Keine neue npm-Dependency.
2. **Immer `-nocert -no-ocsp`.** Keine Zertifikatsprüfung und kein Online-OCSP-Abruf aus der Extraktion (Netzzugriff
   nach außen, langsam). Die Ausgabe „Signature is Valid" bedeutet dann nur: Die Signatur passt kryptografisch zu den
   signierten Bytes (`integritaet`). Über das Zertifikat sagt sie nichts.
3. **„Qualifiziert" nur als Hinweis.** Byte-Suche nach der ETSI-OID QcCompliance im PKCS#7 (`pdfsig -dump`), ohne
   ASN.1-Parser und ohne openssl. Die Oberfläche sagt „Zertifikat als qualifiziert gekennzeichnet", nicht
   „qualifiziert signiert".
4. **Technische Kennungen sind kein Name.** Viele Firmenzertifikate (V5: Microsoft-Entra-Gerätezertifikat) tragen im
   CN eine GUID oder Gerätekennung. Die wird nicht als Unterzeichner ausgegeben, sondern als
   `unterzeichner_technisch`.
5. **Deckung über die signierte Fassung.** Signaturen sind inkrementelle Updates: Die Fassung zum Zeitpunkt der
   Signatur ist das Dateipräfix bis zum Ende der signierten Bytes. Vergleich mit der nächsten Fassung:
   - Seitenzahl und Text je Seite (`pdfinfo`, `pdftotext`).
   - **Nur nach der letzten Signatur** zusätzlich das Seitenbild (`pdftoppm -gray -r 40`, PGM-Rohpixel). Zwischen
     zwei Signaturen bleibt das Bild ungewertet, weil das Erscheinungsbild der zweiten Signatur die Seite
     zwangsläufig verändert.
   - Ergebnis `vollstaendig`, `spaetere_signatur` (Normalfall nacheinander signierender Parteien),
     `nachtrag_ohne_aenderung` (z. B. angehängte Validierungsdaten), `geaendert`, `unbekannt`.
6. **Befunde erzwingen „Zu prüfen".** `nach_signatur_geaendert` und `signatur_beschaedigt` laufen als `error` in die
   Review-Triage, anders als die übrigen Vertragsbefunde (`warn`). Eine Änderung nach der Signatur ist ein harter
   Befund. Beim Basisprofil „Allgemein" laufen sie als Verarbeitungshinweis.
7. **Rückfall statt Ausfall.** Ohne `/ByteRange` startet kein Prozess. Fehlt `pdfsig` oder scheitert es, greift der
   alte Byte-Scan (nur Zeitpunkt, Deckung `unbekannt`).

## Änderungen

| Datei | Änderung |
|---|---|
| `backend/src/services/extraction/contract/signatur.ts` | `pdfsig` auslesen und parsen, Signaturmodell `PdfSignatur`, technische Kennung, QC-Hinweis, Marker mit Namen, Befundtexte; Byte-Scan als Rückfall |
| `backend/src/services/extraction/contract/signatur-deckung.ts` | neu: signierte Fassung rekonstruieren, Text-/Seiten-/Bildvergleich, Wortbeispiel, `leseSignaturen` |
| `contract/lesen.ts` | Signaturen parallel zur Transkription, `signaturen` im Leseergebnis und im Volltext |
| `contract/konsolidierung.ts`, `contract/types.ts` | `vertrag.signaturen`, Befundtypen `nach_signatur_geaendert`, `signatur_beschaedigt` |
| `contract/auswertung.ts` | Prompt: benannte Signatur → Partei, für die die Person im Unterschriftsbereich zeichnet |
| `strategies/contract-structured.ts`, `strategies/general-document.ts` | Signaturen durchreichen, Befunde bei „Allgemein" als Verarbeitungshinweis |
| `extraction/learning/service.ts` | Signatur-Befunde als `error` (Zu prüfen) |
| `frontend/src/components/VertragPane.jsx` | Signaturzeilen in der Karte „Unterschriften", Befund-Labels |
| `scripts/vertrag-pilot/messung.ts` | nutzt `leseSignaturen` |
| `docs/dp-api-vertrag-schema-2026-10-12.md` | `PdfSignatur`, neue Befundtypen |

Tests: `signatur.test.ts` (Parser, Kennungen, Marker, Befunde), `signatur-deckung.test.ts` (Wortdifferenz,
Bildvergleich und **Integration mit zur Laufzeit synthetisch signierten PDFs**: selbstsigniertes Testzertifikat in
einer Temp-NSS-Datenbank, einmal und zweimal signiert, nach der Signatur Text bzw. nur Grafik ergänzt;
übersprungen ohne `pdfsig`/`certutil`), `konsolidierung.test.ts`. Keine Kundendaten im Repo.

## Messergebnisse

Lokal (poppler 24.04, M-Serie):

| Datei | Ergebnis | Dauer |
|---|---|---|
| ohne Signatur | keine Signatur, kein Prozessstart | ~1 ms |
| synthetisch, einmal signiert | `vollstaendig`, Name aus Zertifikat, `intakt` | ~30 ms |
| synthetisch, zweimal signiert | `spaetere_signatur` + `vollstaendig` | ~120 ms |
| V5 (8 Seiten) | `geaendert`, Seite 1, hinzugekommen „Anlage 2", Unterzeichner technische Kennung | ~150–270 ms |

Vertragsmessung V5 mit Modell (`scripts/vertrag-pilot/messung.ts --vertraege V5`, Qwen 3.5 35B, Transkription neu):
**14/14 Erwartungswerte richtig** (Unterschriften 2/2, Befunde 3/3). Neuer Befund: „Nach der elektronischen Signatur
vom 25.07.2024 15:18 wurde das Dokument verändert (Seite 1; hinzugekommen „Anlage 2"). Maßgeblich ist die signierte
Fassung." Die übrigen Unterschriftsbefunde sind unverändert (fehlende Kundenunterschrift weiterhin erkannt).

DP-Qualitätssuite, Set `vertraege` (10 Fälle, Lauf `2026-10-16-15-43-10_647d7000+lokal`): **bestanden**, alle Metriken
gleich der Baseline (Vertrag 99,5 %, Katalog/Unterschriften/Status/Befunde 100 %, Inventar 97,7 %), „sicher aber
falsch" 0.

## Offen / Ausblick

- **Scalingo:** Alle Workplace-Instanzen laufen auf `scalingo-24` (Ubuntu 24.04, poppler 24.02) oder `scalingo-26`
  (Ubuntu 26.04), geprüft 2026-10-16 mit `scalingo apps-info`. Das entspricht der lokal getesteten Version (24.04) oder
  ist neuer. Eine Aktualisierung ist nicht nötig. Nach dem ersten Deploy trotzdem einmal eine signierte PDF durchlaufen
  lassen.
- **Position der Signatur:** Der Marker hängt weiter an der letzten Unterschriftsseite. Die Seite des Signaturfelds
  liefert `pdfsig` nicht.
- **Stufe 3 (Validierung)** nur auf Kundenwunsch, über EU-DSS als eigenen Dienst. Dann Prüfbericht anhängen statt
  selbst „gültig" zu urteilen.
- **Abschlussseiten von Signaturdiensten** (DocuSign „Certificate of Completion" u. Ä.) als eigene Seitenrolle
  erkennen, nicht als Vertragsinhalt. Noch nicht umgesetzt.
