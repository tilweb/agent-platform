import { describe, expect, test } from 'bun:test';
import { baueStruktur } from './struktur';
import { baueAufloeser, dedupliziereInventar, gleicheUnterschriftenAb, unterzeichnungBeilagen, beilagenZuordnung, unterschriftsMarken, findeGueltigkeit, findePlatzhalter, findeVerweise, konsolidiere, normalisiereId } from './konsolidierung';
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

test('normalisiereId: „§2.1" trifft Dezimal-ID 2.1', () => {
  const a = baueAufloeser(baueStruktur([seite(1, '## § 2 Leistungen\n2.1. END baut.\n2.2. END betreibt.')]));
  expect(normalisiereId('§2.1', a)).toBe('2.1');
  expect(normalisiereId('§ 2 Abs. 2', a)).toBe('2.2');
  expect(normalisiereId('Ziffer 2.2', a)).toBe('2.2');
});

test('Unterschriften-Plausibilitaet: mehr Parteien unterschrieben als Markierungen → Befund', () => {
  const k = baueStruktur([seite(1, '## § 1 Gegenstand\nText.'), seite(2, 'Ort, Datum {{hs: FFM, 4.5.23}}\n{{unterschrift: vorhanden}}\nMieter\n\nUnterschrift + Stempel\nEND', 'unterschriften')]);
  const aw = { katalog: { unterschriften: { status: 'gefunden', wert: [{ partei: 'Mieter', vorhanden: true }, { partei: 'END', vorhanden: true }], klauseln: ['unterschriften'] } }, verknuepfungen: [], auffaelligkeiten: [], inventar: [], erweiterung: { data: {}, fundstellen: {} }, aufrufe: 1, probleme: [] } as unknown as AuswertungsErgebnis;
  const { vertrag } = konsolidiere([], k, aw);
  expect(vertrag.befunde.find((b) => b.typ === 'unterschrift_fehlt')!.text).toContain('2 Partei(en) als unterschrieben erkannt, im Dokument aber nur 1');
  const a = baueAufloeser(baueStruktur([seite(1, '## § 8 Entgelt\n8.2 Vergütung\n8.2.1 Pauschale.')]));
  expect(normalisiereId('§8.2.1', a)).toBe('8.2.1');
});

test('Unterschriften: parteigebundene Markierung korrigiert Spaltenverwechslung, Widerspruch bleibt unangetastet', () => {
  const k = baueStruktur([seite(1, '## § 1 Gegenstand\nText.'), seite(2, 'Ort, Datum\n{{keine unterschrift | Kunde}}\n{{unterschrift: s. Ibrahim | EMobility Netzwerk Deutschland GmbH}}\nKunde EMobility Netzwerk Deutschland GmbH', 'unterschriften')]);
  expect(unterschriftsMarken(k.map((x) => x.text).join('\n'))).toEqual([{ partei: 'Kunde', vorhanden: false }, { partei: 'EMobility Netzwerk Deutschland GmbH', vorhanden: true }]);
  const aw = { katalog: { unterschriften: { status: 'gefunden', wert: [{ partei: 'Kunde', vorhanden: true }, { partei: 'EMobility Netzwerk Deutschland GmbH', vorhanden: true }], klauseln: ['unterschriften'] } }, verknuepfungen: [], auffaelligkeiten: [], inventar: [], erweiterung: { data: {}, fundstellen: {} }, aufrufe: 1, probleme: [] } as unknown as AuswertungsErgebnis;
  const { vertrag } = konsolidiere([], k, aw);
  expect((vertrag.katalog.unterschriften!.wert as Array<{ vorhanden: boolean }>).map((u) => u.vorhanden)).toEqual([false, true]);
  expect(vertrag.befunde.some((b) => b.text === 'Unterschrift fehlt: Kunde.')).toBe(true);

  const gemischt = [{ partei: 'Premier Inn GmbH und Premier Inn Hotel GmbH', vorhanden: true }];
  const kl = baueStruktur([seite(1, '{{unterschrift: A. Müller | Premier Inn GmbH und Premier Inn Hotel GmbH}}', 'unterschriften'), seite(2, '{{keine unterschrift | Premier Inn Hotel GmbH}}', 'unterschriften')]);
  expect(gleicheUnterschriftenAb(gemischt, kl)).toBe(0);
  expect(gemischt[0]!.vorhanden).toBe(true);
});

