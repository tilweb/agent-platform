/**
 * Weitere Formulare: Anlage Unterhaltsverpflichtungen (amtliche Vorlage) und das
 * Zusatzblatt für Haushaltsmitglieder ab Nr. 5 bzw. Einnahmen ab Person 6
 * (formloses Blatt, wie es Antragstellende beilegen — „Bei mehr als 4
 * Haushaltsmitgliedern verwenden Sie bitte ein weiteres Blatt").
 */
import { join } from 'node:path';
import { VORLAGEN, datum, esc, eur, htmlDoc, htmlZuPdf, unterschriftSvg } from '../lib';
import type { DokArt, DokSpec, ErzeugtesDokument, Fall, Generator } from '../types';
import { ERWERB_TEXT, FAMSTAND_TEXT } from './antrag';
import { Formular } from './pdfform';

/** Verwandtschaftsziffer laut Anlage: 1 Eltern, 2 Sohn, 3 Tochter, 4 Großeltern. */
export interface UnterhaltsanlageOptionen {
  /** Zeilen der Anlage (max. 3). Default: aus fall.antrag.unterhaltGezahlt. */
  zeilen?: Array<{ fuer: string; ziffer: string; betrag: number; spalte: 'a' | 'b' | 'c' | 'd' }>;
  /** Person, die Unterhalt leistet (Personen-ID). Default: erster Zahler aus fall.antrag bzw. P1. */
  zahler?: string;
  unterschrieben?: boolean;
}

async function erzeugeUnterhaltsanlage(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const o = (spec.optionen ?? {}) as UnterhaltsanlageOptionen;
  const f = await Formular.laden(join(VORLAGEN, '2023_unterhaltsverpflichtungen.pdf'));
  f.schriftgroesse = 8;
  if (fall.antrag?.handschrift) f.handschrift = { seed: `${fall.id}:uh` };
  const p1 = fall.personen[0]!;
  const w = fall.wohnung;
  const gezahlt = fall.antrag?.unterhaltGezahlt ?? [];
  const zahlerId = o.zahler ?? gezahlt[0]?.zahler ?? 'P1';
  const zahler = fall.personen.find((p) => p.id === zahlerId)!;
  const zeilen = o.zeilen ?? gezahlt.map((u) => ({
    fuer: `${u.fuer.nachname}, ${u.fuer.vorname}, geb. ${datum(u.fuer.geburtsdatum)}, ${u.fuer.anschrift}`,
    ziffer: /tochter/i.test(u.verwandt) ? '3' : /sohn/i.test(u.verwandt) ? '2' : /eltern|mutter|vater/i.test(u.verwandt) ? '1' : '',
    betrag: u.betrag,
    spalte: (/ehe|partner/i.test(u.verwandt) ? 'c' : 'd') as 'c' | 'd',
  }));

  f.text('Wohngeldnummer', fall.wohngeldnummer);
  f.text('Datum', datum(fall.antragsdatum));
  f.text('Name antragstellende Person', `${p1.nachname}, ${p1.vorname}${p1.geburtsname ? `, geb. ${p1.geburtsname}` : ''}`);
  f.text('Anschrift', `${w.strasse} ${w.hausnummer}, ${w.plz} ${w.ort}`);
  f.text('Name Unterhalt leistende Person', `${zahler.nachname}, ${zahler.vorname}`);
  const cb = [['1', '2', '3', '4'], ['5', '6', '7', '8'], ['9', '10', '11', '12']];
  zeilen.slice(0, 3).forEach((z, i) => {
    f.text(`Unterhaltsempfänger ${i + 1}`, z.fuer);
    f.text(`Verwandtschaftsverhältnis ${i + 1}`, z.ziffer);
    f.text(`Betrag ${i + 1}`, eur(z.betrag));
    f.kreuz(`ChkBox ${cb[i]!['abcd'.indexOf(z.spalte)]}`);
  });
  f.text('Ort Datum Unterschrift', `${w.ort}, ${datum(fall.antragsdatum)}`);
  if (o.unterschrieben ?? true) f.unterschrift(1, 190, 34, `${zahler.vorname} ${zahler.nachname}`, 100);
  const pdf = await f.flach({ titel: `Anlage Unterhalt ${p1.nachname}` });
  return {
    art: 'unterhaltsanlage', typ: 'unterhaltsnachweis', titel: 'Anlage Unterhaltsverpflichtungen', person: zahlerId, pdf,
    erwartet: {
      identitaet: { nachname: p1.nachname, vorname: p1.vorname },
      analyse: { betrag: zeilen[0]?.betrag ?? null },
    },
  };
}

