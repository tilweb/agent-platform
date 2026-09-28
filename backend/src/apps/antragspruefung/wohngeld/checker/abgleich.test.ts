/**
 * Abgleich Antrag ↔ Beleg — je Regel positiv/negativ, Toleranzgrenzen, Frequenz-Normalisierung,
 * fehlende Werte ⇒ kein Befund. Spec: docs/wohngeld-antrag-beleg-abgleich-spec-2026-09-28.md
 */
import { describe, expect, test } from 'bun:test';
import type { Dokument, DokumentAnalyse, DokumentTyp, Person, PruefBefund, Vorgang, VorgangSnapshot } from '../types';
import { massgeblichesMietdokument, pruefeAbgleiche } from './abgleich';
import { ladeKonstanten } from './konstanten';

const basis = { version: 1, created_at: '', updated_at: '' };
const vorgang = (over: Partial<Vorgang> = {}): Vorgang => ({
  ...basis, id: 'v', akteId: 'a', antragsId: 'X', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
  status: 'sachbearbeitung', prioritaet: 'normal', antragsdatum: '2026-09-01', ...over,
});
const person = (over: Partial<Person> = {}): Person => ({
  ...basis, id: 'p1', vorgangId: 'v', rolle: 'antragsteller', vorname: 'Anna', nachname: 'Muster', ...over,
});
let n = 0;
const dok = (typ: DokumentTyp, analyse: DokumentAnalyse, over: Partial<Dokument> = {}): Dokument => ({
  ...basis, id: `d${++n}`, vorgangId: 'v', typ, istOriginal: false, analyse, ...over,
});
const snap = (s: Partial<VorgangSnapshot>): VorgangSnapshot => ({ vorgang: vorgang(), personen: [person()], dokumente: [], ...s });
const ids = (b: PruefBefund[]) => b.map((x) => x.regelId);
const finde = (b: PruefBefund[], id: string) => b.find((x) => x.regelId === id);

