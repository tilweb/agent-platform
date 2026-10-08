import { describe, expect, test } from 'bun:test';
import { baueStruktur, erkenneKopf, klauselnAlsText } from './struktur';
import type { SeitenTranskript } from './types';

const seite = (n: number, text: string, rolle: SeitenTranskript['rolle'] = 'vertragstext'): SeitenTranskript => ({ seite: n, rolle, text });
const ids = (s: SeitenTranskript[]) => baueStruktur(s).map((k) => k.id);

describe('erkenneKopf', () => {
  test('Paragraph, Ziffer, Artikel, Anlage, Praeambel', () => {
    expect(erkenneKopf('## §6 Vertragsdauer und Kündigung')).toEqual({ art: 'paragraph', nummer: '6', titel: 'Vertragsdauer und Kündigung' });
    expect(erkenneKopf('**§ 10 Schriftform**')).toEqual({ art: 'paragraph', nummer: '10', titel: 'Schriftform' });
    expect(erkenneKopf('Ziffer 7 Entgelt')).toEqual({ art: 'ziffer', nummer: '7', titel: 'Entgelt' });
    expect(erkenneKopf('## Anhang 1: Auflistung der Geräte')?.art).toBe('anlage');
    expect(erkenneKopf('Präambel:')?.art).toBe('praeambel');
  });
  test('Verweise und lange Saetze im Fliesstext sind keine Koepfe', () => {
    expect(erkenneKopf('§ 6 Abs. 3 gilt entsprechend.')).toBeNull();
    expect(erkenneKopf('Anlage 1 ist Bestandteil dieses Vertrages und regelt die Standorte im Einzelnen.')).toBeNull();
  });
});

