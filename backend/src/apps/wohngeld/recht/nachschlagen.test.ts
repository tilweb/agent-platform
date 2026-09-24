import { describe, expect, test } from 'bun:test';
import { absatzText, parseGesetzXml } from './gesetz-parser';
import { GESETZ_ABSAETZE, GESETZ_QUELLEN } from './gesetze.generated';
import { direkteAbfrage, ganzerParagraph, leseAuswahl, schlageNach, vorauswahl } from './nachschlagen';

const XML = `<dokumente><norm doknr="A"><metadaten><jurabk>TestG</jurabk><amtabk>TestG</amtabk><langue>Testgesetz</langue>
<standangabe><standtyp>Neuf</standtyp><standkommentar>Neugefasst durch Bek. v. 1.1.2000</standkommentar></standangabe>
<standangabe><standtyp>Stand</standtyp><standkommentar>Zuletzt geändert durch Art. 1 G v. 2.2.2026</standkommentar></standangabe></metadaten></norm>
<norm doknr="B"><metadaten><jurabk>TestG</jurabk><enbez>§ 3</enbez><titel format="XML">Pflichten</titel></metadaten><textdaten><text format="XML"><Content>
<P>(1) Wer Leistungen beantragt, hat <DL Type="arabic"><DT>1.</DT><DD><LA>alle Tatsachen anzugeben &amp; </LA></DD><DT>2.</DT><DD><LA>Beweismittel zu bezeichnen.</LA></DD></DL></P>
<P>(2) Satz 1 gilt entsprechend.</P></Content></text></textdaten></norm>
<norm doknr="C"><metadaten><jurabk>TestG</jurabk><enbez>§ 4</enbez><titel format="XML">Kurz</titel></metadaten><textdaten><text format="XML"><Content><P>Einziger Absatz.</P></Content></text></textdaten></norm>
</dokumente>`;

describe('Parser (amtliche XML)', () => {
  test('Absätze, Aufzählungen, Entities, Stand', () => {
    const r = parseGesetzXml(XML, { schluessel: 'testg', pfad: 'testg' });
    expect(r.quelle).toMatchObject({ gesetz: 'TestG', name: 'Testgesetz', stand: 'Zuletzt geändert durch Art. 1 G v. 2.2.2026' });
    expect(r.absaetze.map((a) => a.id)).toEqual(['testg-3-abs1', 'testg-3-abs2', 'testg-4']);
    expect(r.absaetze[0]!.text).toBe('(1) Wer Leistungen beantragt, hat\n1. alle Tatsachen anzugeben &\n2. Beweismittel zu bezeichnen.');
    expect(r.absaetze[0]).toMatchObject({ paragraph: '§ 3', absatz: 'Abs. 1', titel: 'Pflichten', url: 'https://www.gesetze-im-internet.de/testg/__3.html' });
    expect(r.absaetze[2]!.absatz).toBeUndefined();
  });
  test('Tabellen als Zeilen', () => {
    expect(absatzText('<table><tbody><row><entry>1</entry><entry>I</entry><entry>361</entry></row><row><entry>2</entry><entry>I</entry><entry>437</entry></row></tbody></table>'))
      .toBe('1 | I | 361\n2 | I | 437');
  });
});

describe('Korpus', () => {
  test('WoGG, WoGV und SGB I §§ 60–67 mit Stand, eindeutige IDs', () => {
    expect(GESETZ_QUELLEN.map((q) => q.gesetz)).toEqual(['WoGG', 'WoGV', 'SGB I']);
    for (const q of GESETZ_QUELLEN) expect(q.stand.length).toBeGreaterThan(10);
    expect(new Set(GESETZ_ABSAETZE.map((a) => a.id)).size).toBe(GESETZ_ABSAETZE.length);
    expect(GESETZ_ABSAETZE.filter((a) => a.gesetz === 'SGB I').every((a) => /^§ 6[0-7]a?$/.test(a.paragraph))).toBe(true);
    expect(GESETZ_ABSAETZE.find((a) => a.id === 'wogg-14-abs2')?.text).toStartWith('(2) Zum Jahreseinkommen gehören:');
  });
});

