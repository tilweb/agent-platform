# Wohngeld — Abgleich Antragsangaben ↔ Belege (Spec, 2026-09-28)

**Muster-Änderung:** Wohngeld prüft Widersprüche zwischen Antrag und eingereichten Belegen jetzt so
gründlich wie die Grundsicherung (`grundsicherung/checker/plausibilitaet.ts`). Vorher verglich Wohngeld
nur Miete/Wohnfläche (Antrag ↔ *erstes* Mietdokument), die Mietzahlung (ja/nein) und
Einkunfts-*Arten* auf dem Kontoauszug.

Code: `backend/src/apps/antragspruefung/wohngeld/checker/abgleich.ts` (Regeln),
`checker/konstanten.ts` (Toleranzen), `checker/regeln.ts` (Katalog, Stand `2026-09-28`),
`types.ts` (DokumentAnalyse-Vertrag), `dp-erkennung.ts` (Abbildung),
`extraction/templates/wohngeld-eingang.ts` (Profil-Vorlage `2026-09-28`).
Tests: `checker/abgleich.test.ts`, `dp-erkennung.test.ts`.

## 1. Grundsätze

- **Keine Berechnung.** Verglichen werden gleichartige Größen (Brutto mit Brutto, Bruttokalt mit
  Bruttokalt, Monatswert mit Monatswert). Wohngeld rechnet mit dem Brutto-Jahreseinkommen (§ 14 WoGG);
  die Regeln normalisieren nur die Frequenz (jährlich ÷ 12), sie berechnen nichts.
- **Beide Seiten müssen einen Wert haben.** Nicht erkannt ⇒ Feld fehlt ⇒ Regel schweigt. Einzige
  Ausnahme mit Begründung: Vermögen, siehe 2.4.
