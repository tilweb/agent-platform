# Leitfaden: Fälle anlegen

Grundlage ist der Fallkatalog `docs/wohngeld-golden-dataset-fallkatalog-2026-09-23.md` (Abschnitt 4).
Muster-Fälle: `src/faelle/F01.ts` (sauber), `F18.ts` (Widerspruch), `F30.ts` (Störungen).

## Datei und Registrierung

- Eine Datei je Fall: `src/faelle/Fnn.ts` mit `export const Fnn: Fall = { id: 'Fnn', … }`.
- Registrierung passiert automatisch (Dateiname). Nichts in `index.ts` eintragen.
- Erzeugen und prüfen: `bun run src/cli.ts Fnn` (mit Scan) bzw. `--ohne-scan`, dann `bun test`.

## Daten

- **Personen:** `personen[0]` ist die antragstellende Person (`id: 'P1'`), weitere `P2`, `P3` … mit `verhaeltnis`
  („Ehefrau", „Sohn", „Tochter", „Lebensgefährte" …). Kontoauszüge laufen auf P1 und Ehe-/Lebenspartner.
- **Einnahmen** (`einnahmen`) sind die Antragsangaben (Formulartext). Gehaltsabrechnungen brauchen `beschaeftigung`;
  das Monatsbrutto kommt aus der ersten Einnahme mit „Gehalt/Lohn/Minijob/Vergütung/Entgelt/geringfügig" im Text.
  Renten brauchen `rente`. Kinder ohne Einkommen: `einnahmen: []` (Formular: „keine Einnahmen").
- **Ausweise:** Erwachsene mit Personalausweis-Kopie brauchen `ausweis`. Kinder bekommen keinen Ausweis.
- **Wohnung/Miete:** Gesamtmiete = grundmiete + nebenkosten + heizkosten + warmwasser. Erwartete Miete in der
  App ist die **Bruttokaltmiete** (ohne Heizung/Warmwasser/Garage/Haushaltsenergie) — rechnet der Generator.
- **Realismus 2026:** Mindestlohn 13,90 €/h, Minijob-Grenze 603 €, Kindergeld 259 €, Regelaltersrente meist
  900–1.600 € brutto; Haushalte sollen wohngeldtypisch sein (geringes bis mittleres Einkommen, Miete passend
  zur Stadt). Jeder Fall in einer anderen realen Stadt, erfundene Straßen/Arbeitgeber/Vermieter, IBAN über
  `iban(blz, konto)` aus `../lib` mit erfundener BLZ.
- **Namen:** erfunden, vielfältig (auch Herkunft), keine Prominenten. Türkische/polnische Sonderzeichen sind
  erlaubt; das getippte Formular ersetzt sie automatisch (ş→s), Handschrift und Nachweise behalten sie.

## Antrag (`fall.antrag`, Typ `AntragAngaben` in `src/types.ts`)

- Jede Frage wird automatisch mit „Nein" beantwortet, außer sie ist in `fall.antrag` gesetzt.
- `handschrift: true` für die ✍-Fälle. `leer: ['flaeche', 'gesamtmiete', 'P2.geburtsdatum']` für bewusst leere Felder.
- `status: 'heim' | 'untermieter' | …`, `bevollmaechtigter` (Betreuer unterschreibt), `zahlungAn` (Auszahlung an Heim/Vermieter).
- Widersprüche zwischen Antrag und Wirklichkeit: `antragAbweichung` (gesamtmiete, heizkosten, flaeche).
  Die Nachweise zeigen immer die Wirklichkeit.
- `unterschrift: { antrag, antragDatum, mietvertrag }` steuert Unterschriften.

## Unterlagen (`fall.dokumente`, Reihenfolge = Reihenfolge in der Sammel-PDF)

Arten (`DokArt` in `src/types.ts`); Optionen je Art stehen als exportiertes Interface in der jeweiligen Datei:

| Familie | Datei | Arten |
|---|---|---|
| Formulare | `src/formulare/*.ts` | antrag, vermieterbescheinigung, unterhaltsanlage, zusatzblatt_haushalt |
| Basis | `src/nachweise/*.ts` | personalausweis, rentenbescheid, mietvertrag, kontoauszug, gehaltsabrechnung (variante normal/minijob/ausbildung/kurzarbeit), mieterhoehung, stromrechnung, hinweisblatt, leerseite |
| Bescheide | `src/nachweise/bescheide.ts` | kindergeldbescheid, uvs_bescheid, elterngeldbescheid, bafoeg_bescheid, buergergeld_bescheid, jobcenter_ablehnung, jobcenter_aufforderung, alg1_bescheid, pflegebescheid, sterbegeld_mitteilung, kita_gebuehrenbescheid |
| Karten | `src/nachweise/karten.ts` | aufenthaltstitel, schwerbehindertenausweis, kv_karte |
| Urkunden | `src/nachweise/urkunden.ts` | untermietvertrag, heimvertrag, betreuungsvereinbarung, abfindungsvereinbarung, betreuerausweis, sterbeurkunde, zuwendungserklaerung, unterhaltszahlung |
| Finanzen | `src/nachweise/finanzen.ts` | steuerbescheid, euer, kv_beitragsnachweis, depotauszug, verdienstbescheinigung |

- `person: 'P2'` bei personenbezogenen Unterlagen, `monat: '2026-07'` bei Abrechnungen/Auszügen.
- Kontoauszug-Optionen: `buchungen` (z. B. Kindergeld-, Unterhalts-, UVS-Eingänge; `{ tag, text, zweck, betrag }`,
  Abgänge negativ), `mieteBar`, `zusatzEingang`, `ohneGehalt`.
- Störungen je Unterlage: `seitenFehlen`, `seitenDoppelt`, `quer`.

## Erwartung (`fall.erwartung`)

- `befunde`: App-`regelId`s, die **fachlich** zu erwarten sind (Regeln: `backend/src/apps/wohngeld/checker/nachweise.ts`
  und `plausibilitaet.ts` lesen!). Standardbefund `bwz-vorschlag-pruefen` und die bekannten App-Übermeldungen
  (`krankenversicherung-nachweis` je Person ohne KV-Dokument, `identitaet-jede-person` für Kinder) trägt der
  Generator selbst ein — nicht in `befunde` aufnehmen. `identitaet-jede-person` für einen **Erwachsenen** ohne
  Ausweis gehört dagegen in `befunde`.
- `befundeOhneAppRegel`: fachlich erwartete Befunde ohne App-Regel, als kurzer deutscher Satz.
- `hinweise`: was der Fall prüft (für Menschen, die das Ergebnis lesen).
- `antragFelder`: überschreibt erwartete Antragsfelder, wenn Werte nicht auslesbar sind (`null`).
- Gruppe A (sauber) hat `befunde: []`.

## Prüfen vor „fertig"

1. `./node_modules/.bin/tsc -p .` fehlerfrei.
2. `bun run src/cli.ts Fnn` läuft, `bun test` grün.
3. Antrag Seite 1 und je eine Seite der fallprägenden Nachweise rendern
   (`pdftocairo -png -r 50 -f N -l N -singlefile out/Fnn/Fnn-digital.pdf /tmp/...`) und ansehen.
4. Die Zahlen im Fall ergeben eine stimmige Geschichte (Einkommen, Miete, Kontoauszug, Bescheide).
