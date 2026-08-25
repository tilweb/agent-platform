/**
 * NK-Vorschlags-Engine: Rollen-Heuristik + Namens-Konstruktion + Konformität.
 * Kern-Garantie: jeder Vorschlag ist NK-konform (kein harter Kanon-Verstoß,
 * G1/G2 erfüllt). Die Rolle ist nur ein demütiger Startpunkt — nicht jede
 * Rolle ist aus dem Namen ableitbar (der Mensch entscheidet).
 */
import { test, expect, describe } from 'bun:test';
import { schlageNamenVor, type VorschlagEingang } from './vorschlag';
import { pruefeNK, type VarFundort } from './nk';

const fundorte: VarFundort[] = [
  { name: 'Archivordner', p: '210' },
  { name: 'C_ArchivPfad', p: '211' },
  { name: 'Aktuelles Datum', p: '210' },
  { name: 'Kammer Nummer', p: '210' }, { name: 'Kammer Nummer', p: '212' }, // gekoppelt
  { name: 'Lauf erfolgreich', p: '210' },
  { name: 'Prüfprotokoll Zeile', p: '213' },
];
const variablen: VorschlagEingang[] = [
  { name: 'Archivordner', p: '210', typ: 'string', schnitt: 'Privat' },
  { name: 'C_ArchivPfad', p: '211', typ: 'string', schnitt: 'Privat' },
  { name: 'Aktuelles Datum', p: '210', typ: 'datetime', schnitt: 'Privat' },
  { name: 'Kammer Nummer', p: '210', typ: 'string', schnitt: 'EinAus' },
  { name: 'Kammer Nummer', p: '212', typ: 'string', schnitt: 'EinAus' },
  { name: 'Lauf erfolgreich', p: '210', typ: 'bool', schnitt: 'Ausgehend' },
  { name: 'Prüfprotokoll Zeile', p: '213', typ: 'int', schnitt: 'Privat' },
];

const { modul, vorschlaege } = schlageNamenVor(fundorte, variablen);
const by = (alt: string) => vorschlaege.find((v) => v.alt === alt)!;

describe('NK-Vorschlags-Engine', () => {
  test('bereits konformer Ist-Name → Identität, istKonform', () => {
    const v = by('C_ArchivPfad');
    expect(v.neu).toBe('C_ArchivPfad');
    expect(v.rolle).toBe('C');
    expect(v.istKonform).toBe(true);
  });

  test('gekoppelter Fachwert (mehrere Prozesse) → Rolle U, kein Präfix', () => {
    const v = by('Kammer Nummer');
    expect(v.rolle).toBe('U');
    expect(v.neu).toBe('KammerNummer');
    expect(v.konfidenz).toBe('hoch');
  });

  test('ausgehende/Status-Variable → Rolle T', () => {
    const v = by('Lauf erfolgreich');
    expect(v.rolle).toBe('T');
    expect(v.neu.startsWith('T_')).toBe(true);
  });

  test('Default → H_, PascalCase, Umlaut-Transliteration', () => {
    const v = by('Aktuelles Datum');
    expect(v.rolle).toBe('H');
    expect(v.neu).toBe('H_AktuellesDatum');
  });

  test('verworfenes Kategorie-Wort am Ende ersetzt (Ordner→Pfad)', () => {
    expect(by('Archivordner').neu.endsWith('ArchivPfad')).toBe(true);
  });

  test('ALLE Vorschläge sind NK-konform (kein harter Kanon-Verstoß, G1/G2 erfüllt)', () => {
    const nk = pruefeNK(modul, fundorte);
    expect(nk.sperrend).toBeFalsy();
    expect(nk.gates.G1.erfuellt).toBe(true);
    expect(nk.gates.G2.erfuellt).toBe(true);
  });

  test('leere Eingabe → leeres Modul, kein Wurf', () => {
    const r = schlageNamenVor([], []);
    expect(r.vorschlaege).toEqual([]);
    expect(r.modul.map).toEqual([]);
  });
});