describe('Vorauswahl', () => {
  const rang = (frage: string, prefix: string) => vorauswahl(frage).findIndex((k) => k.absatz.id.startsWith(prefix));
  test.each([
    ['Was zählt zum Jahreseinkommen?', 'wogg-14', 1],
    ['Welche Folgen hat es, wenn der Antragsteller nicht mitwirkt?', 'sgb1-66', 1],
    ['Freibetrag bei Schwerbehinderung', 'wogg-17', 3],
    ['Wann beginnt der Bewilligungszeitraum?', 'wogg-25', 1],
    ['Welche Vermögensgrenze gilt?', 'wogg-21', 3],
    ['Wer ist vom Wohngeld ausgeschlossen?', 'wogg-7-', 15],
    ['Muss der Antragsteller Unterlagen vorlegen?', 'sgb1-60', 15],
  ])('%s → %s (Rang ≤ %d)', (frage, prefix, max) => {
    const r = rang(frage, prefix);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(max);
  });
  test('Paragraphennennung mit Gesetz', () => {
    expect(vorauswahl('Was regelt § 7 WoGV?')[0]!.absatz.id).toStartWith('wogv-7');
  });
});

describe('direkte Abfrage', () => {
  test('Fundstelle ohne Modell', () => {
    expect(direkteAbfrage('§ 66 SGB I')?.map((a) => a.id)).toEqual(['sgb1-66-abs1', 'sgb1-66-abs2', 'sgb1-66-abs3']);
    expect(direkteAbfrage('zeig § 14 Abs. 2 WoGG')?.map((a) => a.id)).toEqual(['wogg-14-abs2']);
    expect(direkteAbfrage('Was bedeutet § 14 für Minijobs?')).toBeNull();
  });
  test('ganzer Paragraph', () => {
    expect(ganzerParagraph('sgb1-66-abs2').map((f) => f.id)).toEqual(['sgb1-66-abs1', 'sgb1-66-abs2', 'sgb1-66-abs3']);
  });
});

describe('Auswahl durch das Modell', () => {
  test('nur Kandidaten-IDs, dedupliziert, höchstens 4', () => {
    const erlaubt = new Set(['a', 'b', 'c', 'd', 'e']);
    expect(leseAuswahl('```json\n{"ids":["b","x","b","a","c","d","e"],"keine_passend":false}\n```', erlaubt)).toEqual({ ids: ['b', 'a', 'c', 'd'], keine: false });
    expect(leseAuswahl('{"ids":[],"keine_passend":true}', erlaubt)).toEqual({ ids: [], keine: true });
    expect(leseAuswahl('kein json', erlaubt)).toBeNull();
  });
  test('Wortlaut kommt aus dem Korpus, nie aus der Modellantwort', async () => {
    const e = await schlageNach('Was zählt zum Jahreseinkommen?', async () => '{"ids":["wogg-14-abs2"],"keine_passend":false,"text":"erfunden"}');
    expect(e.auswahl).toBe('modell');
    expect(e.fundstellen[0]!.text).toBe(GESETZ_ABSAETZE.find((a) => a.id === 'wogg-14-abs2')!.text);
    expect(e.fundstellen[0]!.stand).toContain('geändert');
  });
  test('Modell nennt fremde ID ⇒ keine erfundene Stelle', async () => {
    const e = await schlageNach('Was zählt zum Jahreseinkommen?', async () => '{"ids":["wogg-99-abs1"],"keine_passend":false}');
    expect(e.fundstellen).toEqual([]);
    expect(e.auswahl).toBe('keine');
  });
  test('Modell fällt aus ⇒ Vorauswahl, gekennzeichnet', async () => {
    const e = await schlageNach('Was zählt zum Jahreseinkommen?', async () => { throw new Error('down'); });
    expect(e.auswahl).toBe('vorauswahl');
    expect(e.fundstellen.length).toBe(3);
  });
  test('direkte Abfrage ruft das Modell nicht auf', async () => {
    let aufgerufen = false;
    const e = await schlageNach('§ 66 SGB I', async () => { aufgerufen = true; return '{}'; });
    expect(aufgerufen).toBe(false);
    expect(e.auswahl).toBe('direkt');
  });
});
