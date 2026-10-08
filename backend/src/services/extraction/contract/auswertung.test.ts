import { expect, test } from 'bun:test';
import { baueStruktur } from './struktur';
import { erweiterungSchema, inventarGruppen, katalogSchema, werteAus } from './auswertung';
import type { ChatFn } from './modell';
import type { SeitenTranskript } from './types';

const seite = (n: number, text: string, rolle: SeitenTranskript['rolle'] = 'vertragstext'): SeitenTranskript => ({ seite: n, rolle, text });

test('inventarGruppen: Abschnitte bleiben zusammen, Budget teilt, Rubrum/Muster ausgenommen', () => {
  const lang = 'x'.repeat(900);
  const k = baueStruktur([
    seite(1, 'Rubrum Kunde', 'deckblatt'),
    seite(2, `## § 1 A\n1. ${lang}\n2. ${lang}\n\n## § 2 B\n1. ${lang}\n\n## § 3 C\n1. ${lang}\n2. ${lang}\n3. ${lang}`),
    seite(3, 'Musterrechnung', 'muster'),
  ]);
  const g = inventarGruppen(k, 2500);
  expect(g.map((x) => x.map((y) => y.id))).toEqual([['§1', '§1.1', '§1.2'], ['§2', '§2.1'], ['§3', '§3.1', '§3.2'], ['§3', '§3.3']]);
});

test('Schemata: alle Schluessel required, keine Zusatzschluessel', () => {
  const s = katalogSchema() as { properties: { katalog: { required: string[]; properties: Record<string, { required: string[] }> } } };
  expect(s.properties.katalog.required).toContain('kuendigung');
  expect(s.properties.katalog.properties.kuendigung!.required).toEqual(['status', 'wert', 'bedingung', 'verweis', 'klauseln']);
  const e = erweiterungSchema({ standorte: { type: 'list', label: 'Standorte', item_fields: { name: { type: 'text', label: 'Name' } } } }) as Record<string, any>;
  expect(e.properties.felder.properties.standorte.properties.zeilen.items.required).toEqual(['name']);
});

test('werteAus ruft Katalog, Inventar je Gruppe und Erweiterung; bereinigt Antworten', async () => {
  const aufrufe: string[] = [];
  const chat = (async (messages: Array<{ role: string; content: unknown }>) => {
    const system = String(messages[0]!.content);
    if (system.includes('Fülle den Katalog')) {
      aufrufe.push('katalog');
      return { content: JSON.stringify({
        katalog: {
          kuendigung: { status: 'gefunden', wert: { frist: { dauer: 3, einheit: 'monate', richtung: 'vor', bezug: 'Ablauf', zum: null, wortlaut: '3 Monate vor Ablauf' }, form: null, ausserordentlich: null }, bedingung: null, verweis: null, klauseln: ['§6.1'] },
          vertragsstrafe: { status: 'nicht_geregelt', wert: { text: 'irrelevant' }, bedingung: null, verweis: null, klauseln: [] },
          parteien: { status: 'gefunden', wert: [{ rolle: 'Auftraggeber', name: 'Kunde', anschrift: null, aliasse: [] }], bedingung: null, verweis: null, klauseln: ['rubrum'] },
        },
        verknuepfungen: [{ art: 'vertragsnummer', wert: '683867', klausel: 'rubrum' }],
        auffaelligkeiten: [],
      }), finish_reason: 'stop' };
    }
    if (system.includes('VOLLSTÄNDIG')) {
      aufrufe.push('inventar');
      expect(String(messages[1]!.content)).toContain('Parteien:');
      return { content: JSON.stringify({ eintraege: [
        { typ: 'pflicht', partei: 'Auftragnehmer', gegenueber: null, inhalt: 'Jährliche Wartung', modalitaet: 'muss', ausloeser: null, bedingung: null, frist: { dauer: null, einheit: null, richtung: null, bezug: null, zum: null, wortlaut: null }, klauseln: ['§3.1'] },
      ] }), finish_reason: 'stop' };
    }
    aufrufe.push('erweiterung');
    return { content: JSON.stringify({ felder: { anzahl_ladepunkte: { wert: 2, klauseln: ['Anl1'] } } }), finish_reason: 'stop' };
  }) as unknown as ChatFn;

  const k = baueStruktur([seite(1, 'Vertrag zwischen Kunde und END', 'deckblatt'), seite(2, '## § 3 Leistungen\n1. Jährliche Wartung.\n\n## § 6 Laufzeit\n1. Kündigung 3 Monate vor Ablauf.')]);
  const r = await werteAus({ userId: 't', chat }, k, { parallel: 2, felder: { anzahl_ladepunkte: { type: 'number', label: 'Anzahl Ladepunkte' } } });
  expect(aufrufe.sort()).toEqual(['erweiterung', 'inventar', 'katalog', 'katalog']);
  expect(r.katalog.vertragsstrafe).toEqual({ status: 'nicht_geregelt', wert: null, klauseln: [] });
  expect(r.katalog.kuendigung!.wert).toEqual({ frist: { dauer: 3, einheit: 'monate', richtung: 'vor', bezug: 'Ablauf', wortlaut: '3 Monate vor Ablauf' } });
  expect(r.inventar).toEqual([{ typ: 'pflicht', partei: 'Auftragnehmer', inhalt: 'Jährliche Wartung', modalitaet: 'muss', klauseln: ['§3.1'] }]);
  expect(r.erweiterung).toEqual({ data: { anzahl_ladepunkte: 2 }, fundstellen: { anzahl_ladepunkte: ['Anl1'] } });
  expect(r.verknuepfungen).toEqual([{ art: 'vertragsnummer', wert: '683867', klausel: 'rubrum' }]);
  expect(r.probleme).toEqual([]);
});

