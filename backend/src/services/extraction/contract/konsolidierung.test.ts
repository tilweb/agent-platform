import { describe, expect, test } from 'bun:test';
import { baueStruktur } from './struktur';
import { baueAufloeser, dedupliziereInventar, findeGueltigkeit, findePlatzhalter, findeVerweise, konsolidiere, normalisiereId } from './konsolidierung';
import type { AuswertungsErgebnis } from './auswertung';
import type { SeitenTranskript } from './types';

const seite = (n: number, text: string, rolle: SeitenTranskript['rolle'] = 'vertragstext'): SeitenTranskript => ({ seite: n, rolle, text });

const SEITEN = [
  seite(1, '## Betreibervertrag\nzwischen END (Auftragnehmer) und Kunde GmbH (Auftraggeber)\nKunden-Nr. XXX\nVertrags-Nr.: 683867', 'deckblatt'),
  seite(2, '## § 2 Gegenstand\nEND wartet die in Anlage 1 aufgeführten Anlagen. Die Preise ergeben sich aus Anlage 3.\n\n## § 6 Vertragsdauer\n1. Beginn 01.06.2022, Mindestlaufzeit 2 Jahre.\n2. Verlängerung um ein Jahr, wenn nicht nach § 6 Abs. 3 gekündigt.\n3. Kündigung 3 Monate vor Ablauf. Das Recht nach § 314 BGB bleibt unberührt.\n4. Siehe auch § 9 Abs. 2 und Ziffer 6.2.'),
  seite(3, '## Ziffer 8 Optionen\n[x] Wartung durch END.\n[ ] Wartung durch den Kunden.\n~~(e) Roaming 15 €~~\nOrt: {{hs: Laupheim, 09.08.2022}}', 'vertragstext'),
  seite(4, '## Anlage 1 Standorte\n| Standort |\n|---|\n| Zentrale |', 'anlage'),
];

describe('Aufloeser und Verweise', () => {
  const k = baueStruktur(SEITEN);
  const a = baueAufloeser(k);

  test('normalisiereId bildet freie Angaben auf Baum-IDs ab', () => {
    expect(normalisiereId('§ 6 Abs. 3', a)).toBe('§6.3');
    expect(normalisiereId('§6.2', a)).toBe('§6.2');
    expect(normalisiereId('Ziffer 8', a)).toBe('Z8');
    expect(normalisiereId('Anlage 1', a)).toBe('Anl1');
    expect(normalisiereId('§ 12', a)).toBeUndefined();
  });

  test('findeVerweise: aufloesbar, ins Leere, Anlagen; Gesetze ignoriert', () => {
    const v = findeVerweise(k, a);
    expect(v).toContainEqual({ von: '§6.2', text: '§ 6 Abs. 3', ziel: '§6.3' });
    expect(v).toContainEqual({ von: '§6.4', text: '§ 9 Abs. 2' });
    expect(v).toContainEqual({ von: '§6.4', text: 'Ziffer 6.2', ziel: '§6.2' });
    expect(v).toContainEqual({ von: '§2', text: 'Anlage 1', ziel: 'Anl1' });
    expect(v).toContainEqual({ von: '§2', text: 'Anlage 3' });
    expect(v.some((x) => x.text.includes('314'))).toBe(false);
  });

  test('Gueltigkeit aus Auszeichnung: gestrichen, nicht angekreuzt, handschriftlich', () => {
    const g = findeGueltigkeit(k);
    expect(g).toContainEqual({ art: 'gestrichen', text: '(e) Roaming 15 €', klausel: 'Z8' });
    expect(g).toContainEqual({ art: 'nicht_angekreuzt', text: 'Wartung durch den Kunden.', klausel: 'Z8' });
    expect(g).toContainEqual({ art: 'handschriftlich', text: 'Laupheim, 09.08.2022', klausel: 'Z8' });
  });

  test('Platzhalter im Rubrum, Ankreuzfelder zaehlen nicht', () => {
    const p = findePlatzhalter(k);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ typ: 'platzhalter', klauseln: ['rubrum'] });
  });
});

