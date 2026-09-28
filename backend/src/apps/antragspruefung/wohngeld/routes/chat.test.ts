import { test, expect, describe } from 'bun:test';
import { parseAntwort, resolveAktionen, AKTION_WHITELIST } from './chat';

describe('parseAntwort — Marker-Parsing (C4)', () => {
  test('ohne Marker: reiner Text, keine Refs/Aktionen', () => {
    const r = parseAntwort('Das ist eine Antwort.');
    expect(r.content).toBe('Das ist eine Antwort.');
    expect(r.dokIds).toEqual([]);
    expect(r.rechtIds).toEqual([]);
    expect(r.actionIds).toEqual([]);
  });

  test('QUELLEN + AKTION werden aus dem Text entfernt und getrennt geparst', () => {
    const raw = 'Es fehlt der Rentenbescheid.\n<<QUELLEN: dok-abc, recht:wogg-14-abs2>>\n<<AKTION: pruefen>>';
    const r = parseAntwort(raw);
    expect(r.content).toBe('Es fehlt der Rentenbescheid.');
    expect(r.dokIds).toEqual(['dok-abc']);
    expect(r.rechtIds).toEqual(['wogg-14-abs2']);
    expect(r.actionIds).toEqual(['pruefen']);
  });

  test('mehrere Aktions-IDs (ein Marker, kommagetrennt) + mehrere Marker', () => {
    const a = parseAntwort('Text\n<<AKTION: pruefen, schreiben_generieren>>');
    expect(a.actionIds).toEqual(['pruefen', 'schreiben_generieren']);
    const b = parseAntwort('Text\n<<AKTION: pruefen>>\n<<AKTION: bwz_uebernehmen>>');
    expect(b.actionIds).toEqual(['pruefen', 'bwz_uebernehmen']);
  });

  test('IDs werden kleingeschrieben', () => {
    const r = parseAntwort('Text\n<<AKTION: Pruefen, SCHREIBEN_GENERIEREN>>');
    expect(r.actionIds).toEqual(['pruefen', 'schreiben_generieren']);
  });
});

describe('resolveAktionen — Whitelist + Labels', () => {
  test('nur Whitelist-IDs werden übernommen, mit deutschem Label', () => {
    const actions = resolveAktionen(['pruefen', 'schreiben_generieren', 'bwz_uebernehmen']);
    expect(actions).toEqual([
      { id: 'pruefen', label: AKTION_WHITELIST.pruefen! },
      { id: 'schreiben_generieren', label: AKTION_WHITELIST.schreiben_generieren! },
      { id: 'bwz_uebernehmen', label: AKTION_WHITELIST.bwz_uebernehmen! },
    ]);
  });

  test('unbekannte IDs werden ignoriert', () => {
    const actions = resolveAktionen(['loeschen', 'pruefen', 'rm_rf', 'verfuegung_speichern']);
    expect(actions).toEqual([{ id: 'pruefen', label: AKTION_WHITELIST.pruefen! }]);
  });

  test('Duplikate werden dedupliziert (Reihenfolge erhalten)', () => {
    const actions = resolveAktionen(['pruefen', 'pruefen']);
    expect(actions).toEqual([{ id: 'pruefen', label: AKTION_WHITELIST.pruefen! }]);
  });
});
