import { describe, test, expect } from 'bun:test';
import { bereinigeVorgangUpdates, filtereVorgaenge, planeStatusWechsel, GESCHUETZTE_VORGANG_FELDER } from './vorgang-helfer';
import type { Akte, Vorgang } from './types';

describe('bereinigeVorgangUpdates', () => {
  test('entfernt geschützte Felder und trennt Locking-Optionen ab', () => {
    const r = bereinigeVorgangUpdates({
      antragsdatum: '2026-03-01', status: 'abgeschlossen', legalHold: true, eingeschraenkt: false,
      aufbewahrungBis: '2020-01-01', geprueftAm: 'x', akteId: 'fremd', permissions: {}, abschluss: { ergebnis: 'bewilligt' },
      expectedVersion: 3, force: true,
    });
    expect(r).toEqual({ updates: { antragsdatum: '2026-03-01' } as Partial<Vorgang>, expectedVersion: 3, force: true });
    expect(GESCHUETZTE_VORGANG_FELDER).toContain('status');
  });

  test('leerer Body', () => {
    expect(bereinigeVorgangUpdates(null)).toEqual({ updates: {}, expectedVersion: undefined, force: false });
  });
});

describe('planeStatusWechsel', () => {
  const heuteIso = '2026-09-27T08:00:00.000Z';
  const vorher = { status: 'sachbearbeitung' as const };

  test('unbekannter Status → 400', () => {
    expect(planeStatusWechsel({ vorher, status: 'fertig', appRole: 'editor', vierAugen: false, heuteIso })).toMatchObject({ ok: false, code: 400 });
  });

  test('unbekanntes Ergebnis → 400', () => {
    expect(planeStatusWechsel({ vorher, status: 'entscheidung', abschluss: { ergebnis: 'vielleicht' }, appRole: 'owner', vierAugen: false, heuteIso })).toMatchObject({ ok: false, code: 400 });
  });

  test('Vier-Augen an: Editor darf kein finales Ergebnis speichern, Owner schon', () => {
    const editor = planeStatusWechsel({ vorher, status: 'entscheidung', abschluss: { ergebnis: 'abgelehnt' }, appRole: 'editor', vierAugen: true, heuteIso });
    expect(editor).toMatchObject({ ok: false, code: 403 });
    const owner = planeStatusWechsel({ vorher, status: 'entscheidung', abschluss: { ergebnis: 'abgelehnt', bemerkung: ' Vermögen ' }, appRole: 'owner', vierAugen: true, heuteIso });
    expect(owner).toEqual({ ok: true, updates: {
      status: 'entscheidung',
      abschluss: { ergebnis: 'abgelehnt', bemerkung: 'Vermögen', am: heuteIso },
      aufbewahrungBis: '2028-09-27',
    } });
  });

  test('Vier-Augen an: Vorbereitung (offen) darf der Editor', () => {
    expect(planeStatusWechsel({ vorher, status: 'entscheidung', abschluss: { ergebnis: 'offen' }, appRole: 'editor', vierAugen: true, heuteIso }).ok).toBe(true);
  });

  test('Statuswechsel ohne Abschluss, nicht abschließend → keine Frist', () => {
    expect(planeStatusWechsel({ vorher, status: 'warte_auf_rueckmeldung', appRole: 'editor', vierAugen: false, heuteIso }))
      .toEqual({ ok: true, updates: { status: 'warte_auf_rueckmeldung' } });
  });
});

describe('filtereVorgaenge', () => {
  const akten = [{ id: 'a1', name: 'Muster, Erika' } as Akte, { id: 'a2', name: 'Beispiel, Hans' } as Akte];
  const v = (id: string, o: Partial<Vorgang>) => ({ id, akteId: 'a1', vorgangsnummer: `GS-${id}`, ...o }) as Vorgang;
  const liste = [v('1', { sachbearbeiterId: 'u1' }), v('2', { akteId: 'a2', aktenzeichen: '50.1-777' }), v('3', { sachbearbeiterId: 'u2' })];

  test('nach Zuständigkeit, „-" = nicht zugewiesen', () => {
    expect(filtereVorgaenge(liste, akten, { sachbearbeiterId: 'u1' }).map((x) => x.id)).toEqual(['1']);
    expect(filtereVorgaenge(liste, akten, { sachbearbeiterId: '-' }).map((x) => x.id)).toEqual(['2']);
  });

  test('Freitext über Vorgangsnummer, Aktenzeichen und Aktenname', () => {
    expect(filtereVorgaenge(liste, akten, { q: 'beispiel' }).map((x) => x.id)).toEqual(['2']);
    expect(filtereVorgaenge(liste, akten, { q: '777' }).map((x) => x.id)).toEqual(['2']);
    expect(filtereVorgaenge(liste, akten, { q: 'gs-3' }).map((x) => x.id)).toEqual(['3']);
  });
});
