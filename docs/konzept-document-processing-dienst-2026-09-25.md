# Konzept: Document Processing als eigenständiger, skalierbarer Dienst (2026-09-25)

Status: Diskussionsgrundlage für das Produktteam. Ergänzt die Übergabe
`docs/document-processing-uebergabe-simon-2026-09-04.md` (dort: Einbau ins Produkt-Workplace, §7
„Integrationsnähte") um die Variante „eigener Dienst, per API von allen Workplaces genutzt".

---

## 1. Anlass

- Document Processing (DP) hat ein anderes Lastprofil als der übrige Workplace: kurze, starke Spitzen bei Speicher
  und Rechenzeit (PDF-Rendering mit poppler, Bildmodell-Aufrufe), lange Laufzeiten (80–150 s je Sammel-PDF mit 20–40
  Seiten) und Batch-Läufe mit vielen Dokumenten.
- Auf workplace-demo (Container M, 512 MB) führte das zu wiederholten Abstürzen „memory quota exceeded", darunter
  mitten in einer Auswertung (Analyse: `docs/wohngeld-speicher-analyse-2026-09-25.md`). Gemessen: ~130 MB Zuwachs je
  Auswertung im Prozess, auf der Instanz Spitzen um 513 MiB inkl. Render-Prozessen.
- Den ganzen Workplace-Container für Batch-Verarbeitung hochzuskalieren ist unwirtschaftlich (der Rest der Anwendung
  skaliert mit, ohne Last zu haben) und riskant (Batch-Spitzen bremsen die Antwortzeiten aller Nutzer).

## 2. Empfehlung in Kürze

1. **DP als eigenen Dienst betreiben** — gleicher Code, eigene App, eigene Skalierung: schlanker Web-Teil nimmt
   Aufträge an, **Worker-Container** holen Jobs aus einer Postgres-Warteschlange und werden unabhängig skaliert.
2. **Ein Codestand, zwei Betriebsformen:** zentral geteilt (für Kunden, bei denen das vertraglich und
   datenschutzrechtlich passt) **oder** dediziert je Kunde (z. B. Kommunen mit Sozialdaten). Die Mandantentrennung wird
   so gebaut, dass beides mit demselben Artefakt geht.
3. **Schrittweise:** zuerst innerhalb des heutigen Repos als eigener Prozesstyp trennen (wenig Aufwand, sofortiger
   Nutzen), dann eigene App mit versioniertem API-Vertrag, erst danach zentrale Bereitstellung für mehrere Workplaces.
4. **Entscheidung gemeinsam mit dem Produktteam**, sonst entstehen zwei Architekturen (Produkt baut DP ein, Experiment
   lagert DP aus).

## 3. Ausgangslage: Was heute schon da ist

DP ist im Code bereits weitgehend abgegrenzt. Das meiste, was ein eigener Dienst braucht, existiert:

| Baustein | Stand heute | Bedeutung für den Dienst |
|---|---|---|
| Engine `services/extraction/` | generisch (Strategien, PDF, OCR, Konfidenz, Laufzeit-Warteschlangen) | wandert unverändert mit |
| Lern-/Orchestrierungsschicht `extraction/` | Projekte, Beispiele, Snapshot, Eval, Batch, Segmentierung, Posteingang | wandert mit |
| Datenhaltung | eigenes Postgres-Schema `extraction` (projects, examples, batch_runs, batch_run_files, inbox_*, evaluations, jobs, model_slots) | wird die Datenbank des Dienstes |
| Job-Warteschlange | `jobs` mit `FOR UPDATE SKIP LOCKED`, Lease 90 s, Heartbeat, Fencing aller Schreibvorgänge, Wiederaufnahme | trägt mehrere Worker-Container schon heute |
| Modell-Slots | `model_slots` (Lease-Tabelle) — begrenzt gleichzeitige Modellaufrufe **über alle Container** | aktiv nur mit `SCALINGO_POSTGRES`; im Dienst immer aktiv |
| Prioritäten | interaktiv < Batch < Evaluation, mit Aging (`runtime.ts`) | Grundlage für Fairness zwischen Aufträgen |
| Öffentliche API | `/api/public/v1`, API-Schlüssel (gehasht), Scopes, Audit, OpenAPI; DP als virtuelle App `extraktion` (`extract`, `batch.create/get/export`) | Keim des API-Vertrags |
| Webhooks | HMAC-SHA256 signiert, Wiederholung mit Backoff, SSRF-Schutz | Rückmeldung an die Workplaces |
| Fortschritt | Kanal `extraction/fortschritt.ts` (Seiten, Abschnitte, Auslesen) | wird Job-Status für die Clients |

Gleichzeitig ist DP an vier Stellen mit dem Workplace verzahnt (Details §6): LLM-Anbieter/Modellregistry,
Nutzungsprotokoll/KI-Governance, Tabellen-Feature (Wertelisten `source:'table'`, Export „in Tabelle") und die
Oberfläche (`ExtractionProjectsPage.jsx`, ~5.000 Zeilen). Dazu kommen Auth (Cookie-Session) und in-memory
Rate-Limits je Prozess.

## 4. Zielbild

```mermaid
flowchart LR
  subgraph WP[Workplace-Instanzen]
    W1[Workplace A]:::wp
    W2[Workplace B]:::wp
    W3[Wohngeld-App]:::wp
  end
  subgraph DP[DP-Dienst]
    API[Web / API\nAufträge annehmen, Status, Ergebnisse]
    Q[(Postgres\nJobs · Profile-Snapshots · Ergebnisse · Modell-Slots)]
    WK[Worker 1..n\nRendern · OCR · Modellaufrufe]
    S3[(Objektspeicher\nOriginale · Seitenbilder, befristet)]
  end
  LLM[Modell-Endpunkt\nz. B. Adacor Qwen]
  W1 & W2 & W3 -- API-Schlüssel je Mandant --> API
  API --> Q
  WK -- Job holen / Lease --> Q
  WK --> S3
  WK -- gedrosselt über Modell-Slots --> LLM
  API -- Webhook signiert --> W1 & W2 & W3
```

- **Web/API** (klein, 1–2 Container): Authentifizierung per Mandanten-Schlüssel, Annahme von Aufträgen,
  Upload-Freigaben, Status, Ergebnisse, Webhooks.
- **Worker** (skaliert, Größe L oder XL): holen Jobs, rendern Seiten, rufen Modelle, schreiben Ergebnisse.
  Keine Lastverteilung nötig — Worker ziehen sich die Arbeit selbst aus der Warteschlange.
- **Scalingo:** Prozesstypen `web` und `worker` in einer App (Procfile), `worker` separat skalierbar
  (`scalingo scale worker:N:L`). Scalingo verteilt Anfragen automatisch auf mehrere `web`-Container.
- **Engpass ist das Modell, nicht der Container:** Mehr Worker helfen nur bis zur Kapazität des Modell-Endpunkts.
  Die Modell-Slots begrenzen deshalb zentral die gleichzeitigen Aufrufe je Modell; Worker ohne freien Slot warten.

## 5. Schnitt: Was gehört in den Dienst, was bleibt im Workplace?

| Bereich | Im DP-Dienst | Im Workplace |
|---|---|---|
| Erkennung, Segmentierung, Auslesen, Konfidenz, Prüfregeln des Profils | ✔ | — |
| Profile (Felder, Segmente, Regeln), Beispiele, Evaluation | ✔ Ausführung; Snapshots nur befristet im Cache (§8a) | ✔ Quelle der Wahrheit und Pflege-Oberfläche (Variante A, §8) |
| Batch, Posteingang-Trennung | ✔ | Auslösen, Ergebnisse übernehmen |
| Fachliche Weiterverarbeitung (z. B. Wohngeld: Haushalt anlegen, Prüfregeln, Feld-Status) | — | ✔ bleibt in der jeweiligen App |
| Nutzer, Gruppen, App-Rechte | — (nur Mandanten und API-Schlüssel) | ✔ |
| Tabellen, Wertelisten-Quellen | Werte kommen im Snapshot mit (§6) | ✔ Quelle der Wahrheit |
| KI-Governance, Nutzungsnachweis | misst und liefert Nutzung je Job mit | ✔ verbucht und zeigt an |

## 6. Abhängigkeiten auflösen

1. **LLM-Anbieter:** Der Dienst hat eine eigene, schlanke Modellkonfiguration (Endpunkt, Modell, Schlüssel,
   Slots je Modell). Anforderung wie heute: OpenAI-kompatibel mit Vision und strukturierter JSON-Ausgabe.
   Ein Auftrag darf ein Modell nur aus einer freigegebenen Liste wählen.
2. **Nutzungsprotokoll / KI-Governance:** Der Dienst zählt je Job Modellaufrufe, Tokens (soweit verfügbar),
   Modell/Version und Dauer und gibt sie im Ergebnis zurück. Der Workplace verbucht sie in seinem
   Nutzungsprotokoll (heute `usageTracking`) — damit bleibt der Nachweis „welches Modell für welchen Fall" beim
   Workplace, wo auch die Fallzuordnung liegt.
3. **Wertelisten aus Tabellen:** Heute löst DP `source:'table'` zur Laufzeit gegen das Tabellen-Feature auf. Im Dienst
   löst der **Workplace** die Werte auf und schickt sie im Profil-Snapshot mit (der Snapshot-Mechanismus gibt das her).
   „Ergebnis in Tabelle übernehmen" wird eine Workplace-Funktion auf Basis des Ergebnisses.
4. **Auth:** Mandanten-API-Schlüssel mit Scopes (auf `public-api/keys` aufbauen), keine Workplace-Sessions.
   Rate-Limits pro Schlüssel in Postgres statt im Prozessspeicher (sonst gilt jedes Limit je Container).
5. **Oberfläche:** siehe §8.

## 7. API-Vertrag (Entwurf v1)

Asynchron, idempotent, versioniert (`/v1`). Alle Ressourcen tragen die Mandanten-ID aus dem Schlüssel.

| Aufruf | Zweck |
|---|---|
| `POST /v1/uploads` | Upload-Freigabe (vorab signierte URL in den Objektspeicher) für große Dateien; kleine Dateien direkt im Job |
| `POST /v1/snapshots` | Profil-Snapshot hinterlegen (befristet, je Mandant) → `{ hash }`; bereits bekannte Hashes werden nicht erneut übertragen (§8a) |
| `POST /v1/jobs` | Auftrag: `snapshot_hash` (bzw. vollständiger Snapshot), `dateien[]`, `modus` (`interaktiv`/`batch`), `callback_url`, `idempotency_key` → `202 { job_id }`; unbekannter Hash → `409 snapshot_unbekannt` |
| `GET /v1/jobs/{id}` | Status + Fortschritt (Phase, „Seite 7 von 18", Abschnitte), Fehler |
| `GET /v1/jobs/{id}/ergebnis` | Abschnitte mit Seitenbereichen, Werten, Belegen (Seite/Box), Befunden, Nutzung |
| `GET /v1/jobs/{id}/seiten/{n}` | Seitenbild für die Vorschau (befristet verfügbar) |
| `DELETE /v1/jobs/{id}` | Abbrechen bzw. Daten sofort löschen |
| `GET/PUT /v1/profile…`, `POST /v1/profile/{id}/evaluationen` | Profilpflege und Messung (für die Oberfläche) |
| Webhook `job.fertig` / `job.fehler` | signiert (HMAC), at-least-once, Empfänger idempotent |

Regeln: Ergebnisse enthalten nur Werte und Belege, keine Originaldateien. Doppelte `idempotency_key` liefern den
bestehenden Job. Der interaktive Modus bekommt Vorrang vor Batch (bestehende Prioritäten), aber mit Obergrenze je
Mandant, damit ein großer Batch eines Kunden die anderen nicht aushungert.

## 8. Oberfläche

- **Variante A (empfohlen für den Start):** Die DP-Oberfläche bleibt im Workplace und wird Client der API
  (Profile pflegen, Beispiele, Evaluation, Batch-Übersicht). Vorteil: Nutzer, Rechte, Design bleiben, wo sie sind.
- **Variante B:** eigene Admin-Oberfläche im Dienst für eine zentrale Profilpflege über Kunden hinweg (z. B. ein
  „Wohngeld-Eingang"-Profil, das alle Kommunen nutzen). Sinnvoll erst, wenn geteilte Profile wirklich gewünscht sind.

## 8a. Wo liegt das Profil? Was muss der Dienst speichern, was kann im Aufruf mitkommen?

**Was eine Auswertung zur Laufzeit braucht** (heute alles im „Snapshot", `captureSnapshot` + `stableHash`):

| Bestandteil | Größe (Beispiel Wohngeld-Eingang) | enthält Personendaten? |
|---|---|---|
| Profildefinition: Felder, Abschnittstypen mit Beschreibungen, Regeln, Anweisungen, Extraktions-Einstellungen | wenige KB | nein |
| Wertelisten (heute teils aus Workplace-Tabellen) | KB | selten |
| Leitlinien (aus Korrekturen erzeugt) | KB | nein |
| Lernbeispiele für Few-Shot (Dokumenttext + korrigierte Werte, ggf. Embedding) | ~10–50 KB je Beispiel | **ja** (echte Anträge) |
| Visuelle Beispiele (max. 2 Bilder) | 100–500 KB | ggf. ja |
| Testbestand mit Original-PDFs (nur für die Evaluation) | MB je Fall | **ja** |

**Was der Dienst speichern muss** (unabhängig vom Profil): Job-Zustand, Ergebnisse bis zur Abholung, Originale und
Seitenbilder befristet, Modell-Slots, Nutzung und Audit. **Das Profil selbst muss er nicht dauerhaft halten.**

**Drei Varianten:**

| Variante | Profil liegt | Aufruf enthält | Dienst hält | Bewertung |
|---|---|---|---|---|
| **1 Zustandslos** | beim Kunden (Workplace) | den vollständigen Snapshot bei **jedem** Job | nichts | maximale Datensparsamkeit, einfach; aber große Aufrufe (Lernbeispiele bei jedem Dokument) |
| **2 Snapshot-Cache per Hash** *(empfohlen)* | beim Kunden | nur den Hash; ist er dem Dienst unbekannt, einmal den vollständigen Snapshot | Snapshots **befristet** (z. B. 24 h nach letzter Nutzung) im Cache, je Mandant | kleine Aufrufe, Profil bleibt Eigentum des Kunden, keine dauerhafte Speicherung von Lernbeispielen im Dienst |
| **3 Profile im Dienst** | im Dienst | nur die Profil-ID/Version | alles dauerhaft | nötig für zentral gepflegte, geteilte Profile (Oberfläche Variante B) |

Regeln unabhängig von der Variante:
- Der Snapshot ist **unveränderlich** und über seinen Hash eindeutig (existiert heute) — jedes Ergebnis nennt den
  Hash, damit nachvollziehbar bleibt, mit welchem Profilstand ausgewertet wurde.
- **Wertelisten löst der Workplace auf** und schickt die Werte im Snapshot mit (keine Rückgriffe des Dienstes auf
  Workplace-Tabellen).
- **Lernbeispiele** entstehen beim Kunden (z. B. aus Bestätigungen der Sachbearbeitung) und bleiben dort; der Dienst
  sieht sie nur als Teil eines Snapshots. Die Auswahl der passenden Few-Shot-Beispiele (ähnlichste zum Dokument)
  kann nur der Dienst treffen, weil nur er das Dokument kennt — deshalb braucht er den Beispielpool im Snapshot.
- **Evaluation** (Testbestand mit Originalen) läuft als eigener Job: Der Workplace schickt Testfälle und Snapshot,
  der Dienst misst, gibt das Ergebnis zurück und **löscht die Originale danach**. Kein dauerhafter Testbestand im
  Dienst.
- **Leitlinien erzeugen/„trainieren"** ist ein Dienst-Aufruf, dessen Ergebnis der Workplace im Profil speichert.
- Heute gefundener Fehler zur Größe: Die Auswertung lud den Testbestand mit Originalen mit (410 MB) — im Dienst
  wird der Snapshot für Auswertungen daher grundsätzlich **ohne** Testbestand und Originale gebildet.

## 9. Mandanten- und Datenschutzmodell

DP verarbeitet je nach Kunde Sozialdaten (Wohngeld), Personaldaten (Bewerbungen), Vertragsdaten. Deshalb:

| Frage | Festlegung |
|---|---|
| Trennung | Mandanten-ID an **jeder** Tabelle und jedem Objektschlüssel; Zugriff nur über den Mandanten-Schlüssel; Profile, Beispiele, Evaluationen je Mandant |
| Originale | nur so lange wie nötig: Objektspeicher mit Löschfrist (z. B. 7 Tage nach Job-Ende, konfigurierbar je Mandant), sofort löschbar per API; **keine** Originale in Job-Ergebnissen |
| Test- und Lernbeispiele | bleiben beim Mandanten; Originale in Testbeständen nur mit Freigabe (heute: base64 in `examples.dataset`, siehe Speicherbefund) |
| Protokoll | Audit je Mandant (wer, welcher Job, welches Profil, welches Modell) |
| Betriebsform | **A zentral geteilt** (eine App, viele Mandanten) — wirtschaftlich; **B dediziert** (eine App je Kunde, gleicher Code) — für Kunden mit Sozialdaten/Datenresidenz-Anforderungen; **C hybrid** |
| Verträge | Auftragsverarbeitung mit jedem Kunden für den Dienst; Ergänzung der DSFA (z. B. Wohngeld: `docs/wohngeld-governance/`); Unterauftragsverarbeiter Modell-Endpunkt und Objektspeicher benennen |

Wichtig: Ein zentraler Dienst ist bei Ausfall ein gemeinsamer Ausfallpunkt für alle angebundenen Workplaces,
darunter kundenproduktive Instanzen. Er braucht eigenes Monitoring (Warteschlangenlänge, Jobdauer, Fehlerquote,
Speicher je Worker), Alarme und eine klare Betriebsverantwortung.

## 10. Skalierung und Kosten (Größenordnungen aus Messungen)

| Größe | Wert | Quelle |
|---|---|---|
| Dauer je Sammel-PDF (20–40 Seiten, digital oder Scan) | 65–150 s | Golden-Dataset-Messung 2026-09-24 |
| Speicher je Auswertung im Prozess | ~130 MB (+ Render-Prozesse) | Speicheranalyse 2026-09-25 |
| Spitze einer Auswertung auf Scalingo | ~513 MiB inkl. Leerlauf und Render-Prozessen | workplace-demo, Container M |
| Modellaufrufe je Sammel-PDF | ~40–60 (1 je Seite Klassifikation + Auslesen je Abschnitt) | Messlog |

Daraus: Ein Worker der Größe L schafft 2 Aufträge gleichzeitig sicher; der Durchsatz eines Batches wird durch die
Modell-Slots bestimmt (heute `EXTRACTION_MODEL_CONCURRENCY` = 4 je Prozess), nicht durch die Worker-Zahl. Vor einer
zentralen Bereitstellung ist mit dem Modellbetreiber zu klären, wie viele parallele Vision-Aufrufe der Endpunkt trägt.

Kleine Optimierungen ohne Qualitätsverlust (Auflösung bleibt bei 150 dpi): Seiten nacheinander statt alle auf
einmal rendern, Seitenbilder nicht doppelt halten, eine Auswertung je Worker-Slot.

## 11. Umsetzung in Stufen

| Stufe | Inhalt | Nutzen | Risiko |
|---|---|---|---|
| **S0** | Entscheidung mit dem Produktteam: DP als Dienst ja/nein, zentral vs. dediziert | eine Architektur statt zwei | — |
| **S1** | Im heutigen Repo: Prozesstyp `worker` (Procfile), `EXTRACTION_WORKER_DISABLED=1` auf `web`; Posteingang-Auswertung und Upload im Vorgang als Jobs statt im Web-Prozess; Modell-Slots immer aktiv | Web bleibt stabil, Worker einzeln skalierbar — ohne neue App | gering |
| **S2** | Eigene Scalingo-App „DP-Dienst" aus demselben Code (eigener Einstiegspunkt ohne Workplace-Routen), API v1 (§7), Wohngeld-App als erster Client über die API statt Direktimport | echte Entkopplung, eigenes Deployment | mittel: Migration der Daten aus dem Schema `extraction` |
| **S3** | Mandantenfähigkeit (§9), Schlüssel je Workplace, Löschfristen, Monitoring; zentrale Bereitstellung für weitere Workplaces | ein Dienst für alle | Datenschutz/Verträge, gemeinsamer Ausfallpunkt |
| **S4** | Oberfläche als API-Client (Variante A) bzw. zentrale Profilpflege (B) | Workplace wird schlanker | Umbau der großen DP-Seite |

S1 lohnt sich unabhängig von der Grundsatzentscheidung und ist die natürliche Vorstufe.

## 12. Offene Entscheidungen

1. Betriebsform: zentral geteilt, dediziert je Kunde oder hybrid — und nach welchem Kriterium je Kunde?
2. Wer betreibt den Dienst (Bereitschaft, Monitoring, Kosten), und wie wird er intern verrechnet?
3. Geteilte Profile über Kunden hinweg (z. B. ein gepflegtes „Wohngeld-Eingang"-Profil für alle Kommunen) — gewünscht?
4. Kapazität des Modell-Endpunkts für parallele Vision-Aufrufe; eigener Endpunkt für Batch?
5. Verhältnis zur Produkt-Übergabe: übernimmt das Produkt DP als Dienst (dann entfallen Teile der §7-Nähte der
   Übergabe) oder als eingebautes Modul?
6. Profilhaltung: Snapshot-Cache per Hash (Profil beim Kunden) oder zentral gepflegte Profile im Dienst (§8a)?

## 13. Nächste Schritte

1. Gespräch mit dem Produktteam auf Basis dieses Papiers (S0).
2. Bei „ja": S1 im Experiment-Repo umsetzen und auf workplace-demo messen (Worker getrennt, Web-Speicher im Leerlauf).
3. API v1 (§7) als OpenAPI-Entwurf ausarbeiten und mit der Wohngeld-App als erstem Client prototypisch anbinden.
4. Unabhängig davon: Lizenz von jina-ocr-v1 klären und OCR-Pilot gegen das Golden Dataset (§14).

## 14. Erweiterung: Texterkennung mit einem OCR-Sprachmodell (z. B. jina-ocr-v1)

**Heute:** Digitale PDFs liefern ihren Text über `pdftotext`; für Scans gibt es keinen brauchbaren Text, deshalb
arbeitet die Erkennung dort seitenweise mit dem großen Bildmodell (Qwen 3.5 Vision). Tesseract liefert Wortpositionen
für die Belege (Box je Wert).

**jina-ocr-v1** (Hugging Face, Stand 2026-09): End-to-end-Dokumentleser auf Basis DeepSeek-OCR, 3,4 Mrd. Parameter
(Mixture-of-Experts, ~570 Mio. aktiv je Token), Ausgabe Markdown mit HTML-Tabellen in Lesereihenfolge, liest laut
Modellkarte auch Handschrift. Betrieb mit vLLM über eine OpenAI-kompatible Schnittstelle (passt zum bestehenden
Adapter), Durchsatz laut Modellkarte 2,57 Seiten/s auf einer A100. Kennzahlen laut Anbieter: OmniDocBench 91,1,
olmOCR-Bench 83,4 — in der Kategorie „alte Scans" aber nur 42,6.

**Wo es helfen würde**
1. **Scans wie digitale PDFs behandeln:** Ein sauberer Text für Scans würde den günstigeren Textweg (Auslesen aus Text,
   Bild nur bei Unsicherheit) auch für Scans öffnen — weniger Aufrufe des großen Bildmodells, geringere Last und Kosten.
2. **Tabellen** (Kontoauszüge, Gehaltsabrechnungen, Anlagen) als HTML-Struktur statt Fließtext.
3. **Handschrift** in Formularen (im Golden Dataset 8 handschriftliche Fälle).
4. **Seitenklassifikation und Posteingang-Trennung** könnten zusätzlich den Text nutzen.

**Was es nicht ersetzt:** das Auslesen der Felder und die Klassifikation (bleiben beim Sprach-/Bildmodell) und die
Wortpositionen für Belege (liefert jina-ocr-v1 laut Karte nicht; Tesseract bleibt dafür).

**Voraussetzungen und Risiken**
- **Lizenz: CC BY-NC 4.0 — kommerzielle Nutzung nur nach Absprache mit Jina.** Für Kundenprojekte zwingend vorher
  klären.
- **Betrieb:** eigener GPU-Server (z. B. beim Modellbetreiber Adacor AI neben den bestehenden vLLM-Modellen). Die
  gehostete „Jina Reader"-API scheidet für Sozialdaten praktisch aus (Datenübermittlung an Dritte).
- **Qualität auf unseren Dokumenten messen**, nicht auf Benchmarks: Die schwache Kategorie „alte Scans" betrifft genau
  Behörden-Posteingänge. Das Golden Dataset (30 Fälle als Scan, exakte Wahrheit) erlaubt einen direkten Vergleich:
  Texterkennung + Textweg gegen heutigen Bildweg — Felder richtig, Dauer, Modellaufrufe.
- **Einbindung im Dienst:** als zusätzlicher „Texterkenner" hinter der bestehenden Naht (`services/extraction/ocr.ts`
  bzw. Dokument-Konverter), pro Profil zuschaltbar; eigene Modell-Slots, damit OCR und Auslesen sich nicht
  gegenseitig blockieren.

### 14a. Vergleich offener OCR-Sprachmodelle (Stand Hugging Face, 2026-09-27)

Lizenz, Größe und Sprachen aus den Modell-Metadaten; Benchmarks sind **Selbstangaben der Hersteller** auf
unterschiedlichen Benchmark-Versionen (OmniDocBench v1.5 bzw. v1.6) und daher nur grob vergleichbar. Deutsche
Behördenformulare kommen in keinem Benchmark vor — maßgeblich ist der eigene Pilot.

| Modell | Lizenz (Gewichte) | Größe | Stärken laut Modellkarte | Positionen (Boxen) | Einordnung |
|---|---|---|---|---|---|
| **PaddleOCR-VL-1.6** (Baidu/PaddlePaddle, 05/2026) | Apache 2.0 | 0,96 Mrd. | OmniDocBench v1.6 96,3 (Bestwert laut Hersteller), eigener Praxis-Benchmark mit Scans/Verzerrung | ja (Layout-Stufe) | **Favorit**: klein, sehr genau, frei |
| **MinerU2.5-Pro** (OpenDataLab, 05/2026) | Apache 2.0 | 1,2 Mrd. | OmniDocBench v1.6 95,7, starke Tabellen | ja (Layout-Erkennung) | Favorit; Lizenz der Begleitsoftware separat prüfen |
| **GLM-OCR** (Zhipu, 01/2026) | MIT | 1,3 Mrd. | OmniDocBench v1.5 94,6; Deutsch in den Sprachen gelistet | ja (Layout + Erkennung) | Favorit |
| **LightOnOCR-2-1B** (LightOn, Frankreich, 01/2026) | Apache 2.0 | 1,0 Mrd. | Deutsch ausdrücklich gelistet, sehr schnell; europäischer Anbieter | Variante „-bbox" (Apache 2.0) | Favorit für Deutsch/EU |
| **Qianfan-OCR** (Baidu, 03/2026) | Apache 2.0 | 4,7 Mrd. | v1.5 93,1, olmOCR-Bench 79,8; vereint Lesen, Layout und Dokumentverständnis | ja | interessant, größer |
| **DeepSeek-OCR-2** (01/2026) / **DeepSeek-OCR** (10/2025) | Apache 2.0 / MIT | 3,4 / 3,3 Mrd. | Basis von jina-ocr-v1; v1.5 91,1 (laut Qianfan-Karte); Boxen per „grounding"-Anweisung | ja | solide Basis, frei |
| **Unlimited-OCR** (Baidu, 06/2026) | MIT | 3,3 Mrd. | Weiterentwicklung von DeepSeek-OCR, liest **mehrseitige Dokumente in einem Durchgang** | ja (`<|det|>`-Boxen) | spannend für Sammel-PDFs |
| **olmOCR-2** (Allen AI, 10/2025) | Apache 2.0 | 8,3 Mrd. (Qwen2.5-VL-7B) | Referenzsystem des olmOCR-Bench | nein | größer, langsamer |
| FireRed-OCR (2,1 Mrd.), Falcon-OCR (0,27 Mrd.), Granite-Docling (0,26 Mrd.) | Apache 2.0 | klein | kompakt | teils | Nebenkandidaten |
| jina-ocr-v1 (09/2026) | **CC BY-NC 4.0** | 3,4 Mrd. | olmOCR-Bench 83,4, v1.6 91,1 | nein | nur mit kommerzieller Lizenz von Jina |
| chandra-ocr-2 / surya-ocr-2 (Datalab) | **modifizierte OpenRAIL-M** (frei nur bis 2 Mio. $ Umsatz/Finanzierung) | 5,3 / 0,7 Mrd. | Handschrift, Layout | ja (surya) | für uns nur mit Lizenz |
| nemotron-ocr-v2 (NVIDIA) | NVIDIA Open Model License | — | Deutsch gelistet, laut Karte kommerziell nutzbar | ja | Lizenzbedingungen im Detail prüfen |
| Nanonets-OCR2-3B | in der Modellkarte **nicht angegeben** | 3,8 Mrd. | Handschrift, semantische Markierungen | nein | Lizenz klären |

**Empfehlung für den Pilot** (Golden Dataset, 30 Scans, exakte Wahrheit): **PaddleOCR-VL-1.6**, **LightOnOCR-2-1B**
(inkl. Box-Variante) und **DeepSeek-OCR-2 bzw. Unlimited-OCR** — alle mit freier Lizenz, klein genug für einen
gemeinsamen GPU-Server, vLLM-fähig, mit Positionsangaben (Chance, Tesseract für die Belege abzulösen). Gemessen wird
nicht die OCR-Qualität an sich, sondern das Endergebnis: Felder richtig (nach dem Auslesen durch Qwen), Dauer,
Modellaufrufe, Qualität der Belege.

**Empfehlung:** Pilot mit den frei lizenzierten Favoriten aus 14a gegen das Golden Dataset (Scan-Variante);
jina-ocr-v1 nur, wenn Jina eine kommerzielle Lizenz anbietet. Lohnt sich der Textweg für Scans, ist das ein großer
Hebel für Durchsatz und Kosten des Dienstes.
