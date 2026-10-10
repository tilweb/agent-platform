import { expect, test } from 'bun:test';
import { baueStruktur } from './struktur';
import { konsolidiere } from './konsolidierung';
import { gleicheMitPruefungAb, pruefeUnterschriften, seitenZurPruefung } from './unterschriftspruefung';
import type { AuswertungsErgebnis } from './auswertung';
import type { ModellKontext } from './modell';
import type { SeitenTranskript } from './types';

const seite = (n: number, text: string, rolle: SeitenTranskript['rolle'] = 'vertragstext') => ({ seite: n, rolle, text }) as SeitenTranskript;
const V3 = seite(2, '## § 3 Bank\nIBAN DE87\n{{unterschrift: vorhanden | Auftraggeber}}\n{{unterschrift: vorhanden | EMobility Netzwerk Deutschland GmbH}}');

test('seitenZurPruefung: Unterschriftsseiten und Seiten mit parteigebundener Markierung, keine Paraphen', () => {
  expect(seitenZurPruefung([seite(1, '## § 1\n{{paraphe: SA}}'), V3, seite(3, 'Ort, Datum', 'unterschriften'), { ...seite(4, '', 'unterschriften'), fehler: 'x' }])).toEqual([2, 3]);
});

test('gleicheMitPruefungAb: Widerspruch → unklar, Uebereinstimmung und mehrdeutige Felder bleiben', () => {
  const r = gleicheMitPruefungAb(V3, { seite: 2, felder: [{ partei: 'Auftraggeber', unterschrieben: true }, { partei: 'EMobility Netzwerk Deutschland GmbH', unterschrieben: false }] });
  expect(r.widersprueche).toBe(1);
  expect(r.seite.text).toContain('{{unterschrift: vorhanden | Auftraggeber}}');
  expect(r.seite.text).toContain('{{unterschrift unklar | EMobility Netzwerk Deutschland GmbH}}');
  // Zwei gepruefte Felder passen auf dieselbe Partei → keine Aussage.
  const zwei = gleicheMitPruefungAb(V3, { seite: 2, felder: [{ partei: 'EMobility GmbH', unterschrieben: false }, { partei: 'EMobility Netzwerk', unterschrieben: true }, { partei: 'Auftraggeber', unterschrieben: true }] });
  expect(zwei.widersprueche).toBe(0);
});

test('pruefeUnterschriften → Konsolidierung: „Unterschrift prüfen" statt bestaetigter Unterschrift', async () => {
  let aufrufe = 0;
  const chat = (async () => {
    aufrufe++;
    return { content: JSON.stringify({ felder: [{ partei: 'Auftraggeber', unterschrieben: true }, { partei: 'EMobility Netzwerk Deutschland GmbH', unterschrieben: false }] }), finish_reason: 'stop' };
  }) as unknown as ModellKontext['chat'];
  const seiten = [seite(1, '## § 1 Gegenstand\nText.'), V3];
  const bilder = seiten.map((s) => ({ seite: s.seite, png: Buffer.from('x') }));
  const p = await pruefeUnterschriften({ userId: 't', chat }, bilder, seiten, 2);
  expect(aufrufe).toBe(1);
  expect(p).toMatchObject({ aufrufe: 1, widersprueche: 1 });

  const aw = { katalog: { unterschriften: { status: 'gefunden', wert: [
    { partei: 'Auftraggeber', vorhanden: true, klausel: 'unterschriften' }, { partei: 'EMobility Netzwerk Deutschland GmbH', vorhanden: true, klausel: 'unterschriften' },
  ], klauseln: [] } }, verknuepfungen: [], auffaelligkeiten: [], inventar: [], erweiterung: { data: {}, fundstellen: {} }, aufrufe: 1, probleme: [] } as unknown as AuswertungsErgebnis;
  const { vertrag } = konsolidiere(p.seiten, baueStruktur(p.seiten), aw);
  expect((vertrag.katalog.unterschriften!.wert as Array<{ vorhanden: boolean }>).map((u) => u.vorhanden)).toEqual([true, false]);
  const befunde = vertrag.befunde.filter((b) => b.typ.startsWith('unterschrift'));
  expect(befunde.map((b) => b.typ)).toEqual(['unterschrift_pruefen']);
  expect(befunde[0]!.text).toBe('Unterschrift EMobility Netzwerk Deutschland GmbH: nicht eindeutig erkennbar — bitte im Original prüfen.');
});

test('pruefeUnterschriften: Fehler der Pruefung laesst die Transkription unveraendert', async () => {
  const chat = (async () => { throw new Error('503'); }) as unknown as ModellKontext['chat'];
  const p = await pruefeUnterschriften({ userId: 't', chat }, [{ seite: 2, png: Buffer.from('x') }], [V3], 1);
  expect(p.seiten[0]!.text).toBe(V3.text);
});