describe('baueStruktur', () => {
  test('Wartungsvertrag: Rubrum, Praeambel, §§ mit Absaetzen, seitenuebergreifend, Unterschriften, Anlage', () => {
    const s = [
      seite(1, '## Wartungsvertrag\n\nZwischen dem Auftraggeber: Kunde oHG\nund dem Auftragnehmer: END GmbH\n\n## Präambel\nDieser Vertrag ersetzt den bestehenden Wartungsvertrag.', 'deckblatt'),
      seite(2, '## §4 Gebühren und Abrechnung\n1. Alle Preise verstehen sich zzgl. Mehrwertsteuer.\n2. Für die Wartung berechnet der Auftragnehmer eine Pauschalgebühr von 20,- € pro Ladepunkt pro Monat.'),
      seite(3, '3. Die Abrechnung der Pauschalgebühr erfolgt jeweils zu Monatsbeginn und wird per SEPA-\nLastschrift eingezogen.\n\n## §6 Vertragsdauer und Kündigung\n1. Dieser Vertrag beginnt am 01.11.2022 und hat eine Mindestlaufzeit von 2 Jahren.\n2. Der Vertrag verlängert sich automatisch um ein Jahr, wenn er nicht wie unter §6 Abs. 3\n3. Der Vertrag kann mit einer Frist von 3 Monaten vor Ablauf des Vertrages von beiden Seiten gekündigt werden.\n\n## §7 Veränderung der Wartungsgebühr\n1. Die in §4 genannte Pauschalgebühr beruht auf einer Kalkulation'),
      seite(4, 'zum Zeitpunkt des Vertragsschlusses.\n2. Verändert sich die Liste der zu wartenden Anlagen, so bleibt die Gültigkeit bestehen.'),
      seite(5, 'Auftraggeber: Frankfurt, 01.11.2022 {{unterschrift: Kunde}} {{stempel: Kunde oHG}}', 'unterschriften'),
      seite(6, '## Anhang 1: Auflistung der enthaltenen Geräte\n| EVSE-ID | Hersteller |\n|---|---|\n| DE*END*E1 | Mennekes |\n\nStand 26.10.2022', 'anlage'),
      seite(7, '## SEPA-Basis-Lastschriftmandat\nGläubiger: END\n\n## SEPA-Basis-Lastschriftmandat\nIch ermächtige END.', 'mandat'),
    ];
    const k = baueStruktur(s);
    expect(k[0]).toMatchObject({ id: 'rubrum', titel: 'Wartungsvertrag' });
    expect(k.map((x) => x.id)).toEqual(['rubrum', 'praeambel', '§4', '§4.1', '§4.2', '§4.3', '§6', '§6.1', '§6.2', '§6.3', '§7', '§7.1', '§7.2', 'unterschriften', 'Anl1', 'S7']);
    expect(k.find((x) => x.id === 'S7')).toMatchObject({ rolle: 'mandat', titel: 'SEPA-Basis-Lastschriftmandat' });
    const abs43 = k.find((x) => x.id === '§4.3')!;
    expect(abs43.seiten).toEqual([3, 3]);
    expect(abs43.titelpfad).toEqual(['§ 4 Gebühren und Abrechnung', 'Abs. 3']);
    // §7 Abs. 1 laeuft von Seite 3 auf Seite 4 und behaelt seinen Paragraphentitel.
    const abs71 = k.find((x) => x.id === '§7.1')!;
    expect(abs71.seiten).toEqual([3, 4]);
    expect(abs71.text).toContain('Kalkulation\nzum Zeitpunkt des Vertragsschlusses');
    expect(abs71.titelpfad[0]).toBe('§ 7 Veränderung der Wartungsgebühr');
    expect(k.find((x) => x.id === 'unterschriften')!.rolle).toBe('unterschriften');
    expect(k.find((x) => x.id === 'Anl1')!.text).toContain('Mennekes');
  });

  test('Ziffern mit unnummerierten Absaetzen bekommen implizite Absatznummern', () => {
    const k = baueStruktur([seite(1, '## Ziffer 8 Haftung\nDer Mieter haftet für Schäden.\n\nEND haftet nicht für Ausfälle.\n\nDie Haftung nach dem Produkthaftungsgesetz bleibt unberührt.')]);
    expect(k.map((x) => x.id)).toEqual(['Z8', 'Z8.1', 'Z8.2', 'Z8.3']);
    expect(k.find((x) => x.id === 'Z8.3')).toMatchObject({ implizit: true, text: 'Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.' });
  });

  test('Dezimalgliederung unter §, Eltern und Ebenen; Anlage mit eigener Nummerierung kollidiert nicht', () => {
    const k = baueStruktur([
      seite(1, '## § 2 Ausbau\n2.5 Ausbau durch END\n2.5.1 END errichtet mindestens 2 Ladepunkte.\n2.5.2 Die Kosten trägt END.\n2.6 Baukostenzuschuss\nPremier zahlt einen Zuschuss.'),
      seite(2, '## Anlage 7 Technische Vorgaben\n2.5 Dokumentation\nUnterlagen 8 Wochen vor Installation.', 'anlage'),
    ]);
    expect(k.map((x) => x.id)).toEqual(['§2', '2.5', '2.5.1', '2.5.2', '2.6', 'Anl7', 'Anl7:2.5']);
    expect(k.find((x) => x.id === '2.5.1')).toMatchObject({ ebene: 3, eltern: '2.5' });
    expect(k.find((x) => x.id === '2.6')!.text).toBe('Baukostenzuschuss\nPremier zahlt einen Zuschuss.');
  });

  test('Muster/Vorlage/Datenblatt-Seiten ohne Kopf werden eigene Wurzeln mit ihrer Rolle', () => {
    const k = baueStruktur([
      seite(1, '## § 1 Gegenstand\nEND betreibt die Ladeinfrastruktur.'),
      seite(2, 'Gutschrift Muster\nkWh 55,39 ct', 'muster'),
      seite(3, 'Technische Daten AMTRON\n22 kW', 'datenblatt'),
    ]);
    expect(k.map((x) => [x.id, x.rolle])).toEqual([['§1', 'vertragstext'], ['S2', 'muster'], ['S3', 'datenblatt']]);
  });

  test('Kopf ohne Titel uebernimmt die naechste kurze Zeile; doppelte IDs werden eindeutig', () => {
    const k = baueStruktur([seite(1, '## § 3\nLeistungen\n1. Wartung jährlich.\n\n## § 3 Leistungen (Fortsetzung)\nText.')]);
    expect(k[0]).toMatchObject({ id: '§3', titel: 'Leistungen' });
    expect(k.map((x) => x.id)).toContain('§3#2');
  });

  test('Seitengrenze nach abgeschlossenem Satz trennt implizite Absaetze', () => {
    const k = baueStruktur([
      seite(1, '## Ziffer 9 Laufzeit\nDer Vertrag läuft unbefristet.'),
      seite(2, 'Die Kündigungsfrist beträgt 3 Monate zum Monatsende.'),
    ]);
    expect(k.map((x) => x.id)).toEqual(['Z9', 'Z9.1', 'Z9.2']);
    expect(k.find((x) => x.id === 'Z9.2')!.seiten).toEqual([2, 2]);
  });

  test('Nummerierte Ueberschriften sind Ziffern; wiederholter Kopf am Seitenanfang ist Fortsetzung; Anlage-Stempel auf Deckblatt bleibt im Rubrum', () => {
    const k = baueStruktur([
      seite(1, '## Anlage 2\n## Vertrag über den Betrieb von Ladeinfrastruktur\nzwischen END und Kunde', 'deckblatt'),
      seite(2, '## 2. Betriebsbeginn und Vertragslaufzeit\nDer Vertrag beginnt am 01.07.2023.\n\n## 3. Stromversorgung und -abrechnung\nDer Kunde hat die LIS anzuschließen.'),
      seite(3, '## § 3 Stromversorgung\n[x] Für die Lieferung von Strom ist der Kunde verantwortlich.\n\n## 4. Instandhaltung\nWartung jährlich.'),
    ]);
    expect(k.filter((x) => x.ebene === 1).map((x) => x.id)).toEqual(['rubrum', 'Z2', 'Z3', 'Z4']);
    expect(k.find((x) => x.id === 'rubrum')!.text).toContain('Anlage 2');
    expect(k.find((x) => x.id === 'Z3.2')).toMatchObject({ seiten: [3, 3], text: '[x] Für die Lieferung von Strom ist der Kunde verantwortlich.' });
  });

  test('Unterschriftsseite: Fortsetzungstext und letzter Abschnitt bleiben vor dem Unterschriftsblock', () => {
    const k = baueStruktur([
      seite(1, '## 10. Haftung\nEND haftet nur bei Vorsatz und'),
      seite(2, 'grober Fahrlässigkeit.\n\n## 11. Schlussbestimmungen\nGerichtsstand ist Frankfurt.\n\nOrt, Datum\n{{hs: Frankfurt, 6.7.2023}}\n{{unterschrift: Kunde}}', 'unterschriften'),
    ]);
    expect(k.filter((x) => x.ebene === 1).map((x) => x.id)).toEqual(['Z10', 'Z11', 'unterschriften']);
    expect(k.find((x) => x.id === 'Z10')!.seiten).toEqual([1, 2]);
    expect(k.find((x) => x.id === 'unterschriften')!.text).toContain('{{unterschrift: Kunde}}');
    expect(k.find((x) => x.id === 'Z11')!.text).toBe('Gerichtsstand ist Frankfurt.');
  });

  test('leere oder fehlerhafte Seiten werden ignoriert', () => {
    expect(ids([{ seite: 1, rolle: 'leer', text: '' }, { seite: 2, rolle: 'vertragstext', text: 'x', fehler: 'timeout' }])).toEqual([]);
  });

  test('klauselnAlsText rendert ID, Titelpfad und Seiten', () => {
    const k = baueStruktur([seite(2, '## §6 Kündigung\n1. Drei Monate vor Ablauf.')]);
    expect(klauselnAlsText(k)).toBe('[§6] § 6 Kündigung (S. 2)\n\n[§6.1] § 6 Kündigung › Abs. 1 (S. 2)\nDrei Monate vor Ablauf.');
  });
});