test('dedupliziereInventar fasst gleiche Eintraege zusammen', () => {
  const e = { typ: 'pflicht' as const, partei: 'END', inhalt: 'Wartung jährlich durchführen.', modalitaet: 'muss' as const, klauseln: ['§3.1'] };
  expect(dedupliziereInventar([e, { ...e, inhalt: 'Wartung jährlich durchführen' }, { ...e, klauseln: ['§3.2'] }])).toHaveLength(2);
});

test('konsolidiere: Befunde, Fundstellen, Fristen, Verknuepfungen', () => {
  const k = baueStruktur(SEITEN);
  const aw: AuswertungsErgebnis = {
    katalog: {
      kuendigung: { status: 'gefunden', wert: { frist: { dauer: 3, einheit: 'monate', richtung: 'vor', bezug: 'Ablauf der Laufzeit', wortlaut: '3 Monate vor Ablauf' }, form: 'schriftlich' }, klauseln: ['§ 6 Abs. 3'] },
      unterschriften: { status: 'gefunden', wert: [{ partei: 'Auftraggeber', vorhanden: true }, { partei: 'Auftragnehmer', vorhanden: false }], klauseln: ['unterschriften'] },
      anlagen: { status: 'gefunden', wert: [{ bezeichnung: 'Anlage 1 Standorte', vorhanden: true }, { bezeichnung: 'Anlage 3 Preise', vorhanden: true }], klauseln: ['§2'] },
    },
    verknuepfungen: [{ art: 'rahmenvertrag', wert: 'Rahmenvertrag vom 08.07.2021' }],
    auffaelligkeiten: [{ text: 'Präambel nennt einen anderen Vertrag.', klauseln: ['rubrum'] }],
    inventar: [{ typ: 'frist', partei: 'Auftragnehmer', inhalt: 'Preiserhöhung 2 Wochen vor Verlängerung mitteilen', modalitaet: 'muss', frist: { dauer: 2, einheit: 'wochen', richtung: 'vor', bezug: 'automatische Verlängerung', wortlaut: 'spätestens 2 Wochen vor' }, klauseln: ['§6.2', '§ 99'] }],
    erweiterung: { data: { standorte: [{ name: 'Zentrale' }] }, fundstellen: { standorte: ['Anlage 1'] } },
    aufrufe: 3,
    probleme: [],
  };
  const { vertrag, erweiterung } = konsolidiere(SEITEN, k, aw);
  expect(vertrag.katalog.kuendigung!.klauseln).toEqual(['§6.3']);
  expect(erweiterung.fundstellen.standorte).toEqual(['Anl1']);
  const typen = vertrag.befunde.map((b) => b.typ);
  expect(typen).toContain('anlage_fehlt');
  expect(typen).toContain('unterschrift_fehlt');
  expect(typen).toContain('verweis_ins_leere');
  expect(typen).toContain('platzhalter');
  expect(typen).toContain('widerspruch');
  expect(vertrag.befunde.find((b) => b.typ === 'anlage_fehlt')!.text).toContain('Anlage 3');
  expect(vertrag.befunde.find((b) => b.typ === 'verarbeitung')!.text).toContain('§ 99');
  // Anlage 3 laut Modell „vorhanden" — die Struktur korrigiert das.
  expect((vertrag.katalog.anlagen!.wert as Array<{ vorhanden: boolean }>).map((x) => x.vorhanden)).toEqual([true, false]);
  expect(vertrag.fristen.map((f) => f.art)).toEqual(['ordentliche Kündigung', 'Preiserhöhung 2 Wochen vor Verlängerung mitteilen']);
  expect(vertrag.fristen[0]).toMatchObject({ dauer: 3, einheit: 'monate', form: 'schriftlich', klauseln: ['§6.3'] });
  expect(vertrag.verknuepfungen).toContainEqual({ art: 'vertragsnummer', wert: '683867', klausel: 'rubrum' });
  expect(vertrag.seiten.map((s) => s.rolle)).toEqual(['deckblatt', 'vertragstext', 'vertragstext', 'anlage']);
});
