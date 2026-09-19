# Auftragsverarbeitung — Vertragsbausteine (Wohngeld-Antragsassistent)

**Rechtsgrundlagen:** Art. 28 DSGVO **+ § 80 SGB X** (i.V.m. §§ 35 SGB I, 76, 78 SGB X) · **App:** `wohngeld`
**Stand:** `[Datum einsetzen]` · **Status:** VORLAGE/Checkliste — mit konkreten Dienstleistern zu füllen.
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md` (Abschnitte 1 + 5),
`docs/wohngeld-governance-spec-2026-09-19.md`.

> **Warum SGB X zusätzlich zu Art. 28 DSGVO?** Wohngelddaten sind **Sozialdaten**. Ihre Verarbeitung
> im Auftrag ist nur unter den **zusätzlichen** Voraussetzungen des **§ 80 SGB X** zulässig. Insbesondere
> gilt bei Auslagerung an **nicht-öffentliche Stellen** ein Erforderlichkeits-/Abwägungsvorbehalt; die
> Zweckbindung „wandert mit" den Daten (§ 78 SGB X) und der Auftragnehmer ist im selben Umfang zur
> Geheimhaltung wie die Behörde verpflichtet (§ 35 SGB I). Die **Kommune bleibt Verantwortliche**.

---

## 1. Rollen und Beteiligte

| Rolle | Beteiligter | Angabe |
|---|---|---|
| Verantwortlicher | Kommune / Wohngeldstelle | `[…]` |
| Auftragsverarbeiter | Plattformbetreiber | `[Anbieter einsetzen]` |
| Unterauftragsverarbeiter 1 | Hosting/Infrastruktur | `[z. B. Scalingo — Standort/Zertifizierung]` |
| Unterauftragsverarbeiter 2 | Objektspeicher (S3) | `[z. B. Flow.swiss — Standort]` |
| Unterauftragsverarbeiter 3 | LLM-Provider | `[z. B. Adacor AI — Modell/Standort]` |
| Weitere | `[…]` | `[…]` |

## 2. Pflicht-Bausteine des AV-Vertrags (Art. 28 Abs. 3) — Checkliste

| # | Baustein | Vorhanden? |
|---|---|---|
| B1 | Gegenstand, Dauer, Art und Zweck der Verarbeitung, Datenarten, Betroffenenkategorien | `[offen]` |
| B2 | **Weisungsbindung** — Verarbeitung nur auf dokumentierte Weisung des Verantwortlichen | `[offen]` |
| B3 | **Vertraulichkeitsverpflichtung** aller mit den Daten befassten Personen | `[offen]` |
| B4 | **TOM nach Art. 32** (Verweis `03-tom-uebersicht.md`), Nachweispflicht | `[offen]` |
| B5 | **Unterauftragsverarbeiter** nur mit Genehmigung; gleichwertige Pflichten weitergeben | `[offen]` |
| B6 | **Unterstützung** bei Betroffenenrechten (Art. 15–18/21) | `[offen]` |
| B7 | **Unterstützung** bei Art. 32–36 (Sicherheit, Meldepflichten, DSFA) | `[offen]` |
| B8 | **Löschung/Rückgabe** aller Daten nach Auftragsende (Wahlrecht des Verantwortlichen) | `[offen]` |
| B9 | **Nachweis-/Audit-/Kontrollrechte** des Verantwortlichen (Inspektionen) | `[offen]` |
| B10 | **Meldepflicht** des AV bei Datenschutzverletzungen (unverzüglich) | `[offen]` |
| B11 | Hinweispflicht des AV bei rechtswidriger Weisung | `[offen]` |

## 3. Zusätzliche Bausteine für Sozialdaten (§ 80 SGB X u. a.) — Checkliste

| # | Baustein | Vorhanden? |
|---|---|---|
| S1 | **Erforderlichkeits-/Abwägungsprüfung** für Auslagerung an nicht-öffentliche Stelle dokumentiert (§ 80 Abs. 2/3 SGB X) | `[offen]` |
| S2 | **Schriftform/dokumentierte Form** des Auftrags | `[offen]` |
| S3 | **Zweckbindung „wandert mit"** — AV verarbeitet nur zum Übermittlungszweck (§ 78 SGB X) | `[offen]` |
| S4 | **Geheimhaltung** des AV im selben Umfang wie die Behörde (§ 35 SGB I / Sozialgeheimnis) | `[offen]` |
| S5 | **Besondere Kategorien / Berufsgeheimnis** (§ 76 SGB X) — Art-9-Daten nicht in externe Klartext-Kontexte/Prompts; besondere Zugriffsbeschränkung | `[offen]` |
| S6 | **Verbleib der Verantwortlichkeit** bei der Kommune klargestellt | `[offen]` |
| S7 | **Löschpflichten** nach Sozialrecht + Aufbewahrungsfristen (`04-loeschkonzept.md`) | `[offen]` |
| S8 | Ggf. **Beteiligung des DSB / Anzeige** nach landesrechtlichen Vorgaben | `[offen]` |

## 4. Besonderheiten LLM-Provider (kritisch prüfen)

| # | Prüfpunkt | Angabe/Status |
|---|---|---|
| L1 | **Standort der Inferenz** (EU/EWR?) und ggf. Drittlandgarantien (Art. 44 ff.) | `[…]` |
| L2 | **Kein Training/Fine-Tuning** auf übermittelten Falldaten; keine Weiterverwendung | `[offen]` |
| L3 | **Keine dauerhafte Speicherung** von Prompts/Antworten beim Provider (bzw. kurze, vertraglich fixierte Retention) | `[offen]` |
| L4 | **Keine besonderen Kategorien** (Art. 9 / § 76 SGB X) im Klartext-Prompt | `[offen]` |
| L5 | Als **Unterauftragsverarbeiter** im AV-Vertrag geführt + Weisungsbindung | `[offen]` |
| L6 | Modell-/Versionsangaben protokolliert (Bezug `audit.usage_log`) | `[Ist-App]` |

## 5. Besonderheiten Hosting / Objektspeicher

| # | Prüfpunkt | Angabe/Status |
|---|---|---|
| H1 | Standort EU/EWR; Zertifizierungen (ISO 27001 o. ä.) | `[…]` |
| H2 | Verschlüsselung at rest / in transit | `[…]` (siehe `03-tom-uebersicht.md`) |
| H3 | Mandanten-/Bucket-Trennung je Instanz | `[Infra]` |
| H4 | Backup/Recovery, Löschung bei Vertragsende | `[…]` |

## 6. Drittland (Art. 44 ff. DSGVO)

- Findet eine Verarbeitung außerhalb EU/EWR statt? `[Ja/Nein]`. Falls ja: Garantien
  (Angemessenheitsbeschluss / SCC + Transfer-Impact-Assessment) je Unterauftragsverarbeiter `[…]`.
  Für Sozialdaten/Art-9 möglichst vermeiden.

---

## Zwingend zu füllen (Kommune/DSB/Betreiber)
Konkrete Dienstleister (Betreiber, Hosting, S3, LLM-Provider) mit Standort; AV-Vertrag mit allen
Bausteinen B1–B11 + S1–S8; Erforderlichkeitsprüfung § 80 SGB X; LLM-Prüfpunkte L1–L5;
Drittland-Garantien falls zutreffend.

## Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (§§ 35 SGB I, 76/78/80 SGB X, Art. 28 DSGVO mit URLs) ·
`docs/wohngeld-governance-spec-2026-09-19.md`.