test('skelett: Platzhalter aus Schema fuer Freitext-JSON', async () => {
  const { skelett } = await import('./modell');
  expect(skelett({ type: 'object', properties: { a: { type: ['string', 'null'] }, b: { type: 'array', items: { type: 'object', properties: { s: { type: 'string', enum: ['muss', 'kann'] } } } } } }))
    .toEqual({ a: 'string|null', b: [{ s: 'muss|kann' }] });
});

test('Inventar: unlesbare Antwort einer Gruppe → Gruppe wird halbiert und einzeln ausgewertet', async () => {
  const chat = (async (messages: Array<{ role: string; content: unknown }>) => {
    const system = String(messages[0]!.content);
    const user = String(messages[messages.length - 1]!.content);
    if (system.includes('Fülle den Katalog')) return { content: '{"katalog":{}}', finish_reason: 'stop' };
    if (!system.includes('VOLLSTÄNDIG')) return { content: '{"felder":{}}', finish_reason: 'stop' };
    // Beide Abschnitte in einer Anfrage → abgeschnittene Antwort (wie am Tokenlimit)
    if (user.includes('[§1]') && user.includes('[§2]')) return { content: '{"eintraege":[{"typ":"pflicht",', finish_reason: 'length' };
    const id = user.includes('[§1]') ? '§1.1' : '§2.1';
    return { content: JSON.stringify({ eintraege: [{ typ: 'pflicht', partei: 'END', gegenueber: null, inhalt: `Pflicht aus ${id}`, modalitaet: 'muss', ausloeser: null, bedingung: null, frist: { dauer: null, einheit: null, richtung: null, bezug: null, zum: null, wortlaut: null }, klauseln: [id] }] }), finish_reason: 'stop' };
  }) as unknown as ChatFn;
  const k = baueStruktur([seite(1, '## § 1 A\n1. Erste Pflicht.\n\n## § 2 B\n1. Zweite Pflicht.')]);
  const r = await werteAus({ userId: 't', chat }, k, { parallel: 2 });
  expect(r.inventar.map((e) => e.inhalt).sort()).toEqual(['Pflicht aus §1.1', 'Pflicht aus §2.1']);
  expect(r.probleme).toEqual([]);
});
