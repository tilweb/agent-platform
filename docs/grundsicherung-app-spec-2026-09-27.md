# Grundsicherung — Antragsprüfungs-App (Spec, 2026-09-27)

Schritt 3 aus `docs/antragspruefung-architektur-konzept-2026-09-27.md`. Gebaut nach
`docs/antragspruefung-muster.md` auf dem Antrag-Kern (`apps/_antrag-kern`). Fachliche Grundlage:
`docs/grundsicherung-regelkatalog-2026-09-27.md` (147 Regeln, 29 Dokumenttypen).

## Auftrag und Grenzen

- Grundsicherung im Alter und bei Erwerbsminderung (SGB XII, 4. Kapitel). Kernmehrwert:
  Vollständigkeit und Plausibilität der Unterlagen prüfen und managen.
- **Keine Berechnung** von Bedarf oder Zahlbetrag (macht das Fachverfahren). Regelbedarfsstufe,
  Schonbetrag, Altersgrenze nur als Prüfmerkmal.
- Menschen entscheiden; alle Befunde sind Vorschläge. Vermögen über dem Schonbetrag, Hinweise auf
  herbeigeführte Bedürftigkeit usw. sind immer `info` bzw. „Sachbearbeitung prüft", nie Ablehnung.
- **Erster Wurf bewusst schmal:** die häufigen Fälle (Wohnung zur Miete oder im Eigentum, allein
  oder als Paar, Rente als Haupteinkommen) vollständig; Sonderwelten nur als Hinweis
  „außerhalb des Prüfumfangs" (Einrichtung/besondere Wohnform, WfbM, Selbständige,
  Aufenthaltsrecht im Detail, Schenkungsrückforderung, Kfz-Angemessenheit).

## Unterschiede zu Wohngeld, die das Datenmodell prägen

| Thema | Wohngeld | Grundsicherung |
|---|---|---|
| Personenkreis | Haushalt (§ 5 WoGG) | **Einsatzgemeinschaft** (Antragsteller + Partner) plus Haushaltsangehörige nur für Kopfteil der Wohnkosten |
| Anspruchsgrund | — | **Alter** (Altersgrenze nach Jahrgang) oder **dauerhafte volle Erwerbsminderung** (Feststellung RV) |
| Wohnkosten | Bruttokaltmiete + Heizkosten | **Kaltmiete, kalte Nebenkosten, Heizkosten getrennt**, Warmwasser zentral/dezentral |
| Einkommen | Jahresprognose § 14 ff. | Monatlich im Zuflussmonat; Rentenanpassung zum 01.07. |
| Vermögen | Freigrenze 60.000/30.000 € | Schonbetrag 10.000 € je Person der Einsatzgemeinschaft |
| Mehrbedarfe | — | Merkzeichen G, kostenaufwändige Ernährung (erster Wurf) |
| Unterhalt | Unterhaltsleistungen | Kinder/Eltern nur bei > 100.000 € (§ 94 Abs. 1a) — nur Angabe erheben |

## Datenmodell

Eigenes Schema `grundsicherung`, Präfix `gs`, Migration `0048_grundsicherung.sql`.

- `akten`, `vorgaenge`, `personen`, `dokumente`, `pruefschritte`, `schreiben`, `textbausteine`,
  `chat_messages` (für später), `aktivitaeten` — Spalten wie Wohngeld, fachliche Details im `data`-jsonb.
- Aus dem Kern über Fabriken: `audit_log`, `ki_verbrauch`, `posteingang`, `feld_status`, `notizen`.
- **Vorgang** (fachlich): `antragsart` (erstantrag | weiterbewilligung | aenderung), `antragsdatum`,
  `anspruchsgrund` (alter | erwerbsminderung), `wohnsituation` (miete | untermiete | eigentum |
  bei_angehoerigen | einrichtung), `wohnung` { kaltmiete, nebenkosten_kalt, heizkosten,
  warmwasser: zentral|dezentral, wohnflaeche_qm, bewohner_anzahl, heizung_in_miete_enthalten },
  `bwz` { start, ende } (12 Monate ab Monatserster des Antragsmonats, nur Vorschlag),
  `ersteingang` { datum, stelle } (§ 16 Abs. 2 SGB I), `aktenzeichen` (Fachverfahren),
  `vorbezug`, `wohngeld_antrag_laeuft`, Kern-Felder (Status, Sachbearbeitung, Aufbewahrung, Legal
  Hold, Einschränkung, Labels, Todos, Fristen).