/** Zusatzblatt: Haushaltsmitglieder ab Nr. 5 (Personen-Index 5+) und Einnahmen ab Person 6. */
async function erzeugeZusatzblatt(fall: Fall): Promise<ErzeugtesDokument> {
  const hand = !!fall.antrag?.handschrift;
  const p1 = fall.personen[0]!;
  const zusatzHaushalt = fall.personen.slice(5);
  const zusatzEinnahmen = fall.personen.slice(5);
  const zeile = (k: string, v: string) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`;
  const bloecke = zusatzHaushalt.map((p, i) => `
    <h3>Angaben für das ${i + 5}. Haushaltsmitglied</h3>
    <table>${zeile('Familienname, Vorname(n)', `${p.nachname}, ${p.vorname}`)}${zeile('Geburtsdatum', datum(p.geburtsdatum))}
    ${zeile('Geburtsort', p.geburtsort)}${zeile('Staatsangehörigkeit', p.staatsangehoerigkeit)}
    ${zeile('Geschlecht', p.geschlecht === 'weiblich' ? 'weiblich' : p.geschlecht === 'maennlich' ? 'männlich' : 'divers')}
    ${zeile('Familienstand', FAMSTAND_TEXT[p.familienstand])}${zeile('Verhältnis zu mir', p.verhaeltnis ?? '')}${zeile('Erwerbsstatus', ERWERB_TEXT[p.erwerb])}</table>`).join('');
  const einnahmen = zusatzEinnahmen.map((p) => `
    <h3>Einnahmen: ${esc(p.vorname)} ${esc(p.nachname)}</h3>
    <table>${(p.einnahmen.length ? p.einnahmen : [{ art: 'keine Einnahmen', brutto: NaN, turnus: '' }]).map((e) => zeile(e.art, Number.isFinite(e.brutto) ? `${eur(e.brutto)} EUR ${e.turnus}` : '—')).join('')}</table>`).join('');
  const css = `
    .zb { font-family: ${hand ? "'Noteworthy','Bradley Hand',cursive" : 'Arial, sans-serif'}; font-size: ${hand ? '12pt' : '10.5pt'}; color: ${hand ? '#1b2a78' : '#111'}; }
    .zb h2 { font-size: 14pt; margin: 0 0 2mm; } .zb h3 { font-size: 11.5pt; margin: 5mm 0 1.5mm; }
    .zb table { width: 100%; } .zb td { padding: 1mm 0; border-bottom: 0.2mm solid ${hand ? '#9aa6d6' : '#bbb'}; } .zb td.k { width: 60mm; color: #444; }
  `;
  const html = htmlDoc(`<div class="seite zb">
    <h2>Zusatzblatt zum Wohngeldantrag (Mietzuschuss)</h2>
    <div>Antragsteller/in: ${esc(p1.vorname)} ${esc(p1.nachname)}, ${esc(fall.wohnung.strasse)} ${esc(fall.wohnung.hausnummer)}, ${esc(fall.wohnung.plz)} ${esc(fall.wohnung.ort)}</div>
    <div>zu Frage 6 (weitere Haushaltsmitglieder) und Frage 12 (Einnahmen)</div>
    ${bloecke}${einnahmen}
    <p style="margin-top:12mm">${esc(fall.wohnung.ort)}, ${datum(fall.antragsdatum)}</p>
    <div style="height:14mm">${unterschriftSvg(`${p1.vorname} ${p1.nachname}`, 45)}</div>
  </div>`, css);
  return {
    art: 'zusatzblatt_haushalt', typ: 'wohngeldantrag', titel: 'Zusatzblatt weitere Haushaltsmitglieder', person: 'P1',
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: { nachname: p1.nachname, vorname: p1.vorname } },
  };
}

export const GENERATOREN_FORMULARE: Partial<Record<DokArt, Generator>> = {
  unterhaltsanlage: erzeugeUnterhaltsanlage,
  zusatzblatt_haushalt: (f) => erzeugeZusatzblatt(f),
};
