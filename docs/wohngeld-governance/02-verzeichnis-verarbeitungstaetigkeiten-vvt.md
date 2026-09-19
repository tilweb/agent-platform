# Verzeichnis von Verarbeitungstätigkeiten (VVT) — Wohngeld-Antragsassistent

**Rechtsgrundlage:** Art. 30 DSGVO · **App:** `wohngeld` · **Stand:** `[Datum einsetzen]`
**Status:** VORLAGE — auszufüllen und zu führen durch den Verantwortlichen (Kommune)
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md`,
`docs/wohngeld-governance-spec-2026-09-19.md`.

> **Hinweis.** Dies ist der Eintrag des **Verantwortlichen** (Kommune) nach Art. 30 Abs. 1. Der
> **Auftragsverarbeiter** (Plattformbetreiber) führt zusätzlich sein eigenes Verzeichnis nach
> Art. 30 Abs. 2 — siehe `05-auftragsverarbeitung-av-bausteine.md`.

---

## 1. Verantwortlicher / Vertreter / DSB (Art. 30 Abs. 1 lit. a)

| Feld | Angabe |
|---|---|
| Verantwortlicher | `[Kommune / Amt / Anschrift]` |
| Gesetzlicher Vertreter | `[Name / Funktion, z. B. (Ober-)Bürgermeister/in]` |
| Ggf. gemeinsam Verantwortliche (Art. 26) | `[falls zutreffend]` |
| Datenschutzbeauftragte(r) | `[Name / Kontakt]` |
| Fachverantwortung | `[Leitung Wohngeldstelle]` |

## 2. Bezeichnung und Zweck der Verarbeitung (Art. 30 Abs. 1 lit. b)

- **Bezeichnung:** KI-gestützte Bearbeitung von Wohngeldanträgen (Antragsassistent `wohngeld`).
- **Zwecke:** Dokument-Klassifikation/-Extraktion, **Vollständigkeitsprüfung**, **Plausibilitätsprüfung**,
  Aufbereitung von Anforderungs-/Anschreiben, fallbezogenes belegpflichtiges Q&A — als **Assistenz** der
  Sachbearbeitung. **Nicht:** automatisierte Bewilligung/Ablehnung, Betragsfestsetzung, Profiling.

## 3. Rechtsgrundlage

- **Art. 6 Abs. 1 lit. e i.V.m. Abs. 3 DSGVO** (öffentliche Aufgabe) + **WoGG** und **SGB I/X**.
- **Art. 9 Abs. 2 lit. b/g DSGVO** i.V.m. **§ 76 SGB X** für besondere Kategorien.
- Bereichsspezifisch: **§ 35 SGB I**, **§§ 67c, 78 SGB X** (Zweckbindung), **§ 80 SGB X** (AV).

## 4. Kategorien betroffener Personen (Art. 30 Abs. 1 lit. c)

- Antragstellende Personen · Haushaltsmitglieder (ggf. Minderjährige) · Dritte in Belegen (z. B.
  Vermieter, Unterhaltsverpflichtete) · Beschäftigte der Wohngeldstelle (als Akteure im Audit-Log).

## 5. Kategorien personenbezogener Daten (Art. 30 Abs. 1 lit. c)

| Kategorie | Beispiele |
|---|---|
| Stammdaten | Name, Anschrift, Geburtsdatum, Familienstand, Haushaltszusammensetzung |
| Wohn-/Mietdaten | Miete, Nebenkosten, Wohnfläche, Mietvertrag |
| Einkommen/Vermögen | Lohn/Gehalt, Rente, Sozialleistungen, Vermögen, Nachweise |
| **Besondere Kategorien (Art. 9)** | **Behinderung, Pflegegrad, Gesundheitsangaben** (Freibeträge §§ 17 WoGG) |
| Dokumente/Belege | hochgeladene Bescheide, Verträge, Atteste (ggf. Art-9-Inhalte) |
| Verfahrensdaten | Vorgangs-Status, Prüfschritte, Verfügung, Notizen, Feld-Provenienz |
| Protokolldaten | Audit-Log (Wer/Was/Wann, inkl. Lesezugriffe/Exporte), KI-Usage-Log |

## 6. Kategorien von Empfängern (Art. 30 Abs. 1 lit. d)

- **Intern:** befugte Sachbearbeitung (rollenbasiert owner/editor/viewer, `requireAppAccess`).
- **Auftragsverarbeiter:** Plattformbetreiber `[…]`; Hosting/Storage (S3) `[…]`; LLM-Provider `[…]`
  (aktueller Default Adacor AI — `[final benennen]`). Siehe `05-auftragsverarbeitung-av-bausteine.md`.
- **Externe Empfänger / Übermittlungen** (§§ 67d ff. SGB X): `[falls zutreffend benennen,
  z. B. andere Leistungsträger, mit Rechtsgrundlage]`.

## 7. Übermittlung an Drittländer (Art. 30 Abs. 1 lit. e)

- **Grundsatz:** Verarbeitung/Speicherung in der **EU/EWR** anzustreben. `[Standort Hosting/Storage
  und LLM-Inferenz einsetzen]`.
- Findet eine Drittlandübermittlung statt? `[Ja/Nein]`. Falls ja: Garantien nach Art. 44 ff.
  (Angemessenheitsbeschluss / Standardvertragsklauseln + TIA) `[benennen]`. Für besondere Kategorien
  und Sozialdaten (§ 76 SGB X) besonders kritisch prüfen — möglichst vermeiden.

## 8. Vorgesehene Löschfristen (Art. 30 Abs. 1 lit. f)

- Wohngeldakten regelmäßig **~10 Jahre**, abgelehnte Anträge ohne Bezug **~2 Jahre** — **final
  landesrechtlich zu klären** (§§ 27 Abs. 4, 33 Abs. 2 WoGG; § 45 Abs. 3 SGB X; WoGVwV + Landes-VwV).
- Protokolldaten: eigene, begrenzte Frist `[definieren]` (Auth-Audit derzeit 90 Tage; fachliches
  Audit an Fall-Aufbewahrung gekoppelt).
- Verfahren und App-Mechanik (`aufbewahrungBis`, Legal Hold, Löschfällig-Ansicht): siehe
  `04-loeschkonzept.md`.

## 9. Technische und organisatorische Maßnahmen (Art. 30 Abs. 1 lit. g)

Allgemeine Beschreibung der TOM nach Art. 32 DSGVO / BSI IT-Grundschutz: siehe **`03-tom-uebersicht.md`**
(Zugriffs-, Eingabe-, Trennungskontrolle, Protokollierung, Verschlüsselung, Verfügbarkeit,
Pseudonymisierung).

## 10. Bezug zur KI-Nutzung (ergänzend)

- KI-Einsatz als **Assistenz** dokumentiert in `docs/wohngeld-ai-act-assistenz-bewertung-2026-09-19.md`
  (AI Act Art. 6 Abs. 3, kein Profiling). KI-Aufrufe werden im **`audit.usage_log`** protokolliert
  (Modell-ID, Provider, Prompt-/Regelkatalog-Version, Zweck, Nutzer, Fallbezug).

---

## Kopf-/Versionsangaben

| Feld | Angabe |
|---|---|
| Erstellt von | `[…]` |
| Erstellt/aktualisiert am | `[…]` |
| Nächste Überprüfung | `[Turnus]` |
| Verknüpfte DSFA | `01-datenschutz-folgenabschaetzung-dsfa.md` |

## Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (Art. 30 u. a.) ·
`docs/wohngeld-governance-spec-2026-09-19.md`.