- **Person**: `rolle` (antragsteller | partner | haushaltsangehoerig), `familienstand`
  (ledig | verheiratet | getrennt_lebend | geschieden | verwitwet | lebenspartnerschaft |
  eheaehnlich), Name, Geburtsdatum, Staatsangehörigkeit, `betreuung` (keine | betreuung | vollmacht),
  `erwerbsminderung` { voll, dauerhaft, befristet_bis, arbeitsmarktabhaengig, feststellung_rv },
  `schwerbehinderung` { gdb, merkzeichen[], gueltig_bis }, `mehrbedarf_ernaehrung`,
  `krankenversicherung` { art: pflicht|familie|freiwillig|privat|keine, kasse, beitrag },
  `einkommen[]` { art, betrag_monat, traeger }, `vermoegen[]` { art, betrag, schonvermoegen? },
  `unterhalt_kinder_eltern` { angegeben, ueber_100k_moeglich }.
- **Dokumenttypen (erster Wurf, 20):** grundsicherungsantrag, personalausweis, betreuerausweis,
  rentenbescheid, rentenanpassungsmitteilung, em_feststellung_rv, betriebsrente_mitteilung,
  kontoauszug, mietvertrag, vermieterbescheinigung, nebenkostenabrechnung, energieabrechnung,
  eigentum_nachweis, vermoegensnachweis, bestattungsvorsorge, kv_pv_nachweis,
  schwerbehindertenausweis, aerztliche_bescheinigung, wohngeldbescheid, transferleistungsbescheid,
  sonstiges. Übrige Katalog-Typen laufen im ersten Wurf als `sonstiges`.

## Prüfregeln (erster Wurf)

IDs aus dem Katalog; Beschreibung jeder Regel im Regelkatalog der App (`checker/regeln.ts`,
Wächter-Test). Altersgrenzen-Tabelle § 41 Abs. 2 als Code mit Tests.

**Vollständigkeit (27):** antrag-vollstaendig-unterschrieben · identitaet-jede-person ·
bankverbindung · betreuung-bestellungsurkunde · vollmacht-bevollmaechtigte ·
anspruchsgrund-alter-nachweis · em-rentenbescheid-unbefristet · em-feststellung-rv · mietvertrag ·
mietbescheinigung-aktuell · nebenkostenabrechnung · heizkosten-nachweis · mietzahlungsnachweis ·
eigentum-kostenaufstellung · kv-pv-nachweis · rentenbescheid · rentenanpassungsmitteilung ·
betriebsrente-nachweis · wohngeldbescheid · schwerbehindertenausweis-g ·
ernaehrung-aerztliche-bescheinigung · vermoegenserklaerung · kontoauszuege ·
lebensversicherung-rueckkaufswert · bestattungsvorsorge-vertrag · angaben-kinder-eltern ·
kein-einkommen-erklaerung

**Plausibilität (20):** plausi-altersgrenze-nicht-erreicht · plausi-altersgrenze-folgemonat ·
plausi-geburtsdatum-abweichung · plausi-em-rente-befristet ·
plausi-em-rente-teilweise-oder-arbeitsmarkt · plausi-partner-fehlt ·
plausi-regelbedarfsstufe-inkonsistent · plausi-miete-abweichung · plausi-miete-nicht-gezahlt ·
plausi-heizung-in-miete-unklar · plausi-rente-abweichung · plausi-rentenanpassung-fehlt ·
plausi-kontoauszug-unerklaerte-eingaenge · plausi-wohngeld-als-einkommen ·
plausi-vermoegen-ueber-schonbetrag · plausi-kontostand-abweichung · plausi-grosse-abgaenge ·
plausi-merkzeichen-g-nicht-beantragt · plausi-ausweis-abgelaufen · plausi-antrag-ohne-datum

**Vorrang-Hinweise (5, alle `info`, ohne Rechnung):** vorrang-wohngeldbescheid-liegt-vor ·
vorrang-wohngeld-antrag-parallel · vorrang-vermoegen-ueber-schonbetrag ·
vorrang-weiterleitung-antragsdatum · vorrang-sgb2-statt-sgb12

**Außerhalb des Prüfumfangs (1, `info`):** `ausserhalb-pruefumfang` bei Wohnsituation Einrichtung/
besondere Wohnform, WfbM, Selbständigkeit — mit Hinweis, dass die Sachbearbeitung diese Teile
manuell prüft.

