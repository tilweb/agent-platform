import { test, expect } from 'bun:test';
import { parseLabelmap } from './template-labelmap';
import { buildGrundsteuerGmbxProject } from '../../../extraction/templates/grundsteuer-gmbx';
import { extractionProjectToExtractionSchema } from '../../../extraction/learning/pipeline-adapter';

const profile = extractionProjectToExtractionSchema(buildGrundsteuerGmbxProject()).profile;

// Layout-Text wie von `pdftotext -layout` (rechtsbuendige Label-Spalte, >=2 Spaces zum Wert).
const MIT_ZERLEGUNG = `Grundsteuermessbeträge nach GrStRefG von
2019 (GMBX)

                                    Aktenzeichen     1901500480200002
             Amtlicher Gemeindeschlüssel (AGS)       06435012
           Datum der Berechnung des Bescheids        06022024
      Sonstige Bescheidkennzeichnungen (z.B.
              geändert), Nebenbestimmungen,          24
                            Billigkeitsangaben
                          Anzahl der Eigentümer      2
                                     Messbetrag      61297
(Ganzzahl in Cent)

1 – Zerlegungsbescheid
       Es liegt eine Zerlegung vor.      Es liegt eine Zerlegung vor.
                          Anteil Nenner  5992141

2 – Lage der wirtschaftlichen Einheit
        Ort der wirtschaftlichen Einheit  Schlüchtern

3 – Eigentümer
                                 Anrede   02
          Geburtsdatum des Eigentümers    17051966
3.1 – Name E
              Nachname des Eigentümers    Bien
                Vorname des Eigentümers   Hagen
4 – Eigentümer
                                 Anrede   07
4.1 – Name E
          Namenszeile 1 des Eigentümers   Kaiser Immobilien
          Namenszeile 2 des Eigentümers   Verwaltung GmbH
`;

test('mappt Kopf-, Lage- und Zerlegungsfelder label-verankert', () => {
  const { extracted, unknownLabels } = parseLabelmap(MIT_ZERLEGUNG, profile);
  const felder = (extracted as any).felder;
  expect(felder.aktenzeichen).toBe('1901500480200002');
  expect(felder.ags).toBe('06435012');
  expect(felder.datum_berechnung).toBe('2024-02-06');      // DDMMYYYY → ISO
  expect(felder.messbetrag).toBe(61297);                    // number
  expect(felder.anzahl_eigentuemer).toBe(2);
  expect(felder.lage_ort).toBe('Schlüchtern');              // Section-Nr. verschoben (2, nicht 1)
  expect(felder.zerlegung_anteil_nenner).toBe(5992141);
  expect(unknownLabels).toEqual([]);
});

test('erkennt mehrzeiliges Label ueber Anker-Alias', () => {
  const { extracted } = parseLabelmap(MIT_ZERLEGUNG, profile);
  expect((extracted as any).felder.sonstige_bescheidkennzeichnungen).toBe('24');
});

test('trennt wiederholbare Eigentuemer korrekt (natuerlich + juristisch)', () => {
  const { extracted } = parseLabelmap(MIT_ZERLEGUNG, profile);
  const owners = (extracted as any).eigentuemer;
  expect(owners).toHaveLength(2);
  expect(owners[0]).toMatchObject({ anrede: '02', nachname: 'Bien', vorname: 'Hagen', geburtsdatum: '1966-05-17' });
  expect(owners[1]).toMatchObject({ anrede: '07', namenszeile_1: 'Kaiser Immobilien', namenszeile_2: 'Verwaltung GmbH' });
  // Owner-Felder duerfen NICHT ins naechste Instanz-Objekt lecken.
  expect(owners[1].nachname).toBeUndefined();
});

test('bleibt bei verschobener Nummerierung stabil (ohne Zerlegung)', () => {
  // Kein Zerlegungsblock → Lage ist Abschnitt 1, Eigentuemer Abschnitt 2.
  const OHNE = `                Aktenzeichen   1901590000320000
1 – Lage der wirtschaftlichen Einheit
    Ort der wirtschaftlichen Einheit   Gründau
2 – Eigentümer
                          Anrede   02
2.1 – Name E
        Nachname des Eigentümers   Schäfer
`;
  const { extracted, unknownLabels } = parseLabelmap(OHNE, profile);
  expect((extracted as any).felder.lage_ort).toBe('Gründau');
  expect((extracted as any).eigentuemer).toHaveLength(1);
  expect((extracted as any).eigentuemer[0].nachname).toBe('Schäfer');
  expect(unknownLabels).toEqual([]);
});

test('meldet unbekannte Labels als Befund', () => {
  const TXT = `        Aktenzeichen   123
        Völlig Fremdes Feld   xyz
`;
  const { unknownLabels } = parseLabelmap(TXT, profile);
  expect(unknownLabels).toContain('Völlig Fremdes Feld');
});
