import { test, expect, describe } from 'bun:test';
import {
  abzugssatz16, jahreseinkommenRoh, jahreseinkommen, freibetraege17,
  gesamteinkommen, vermoegensFreigrenze, FREIBETRAG_17,
} from './einkommen';
import type { Person } from './types';

function mkPerson(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', nachname: 'Test', vorname: 'Max',
    version: 1, created_at: '', updated_at: '', ...over,
  };
}

describe('§16 Abzugssatz (10% je Kategorie, max 30%)', () => {
  test('keine Kategorie → 0', () => { expect(abzugssatz16({})).toBe(0); });
  test('eine Kategorie → 10%', () => { expect(abzugssatz16({ steuern: true })).toBeCloseTo(0.1, 5); });
  test('zwei Kategorien → 20%', () => { expect(abzugssatz16({ steuern: true, kvPv: true })).toBeCloseTo(0.2, 5); });
  test('drei Kategorien → 30% (Deckel)', () => {
    expect(abzugssatz16({ steuern: true, kvPv: true, rv: true })).toBeCloseTo(0.3, 5);
  });
});

describe('Jahreseinkommen (§14)', () => {
  test('summiert positive Jahresbeträge, keine Verlustverrechnung', () => {
    const p = mkPerson({ einkommen: [
      { id: 'e1', art: 'lohn_gehalt', betrag_jaehrlich: 24000, beruecksichtigt: true },
      { id: 'e2', art: 'v_und_v', betrag_jaehrlich: -5000, beruecksichtigt: true }, // Verlust: ignoriert
    ] });
    expect(jahreseinkommenRoh(p)).toBe(24000);
  });
  test('monatliche Beträge werden ×12 gerechnet', () => {
    const p = mkPerson({ einkommen: [{ id: 'e1', art: 'rente', betrag_monatlich: 1000, beruecksichtigt: true }] });
    expect(jahreseinkommenRoh(p)).toBe(12000);
  });
  test('mit §16-Abzug (20%)', () => {
    const p = mkPerson({ einkommen: [{ id: 'e1', art: 'lohn_gehalt', betrag_jaehrlich: 30000, beruecksichtigt: true }] });
    expect(jahreseinkommen(p, { steuern: true, kvPv: true })).toBeCloseTo(24000, 5);
  });
});

describe('Freibeträge (§17)', () => {
  test('Schwerbehinderung GdB 100 → 1.800 €', () => {
    expect(freibetraege17(mkPerson({ pflege_behinderung: { schwerbehinderungsgrad: 100 } }))).toBe(FREIBETRAG_17.schwerbehinderung);
  });
  test('GdB 50 + Pflegegrad → 1.800 €', () => {
    expect(freibetraege17(mkPerson({ pflege_behinderung: { schwerbehinderungsgrad: 50, pflegegrad: 2 } }))).toBe(1800);
  });
  test('GdB 50 ohne Pflege → 0', () => {
    expect(freibetraege17(mkPerson({ pflege_behinderung: { schwerbehinderungsgrad: 50 } }))).toBe(0);
  });
  test('Kind mit eigenem Erwerbseinkommen: gedeckelt auf 1.200 €', () => {
    const kind = mkPerson({ rolle: 'kind', einkommen: [{ id: 'e', art: 'lohn_gehalt', betrag_jaehrlich: 5000, beruecksichtigt: true }] });
    expect(freibetraege17(kind)).toBe(FREIBETRAG_17.kind_erwerb_max);
  });
});

describe('Gesamteinkommen (§13) + Freigrenze (§21)', () => {
  test('summiert Jahreseinkommen, zieht Freibeträge + Unterhalt ab, /12 monatlich', () => {
    const p1 = mkPerson({ id: 'p1', einkommen: [{ id: 'e', art: 'lohn_gehalt', betrag_jaehrlich: 24000, beruecksichtigt: true }] });
    const p2 = mkPerson({ id: 'p2', pflege_behinderung: { schwerbehinderungsgrad: 100 },
      einkommen: [{ id: 'e', art: 'rente', betrag_jaehrlich: 12000, beruecksichtigt: true }] });
    const r = gesamteinkommen([{ person: p1 }, { person: p2 }], 3000);
    expect(r.summeJahreseinkommen).toBe(36000);
    expect(r.summeFreibetraege).toBe(1800);
    expect(r.gesamteinkommenJahr).toBe(36000 - 1800 - 3000);
    expect(r.gesamteinkommenMonat).toBeCloseTo((36000 - 1800 - 3000) / 12, 5);
  });
  test('Vermögens-Freigrenze: 60k + 30k je weiteres Mitglied', () => {
    expect(vermoegensFreigrenze(1)).toBe(60000);
    expect(vermoegensFreigrenze(2)).toBe(90000);
    expect(vermoegensFreigrenze(3)).toBe(120000);
  });
});