Schwellen, die die Kommune festlegt (Kontoauszug-Zeitraum, „große Abgänge", Richtwerte), sind
Konstanten mit Env-Override `GRUNDSICHERUNG_*` und im Regelkatalog als „kommunal festzulegen"
gekennzeichnet. Richtwert-Regeln (KdU-Angemessenheit) kommen erst mit Pilotkommune.

## Posteingang und Erkennung

- Kern-Posteingang mit Grundsicherungs-Hooks; DP-Segmentprofil `grundsicherung-eingang`
  (Vorlage `extraction/templates/grundsicherung-eingang.ts`, Muster wie `wohngeld-eingang.ts`)
  mit den 20 Dokumenttypen und den Feldern aus Katalog Abschnitt 6.
- Zuordnung/Verteilung wie Wohngeld: neuer Vorgang oder Nachreichung, Antragsdaten füllen leere
  Felder, Nachweise werden Personen zugeordnet, danach Auto-Prüfung. Match über Name + Geburtsdatum.
- Posteingang-Quelle `weiterleitung` mit Ersteingangsdatum der ersten Stelle → Vorgang
  `ersteingang` (§ 16 Abs. 2 SGB I).

## Oberfläche

Nach Muster: Einstieg (Vorgänge · Akten · Aufgaben · Prüfregeln · Löschfällig), Posteingang
(Liste/Detail), Vorgangsseite mit Reitern **Übersicht · Schreiben · Protokoll · KI-Verbrauch**
und Seitenleiste **Details · Prüfschritte · Dokumente**. Übersicht-Abschnitte: Antrag &
Anspruchsgrund · Personen der Einsatzgemeinschaft (PersonCard mit Einkommen, Vermögen,
Versicherung, Schwerbehinderung/Mehrbedarf, Unterhalt Kinder/Eltern) · Haushaltsangehörige ·
Wohnung und Heizung · Vorrang & Verfahren (Ersteingang, Wohngeld-Bezug, Vorbezug).
Schreiben: Nachforderung nach § 60 SGB I mit Frist und Rechtsfolgenbelehrung § 66 SGB I
(Export PDF/Word über den bestehenden documentGenerator).

## Wellen

| Welle | Inhalt | Abnahme |
|---|---|---|
| **G1** | Schema + Migration 0048, Typen, Storage, App-Registrierung, Kern-Adapter (Audit, KI-Verbrauch, Aufbewahrung, Rollen, Feldstatus, Notizen), Routen Akten/Vorgänge/Personen/Dokumente/Prüfschritte/Textbausteine/Audit/Sachbearbeitung/Aufgaben | Tests, Typecheck, Migration lokal angewendet |
| **G2** | Regel-Engine (Vollständigkeit, Plausibilität, Vorrang), Altersgrenze, Regelkatalog + Wächter, 3 Goldfälle als Abnahmetest | Goldfall-Tests grün |
| **G3** | Posteingang (Kern-Routen + Hooks), DP-Profil-Vorlage, Extraktion/Erkennung, Verteilung/Match, Schreiben-Generator + Export, Demo-Seed (3 Fälle) | Tests, Seed lokal, Posteingang-Smoke |
| **G4** | Frontend (alle Seiten nach Muster), Routen in App.jsx | Lint, Build, Klick-Smoke |
| **G5** | Vorrang in beiden Apps: Grunddaten-Vertrag (`grunddatenFuerVorrangpruefung`) je App mit Test; Spiegelregeln in Wohngeld (`vorrang-grundsicherungsbescheid-bei-wohngeld`, `vorrang-grundsicherung-mitpruefen`) | Tests beider Apps |

Später (nicht in diesem Wurf): Fall-Chat mit SGB-XII-Korpus, Richtwert-Regeln, Vorrang-
Einschätzung (Pilot), Einrichtungsfälle, restliche Katalog-Regeln.

## Goldfälle (Abnahme G2)

1. **Alleinstehende Rentnerin, Miete:** Altersrente 780 €, Rentenbescheid 2025 (Anpassung 2026
   fehlt), Kontoauszug mit nicht angegebener Betriebsrente, Heizkosten in Pauschalmiete.
   Erwartet u. a.: rentenanpassungsmitteilung, plausi-kontoauszug-unerklaerte-eingaenge,
   plausi-heizung-in-miete-unklar, betriebsrente-nachweis.
2. **Paar, Antragsteller 58 J., EM-Rente befristet:** Partnerin nicht im Antrag, aber
   Mitmieterin. Erwartet: plausi-em-rente-befristet, em-feststellung-rv, plausi-partner-fehlt,
   vorrang-sgb2-statt-sgb12.
3. **Rentner mit Wohngeld und Sparbuch 14.200 €:** Wohngeldbescheid liegt bei, Wohngeld nicht
   als Einkommen angegeben. Erwartet: vorrang-wohngeldbescheid-liegt-vor,
   plausi-wohngeld-als-einkommen, plausi-vermoegen-ueber-schonbetrag,
   vorrang-vermoegen-ueber-schonbetrag.
