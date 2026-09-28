/**
 * Vertrags-Test: Beide Apps liefern für einen vergleichbaren Fall (Rentnerehepaar zur Miete)
 * Grunddaten in derselben Form und befüllen dieselben Pflicht-Grunddaten. Abweichungen sind
 * nur die dokumentierten Lücken der jeweiligen Erfassung (Wohngeld: Zahl der Bewohner).
 */
import { describe, expect, test } from 'bun:test';
import {
  einsatzgemeinschaft, vollstaendigkeit, VORRANG_EINKOMMENSARTEN, VORRANG_GRUNDDATEN_VERSION,
  VORRANG_TRANSFERARTEN, VORRANG_VERMOEGENSARTEN, type VorrangGrunddaten,
} from './grunddaten';
import { grunddatenFuerVorrangpruefung as ausWohngeld } from '../wohngeld/vorrang-grunddaten';
import { grunddatenFuerVorrangpruefung as ausGrundsicherung } from '../grundsicherung/vorrang-grunddaten';
import type * as WG from '../wohngeld/types';
import type * as GS from '../grundsicherung/types';

const basis = { version: 1, created_at: '', updated_at: '' };

function wohngeldFall(): WG.VorgangSnapshot {
  const p = (over: Partial<WG.Person>): WG.Person => ({ ...basis, id: 'p', vorgangId: 'v', rolle: 'haushaltsmitglied', nachname: 'M', vorname: 'X', ...over });
  return {
    vorgang: {
      ...basis, id: 'wg-1', akteId: 'a', antragsId: 'W-1', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
      status: 'sachbearbeitung', prioritaet: 'normal', antragsdatum: '2026-08-12',
      wohnung: { miete: 540, heizkosten: 80, wohnflaeche_qm: 60 },
    },
    personen: [
      p({ id: 'a', rolle: 'antragsteller', geburtsdatum: '1955-06-01', einkommen: [{ id: 'e', art: 'rente', betrag_monatlich: 950, beruecksichtigt: true }], vermoegenPositionen: [{ id: 'v', art: 'Sparbuch', betrag: 3000 }] }),
      p({ id: 'b', rolle: 'ehegatte', geburtsdatum: '1957-09-15', einkommen: [{ id: 'e', art: 'rente', betrag_monatlich: 420, beruecksichtigt: true }], vermoegen: 0 }),
    ],
    dokumente: [],
  };
}

function grundsicherungFall(): GS.VorgangSnapshot {
  const p = (over: Partial<GS.Person>): GS.Person => ({ ...basis, id: 'p', vorgangId: 'v', rolle: 'haushaltsangehoerig', nachname: 'M', vorname: 'X', ...over });
  return {
    vorgang: {
      ...basis, id: 'gs-1', akteId: 'a', vorgangsnummer: 'G-1', antragsart: 'erstantrag', anspruchsgrund: 'alter',
      status: 'sachbearbeitung', prioritaet: 'normal', antragsdatum: '2026-08-12', wohnsituation: 'miete',
      wohnung: { kaltmiete: 440, nebenkosten_kalt: 100, heizkosten: 80, wohnflaeche_qm: 60, bewohner_anzahl: 2 },
    },
    personen: [
      p({ id: 'a', rolle: 'antragsteller', geburtsdatum: '1955-06-01', familienstand: 'verheiratet', einkommen: [{ id: 'e', art: 'altersrente', betrag_monat: 950 }], vermoegen: [{ id: 'v', art: 'sparbuch', betrag: 3000 }] }),
      p({ id: 'b', rolle: 'partner', geburtsdatum: '1957-09-15', familienstand: 'verheiratet', einkommen: [{ id: 'e', art: 'altersrente', betrag_monat: 420 }], vermoegen: [] }),
    ],
    dokumente: [],
  };
}

/** Pflicht-Grunddaten, die jede App für einen vollständig erfassten Fall liefern muss. */
function pflichtBefuellt(g: VorrangGrunddaten): Record<string, boolean> {
  const eg = einsatzgemeinschaft(g);
  const w = g.wohnkosten;
  return {
    version: g.version === VORRANG_GRUNDDATEN_VERSION,
    stichtag: !!g.stichtag,
    antragsteller_zuerst: g.haushalt[0]?.rolle === 'antragsteller',
    partner: g.haushalt.some((h) => h.rolle === 'partner'),
    geburtsdaten: g.haushalt.every((h) => !!h.geburtsdatum),
    partnerschaft: g.partnerschaft !== undefined,
    vermoegen_angegeben: eg.every((i) => g.haushalt[i]!.vermoegen_angegeben === true),
    einkommen: g.einkommen.length > 0 && g.einkommen.every((e) => typeof e.betrag_monat === 'number'),
    einkommen_je_person: eg.every((i) => g.einkommen.some((e) => e.person === i)),
    miete: w.bruttokaltmiete !== undefined || (w.kaltmiete !== undefined && w.nebenkosten_kalt !== undefined),
    heizkosten: w.heizkosten !== undefined,
    wohnflaeche: w.wohnflaeche_qm !== undefined,
    eigentum: w.eigentum === false,
    altersgrenze: eg.every((i) => g.alter_em[i]?.altersgrenze_erreicht === true),
    je_person_listen: [g.alter_em, g.schwerbehinderung, g.abzuege].every((l) => l.length === g.haushalt.length && l.every((x, i) => x.person === i)),
    eingang: !!(g.eingang.datum || g.eingang.antragsdatum),
  };
}

function formVon(g: VorrangGrunddaten) {
  return {
    oben: Object.keys(g).sort(),
    haushalt: g.haushalt.map((h) => h.rolle),
    einkommen: g.einkommen.map((e) => [e.person, typeof e.art]),
    vermoegen: g.vermoegen.map((v) => [v.person, v.art, v.betrag]),
  };
}

describe('Grunddaten-Vertrag Wohngeld ↔ Grundsicherung', () => {
  const wg = ausWohngeld(wohngeldFall());
  const gs = ausGrundsicherung(grundsicherungFall());

  test('gleiche Form', () => {
    expect(formVon(wg)).toEqual(formVon(gs));
    expect(wg.quelle).toBe('wohngeld');
    expect(gs.quelle).toBe('grundsicherung');
  });

  test('dieselben Pflicht-Grunddaten befüllt', () => {
    const erwartet = pflichtBefuellt(gs);
    expect(Object.values(erwartet).every(Boolean)).toBe(true);
    expect(pflichtBefuellt(wg)).toEqual(erwartet);
  });

  test('nur Arten aus den gemeinsamen Listen', () => {
    for (const g of [wg, gs]) {
      for (const e of g.einkommen) expect(VORRANG_EINKOMMENSARTEN).toContain(e.art);
      for (const v of g.vermoegen) expect(VORRANG_VERMOEGENSARTEN).toContain(v.art);
      for (const t of g.transferleistungen) expect(VORRANG_TRANSFERARTEN).toContain(t.art);
    }
  });

  test('Vollständigkeit: Abweichung nur in den dokumentierten Lücken', () => {
    expect(vollstaendigkeit(gs).fehlend).toEqual([]);
    expect(vollstaendigkeit(wg).fehlend).toEqual(['wohnkosten.bewohner']);
  });

  test('gleiche Werte für denselben Sachverhalt', () => {
    expect(wg.einkommen.map((e) => e.betrag_monat)).toEqual(gs.einkommen.map((e) => e.betrag_monat));
    expect(wg.alter_em.map((a) => a.altersgrenze_am)).toEqual(gs.alter_em.map((a) => a.altersgrenze_am));
  });
});
