# Goldfall „Petermann" — Test-Fixture für Prüf-/Plausibilitätslogik

**Quelle:** Screenshots `docs/wohngeld/*.png` (Referenzprodukt „forml"), Vorgang `104-556-230`.
**Zweck:** Deterministischer Abnahme-Maßstab für die Regel-Engine (Phase 1). Aus diesem Fall
werden die erwarteten Prüfschritte (Vollständigkeit + Plausibilität) abgeleitet und per `bun test`
verifiziert. Die eingebauten **Widersprüche** sind Absicht — sie triggern Plausibilitätsregeln.

> Hinweis: Die Screenshots zeigen mehrere Beispiel-Zustände mit teils abweichenden Zahlen
> (verschiedene Demo-Varianten). Hier ist der **kanonische** Fall festgelegt; Abweichungen sind
> als solche markiert.

---

## 1. Vorgang / Stammdaten

| Feld | Wert |
|---|---|
| Antrags-ID | 104-556-230 |
| Wohngeldart | Mietzuschuss |
| Antragsart | Erstantrag |
| Antragsdatum | 12.08.2026 |
| Status | Sachbearbeitung |
| Sachbearbeiter:in | Katharina Vogel |
| Priorität | Normal |
| Antragsteller | Petermann, Siegfried |

---

## 2. Personen

### P1 — Siegfried Petermann (Antragsteller)
| Feld | Wert |
|---|---|
| Rolle | Antragsteller |
| Geschlecht | Männlich |
| Geburtsdatum | 26.03.1955 (71 J.) |
| Geburtsort | Paderborn |
| Familienstand | Verheiratet |
| Staatsangehörigkeit | Deutschland |
| Erwerbsstatus | Rente/Pension |
| Einkommen | Rente/Pension 686,00 €/mtl. (8.232,00 €/J.); Lohn/Gehalt 980,00 €/mtl. (11.760,00 €/J.) |
| Vermögen | Bankguthaben 12.500,00 € |
| Erhält Kindergeld | nein |
| Werbungskosten | nein |

### P2 — Marion Henriette Petermann (Ehegattin)
| Feld | Wert |
|---|---|
| Rolle | Ehegatte/Ehegattin |
| Alter | 66 J. |
| Erwerbsstatus | Rente/Pension |
| Einkommen | Rente 874,86 €/mtl. (10.498,36 €/J.) |

**Anrechenbares Gesamteinkommen (§13 WoGG, aus Screenshot):** 1.560,86 €/mtl. → 18.730,36 €/J.
*(Wird von der §13-Aggregationsfunktion nachgerechnet; dient als Plausibilitäts-Zielwert.)*

---

## 3. Wohnung & Miete

| Feld | Antrag | Nachweis (Mietvertrag) |
|---|---|---|
| Straße/Nr. | Brinckmannstraße 5 | Brinckmannstrasse 5 |
| PLZ/Ort | 40225 Düsseldorf | 40225 Düsseldorf |
| Wohnfläche | 63,00 m² | **120 m²** ⚠️ Widerspruch |
| Miete (gesamt) | 704,00 € | **690,00 €** ⚠️ Widerspruch (Differenz 14 €) |
| Heizkosten | – | – |
| Warmwasser | – | – |
| Mietvertrag | – | Unbefristet, **ohne Unterschrift** ⚠️ |

---

## 4. Eingegangene Dokumente (Nachweise)

| ID | Typ | Merkmale / Flags |
|---|---|---|
| D1 | Wohngeld-Antrag (Mietzuschuss) | 11 Seiten, **ohne Datum unterschrieben** ⚠️ |
| D2 | Rentenanpassung Dt. Rentenversicherung (Marion) | Stand 01.07.2023, mit KV-Zuschuss; **keine Grundrentenzeiten** ⚠️ |
| D3 | Kontoauszug (Siegfried) | aus 2019, **keine Mietzahlungen** ⚠️, **Dividendengutschrift** sichtbar ⚠️ |
| D4 | Mietvertrag | Unbefristet, **nicht unterschrieben** ⚠️, Miete 690 € / 120 m² |

**Vorhanden:** Wohngeld-Antrag, Rentenbescheid (Marion), Kontoauszug (Siegfried), Mietvertrag.
**Fehlend (leiten Nachforderungen aus):** Personalausweis P1, Personalausweis P2,
Rentenbescheid P1, Verdienstbescheinigung/Gehaltsabrechnungen P1, KV-/PV-Nachweise,
aktuelle Kontoauszüge mit Mietzahlungen.

---

## 5. Erwartete Prüfschritte (Soll-Ergebnis der Engine)

Typ: `anforderung` (Nachforderung nötig) | `info` (Hinweis). Status initial: `offen`.
Kategorie: `vollstaendigkeit` (fehlender Nachweis) | `plausibilitaet` (Widerspruch).

### Personenübergreifend / Antrag
| ID (erwartet) | Titel | Typ | Kategorie | Begründung (Beleg) |
|---|---|---|---|---|
| antrag-unterschrift | Unterschrift/Datum Antrag | anforderung | vollstaendigkeit | Antrag auf S. 11 ohne Datum unterschrieben (D1) |
| essenzielle-angaben | Essenzielle Angaben im Antrag | anforderung | vollstaendigkeit | Pflichtangaben unvollständig |

### P1 — Siegfried Petermann
| ID (erwartet) | Titel | Typ | Kategorie | Begründung |
|---|---|---|---|---|
| ausweis-p1 | Personalausweis | anforderung | vollstaendigkeit | Identitätsnachweis fehlt |
| miethoehe | Miethöhe | anforderung | plausibilitaet | Mietvertrag 690 € vs. Antrag 704 € — Differenz 14 € (D4) |
| wohnflaeche | Wohnfläche | anforderung | plausibilitaet | Antrag 63 m² vs. Mietvertrag 120 m² (D4) |
| mietzahlung | Mietzahlung | anforderung | plausibilitaet | Kontoauszug (2019) belegt keine Mietzahlungen (D3) |
| rente-p1 | Rentenbescheid | anforderung | vollstaendigkeit | Aktueller Rentenbescheid P1 fehlt |
| erwerbseinkommen-p1 | Verdienstbescheinigung/Gehaltsabrechnungen | anforderung | vollstaendigkeit | Lohn/Gehalt angegeben, Nachweis fehlt |
| kapitalertraege-p1 | Kapitalerträge | anforderung | plausibilitaet | Dividende im Kontoauszug, im Antrag keine Kapitalerträge (D3) |
| kv-pv-p1 | Kranken-/Pflegeversicherung | anforderung | vollstaendigkeit | Nachweis Versicherung fehlt |
| kv-pv-zahlung-p1 | Zahlung zur Kranken-/Pflegeversicherung | anforderung | vollstaendigkeit | Beitragszahlung nicht belegt |

### P2 — Marion Henriette Petermann
| ID (erwartet) | Titel | Typ | Kategorie | Begründung |
|---|---|---|---|---|
| ausweis-p2 | Personalausweis | anforderung | vollstaendigkeit | Identitätsnachweis fehlt |
| grundrentenzeiten-p2 | Grundrentenzeiten | anforderung | vollstaendigkeit | Rentenanpassungsbescheid ohne Grundrentenzeiten (D2) |

> Diese Soll-Liste ist der Kern-Testfall. In Phase 1 wird sie als erwartetes Ergebnis
> (`expected pruefschritte`) gegen den Output der Regel-Engine geprüft. IDs/Details werden nach
> Vorliegen des Regel-Katalogs (`docs/wohngeld-regelkatalog-2026-09-18.md`) final abgeglichen.

---

## 6. Erwartetes Anforderungsschreiben (Soll)

- **Betreff:** „Ihr Wohngeldantrag vom 12.08.2026 — fehlende Nachweise"
- **Art:** Erstanforderung · **Frist:** 09.09.2026
- **Gliederung je Person**, je offener `anforderung`-Prüfschritt ein begründeter Absatz.
- Export als Word/PDF.
