import { test, expect, describe } from 'bun:test';
import {
  abzugssatz16, jahreseinkommenRoh, jahreseinkommen, freibetraege17,
  gesamteinkommen, vermoegensFreigrenze, FREIBETRAG_17,
  abzugskategorienFuer, berechneVorgangEinkommen,
  unterhaltsabzuegeFuer, unterhaltsabzuegeFuerPerson, vermoegenSummeFuer, haushaltsVermoegen,
} from './einkommen';
import type { Person, Dokument } from './types';

function mkPerson(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', nachname: 'Test', vorname: 'Max',
    version: 1, created_at: '', updated_at: '', ...over,
  };
}
function mkDok(over: Partial<Dokument> = {}): Dokument {
  return {
    id: 'd', vorgangId: 'v1', typ: 'sonstiges', istOriginal: false,
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

describe('§16-Abzugskategorien ableiten (abzugskategorienFuer)', () => {
  test('Angestellter mit Lohn: steuern + rv + kvPv (Erwerbseinkommen)', () => {
    const p = mkPerson({ erwerbsstatus: 'angestellt',
      einkommen: [{ id: 'e', art: 'lohn_gehalt', betrag_monatlich: 2000, beruecksichtigt: true }] });
    expect(abzugskategorienFuer(p, [])).toEqual({ kvPv: true, steuern: true, rv: true });
  });
  test('Rentner ohne KV/PV-Nachweis: kvPv aus Renteneinkommen, kein steuern/rv', () => {
    const p = mkPerson({ erwerbsstatus: 'rente_pension',
      einkommen: [{ id: 'e', art: 'rente', betrag_monatlich: 900, beruecksichtigt: true }] });
    expect(abzugskategorienFuer(p, [])).toEqual({ kvPv: true, steuern: false, rv: false });
  });
  test('Ohne Einkommen: kvPv nur bei vorhandenem KV/PV-Nachweis', () => {
    const p = mkPerson({ id: 'pX', erwerbsstatus: 'ohne_erwerb' });
    expect(abzugskategorienFuer(p, [])).toEqual({ kvPv: false, steuern: false, rv: false });
    const dok = mkDok({ typ: 'kv_pv_nachweis', personId: 'pX' });
    expect(abzugskategorienFuer(p, [dok])).toEqual({ kvPv: true, steuern: false, rv: false });
  });
});

describe('Vorgangs-Einkommen (berechneVorgangEinkommen)', () => {
  test('leitet Kategorien je Person ab und summiert (§13)', () => {
    const p1 = mkPerson({ id: 'p1', vorname: 'Anna', nachname: 'Muster', erwerbsstatus: 'angestellt',
      einkommen: [{ id: 'e', art: 'lohn_gehalt', betrag_jaehrlich: 30000, beruecksichtigt: true }] });
    const p2 = mkPerson({ id: 'p2', vorname: 'Bea', nachname: 'Muster', erwerbsstatus: 'rente_pension',
      einkommen: [{ id: 'e', art: 'rente', betrag_jaehrlich: 12000, beruecksichtigt: true }] });
    const r = berechneVorgangEinkommen([p1, p2], [], 0);

    // p1: 30000 × (1 - 0.3) = 21000 (steuern+kvPv+rv), p2: 12000 × (1 - 0.1) = 10800 (kvPv)
    const z1 = r.proPerson.find(z => z.personId === 'p1')!;
    const z2 = r.proPerson.find(z => z.personId === 'p2')!;
    expect(z1.name).toBe('Anna Muster');
    expect(z1.abzugskategorien).toEqual({ kvPv: true, steuern: true, rv: true });
    expect(z1.jahreseinkommen).toBeCloseTo(21000, 5);
    expect(z2.abzugskategorien).toEqual({ kvPv: true, steuern: false, rv: false });
    expect(z2.jahreseinkommen).toBeCloseTo(10800, 5);

    expect(r.summeJahreseinkommen).toBeCloseTo(31800, 5);
    expect(r.gesamteinkommenJahr).toBeCloseTo(31800, 5);
    expect(r.gesamteinkommenMonat).toBeCloseTo(31800 / 12, 5);
  });
  test('Unterhaltsabzüge (§18) mindern das Gesamteinkommen', () => {
    const p = mkPerson({ id: 'p1',
      einkommen: [{ id: 'e', art: 'rente', betrag_jaehrlich: 12000, beruecksichtigt: true }] });
    const r = berechneVorgangEinkommen([p], [], 3000);
    expect(r.unterhaltsabzuege).toBe(3000);
    expect(r.gesamteinkommenJahr).toBeCloseTo(12000 * 0.9 - 3000, 5);
  });
});

describe('Unterhaltsabzüge § 18 (unterhaltsabzuegeFuer)', () => {
  test('ohne Titel: gedeckelt auf Kategorie-Höchstbetrag', () => {
    const p = mkPerson({ unterhaltsverpflichtungen: [
      { id: 'u1', empfaengerKategorie: 'kind_anderer_elternteil', betrag: 5000, titelVorhanden: false }, // max 3000
    ] });
    expect(unterhaltsabzuegeFuerPerson(p)).toBe(3000);
  });
  test('mit Titel: tatsächliche Höhe (über Höchstbetrag hinaus)', () => {
    const p = mkPerson({ unterhaltsverpflichtungen: [
      { id: 'u1', empfaengerKategorie: 'kind_anderer_elternteil', betrag: 5000, titelVorhanden: true },
    ] });
    expect(unterhaltsabzuegeFuerPerson(p)).toBe(5000);
  });
  test('ohne Titel unter Höchstbetrag: tatsächlicher Betrag', () => {
    const p = mkPerson({ unterhaltsverpflichtungen: [
      { id: 'u1', empfaengerKategorie: 'ehegatte_getrennt', betrag: 4000, titelVorhanden: false }, // max 6000
    ] });
    expect(unterhaltsabzuegeFuerPerson(p)).toBe(4000);
  });
  test('summiert über mehrere Personen', () => {
    const p1 = mkPerson({ id: 'p1', unterhaltsverpflichtungen: [
      { id: 'u1', empfaengerKategorie: 'sonstige', betrag: 9000, titelVorhanden: false }, // max 3000
    ] });
    const p2 = mkPerson({ id: 'p2', unterhaltsverpflichtungen: [
      { id: 'u2', empfaengerKategorie: 'auswaertige_ausbildung', betrag: 2000, titelVorhanden: false },
    ] });
    expect(unterhaltsabzuegeFuer([p1, p2])).toBe(3000 + 2000);
  });
  test('keine Verpflichtungen → 0', () => {
    expect(unterhaltsabzuegeFuer([mkPerson()])).toBe(0);
  });
});

describe('Vermögenssumme (Listen + Legacy)', () => {
  test('Summe aus vermoegenPositionen', () => {
    const p = mkPerson({ vermoegenPositionen: [
      { id: 'v1', art: 'Bankguthaben', betrag: 10000 },
      { id: 'v2', art: 'Wertpapiere', betrag: 5000 },
    ] });
    expect(vermoegenSummeFuer(p)).toBe(15000);
  });
  test('Fallback auf Legacy vermoegen wenn keine Positionen', () => {
    expect(vermoegenSummeFuer(mkPerson({ vermoegen: 12500 }))).toBe(12500);
  });
  test('Positionen sind führend gegenüber Legacy', () => {
    const p = mkPerson({ vermoegen: 99999, vermoegenPositionen: [{ id: 'v1', art: 'x', betrag: 100 }] });
    expect(vermoegenSummeFuer(p)).toBe(100);
  });
  test('haushaltsVermoegen summiert über Personen', () => {
    const p1 = mkPerson({ id: 'p1', vermoegenPositionen: [{ id: 'v1', art: 'x', betrag: 40000 }] });
    const p2 = mkPerson({ id: 'p2', vermoegen: 20000 });
    expect(haushaltsVermoegen([p1, p2])).toBe(60000);
  });
});