test('Beilagen: leerer Unterschriftsbereich eines beigefuegten Vertrags → eigener Befund, keine Partei des Hauptvertrags', () => {
  const s = (n: number, text: string, rolle: SeitenTranskript['rolle']) => ({ seite: n, rolle, text, fusszeile: '' }) as SeitenTranskript;
  const seiten = [
    s(1, '## § 1 Gegenstand\nText.', 'vertragstext'),
    s(2, '{{unterschrift: A. Müller | Premier Inn GmbH}}\n{{unterschrift: E. Friemuth | END}}', 'unterschriften'),
    s(3, 'Anlage Vorlage\nUnterschrift\n[GESELLSCHAFT NAME]', 'unterschriften'),
    s(4, 'Standortvertrag zwischen Premier Inn Hotel GmbH und END', 'deckblatt'),
    s(5, '## 1. Gegenstand\nStandort Messe.', 'vertragstext'),
    s(6, '8.4 Anlagen gelten.\n{{keine unterschrift | Premier Inn Hotel GmbH}}\n{{keine unterschrift | END}}', 'unterschriften'),
    s(7, 'Unterschrift\nPremier Inn Hotel GmbH', 'unterschriften'),
  ];
  const k = baueStruktur(seiten);
  const befunde = unterzeichnungBeilagen(beilagenZuordnung(seiten, k), k);
  expect(befunde).toHaveLength(1);
  expect(befunde[0]!.text).toBe('Beigefügtes Dokument (ab S. 4, Unterschriftsbereich S. 6) ist nicht unterzeichnet.');
  const aw = { katalog: { unterschriften: { status: 'gefunden', wert: [
    { partei: 'Premier Inn GmbH', vorhanden: true, klausel: 'unterschriften' }, { partei: 'END', vorhanden: true, klausel: 'unterschriften' },
    { partei: 'Standortvertrag (Premier Inn Hotel GmbH)', vorhanden: false, klausel: befunde[0]!.klauseln[0] },
  ], klauseln: ['unterschriften'] } }, verknuepfungen: [], auffaelligkeiten: [], inventar: [], erweiterung: { data: {}, fundstellen: {} }, aufrufe: 1, probleme: [] } as unknown as AuswertungsErgebnis;
  const { vertrag } = konsolidiere(seiten, k, aw);
  // Kuerzel ohne Feldbezug (Paraphen) und woertliche Platzhalter machen die Beilage nicht „unterschrieben".
  const mitParaphen = baueStruktur([...seiten.slice(0, 4), s(5, '## 1. Gegenstand\nStandort Messe.\n{{unterschrift: sA}}', 'vertragstext'),
    s(6, '8.4 Anlagen gelten.\n{{keine unterschrift | Partei}}\n{{keine unterschrift | Partei}}', 'vertragstext'), s(7, 'Unterschrift\n{{unterschrift: Kürzel}}', 'unterschriften')]);
  expect(unterzeichnungBeilagen(beilagenZuordnung(seiten, mitParaphen), mitParaphen)).toHaveLength(1);
  // Blanko-Vorlage mit Platzhaltern im Anlagenteil des Hauptvertrags → kein Befund.
  const vorlage = baueStruktur([seite(1, '## § 1 Gegenstand\nText.'), seite(2, '{{unterschrift: A | Kunde}}', 'unterschriften'),
    seite(3, '## Anlage 2 Beitritt\nText.'), seite(4, '{{keine unterschrift | [GESELLSCHAFT NAME]}}\nUnterschrift\n[GESELLSCHAFT NAME]', 'unterschriften')]);
  expect(unterzeichnungBeilagen(beilagenZuordnung([], vorlage), vorlage)).toHaveLength(0);
  expect(unterschriftsMarken('{{keine unterschrift | Partei links}} {{unterschrift: x | Kunde}}')).toEqual([{ partei: 'Kunde', vorhanden: true }]);
  expect((vertrag.katalog.unterschriften!.wert as unknown[]).length).toBe(2);
  expect(vertrag.befunde.some((b) => b.typ === 'unterschrift_fehlt')).toBe(false);
  expect(vertrag.befunde.filter((b) => b.typ === 'beilage_nicht_unterzeichnet')).toHaveLength(1);
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

test('Signaturen: Aenderung nach der Signatur → Befund am Unterschriftsbereich, digitale Signatur mit Namen zaehlt als Markierung', () => {
  const k = baueStruktur([seite(1, '## § 1 Gegenstand\nText.'), seite(2, 'Kunde\n\n{{digitale signatur: im PDF elektronisch signiert von Erika Mustermann am 25.07.2024 15:18}}', 'unterschriften')]);
  const aw = { katalog: { unterschriften: { status: 'gefunden', wert: [{ partei: 'Kunde', vorhanden: true }], klauseln: ['unterschriften'] } }, verknuepfungen: [], auffaelligkeiten: [], inventar: [], erweiterung: { data: {}, fundstellen: {} }, aufrufe: 1, probleme: [] } as unknown as AuswertungsErgebnis;
  const sig = { feld: 'Sig', zeit: '25.07.2024 15:18', unterzeichner: 'Erika Mustermann', art: 'pkcs7' as const, integritaet: 'unbekannt' as const, bereich_ende: 100, deckung: 'geaendert' as const, aenderung: { seiten: [1], art: ['text' as const], hinzu: 'Anlage 2' } };
  const { vertrag } = konsolidiere([], k, aw, [sig]);
  expect(vertrag.signaturen).toEqual([sig]);
  expect(vertrag.befunde.find((b) => b.typ === 'nach_signatur_geaendert')).toMatchObject({ klauseln: ['unterschriften'] });
  expect(vertrag.befunde.some((b) => b.typ === 'unterschrift_fehlt')).toBe(false);
  expect(konsolidiere([], k, aw).vertrag.signaturen).toBeUndefined();
});
