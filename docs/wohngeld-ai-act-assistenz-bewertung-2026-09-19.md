# AI-Act-Assistenz-Bewertung: Wohngeld-Antragsassistent (Entwurf, Art. 6 Abs. 3)

**Stand:** 2026-09-19 · **Status:** ENTWURF — auszufüllen/freizugeben mit DSB & Kommune
**App:** `wohngeld` · **Bezug:** GOV-3 (KI-Governance)
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md` (Rechtsanker mit §§/Artikeln + URLs),
`docs/wohngeld-governance-spec-2026-09-19.md` (Abschnitt G-H)

> **Zweck dieses Dokuments:** dokumentierte Begründung, warum der Wohngeld-Antragsassistent
> **echte Assistenz** ist und über die **Ausnahme des Art. 6 Abs. 3 KI-VO (EU AI Act)** aus der
> Hochrisiko-Einstufung herausfällt, obwohl Sozialleistungen grds. Anhang III Nr. 5 a unterfallen.
> Es ersetzt **nicht** DSFA (Art. 35 DSGVO), Verfahrensverzeichnis (Art. 30) oder die Abstimmung
> mit DSB/Kommune/Personalrat — es liefert die technische/organisatorische Grundlage dafür.
> Felder mit `[…]` sind vor Freigabe von der Kommune/DSB auszufüllen.

---

## 1. System- und Zweckbeschreibung

- **Name/Version:** Wohngeld-Antragsassistent, Prompt-/Regelkatalog-Stand `WOHNGELD_PROMPT_VERSION = 2026-09-19`.
- **Betreiber/Verantwortlicher:** `[Kommune / Amt einsetzen]`.
- **Fachlicher Zweck:** Unterstützung der Sachbearbeitung bei der Bearbeitung von Wohngeldanträgen —
  Dokument-Klassifikation/-Extraktion, Vollständigkeits- und Plausibilitätsprüfung, Aufbereitung von
  Anforderungsschreiben, fallbezogene Fragen (grounded Q&A auf Fall- und Rechtsquellen).
- **Ausdrücklich NICHT Zweck:** keine Leistungs-/Betragsfestsetzung (§ 19 WoGG bleibt manuell),
  keine rechtsverbindliche Bescheiderzeugung, keine automatisierte Bewilligung/Ablehnung.
- **Eingesetzte Modelle:** `[Provider/Modell einsetzen; aktueller Default: Adacor Qwen3]` — je Aufruf
  im Usage-Log mitprotokolliert (Modell-ID, Provider, Prompt-Stand, Rechtsstand, Fallbezug).

## 2. Warum keine automatisierte Einzelentscheidung (Art. 22 DSGVO)

Die KI erzeugt **Vorschläge**, keine Entscheidungen. Die menschliche Letztentscheidung ist im Tool
**erlebbar und technisch abgesichert** (Human-in-the-Loop):

| Beleg im Tool | Wirkung |
|---|---|
| **Feld-Provenienz** (`feld_status`: quelle `llm`/`mensch`, `bestaetigt`, `confidence`) | KI-extrahierte Werte sind gekennzeichnet und **bestätigungspflichtig** — sie werden erst durch aktive Bestätigung der Sachbearbeitung wirksam. |
| **Bestätigen/Verwerfen-Workflow** | Jeder KI-Vorschlag kann verworfen werden; ergebnisoffen, kein „Rubber-Stamping". |
| **Prüfschritte** mit `automatisch`-Flag + Status offen/erledigt/verworfen | Maschinen-Befund und menschliche Freigabe sind getrennt sichtbar. |
| **Chat als Vorschlag** | Chat-Antworten/Aktions-Vorschläge (C4) werden **nie automatisch** ausgeführt — nur nach Klick + Bestätigung. |
| **Verfügung durch Mensch** | Entscheidung + Bemerkung werden manuell gesetzt; Status `entscheidung` erfordert eine menschliche Aktion. |
| **Vier-Augen-Option** (`WOHNGELD_VIERAUGEN`) | Opt-in: finale Entscheidung nur durch Rolle „Entscheider" (owner) — Bearbeiter ≠ Entscheider. |
| **Transparenzhinweis im Verfügungs-Dokument** | Schriftlicher Vermerk, dass KI nur assistierte und ein Mensch entschied. |

→ Die Entscheidung ist damit **nicht** „ausschließlich auf automatisierter Verarbeitung" beruhend i. S. v. Art. 22 DSGVO.

## 3. Einordnung nach EU AI Act (Art. 6 Abs. 3)

Sozialleistungen fallen grds. unter **Anhang III Nr. 5 a** (Hochrisiko). Die Ausnahme **Art. 6 Abs. 3**
greift, wenn das System **kein erhebliches Risiko** für Grundrechte begründet, weil es nur eine der
dort genannten Fallgruppen erfüllt. Bewertung hier:

- **Eng umgrenzte Verfahrensaufgabe:** Klassifikation/Extraktion, Vollständigkeits-/Plausibilitätsprüfung,
  Text-Aufbereitung — jeweils Zuarbeit, keine Entscheidung. `[bestätigen]`
- **Verbesserung eines bereits abgeschlossenen menschlichen Arbeitsergebnisses / Vorbereitung:**
  Die KI bereitet vor; die fachliche Würdigung und Entscheidung erfolgt durch den Menschen. `[bestätigen]`
- **KEIN Profiling** i. S. v. Art. 4 Nr. 4 DSGVO: keine Bewertung/Vorhersage persönlicher Aspekte,
  **keine Score-basierte Priorisierung** von Personen, kein automatisches Ranking von Antragstellenden. `[bestätigen]`
- **Kein Ersetzen/Beeinflussen der menschlichen Bewertung ohne Prüfung:** Vorschläge sind gekennzeichnet
  und bestätigungspflichtig (s. Abschnitt 2). `[bestätigen]`

→ **Vorläufiges Ergebnis:** Ausnahme Art. 6 Abs. 3 einschlägig, **da echte Assistenz + kein Profiling**.
Diese Einordnung ist gem. Art. 6 Abs. 4 zu **dokumentieren** (dieses Dokument) und die Registrierungs-/
Meldepflichten sind zu beachten. **Finale Bewertung durch DSB/Rechtsamt.** `[offen]`

## 4. Kein Profiling / keine unzulässige Verarbeitung besonderer Daten

- Keine Profilbildung, kein Training auf Falldaten, kein Auto-Retraining (Modelle werden nur zur
  Inferenz genutzt).
- Besondere Kategorien (Behinderung/Pflege/Gesundheit → Freibeträge, Art. 9 DSGVO) werden nur
  verarbeitet, soweit für die Wohngeldberechnung erforderlich (Art. 9 Abs. 2 b/g); keine Nutzung
  zu Bewertungs-/Vorhersagezwecken.

## 5. Technische Absicherung (AI Act Art. 12/13/14 als Best Practice)

- **Art. 12 Logging:** Zentrales KI-Nutzungs-Protokoll (`audit.usage_log`) — je LLM-Aufruf mit
  Zeitpunkt, Modell-ID, Provider, **Prompt-/Regelkatalog-Version**, **Rechtsstand** (bei Rechts-Chat),
  Zweck (source/operation), Nutzer und **Fallbezug** (`vorgangId`/`resourceId`). Sicht „KI-Nutzung je
  Vorgang" im Details-Tab. Fachliches Handeln zusätzlich im append-only `wohngeld.audit_log` (GOV-1).
- **Art. 13 Transparenz:** Default-Textbaustein „KI-Transparenzhinweis" (Kategorie „Allgemein") für
  Anschreiben/Bescheide; Schluss-Hinweis im Verfügungs-Export.
- **Art. 14 menschliche Aufsicht:** siehe Abschnitt 2 (Kennzeichnung, Bestätigungspflicht, Vier-Augen-Option).
- **Grenzen der Genauigkeit (Art. 15):** LLM-Ausgaben können fehlerhaft sein — deshalb Bestätigungs-
  pflicht und Belegbindung (Chat zitiert Quellen; keine Rechtsauskunft ohne §-Fundstelle).
- **Bekannte Limitation:** Die Token-Spalten (`prompt/completion/total`) werden derzeit **nicht** befüllt
  (LLM-Adapter reicht die Usage-Zahlen nicht an das Usage-Log durch; Nachrüstung nur mit Adapter-Umbau —
  bewusst zurückgestellt). Modell/Version/Zweck/Fallbezug werden vollständig protokolliert.

## 6. Offene Punkte für DSB / Kommune

1. Finale AI-Act-Einstufung + Dokumentation Art. 6 Abs. 4 bestätigen `[offen]`.
2. DSFA (Art. 35) + Verfahrensverzeichnis (Art. 30) durchführen/pflegen `[offen]`.
3. Verantwortlichen/Betreiber + eingesetzte Modelle konkret benennen `[offen]`.
4. Personalrat wg. Protokollierung (Zweckbindung „keine Leistungskontrolle") einbinden `[offen]`.
5. Vier-Augen-Prinzip aktivieren? (`WOHNGELD_VIERAUGEN`) `[offen]`.
6. Aufbewahrungs-/Löschfristen (Landesrecht, ~10 J.) festlegen `[offen]`.

---

## Quellen

`docs/wohngeld-governance-recherche-2026-09-19.md` (§§/Artikel mit URLs) ·
`docs/wohngeld-governance-spec-2026-09-19.md` (G-H) · Code-Bestandsaufnahme (Datei:Zeile).
