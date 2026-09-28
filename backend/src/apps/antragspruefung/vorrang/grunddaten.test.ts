import { describe, expect, test } from 'bun:test';
import {
  artAusStichworten, einkommensartAus, EINKOMMENSART_AUS_GRUNDSICHERUNG, EINKOMMENSART_AUS_WOHNGELD,
  TRANSFERART_AUS_WOHNGELD_AUSSCHLUSS, TRANSFERART_STICHWORTE, VERMOEGENSART_AUS_GRUNDSICHERUNG,
  VERMOEGENSART_STICHWORTE_WOHNGELD, vollstaendigkeit, VORRANG_EINKOMMENSARTEN, VORRANG_GRUNDDATEN_VERSION,
  VORRANG_TRANSFERARTEN, VORRANG_VERMOEGENSARTEN, type VorrangGrunddaten,
} from './grunddaten';

function leer(over: Partial<VorrangGrunddaten> = {}): VorrangGrunddaten {
  return {
    version: VORRANG_GRUNDDATEN_VERSION, quelle: 'grundsicherung', vorgangId: 'v',
    haushalt: [{ rolle: 'antragsteller', geburtsdatum: '1950-01-01', vermoegen_angegeben: true }],
    partnerschaft: 'keine',
    einkommen: [{ person: 0, art: 'gesetzliche_rente', art_quelle: 'altersrente', betrag_monat: 900 }],
    abzuege: [{ person: 0 }],
    wohnkosten: { eigentum: false, bruttokaltmiete: 500, heizkosten: 60, wohnflaeche_qm: 45, bewohner: 1 },
    vermoegen: [], alter_em: [{ person: 0, altersgrenze_erreicht: true }],
    schwerbehinderung: [{ person: 0 }], transferleistungen: [], eingang: { antragsdatum: '2026-08-01' },
    ...over,
  };
}

describe('Arten-Abbildungen', () => {
  test('alle Abbildungsziele liegen in den gemeinsamen Listen', () => {
    for (const t of [EINKOMMENSART_AUS_WOHNGELD, EINKOMMENSART_AUS_GRUNDSICHERUNG]) for (const a of Object.values(t)) expect(VORRANG_EINKOMMENSARTEN).toContain(a);
    for (const a of Object.values(VERMOEGENSART_AUS_GRUNDSICHERUNG)) expect(VORRANG_VERMOEGENSARTEN).toContain(a);
    for (const [, a] of VERMOEGENSART_STICHWORTE_WOHNGELD) expect(VORRANG_VERMOEGENSARTEN).toContain(a);
    for (const a of Object.values(TRANSFERART_AUS_WOHNGELD_AUSSCHLUSS)) expect(VORRANG_TRANSFERARTEN).toContain(a);
    for (const [, a] of TRANSFERART_STICHWORTE) expect(VORRANG_TRANSFERARTEN).toContain(a);
  });

  test('unbekannte Art → sonstiges', () => {
    expect(einkommensartAus(EINKOMMENSART_AUS_WOHNGELD, 'gibt_es_nicht')).toBe('sonstiges');
    expect(einkommensartAus(EINKOMMENSART_AUS_WOHNGELD, undefined)).toBe('sonstiges');
  });

  test('Wohngeld-Freitext Vermögen', () => {
    const art = (t: string) => artAusStichworten(VERMOEGENSART_STICHWORTE_WOHNGELD, t);
    expect(art('Bankguthaben')).toBe('konto');
    expect(art('Sparbuch')).toBe('konto');
    expect(art('Wertpapiere')).toBe('wertpapiere');
    expect(art('Bausparvertrag')).toBe('bausparvertrag');
    expect(art('Hausrat')).toBe('hausrat');
    expect(art('Riester-Rente')).toBe('gefoerderte_altersvorsorge');
    expect(art('Kapitallebensversicherung')).toBe('lebensversicherung');
    expect(art('Gemälde')).toBeUndefined();
  });

  test('Transferleistungen aus Freitext', () => {
    const art = (t: string) => artAusStichworten(TRANSFERART_STICHWORTE, t);
    expect(art('Grundsicherung im Alter')).toBe('grundsicherung');
    expect(art('Grundsicherung')).toBe('grundsicherung');
    expect(art('Grundsicherung für Arbeitsuchende')).toBe('sgb2');
    expect(art('Bürgergeld')).toBe('sgb2');
    expect(art('Sozialhilfe')).toBe('hilfe_lebensunterhalt');
    expect(art('AsylbLG')).toBe('asylblg');
    expect(art('BAföG')).toBe('ausbildungsfoerderung');
  });
});

describe('vollstaendigkeit', () => {
  test('vollständige Grunddaten → nichts fehlt', () => {
    expect(vollstaendigkeit(leer()).fehlend).toEqual([]);
  });

  test('Eigentum braucht keine Miete, Pauschalmiete keine Heizkosten', () => {
    const g = leer({ wohnkosten: { eigentum: true, heizung_in_miete: true, wohnflaeche_qm: 80, bewohner: 1 } });
    expect(vollstaendigkeit(g).fehlend).toEqual([]);
  });

  test('getrennte Miete statt Bruttokaltmiete genügt; nur Kaltmiete nicht', () => {
    expect(vollstaendigkeit(leer({ wohnkosten: { eigentum: false, kaltmiete: 400, nebenkosten_kalt: 90, heizkosten: 50, wohnflaeche_qm: 45, bewohner: 1 } })).fehlend).toEqual([]);
    expect(vollstaendigkeit(leer({ wohnkosten: { eigentum: false, kaltmiete: 400, heizkosten: 50, wohnflaeche_qm: 45, bewohner: 1 } })).fehlend).toEqual(['wohnkosten.nebenkosten_kalt']);
  });

  test('Erwerbsminderung nur gefragt, wenn die Altersgrenze nicht erreicht ist; Haushaltsangehörige ohne Vermögens-/Alterspflicht', () => {
    const g = leer({
      haushalt: [{ rolle: 'antragsteller', geburtsdatum: '1970-01-01', vermoegen_angegeben: true }, { rolle: 'haushaltsangehoerig', geburtsdatum: '2005-01-01' }],
      alter_em: [{ person: 0, altersgrenze_erreicht: false }, { person: 1 }],
      abzuege: [{ person: 0 }, { person: 1 }], schwerbehinderung: [{ person: 0 }, { person: 1 }],
    });
    expect(vollstaendigkeit(g).fehlend).toEqual(['alter_em[0].em_voll_dauerhaft']);
  });

  test('leerer Haushalt', () => {
    const f = vollstaendigkeit(leer({ haushalt: [], alter_em: [], einkommen: [] })).fehlend;
    expect(f).toContain('haushalt');
    expect(f).toContain('haushalt.antragsteller');
    expect(f).toContain('einkommen');
  });
});