describe('Miethöhe: maßgebliches Mietdokument', () => {
  test('Mieterhöhung/Vermieterbescheinigung schlägt älteren Mietvertrag (F18-Muster)', () => {
    const mv = dok('mietvertrag', { miete: 710, mietdokument: 'mietvertrag' });
    const vb = dok('mietbescheinigung', { miete: 777, mietdokument: 'vermieterbescheinigung' });
    const b = pruefeAbgleiche(snap({ vorgang: vorgang({ wohnung: { miete: 710 } }), dokumente: [mv, vb] }));
    const f = finde(b, 'plausi-miethoehe-abweichung')!;
    expect(f.quellDokumentId).toBe(vb.id);
    expect(f.belegtext).toContain('777,00 €');
    expect(f.belegtext).toContain('710,00 €');
    expect(f.belegtext).toContain('Vermieterbescheinigung');
  });
  test('Antrag entspricht dem aktuellen Dokument, älterer Vertrag abweichend ⇒ kein Befund', () => {
    const b = pruefeAbgleiche(snap({
      vorgang: vorgang({ wohnung: { miete: 777 } }),
      dokumente: [dok('mietvertrag', { miete: 710 }), dok('mietvertrag', { miete: 777, mietdokument: 'mieterhoehung' })],
    }));
    expect(ids(b)).not.toContain('plausi-miethoehe-abweichung');
  });
  test('Datum „gültig ab" geht vor Dokumentart', () => {
    const vb = dok('mietbescheinigung', { miete: 700, miete_gueltig_ab: '2025-01-01' });
    const erh = dok('mietvertrag', { miete: 740, mietdokument: 'mieterhoehung', miete_gueltig_ab: '2026-10-01' });
    expect(massgeblichesMietdokument([vb, erh])?.id).toBe(erh.id);
  });
  test('Untermietvertrag zählt nur ohne anderes Mietdokument', () => {
    const mv = dok('mietvertrag', { miete: 600 });
    const um = dok('mietvertrag', { miete: 350, mietdokument: 'untermietvertrag' });
    expect(massgeblichesMietdokument([mv, um])?.id).toBe(mv.id);
    expect(massgeblichesMietdokument([um])?.id).toBe(um.id);
  });
  test('Toleranzgrenze: 1,00 € kein Befund, 1,01 € Befund', () => {
    const mit = (antrag: number) => pruefeAbgleiche(snap({ vorgang: vorgang({ wohnung: { miete: antrag } }), dokumente: [dok('mietbescheinigung', { miete: 500 })] }));
    expect(ids(mit(501))).not.toContain('plausi-miethoehe-abweichung');
    expect(ids(mit(501.01))).toContain('plausi-miethoehe-abweichung');
  });
  test('Differenz = Heiz-/Warmwasserkosten (Gesamtmiete gelesen) ⇒ kein Befund', () => {
    const b = pruefeAbgleiche(snap({ vorgang: vorgang({ wohnung: { miete: 640 } }), dokumente: [dok('mietbescheinigung', { miete: 730, heizkosten_warmwasser: 90 })] }));
    expect(ids(b)).not.toContain('plausi-miethoehe-abweichung');
  });
  test('ohne Antrag-Miete oder ohne Beleg-Miete ⇒ kein Befund', () => {
    expect(ids(pruefeAbgleiche(snap({ dokumente: [dok('mietbescheinigung', { miete: 500 })] })))).not.toContain('plausi-miethoehe-abweichung');
    expect(ids(pruefeAbgleiche(snap({ vorgang: vorgang({ wohnung: { miete: 500 } }), dokumente: [dok('mietbescheinigung', { wohnflaeche_qm: 50 })] })))).not.toContain('plausi-miethoehe-abweichung');
  });
  test('Wohnfläche aus dem maßgeblichen Dokument mit Flächenangabe', () => {
    const b = pruefeAbgleiche(snap({
      vorgang: vorgang({ wohnung: { wohnflaeche_qm: 72 } }),
      dokumente: [dok('mietvertrag', { wohnflaeche_qm: 62 }), dok('mietbescheinigung', { wohnflaeche_qm: 72 })],
    }));
    expect(ids(b)).not.toContain('plausi-wohnflaeche-abweichung');
  });
});

describe('Mietzahlung auf dem Kontoauszug', () => {
  const mit = (zahlung: number, hw?: number) => pruefeAbgleiche(snap({
    vorgang: vorgang({ wohnung: { miete: 550 } }),
    dokumente: [dok('mietbescheinigung', { miete: 550, ...(hw !== undefined ? { heizkosten_warmwasser: hw } : {}) }), dok('kontoauszug', { mietzahlung_betrag: zahlung, zeitraum_bis: '2026-07-31' })],
  }));
  test('Gesamtmiete (Bruttokalt + Heizung/Warmwasser) passt', () => {
    expect(ids(mit(620, 70))).not.toContain('plausi-mietzahlung-abweichung');
  });
  test('abweichende Zahlung ⇒ Hinweis mit beiden Werten und Monat', () => {
    const f = finde(mit(700, 70), 'plausi-mietzahlung-abweichung')!;
    expect(f.typ).toBe('info');
    expect(f.belegtext).toContain('700,00 €');
    expect(f.belegtext).toContain('550,00 €');
    expect(f.belegtext).toContain('Kontoauszug 07/2026');
  });
  test('Zahlung passt zum maßgeblichen Mietdokument, Antrag veraltet ⇒ nur Miethöhe, keine Doppelmeldung', () => {
    const b = pruefeAbgleiche(snap({
      vorgang: vorgang({ wohnung: { miete: 710 } }),
      dokumente: [dok('mietbescheinigung', { miete: 777, heizkosten_warmwasser: 100 }), dok('kontoauszug', { mietzahlung_betrag: 877 })],
    }));
    expect(ids(b)).toContain('plausi-miethoehe-abweichung');
    expect(ids(b)).not.toContain('plausi-mietzahlung-abweichung');
  });
  test('ohne bekannte Heizkosten nur zu niedrige Zahlung melden', () => {
    expect(ids(mit(640))).not.toContain('plausi-mietzahlung-abweichung');
    expect(ids(mit(500))).toContain('plausi-mietzahlung-abweichung');
  });
});