- **Belegtext nennt beide Werte und die Quelle** (Dokument, Monat bzw. „gültig ab"),
  `quellDokumentId` ist gesetzt, personenbezogene Befunde tragen `personId`.
- **Aktuellster Beleg ist maßgeblich**; ältere Unterlagen werden nicht als Widerspruch gewertet.
- Toleranzen sind Verwaltungspraxis („kommunal festzulegen"), per `WOHNGELD_<NAME>` überschreibbar.

## 2. Abgleiche

| Regel-ID | Antrag (Quelle) | Beleg (Quelle) | Toleranz | Typ |
|---|---|---|---|---|
| `plausi-miethoehe-abweichung` (überarbeitet) | `vorgang.wohnung.miete` (Bruttokalt aus Frage 23/24 via `bruttokalt()`) | `analyse.miete` des **maßgeblichen** Mietdokuments | 1 € (`MIETE_TOLERANZ_EUR`), 0 % | anforderung |
| `plausi-wohnflaeche-abweichung` (überarbeitet) | `wohnung.wohnflaeche_qm` | `analyse.wohnflaeche_qm` des maßgeblichen Dokuments mit Fläche | 0,01 m² (unverändert) | info |
| `plausi-mietzahlung-abweichung` (neu) | `wohnung.miete` (+ Heiz-/WW-Kosten aus Antrag oder Mietdokument) | Kontoauszug `mietzahlung_betrag` | 1 € | info |
| `plausi-rente-abweichung` (neu, ID wie GS) | `person.einkommen[art=rente]`, Monatswert, ohne Betriebs-/Zusatz-/Privatrente/Pension | Rentenbescheid/Anpassung `betrag` (Bruttorente), neuester je Rentenart | 1 € (wie GS) | anforderung |
| `plausi-rente-zahlbetrag-pruefen` (neu) | wie oben | Rentenbescheid nur `zahlbetrag` | Antrag muss in [Zahlbetrag − 1 €; Zahlbetrag × 1,15 + 1 €] liegen | info |
| `plausi-einkommen-abweichung:lohn_gehalt` (neu) | `einkommen[art=lohn_gehalt]`, Monatswert, ohne Einmal-/Sonderzahlung und Kurzarbeitergeld | Gehaltsabrechnungen (`betrag` = Gesamtbrutto, je Monat über Arbeitgeber summiert); sonst Verdienstbescheinigung (`einkommensart = lohn_gehalt`) | 5 %, mind. 10 € | anforderung |
| `plausi-einkommen-abweichung:alg1/krankengeld/elterngeld` (neu) | `einkommen[art]` | Lohnersatzbescheid mit erkannter `einkommensart` | 5 %, mind. 10 € | anforderung |
| `plausi-kontoauszug-unerklaerte-eingaenge` (neu, ID wie GS) | Einkommensarten aller Haushaltsmitglieder; Arbeitgeber aus Lohnnachweisen | Kontoauszug `eingaenge[]` (Absender, Betrag, Art, wiederkehrend) über alle Auszüge der Person | — | anforderung |
| `plausi-vermoegen-beleg-abweichung` (neu) | erfasstes Vermögen (`haushaltsVermoegen`) bzw. Frage 20 „Nein" | Vermögensnachweise `betrag` + letzter positiver `endsaldo` je Konto | 10 %, mind. 250 € (wie GS); bei „Nein": Freigrenze | anforderung |
| `plausi-geburtsdatum-abweichung` (neu, ID wie GS) | `person.geburtsdatum` | `analyse.person_geburtsdatum` der Person zugeordneter Belege | exakt | anforderung |
| `plausi-name-abweichung` (neu) | `person.vorname/nachname/geburtsname` | `analyse.person_vorname/nachname` (Ausweis, Renten-, Lohn-, KV-, SB-, Pflegenachweis) | 1 Buchstabe (Lesefehler) | info |
| `plausi-mieter-nicht-im-haushalt` (neu; Pendant zu GS `plausi-partner-fehlt`) | Haushaltsmitglieder (Name/Geburtsdatum) | Mietvertrag `mieter[]` | 1 Buchstabe | info |

### 2.1 Miete

- **Maßgebliches Mietdokument** unter allen Dokumenten vom Typ Mietvertrag/Mietbescheinigung mit
  Wert: späteres „gültig ab" (`miete_gueltig_ab`: Mietbeginn, Mieterhöhung ab, „Miete seit") gewinnt;
  ohne vergleichbare Daten Vermieterbescheinigung > Mieterhöhung > Mietvertrag; sonst das spätere im
  Vorgang. Ein Untermietvertrag zählt nur, wenn kein anderes Mietdokument vorliegt (sonst ist die
  antragstellende Person meist Untervermieterin, F25).
- **Bruttokalt korrekt**: Mietvertrag = Grundmiete + kalte Nebenkosten, wenn beide gelesen sind
  (vorher bevorzugt Gesamtmiete − Heizung − Warmwasser, anfällig, wenn die „Gesamtmiete" schon ohne
  Heizung gelesen wurde); Vermieterbescheinigung/Antrag über `bruttokalt()`; Mieterhöhung neue
  Gesamtmiete − Heiz-/WW-Anteil.
- **Lesefehler Gesamt- statt Bruttokaltmiete**: entspricht die Differenz (± Toleranz) genau den
  Heiz-/Warmwasserkosten (Beleg oder Antrag), gibt es keinen Befund.
- **Toleranz** bewusst nur Rundung (1 €): Wohngeld rechnet unmittelbar mit der Miete; die
  Grundsicherungs-Toleranz (5 %/10 €) hätte z. B. den Goldfall Petermann (704 ↔ 690 €) verschluckt.
- **Mietzahlung**: passt, wenn die Abbuchung der Bruttokaltmiete oder Bruttokalt + Heiz-/WW-Kosten
  entspricht. Ohne bekannte Heizkosten nur „zu niedrig" melden. Nur `info` (Nachzahlungen, Garage).
- Unverändert: `plausi-mietvertrag-unsigniert` prüft weiter das erste Mietdokument.

### 2.2 Einkommen je Person

- Monatswert der Antragsposition: `betrag_monatlich`, sonst `betrag_jaehrlich / 12`. Fehlt bei einer
  einschlägigen Position der Betrag, ist die Angabe unvollständig ⇒ kein Vergleich.
- **Erwerb**: maßgeblich ist der aktuelle Stand — gemeldet wird nur, wenn sowohl der **letzte
  Abrechnungsmonat** als auch der **Durchschnitt der letzten drei** abweichen (Kurzarbeit F29,
  schwankende Zuschläge). Mehrere Beschäftigungen nur mit lesbaren Abrechnungsmonaten (Summe je Monat).
- **Rente**: je Rentenart (Alter, Hinterbliebene, Waise, EM) der neueste Bescheid (`betrag_gueltig_ab`),
  Antragspositionen derselben Art; bei nur einer Art zählen auch unbestimmte Bezeichnungen („Rente").
- **Lohnersatz**: nur mit erkannter Leistungsart (`leistungsart` → `einkommensart`); der Abschnitt
  `lohnersatzbescheid` wird als Typ `verdienstbescheinigung` eingeordnet, daher zählt eine
  Verdienstbescheinigung nur mit `einkommensart = lohn_gehalt` als Lohnnachweis (sonst würde ein
  Steuerbescheid mit Jahreswert als Monatslohn gelesen).
- **Kontoeingänge**: Absender je Person über alle Auszüge zusammengefasst; gemeldet werden
  wiederkehrende (Flag, Anzahl > 1 oder auf mehreren Auszügen) Eingänge, die keine Einkommensart im
  Antrag erklärt; Kapitalerträge/Mieteinnahmen auch einmalig. **Arbeitgeber-Abgleich**: ein
  Erwerbseingang von einem Absender, der zu keinem Arbeitgeber der Lohnnachweise passt, wird gemeldet —
  aber nur, wenn jede Person mindestens so viele nachgewiesene Arbeitgeber wie angegebene
  Beschäftigungen hat (sonst meldet schon die Vollständigkeit bzw. der Einkommensabgleich). Liegt die
  Eingangsliste vor, ersetzt sie die alten Ja/Nein-Flags (`plausi-kontoauszug-unerklaerte-einkuenfte`
  entfällt für diesen Auszug).

### 2.3 Identität

Geburtsdatum aller der Person zugeordneten Belege (Ausweis, Rentenbescheid …); Name nur bei Belegen,
die die Person selbst benennen (nicht Kontoauszug — gemeinsames Konto „Dennis und Laura Hoffmann" —,
nicht Kindergeld-/Unterhaltsbescheid). Geburtsname und ein abweichender Buchstabe (Lesefehler
„Altmeyer/Altmayer", F09) gelten nicht als Abweichung. Hinweis: der Posteingang ordnet Belege mit
abweichendem Geburtsdatum gar nicht automatisch zu; der Befund entsteht daher vor allem nach
manueller Zuordnung.

### 2.4 Vermögen

Frage 20 des Antrags fragt, ob Vermögen **über der Freigrenze** besteht; bei „Nein" ist kein Vermögen
erfasst. Deshalb zwei Fälle:
- **Vermögen erfasst**: Befund, wenn die Belege mehr als 10 % (mind. 250 €) darüber liegen. Weniger
  Guthaben ist kein Widerspruch (Vermögen auf Konten ohne Auszug).
- **Nichts erfasst** und ein Wohngeldantrag liegt vor (Frage 20 ist Pflichtfrage): Befund nur, wenn die
  Belege die Freigrenze (60.000 € + 30.000 € je weiterem Mitglied) übersteigen — genau dann
  widersprechen sie dem „Nein" (F22).
- Konten ohne lesbare IBAN gelten als **ein** Konto (letzter Saldo), damit Monatsauszüge nicht doppelt
  zählen. `plausi-vermoegen-ueber-freigrenze` bleibt eigene Regel und rechnet nur mit erfasstem Vermögen.

### 2.5 Haushalt ↔ Mietvertrag

Mieter:innen im Kopf des Mietvertrags (nicht Untermietvertrag), die keinem Haushaltsmitglied
entsprechen (Vorname + Nachname/Geburtsname, oder Geburtsdatum) ⇒ `info`: lebt die Person noch in der
Wohnung (Haushaltsmitglied mit Einkommen) oder ist sie ausgezogen/verstorben?

## 3. Bewusst nicht

- **Keine Berechnung** von Jahreseinkommen, Freibeträgen oder Wohngeld; keine Hochrechnung von
  Netto auf Brutto (Kontoeingänge werden nur nach Art/Absender, nicht nach Höhe mit dem Brutto
  verglichen; der Rentenzahlbetrag nur als Spannen-Hinweis).
- **Steuerbescheid/EÜR** (Selbständige): Vorjahresgewinn und Prognose sind nicht gleichartig.
- **Unterhalt, Kindergeld**: Unterhaltsnachweise sind mehrdeutig (gezahlt oder erhalten), Kindergeld
  ist kein Einkommen nach WoGG.
- **Zuschüsse Dritter** (Frage 26) und Untervermietung (Fragen 28/29) liest das Profil nicht aus; ein
  Untermietvertrag erklärt Untermieteinnahmen auf dem Konto.
- **Meldebescheinigung**: kein eigener Dokument-/Abschnittstyp — erst mit neuem Typ möglich.
- **Legacy-Erkennung** (`WOHNGELD_ERKENNUNG=legacy`, `extraction-schema.ts`) liefert die neuen Felder
  nicht; die Regeln schweigen dort (kein Fehlalarm).

## 4. Datenvertrag und Profil

`DokumentAnalyse` (types.ts), alle Felder optional: `person_vorname/_nachname/_geburtsdatum`,
`mietdokument`, `miete_gueltig_ab`, `heizkosten_warmwasser`, `mieter[]`, `einkommensart`,
`abrechnungsmonat`, `arbeitgeber`, `rentenart`, `zahlbetrag`, `betrag_gueltig_ab`, `iban`,
`zeitraum_bis`, `endsaldo`, `mietzahlung_betrag`, `eingaenge[]` (`KontoEingang`).

Profil-Vorlage `WOHNGELD_PROFIL_VORLAGE_STAND = 2026-09-28` — neue Felder:
Vermieterbescheinigung `miete_seit`; Mietvertrag `mietbeginn`, `mieter[]`; Mieterhöhung `gueltig_ab`;
Gehaltsabrechnung `abrechnungsmonat`, `arbeitgeber`; Verdienstbescheinigung `arbeitgeber`;
Lohnersatzbescheid `leistungsart`; Rentenbescheid `geburtsdatum`, `zahlbetrag`, `gueltig_ab`
(Beschreibung von `betrag`: Spalte „neu"); Kontoauszug `iban`, `zeitraum_bis`, `endsaldo`,
`mietzahlung_betrag`, `eingaenge[]`. Unbearbeitete Profile werden beim nächsten `ladeProfil()`
angehoben (Vorlagen-Marke); gepflegte Profile brauchen die Übernahme in der DP-Oberfläche.

Die Extraktions-Übersicht (`baueExtraktionsUebersicht`) zeigt die neuen Werte in der Gruppe „Analyse".

## 5. Messung (Golden-Datensatz Wohngeld, 30 Fälle)

Befundzählung wie `werteBefundeAus` (je Fall und Regel-ID, Mehrfachmeldungen zusammengefasst).
„Fehlalarm" = App-Befund, der weder erwartet noch als bekannt vermutet ist.

**Erwartungen angepasst (fachlich eindeutig, vorher als `befundeOhneAppRegel` dokumentiert):**
- F21: nicht angegebener Minijob-Eingang (Gaststätte, 480 €, Juli + August) → `plausi-kontoauszug-unerklaerte-eingaenge`.
- F22: Frage 20 „Nein" ↔ Depotauszug 140.216,84 € → `plausi-vermoegen-beleg-abweichung`.
Beide in `expected/*.json` und in der Fallquelle `tools/wohngeld-golden/src/faelle/F21.ts`/`F22.ts`
(Generator-Konsistenztest grün). Übrige Erwartungen unverändert.

| Stufe | Stand | Treffer | Verfehlt | Fehlalarme |
|---|---|---|---|---|
| Regelwerk (30 Fälle, erwartete Werte, ohne KI) | vorher | 47 | 3 (5 gegen neue Erwartung) | 13 |
| | nachher | 49 | 3 | 12 |
| Posteingang, gespeicherte Profil-Ergebnisse vom 24.09. (30 × digital + scan, ohne KI; ohne neue Felder) | vorher | 93 | 7 (11 gegen neue Erwartung) | 70 |
| | nachher | 97 | 7 | 70 |
| Posteingang **live** mit Profil-Vorlage 2026-09-28 (8 Fälle digital: F02, F04, F18, F21, F22, F25, F27, F29) | vorher (alte Regeln, alte Ergebnisse) | 8 | 3 (5 gegen neue Erwartung) | 13 |
| | nachher | 12 | 1 | 6 |

Neue echte Treffer: **F18** Miethöhe (Vermieterbescheinigung/Mieterhöhung 777 € ↔ Antrag 710 €; vorher
nur mit dem alten Mietvertrag verglichen — jetzt in allen drei Stufen), **F21** Minijob-Eingang
(Arbeitgeber ohne Nachweis, Juli + August), **F22** Depot über der Freigrenze trotz „Nein".
Keine neuen Fehlalarme: auf den 8 Live-Fällen sinken sie von 13 auf 6 (die Eingangsliste ersetzt die
unzuverlässigen Ja/Nein-Flags; F25 Untermiete ist über den Untermietvertrag erklärt; F29 Zuschuss der
Großmutter wird nicht mehr als Mieteinnahme gemeldet). Die verbleibenden Fehlalarme sind bekannt und nicht
Gegenstand dieser Änderung (`plausi-mietvertrag-unsigniert` bei digitalen PDFs, `identitaet-jede-person`,
`vorrang-grundsicherung-mitpruefen`). Einkommens-, Renten-, Identitäts- und Mieter-Abgleiche meldeten auf
allen korrekt gelesenen Fällen nichts (z. B. F04 Renten 1.318,40/742,90 € brutto, F29 Kurzarbeit — vor
der Regel „letzter Monat UND Dreimonatsschnitt" hätte F29 im Regelwerk einen Fehlalarm erzeugt).

Verbleibend verfehlt: F22 `plausi-vermoegen-ueber-freigrenze` (rechnet absichtlich nur mit erfasstem
Vermögen; greift, sobald die Sachbearbeitung den Depotwert erfasst), im Regelwerk außerdem F12 (bekannt)
und F21 (die Erwartungsdatei enthält keine Kontoeingänge).

Extraktion der neuen Felder (Live, 8 Fälle): Mietdokument-Art, „gültig ab", Heizkosten, Mieter,
Abrechnungsmonat, Arbeitgeber, Rentenart/Zahlbetrag/gültig ab, IBAN, Endsaldo, Mietzahlung und
Eingänge wurden in allen geprüften Belegen gelesen. Auffällig: die Mieterliste enthält die Namen aus dem
Unterschriftenblock doppelt (unschädlich); die Art eines Eingangs schwankt zwischen Auszügen (daher die
Absender-Regel oben).

Aufwand: 8 Sammel-PDFs, 198 LLM-Aufrufe (Profil-Extraktion, `audit.usage_log` source `extraction`),
≈ 17 Minuten. Token-Zahlen werden für die Extraktion nicht protokolliert (Felder leer).
Reproduktion: `bun run scripts/wohngeld-golden/messung.ts --stufen regelwerk` bzw. `--erkennung profil
--faelle …`; die Cache-Auswertung ohne KI lief über ein Hilfsskript auf `out/messung/cache/profil`
(Lauf 2026-09-24T05-40-28). Nebenwirkung: `ladeProfil()` hat das unbearbeitete lokale DP-Profil auf die
Vorlage 2026-09-28 angehoben.
