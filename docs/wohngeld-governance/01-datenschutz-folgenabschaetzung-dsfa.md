# Datenschutz-Folgenabschätzung (DSFA) — Wohngeld-Antragsassistent

**Rechtsgrundlage:** Art. 35 DSGVO · **App:** `wohngeld` · **Stand:** `[Datum einsetzen]`
**Status:** VORLAGE — auszufüllen und freizugeben mit DSB / Kommune / Rechtsamt
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md` (Rechtsanker),
`docs/wohngeld-governance-spec-2026-09-19.md` (technische Substanz),
`docs/wohngeld-ai-act-assistenz-bewertung-2026-09-19.md` (AI-Act-Einordnung).

> **Warum voraussichtlich DSFA-pflichtig?** (1) Umfangreiche Verarbeitung besonderer Kategorien
> (Art. 9 — Behinderung/Pflege/Gesundheit für Freibeträge), (2) Verarbeitung durch eine **öffentliche
> Stelle** in Ausübung hoheitlicher Aufgaben, (3) Einsatz **neuer Technologie (KI)**, (4) potenziell
> erhebliche Auswirkungen auf die Betroffenen (Existenzsicherung durch Wohngeld). Die
> **Muss-Liste des jeweiligen Landes** (Art. 35 Abs. 4 DSGVO) ist heranzuziehen — Wohngeld-/
> Sozialleistungsverfahren werden dort regelmäßig genannt.

---

## 0. Verfahrenskopf

| Feld | Angabe |
|---|---|
| Verantwortlicher (Art. 4 Nr. 7) | `[Kommune / Amt / Anschrift einsetzen]` |
| Ggf. gemeinsam Verantwortliche (Art. 26) | `[falls zutreffend]` |
| Datenschutzbeauftragte(r) | `[Name / Kontakt DSB einsetzen]` |
| Fachlich Verantwortliche(r) (Amtsleitung Wohngeldstelle) | `[Name / Rolle einsetzen]` |
| Auftragsverarbeiter (Betreiber der Plattform) | `[Anbieter einsetzen]` (siehe `05-auftragsverarbeitung-av-bausteine.md`) |
| Datum der DSFA / letzte Fortschreibung | `[Datum]` |
| Beteiligte an der DSFA | `[DSB, Fachbereich, IT-Sicherheit, ggf. Personalrat]` |

---

## (a) Systematische Beschreibung der Verarbeitung (Art. 35 Abs. 7 lit. a)

### Zweck der Verarbeitung
Unterstützung der Sachbearbeitung bei der Bearbeitung von **Wohngeldanträgen** — konkret:
- **Dokument-Klassifikation und -Extraktion** (KI liest hochgeladene Belege, schlägt Feldwerte vor),
- **Vollständigkeitsprüfung** (welche Nachweise/Angaben fehlen),
- **Plausibilitätsprüfung** (Auffälligkeiten/Abweichungen als Hinweis, keine Entscheidung),
- **Aufbereitung von Anforderungs-/Anschreiben** (Textentwürfe),
- **fallbezogene Fragen** (belegpflichtiges, quellengebundenes Q&A auf Fall- und Rechtsquellen).

**Ausdrücklich NICHT Zweck:** keine Leistungs-/Betragsfestsetzung (§ 19 WoGG bleibt manuell), keine
rechtsverbindliche Bescheiderzeugung, keine automatisierte Bewilligung/Ablehnung, kein Profiling,
kein Training/Auto-Retraining auf Falldaten. Details: AI-Act-Assistenz-Bewertung (Abschnitte 1, 4).

### Rechtsgrundlagen
- **Art. 6 Abs. 1 lit. e i.V.m. Abs. 3 DSGVO** (öffentliche Aufgabe) + Fachrecht **WoGG** und **SGB I/X**
  — keine Einwilligung der Antragstellenden erforderlich.
- **Art. 9 Abs. 2 lit. b/g DSGVO** i.V.m. **§ 76 SGB X** für besondere Kategorien (Behinderung/Pflege/
  Gesundheit für Freibeträge).
- Bereichsspezifischer Sozialdatenschutz: **§ 35 SGB I** (Sozialgeheimnis), **§§ 67c, 78 SGB X**
  (Zweckbindung), **§ 80 SGB X** (Auftragsverarbeitung).

### Art der eingesetzten KI
- KI wird **assistierend** eingesetzt (Vorschläge, nicht Entscheidungen). Human-in-the-Loop ist im
  Tool technisch abgesichert (siehe (d)). Eingesetzte Modelle: `[Provider/Modell einsetzen; aktueller
  Default: Adacor Qwen3]`; Prompt-/Regelkatalog-Stand `WOHNGELD_PROMPT_VERSION`.
- AI-Act-Einordnung (Anhang III Nr. 5 a → Ausnahme Art. 6 Abs. 3, echte Assistenz, kein Profiling):
  siehe `docs/wohngeld-ai-act-assistenz-bewertung-2026-09-19.md`.

### Datenarten
| Kategorie | Beispiele | Besonderheit |
|---|---|---|
| Stammdaten Antragsteller/Haushalt | Name, Anschrift, Geburtsdatum, Haushaltsmitglieder | personenbezogen |
| Wohn-/Mietdaten | Miete, Wohnfläche, Mietvertrag | personenbezogen |
| Einkommens-/Vermögensdaten | Lohn, Rente, Sozialleistungen, Nachweise | personenbezogen, sensibel im Alltag |
| **Besondere Kategorien (Art. 9)** | **Behinderung, Pflegegrad, Gesundheitsangaben** (für Freibeträge §§ 17 WoGG) | **erhöhter Schutz, § 76 SGB X** |
| Dokumente/Belege | hochgeladene Bescheide, Verträge, Atteste | ggf. Art-9-Inhalte |
| Verfahrensmetadaten | Vorgangs-Status, Prüfschritte, Verfügung, Notizen | Sozialdaten |
| Protokolldaten | Audit-Log (Wer/Was/Wann), KI-Usage-Log | Beschäftigtendaten → Personalrat |

### Betroffene (Kategorien)
- **Antragstellende** und **Haushaltsmitglieder** (inkl. ggf. Minderjähriger).
- Ggf. **Dritte** (Vermieter, unterhaltsverpflichtete Personen), soweit in Belegen enthalten.
- **Beschäftigte** der Wohngeldstelle (als Akteure im Audit-Log — Zweckbindung beachten).

### Empfänger
- Intern: **befugte** Sachbearbeitung der Wohngeldstelle (rollenbasiert, siehe (d)).
- Auftragsverarbeiter: **Plattformbetreiber** `[…]`, **Hosting/Storage** `[…]`, **LLM-Provider** `[…]`
  (siehe `05-auftragsverarbeitung-av-bausteine.md`).
- Ggf. gesetzlich vorgesehene Übermittlungen (§§ 67d ff. SGB X) — `[falls zutreffend benennen]`.

### Verarbeitungsablauf / Systemgrenzen
`[Kurzbeschreibung Datenfluss einsetzen: Erhebung → Upload/Extraktion → Prüfung durch Mensch →
Verfügung → Aufbewahrung → Löschung. Architektur/Schnittstellen (Fachverfahren, OZG-Antragsstrecke)
benennen.]`

### Speicherdauer
Wohngeldakten regelmäßig **~10 Jahre**, abgelehnte Anträge ohne Bezug **~2 Jahre** — **final mit
Kommune/Land zu klären** (Landesrecht). Details und App-Mechanik: `04-loeschkonzept.md`.

---

## (b) Notwendigkeit und Verhältnismäßigkeit (Art. 35 Abs. 7 lit. b)

- **Erforderlichkeit:** Die Bearbeitung von Wohngeldanträgen ist gesetzliche Pflichtaufgabe (WoGG);
  die verarbeiteten Daten sind zur Anspruchsprüfung erforderlich. Die KI-Assistenz dient der
  Beschleunigung/Qualitätssicherung, **ersetzt aber keine Datenerhebung**.
- **Datenminimierung (Art. 5 Abs. 1 lit. c):** `[beschreiben, wie Datensparsamkeit sichergestellt
  wird; besondere Kategorien nur soweit für Freibeträge nötig; keine Art-9-Daten in externe
  Klartext-Kontexte/Prompts, kein Prompt-/Antwort-Volltext im Audit — nur Metadaten]`.
- **Zweckbindung (§§ 67c, 78 SGB X):** Verarbeitung nur zum Erhebungszweck „Bearbeitung des
  Wohngeldantrags"; keine Zweckänderung (kein Training/Analyse) ohne eigene Rechtsgrundlage.
- **Rechtsgrundlage tragfähig:** Art. 6 Abs. 1 lit. e + WoGG/SGB (keine Einwilligung).
- **Verhältnismäßigkeit der KI:** echte Assistenz mit menschlicher Letztentscheidung; mildere Mittel
  (rein manuell) wären möglich, die Assistenz ist aber eng umgrenzt und jederzeit übersteuerbar.
- **Transparenz gegenüber Betroffenen (Art. 13/14):** `[Verweis auf Datenschutzhinweise im
  Antragsverfahren + KI-Transparenzhinweis im Verfügungs-/Anschreiben-Export]`.

---

## (c) Risiken für die Rechte und Freiheiten der Betroffenen (Art. 35 Abs. 7 lit. c)

Bewertung je Risiko: Eintrittswahrscheinlichkeit × Schwere → Risiko (niedrig/mittel/hoch), vor
Maßnahmen. `[von DSB/Fachbereich einstufen]`.

| # | Risiko | Beschreibung | Eintritt | Schwere | Risiko |
|---|---|---|---|---|---|
| R1 | Unbefugter Zugriff auf Sozialdaten | Einsicht durch Nicht-Befugte (§ 35 SGB I) | `[…]` | hoch | `[…]` |
| R2 | Fehlerhafte KI-Extraktion/Plausibilität | Falscher Feldwert wird unbemerkt übernommen | `[…]` | hoch | `[…]` |
| R3 | Faktisch automatisierte Entscheidung | „Rubber-Stamping", Mensch nickt nur ab (Art. 22) | `[…]` | hoch | `[…]` |
| R4 | Abfluss besonderer Kategorien (Art. 9) | Behinderungs-/Pflegedaten in externe LLM-Kontexte/Logs | `[…]` | hoch | `[…]` |
| R5 | Fehlende Nachvollziehbarkeit | Zugriffe/Änderungen nicht rekonstruierbar | `[…]` | mittel | `[…]` |
| R6 | Zweckentfremdung Protokolldaten | Nutzung des Audit-Logs zur Leistungskontrolle | `[…]` | mittel | `[…]` |
| R7 | Übermäßige/zu kurze Speicherung | Verstoß gegen Aufbewahrungs-/Löschpflichten | `[…]` | mittel | `[…]` |
| R8 | Unzulässige Übermittlung | Weitergabe ohne Rechtsgrundlage (§§ 67d ff. SGB X) | `[…]` | hoch | `[…]` |
| R9 | Verletzung Betroffenenrechte | Auskunft/Berichtigung/Einschränkung nicht umsetzbar | `[…]` | mittel | `[…]` |
| R10 | Diskriminierung/Bias | Systematische Benachteiligung von Personengruppen | `[…]` | hoch | `[…]` |

---

## (d) Abhilfemaßnahmen (Art. 35 Abs. 7 lit. d)

Maßnahmen zur Risikoeindämmung — mit Verweis auf die **konkreten Mechanismen der App** (Ist-Stand
laut Governance-Spec) und ergänzende organisatorische Maßnahmen `[…]`.

| Risiko | Technische Maßnahme in der App | Organisatorisch `[…]` |
|---|---|---|
| R1 | **3-Rollen-Modell** owner/editor/viewer (gruppenbasiert) + **`requireAppAccess`**; globale Admins ohne Auto-Zugriff; Editor-Gate (`denyIfNotAppEditor`) auf Schreib-Routen | Berechtigungsvergabe nach Least Privilege, regelmäßige Rezertifizierung `[…]` |
| R2 | **KI-Provenienz auf Feldebene** (`feld_status`: quelle `llm`/`mensch`, `bestaetigt`, `confidence`, `quellDokumentId`) + **Bestätigen/Verwerfen-Workflow**; **Prüfschritte** mit `automatisch`-Flag; **Vorher/Nachher-Diff** im Audit | Schulung Sachbearbeitung, Stichprobenkontrolle `[…]` |
| R3 | Vorschläge sind gekennzeichnet + **bestätigungspflichtig**; Chat-Aktionen (C4) nur nach Klick+Bestätigung; **Verfügung** nur durch Mensch; optionales **Vier-Augen** (`WOHNGELD_VIERAUGEN`, Bearbeiter ≠ Entscheider) | Dienstanweisung „echte Prüfung, kein Abnicken" `[…]` |
| R4 | Keine Art-9-Daten in externe Klartext-Kontexte; kein Prompt-/Antwort-Volltext im Audit (nur Metadaten); Zweckbindung „wandert mit" (§ 78 SGB X) | AV-Verträge mit § 80-SGB-X-Zusätzen `[…]` |
| R5 | **Append-only Audit-Log** (`wohngeld.audit_log`) inkl. **Lesezugriffen** (`vorgang.geoeffnet`) und **Exporten**; Akteur-Identität (Name+Rolle); Fall-Protokoll-Tab; Admin/DSB-Protokoll-Ansicht | Regelmäßige Protokollauswertung durch DSB `[…]` |
| R6 | Audit dient nicht der Leistungskontrolle (Zweckbindung im Konzept verankert) | **Personalrat/Dienstvereinbarung** `[…]` |
| R7 | **Retention-Mechanik**: `aufbewahrungBis` (automatisch bei Abschluss), **Legal Hold**, **Löschfällig-Ansicht**, Löschung nur nach Bestätigung (kein stilles Hard-Delete) | Fristen final mit Land klären `[…]` (siehe `04`) |
| R8 | Export-/Weitergabe-Protokollierung im Audit-Log | Übermittlungsregeln §§ 67d ff. SGB X dokumentieren `[…]` |
| R9 | **Auskunftsexport** je Person (Art. 15/20), **Berichtigung** = Edit+Audit (Art. 16), **Einschränkungs-Flag** (`eingeschraenkt`, Art. 18 → nur lesend via `denyIfEingeschraenkt`) | Prozess für Betroffenenanfragen `[…]` |
| R10 | Kein Profiling, kein Score-basiertes Ranking von Personen; Regel-/Retrieval-Assistenz statt eigener Trainingsmodelle | Bias-Review, ggf. Grundrechte-Folgenabschätzung Art. 27 AI Act `[…]` |

**TOM-Gesamtübersicht:** `03-tom-uebersicht.md` (Art. 32 / BSI IT-Grundschutz).

---

## (e) Bewertung, Restrisiko und Freigabe

- **Restrisiko nach Maßnahmen:** `[je Risiko R1–R10 neu einstufen; Gesamtbewertung]`.
- **Konsultation der Aufsichtsbehörde nach Art. 36 DSGVO erforderlich?** `[Ja/Nein — nur wenn trotz
  Maßnahmen hohes Restrisiko verbleibt; mit DSB entscheiden]`.
- **Standpunkt der/des Betroffenenvertretung/Personalrats (soweit eingeholt):** `[…]`.

### Stellungnahme des Datenschutzbeauftragten (Art. 35 Abs. 2)
`[Bewertung/Empfehlung des DSB einsetzen]`

### Freigabe
| Rolle | Name | Datum | Ergebnis |
|---|---|---|---|
| Datenschutzbeauftragte(r) | `[…]` | `[…]` | `[freigegeben / mit Auflagen / abgelehnt]` |
| Verantwortlicher (Amtsleitung) | `[…]` | `[…]` | `[…]` |
| ggf. IT-Sicherheit | `[…]` | `[…]` | `[…]` |

**Fortschreibung:** Die DSFA ist bei wesentlichen Änderungen (neue Zwecke, Datenarten, Modelle/
Provider, erhöhtes Risiko) sowie anlassunabhängig `[Turnus, z. B. jährlich]` zu überprüfen.

---

## Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (Art. 35 u. a. mit URLs) ·
`docs/wohngeld-governance-spec-2026-09-19.md` · `docs/wohngeld-ai-act-assistenz-bewertung-2026-09-19.md`.
BfDI-DSFA-Übersicht und Muss-Listen-Beispiel siehe Recherche-Dokument, Abschnitt Art. 35.