describe('Einkommen je Person', () => {
  const rente = (antrag: Partial<{ m: number; j: number; bez: string }>, a: DokumentAnalyse) => pruefeAbgleiche(snap({
    personen: [person({ einkommen: [{ id: 'e', art: 'rente', bezeichnung: antrag.bez ?? 'Altersrente', beruecksichtigt: false, ...(antrag.m !== undefined ? { betrag_monatlich: antrag.m } : {}), ...(antrag.j !== undefined ? { betrag_jaehrlich: antrag.j } : {}) }] })],
    dokumente: [dok('rentenbescheid', a, { personId: 'p1' })],
  }));
  test('Rente: Abweichung über 1 € ⇒ Anforderung mit beiden Beträgen', () => {
    const f = finde(rente({ m: 1136.4 }, { betrag: 1184.2, rentenart: 'Regelaltersrente', betrag_gueltig_ab: '2026-07-01' }), 'plausi-rente-abweichung')!;
    expect(f.typ).toBe('anforderung');
    expect(f.personId).toBe('p1');
    expect(f.belegtext).toContain('1.136,40 €');
    expect(f.belegtext).toContain('1.184,20 €');
    expect(f.belegtext).toContain('01.07.2026');
  });
  test('Rente: innerhalb 1 € kein Befund; jährliche Angabe wird auf den Monat umgerechnet', () => {
    expect(ids(rente({ m: 1183.5 }, { betrag: 1184.2 }))).not.toContain('plausi-rente-abweichung');
    expect(ids(rente({ j: 14210.4 }, { betrag: 1184.2 }))).not.toContain('plausi-rente-abweichung');
    expect(ids(rente({ j: 12000 }, { betrag: 1184.2 }))).toContain('plausi-rente-abweichung');
  });
  test('Rente: Betriebsrente im Antrag bleibt außen vor', () => {
    expect(ids(rente({ m: 300, bez: 'Betriebsrente' }, { betrag: 1184.2 }))).not.toContain('plausi-rente-abweichung');
  });
  test('Rente: nur Zahlbetrag belegt ⇒ Hinweis nur außerhalb der Spanne', () => {
    expect(ids(rente({ m: 1184.2 }, { zahlbetrag: 1037.36 }))).not.toContain('plausi-rente-zahlbetrag-pruefen');
    const b = rente({ m: 900 }, { zahlbetrag: 1037.36 });
    expect(finde(b, 'plausi-rente-zahlbetrag-pruefen')?.typ).toBe('info');
    expect(ids(b)).not.toContain('plausi-rente-abweichung');
  });
  test('Rente: ohne Bescheidbetrag oder ohne Antragsbetrag kein Befund', () => {
    expect(ids(rente({ m: 900 }, { rentenart_vorhanden: true }))).not.toContain('plausi-rente-abweichung');
    expect(ids(rente({}, { betrag: 1184.2 }))).not.toContain('plausi-rente-abweichung');
  });

  const lohn = (einkommen: Person['einkommen'], abr: DokumentAnalyse[]) => pruefeAbgleiche(snap({
    personen: [person({ einkommen })],
    dokumente: abr.map((a) => dok('gehaltsabrechnung', a, { personId: 'p1' })),
  }));
  const pos = (m?: number, j?: number, bez = 'Gehalt/Lohn') => [{ id: 'e', art: 'lohn_gehalt', bezeichnung: bez, beruecksichtigt: false, ...(m !== undefined ? { betrag_monatlich: m } : {}), ...(j !== undefined ? { betrag_jaehrlich: j } : {}) }];
  test('Erwerb: Toleranz 5 % (mind. 10 €) — 2.000 ↔ 2.100 kein Befund, 2.000 ↔ 2.110 Befund', () => {
    expect(ids(lohn(pos(2000), [{ betrag: 2100 }]))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
    const f = finde(lohn(pos(2000), [{ betrag: 2110, abrechnungsmonat: '2026-08' }]), 'plausi-einkommen-abweichung:lohn_gehalt')!;
    expect(f.personId).toBe('p1');
    expect(f.belegtext).toContain('2.000,00 €');
    expect(f.belegtext).toContain('2.110,00 €');
    expect(f.belegtext).toContain('08/2026');
  });
  test('Erwerb: Jahresgehalt wird auf den Monat normalisiert', () => {
    expect(ids(lohn(pos(undefined, 34680), [{ betrag: 2890 }]))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
  });
  test('Erwerb: aktueller Stand zählt (Kurzarbeit) — nur wenn letzter Monat UND Dreimonatsschnitt abweichen', () => {
    const abr = [3150, 3150, 1890, 1575, 1260, 1575].map((b, i) => ({ betrag: b, abrechnungsmonat: `2026-0${i + 3}` }));
    expect(ids(lohn(pos(1575), abr))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
    expect(ids(lohn(pos(3150), abr))).toContain('plausi-einkommen-abweichung:lohn_gehalt');
  });
  test('Erwerb: Sonderzahlung/Kurzarbeitergeld im Antrag zählen nicht zum Monatsbrutto', () => {
    const e = [...pos(2890), { id: 'w', art: 'lohn_gehalt', bezeichnung: 'Weihnachtsgeld', betrag_jaehrlich: 2000, beruecksichtigt: false }];
    expect(ids(lohn(e, [{ betrag: 2890 }]))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
  });
  test('Erwerb: zwei Beschäftigungen — Monatssumme über Arbeitgeber, ohne Monate kein Vergleich', () => {
    const e = [...pos(1380, undefined, 'Teilzeit'), ...pos(480, undefined, 'Minijob').map((x) => ({ ...x, id: 'e2' }))];
    const mitMonat = [{ betrag: 1380, abrechnungsmonat: '2026-08' }, { betrag: 480, abrechnungsmonat: '2026-08' }];
    expect(ids(lohn(e, mitMonat))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
    expect(ids(lohn(e, [{ betrag: 1380 }, { betrag: 900 }]))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
  });
  test('Erwerb: fehlender Antragsbetrag oder fremde Person ⇒ kein Befund', () => {
    expect(ids(lohn(pos(), [{ betrag: 2890 }]))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
    const b = pruefeAbgleiche(snap({ personen: [person({ einkommen: pos(1000) })], dokumente: [dok('gehaltsabrechnung', { betrag: 2890 }, { personId: 'p2' })] }));
    expect(ids(b)).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
  });
  test('Verdienstbescheinigung zählt nur mit Einkommensart Lohn (nicht Steuerbescheid/Lohnersatz)', () => {
    const mit = (a: DokumentAnalyse) => pruefeAbgleiche(snap({ personen: [person({ einkommen: pos(2000) })], dokumente: [dok('verdienstbescheinigung', a, { personId: 'p1' })] }));
    expect(ids(mit({ betrag: 30000 }))).not.toContain('plausi-einkommen-abweichung:lohn_gehalt');
    expect(ids(mit({ betrag: 2500, einkommensart: 'lohn_gehalt' }))).toContain('plausi-einkommen-abweichung:lohn_gehalt');
  });
  test('Lohnersatz: Elterngeld laut Bescheid', () => {
    const mit = (betrag: number) => pruefeAbgleiche(snap({
      personen: [person({ einkommen: [{ id: 'e', art: 'elterngeld', betrag_monatlich: 780, beruecksichtigt: false }] })],
      dokumente: [dok('verdienstbescheinigung', { betrag, einkommensart: 'elterngeld' }, { personId: 'p1' })],
    }));
    expect(ids(mit(780))).not.toContain('plausi-einkommen-abweichung:elterngeld');
    expect(ids(mit(1200))).toContain('plausi-einkommen-abweichung:elterngeld');
  });
});

describe('Kontoauszug: nicht angegebene Eingänge', () => {
  const f21 = (antragMinijob = false, abrechnungMinijob = false) => pruefeAbgleiche(snap({
    personen: [person({ einkommen: [
      { id: 'e', art: 'lohn_gehalt', bezeichnung: 'Teilzeit', betrag_monatlich: 1380, beruecksichtigt: false },
      ...(antragMinijob ? [{ id: 'm', art: 'lohn_gehalt', bezeichnung: 'Minijob', betrag_monatlich: 480, beruecksichtigt: false }] : []),
    ] })],
    dokumente: [
      dok('gehaltsabrechnung', { betrag: 1380, arbeitgeber: 'Rheinufer Apotheken OHG', abrechnungsmonat: '2026-07' }, { personId: 'p1' }),
      ...(abrechnungMinijob ? [dok('gehaltsabrechnung', { betrag: 480, arbeitgeber: 'Gaststätte Zum Mülheimer Hafen GmbH', abrechnungsmonat: '2026-07' }, { personId: 'p1' })] : []),
      ...['2026-07-31', '2026-08-31'].map((bis) => dok('kontoauszug', { zeitraum_bis: bis, eingaenge: [
        { verwendungszweck: 'Rheinufer Apotheken OHG', betrag: 1050.12, art: 'erwerb', wiederkehrend: true },
        { verwendungszweck: 'Gaststätte Zum Mülheimer Hafen GmbH', betrag: 480, art: 'erwerb' },
        { verwendungszweck: 'Familienkasse', betrag: 255, art: 'kindergeld', wiederkehrend: true },
      ] }, { personId: 'p1' })),
    ],
  }));
  test('Erwerbseingang eines Arbeitgebers ohne Nachweis, über zwei Auszüge (F21-Muster)', () => {
    const f = finde(f21(), 'plausi-kontoauszug-unerklaerte-eingaenge')!;
    expect(f.personId).toBe('p1');
    expect(f.belegtext).toContain('Gaststätte Zum Mülheimer Hafen GmbH');
    expect(f.belegtext).toContain('480,00 €');
    expect(f.belegtext).toContain('Kontoauszug 07/2026, Kontoauszug 08/2026');
    expect(f.belegtext).not.toContain('Apotheken');
    expect(f.belegtext).not.toContain('Familienkasse');
  });
  test('mit Abrechnung dieses Arbeitgebers kein Befund', () => {
    expect(ids(f21(true, true))).not.toContain('plausi-kontoauszug-unerklaerte-eingaenge');
  });
  test('fehlt der Nachweis einer angegebenen Beschäftigung, meldet die Vollständigkeit — hier nichts', () => {
    expect(ids(f21(true, false))).not.toContain('plausi-kontoauszug-unerklaerte-eingaenge');
  });
  test('Art ohne Angabe im Antrag (Rente) wird gemeldet; einmalig nur bei Kapitalerträgen', () => {
    const b = pruefeAbgleiche(snap({ dokumente: [dok('kontoauszug', { eingaenge: [
      { verwendungszweck: 'Deutsche Rentenversicherung', betrag: 900, art: 'rente', wiederkehrend: true },
      { verwendungszweck: 'Erstattung Stadtwerke', betrag: 40, art: 'erstattung' },
      { verwendungszweck: 'Oma Lehmann', betrag: 100, art: 'zuwendung', wiederkehrend: true },
      { verwendungszweck: 'Heidrun Lehmann Zuschuss Miete 06/2026', betrag: 200, art: 'miete_einnahme', wiederkehrend: true },
    ] }, { personId: 'p1' })] }));
    const f = finde(b, 'plausi-kontoauszug-unerklaerte-eingaenge')!;
    expect(f.belegtext).toContain('Deutsche Rentenversicherung');
    expect(f.belegtext).not.toContain('Oma');
    expect(f.belegtext).not.toContain('Zuschuss');
    expect(f.belegtext).not.toContain('Stadtwerke');
  });
  test('Eingangsliste ersetzt die Einkunftsarten-Flags des Auszugs', async () => {
    const { pruefePlausibilitaet } = await import('./plausibilitaet');
    const b = pruefePlausibilitaet(snap({ dokumente: [dok('kontoauszug', { erkannte_einkuenfte: ['kapitalertraege'], eingaenge: [{ verwendungszweck: 'Depot Zinsen', betrag: 12, art: 'kapitalertrag' }] }, { personId: 'p1' })] }));
    expect(ids(b).filter((x) => x.startsWith('plausi-kontoauszug-unerklaerte-einkuenfte'))).toEqual([]);
    expect(ids(b)).toContain('plausi-kontoauszug-unerklaerte-eingaenge');
  });
});

describe('Vermögen ↔ Belege', () => {
  const antrag = dok('wohngeldantrag', {});
  test('Frage 20 „Nein", Depot über der Freigrenze (F22-Muster)', () => {
    const f = finde(pruefeAbgleiche(snap({ dokumente: [antrag, dok('vermoegensnachweis', { betrag: 140216.84 }, { personId: 'p1', titel: 'Depotauszug' })] })), 'plausi-vermoegen-beleg-abweichung')!;
    expect(f.belegtext).toContain('140.216,84 €');
    expect(f.belegtext).toContain('60.000,00 €');
  });
  test('kein Vermögen erfasst, Belege unter der Freigrenze ⇒ kein Befund; ohne Antrag kein Befund', () => {
    expect(ids(pruefeAbgleiche(snap({ dokumente: [antrag, dok('kontoauszug', { endsaldo: 2300 })] })))).not.toContain('plausi-vermoegen-beleg-abweichung');
    expect(ids(pruefeAbgleiche(snap({ dokumente: [dok('vermoegensnachweis', { betrag: 90000 })] })))).not.toContain('plausi-vermoegen-beleg-abweichung');
  });
  test('Angabe vorhanden: Toleranz 10 % (mind. 250 €), letzter Saldo je Konto', () => {
    const mit = (saldi: number[]) => pruefeAbgleiche(snap({
      personen: [person({ vermoegenPositionen: [{ id: 'v', art: 'Bankguthaben', betrag: 20000 }] })],
      dokumente: [antrag, ...saldi.map((s, i) => dok('kontoauszug', { endsaldo: s, iban: 'DE01', zeitraum_bis: `2026-0${i + 6}-30` }))],
    }));
    expect(ids(mit([30000, 22000]))).not.toContain('plausi-vermoegen-beleg-abweichung'); // letzter Saldo 22.000 ≤ 20.000 + 2.000
    expect(ids(mit([22000, 22001]))).toContain('plausi-vermoegen-beleg-abweichung');
  });
  test('weniger belegt als angegeben ist kein Widerspruch', () => {
    const b = pruefeAbgleiche(snap({ personen: [person({ vermoegen: 50000 })], dokumente: [antrag, dok('kontoauszug', { endsaldo: 800 })] }));
    expect(ids(b)).not.toContain('plausi-vermoegen-beleg-abweichung');
  });
});

describe('Identität', () => {
  const mit = (p: Partial<Person>, a: DokumentAnalyse, typ: DokumentTyp = 'personalausweis') =>
    pruefeAbgleiche(snap({ personen: [person(p)], dokumente: [dok(typ, a, { personId: 'p1' })] }));
  test('Geburtsdatum weicht ab ⇒ Anforderung mit beiden Daten', () => {
    const f = finde(mit({ geburtsdatum: '1990-06-17' }, { person_geburtsdatum: '1990-07-16' }), 'plausi-geburtsdatum-abweichung')!;
    expect(f.typ).toBe('anforderung');
    expect(f.belegtext).toContain('17.06.1990');
    expect(f.belegtext).toContain('16.07.1990');
  });
  test('gleiches Datum (auch deutsch geschrieben) oder fehlende Seite ⇒ kein Befund', () => {
    expect(ids(mit({ geburtsdatum: '1990-06-17' }, { person_geburtsdatum: '17.06.1990' }))).not.toContain('plausi-geburtsdatum-abweichung');
    expect(ids(mit({}, { person_geburtsdatum: '1990-06-17' }))).not.toContain('plausi-geburtsdatum-abweichung');
    expect(ids(mit({ geburtsdatum: '1990-06-17' }, {}))).not.toContain('plausi-geburtsdatum-abweichung');
  });
  test('Nachname weicht ab ⇒ Hinweis; Geburtsname und ein Lesefehler werden toleriert', () => {
    expect(finde(mit({}, { person_vorname: 'Anna', person_nachname: 'Schmidt' }), 'plausi-name-abweichung')?.typ).toBe('info');
    expect(ids(mit({ geburtsname: 'Schmidt' }, { person_vorname: 'Anna', person_nachname: 'Schmidt' }))).not.toContain('plausi-name-abweichung');
    expect(ids(mit({ nachname: 'Altmayer' }, { person_nachname: 'Altmeyer' }))).not.toContain('plausi-name-abweichung');
  });
  test('Kontoauszug (gemeinsames Konto) wird beim Namen nicht verglichen', () => {
    expect(ids(mit({}, { person_vorname: 'Dennis', person_nachname: 'Hoffmann' }, 'kontoauszug'))).not.toContain('plausi-name-abweichung');
  });
});

describe('Haushalt ↔ Mietvertrag', () => {
  test('Mitmieterin nicht im Antrag ⇒ Hinweis', () => {
    const b = pruefeAbgleiche(snap({ dokumente: [dok('mietvertrag', { mieter: [{ vorname: 'Anna', nachname: 'Muster' }, { vorname: 'Laura', nachname: 'Muster' }] })] }));
    const f = finde(b, 'plausi-mieter-nicht-im-haushalt')!;
    expect(f.typ).toBe('info');
    expect(f.belegtext).toContain('Laura Muster');
    expect(f.belegtext).not.toContain('Anna Muster');
  });
  test('alle Mieter im Haushalt (auch per Geburtsdatum) ⇒ kein Befund; ohne Mieterliste kein Befund', () => {
    const personen = [person(), person({ id: 'p2', rolle: 'ehegatte', vorname: 'Laura', nachname: 'Beispiel', geburtsdatum: '1990-06-17' })];
    expect(ids(pruefeAbgleiche(snap({ personen, dokumente: [dok('mietvertrag', { mieter: [{ vorname: 'Anna', nachname: 'Muster' }, { vorname: 'Laura', nachname: 'Muster', geburtsdatum: '1990-06-17' }] })] })))).not.toContain('plausi-mieter-nicht-im-haushalt');
    expect(ids(pruefeAbgleiche(snap({ dokumente: [dok('mietvertrag', { miete: 500 })] })))).not.toContain('plausi-mieter-nicht-im-haushalt');
  });
  test('Untermietvertrag wird nicht ausgewertet', () => {
    const b = pruefeAbgleiche(snap({ dokumente: [dok('mietvertrag', { mietdokument: 'untermietvertrag', mieter: [{ vorname: 'Tom', nachname: 'Fremd' }] })] }));
    expect(ids(b)).not.toContain('plausi-mieter-nicht-im-haushalt');
  });
});

test('Konstanten per Umgebung überschreibbar', () => {
  const k = ladeKonstanten({ WOHNGELD_MIETE_TOLERANZ_EUR: '10', WOHNGELD_EINKOMMEN_TOLERANZ_PROZENT: '0,1', WOHNGELD_RENTE_TOLERANZ_EUR: 'x' });
  expect(k.MIETE_TOLERANZ_EUR).toBe(10);
  expect(k.EINKOMMEN_TOLERANZ_PROZENT).toBe(0.1);
  expect(k.RENTE_TOLERANZ_EUR).toBe(1);
  const b = pruefeAbgleiche(snap({ vorgang: vorgang({ wohnung: { miete: 505 } }), dokumente: [dok('mietbescheinigung', { miete: 500 })] }), { konstanten: { MIETE_TOLERANZ_EUR: 10 } });
  expect(ids(b)).not.toContain('plausi-miethoehe-abweichung');
});
