/**
 * Kontoauszug (Girokonto, 1 Monat). Buchungen aus dem Fall: Einkommen (Rente/
 * Gehalt netto), Miete an den Vermieter, Alltagsausgaben (seeded). Optionen:
 * - mieteBar: keine Mietüberweisung, stattdessen Barabhebung (F21)
 * - zusatzEingang: { text, betrag } regelmäßiger, nicht angegebener Eingang (F21)
 * - buchungen: weitere Buchungen [{ tag, text, zweck, betrag }] (Kindergeld, Unterhalt, Minijob …)
 * - ohneGehalt: Personen-IDs, deren Gehalt nicht auf diesem Konto eingeht
 */
import { datum, esc, eur, ganz, htmlDoc, htmlZuPdf, ibanFormat, monatName, rng, rund2, tageImMonat, wahl, zwischen } from '../lib';
import type { DokSpec, ErzeugtesDokument, Fall, Person } from '../types';
import { bruttoAus, hatKinder, nettoLohn } from './gehaltsabrechnung';

interface Buchung { tag: number; text: string; zweck: string; betrag: number }

const HAENDLER = ['REWE Markt', 'ALDI SUED', 'Lidl sagt Danke', 'EDEKA Center', 'dm-drogerie markt', 'Netto Marken-Discount', 'Bäckerei Wagner', 'Rossmann'];

/** Monatlicher Zahlbetrag einer Rente (nach KVdR/PV). */
function renteZahl(p: Person): number {
  return p.rente ? rund2(p.rente.brutto * (1 - 0.0875 - 0.036)) : 0;
}

export async function erzeugeKontoauszug(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const monat = spec.monat ?? fall.antragsdatum.slice(0, 7);
  const r = rng(`${fall.id}:konto:${monat}`);
  const w = fall.wohnung;
  const opt = (spec.optionen ?? {}) as { mieteBar?: boolean; zusatzEingang?: { text: string; betrag: number; tag: number }; buchungen?: Buchung[]; ohneGehalt?: string[] };
  const tage = tageImMonat(monat);
  const inhaber = fall.personen.filter((p) => p.id === 'P1' || /(ehe|partner)/i.test(p.verhaeltnis ?? ''));
  const gesamtmiete = w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser;
  const b: Buchung[] = [];

  for (const p of inhaber) {
    if (p.rente) b.push({ tag: tage, text: p.rente.traeger.toUpperCase(), zweck: `RV-Rente ${monatName(monat)} VSNR ${p.rente.versicherungsnummer.replace(/\s/g, '')}`, betrag: renteZahl(p) });
    if (p.beschaeftigung && !opt.ohneGehalt?.includes(p.id)) {
      const brutto = bruttoAus(p);
      b.push({ tag: tage - 1, text: p.beschaeftigung.arbeitgeber, zweck: `LOHN/GEHALT ${monat.slice(5)}/${monat.slice(0, 4)} PERS.NR ${p.beschaeftigung.personalnummer}`, betrag: nettoLohn(brutto, p, hatKinder(fall)).netto });
    }
  }
  for (const x of opt.buchungen ?? []) b.push(x);
  if (opt.zusatzEingang) b.push({ tag: opt.zusatzEingang.tag, text: opt.zusatzEingang.text, zweck: `Verdienst ${monat.slice(5)}/${monat.slice(0, 4)}`, betrag: opt.zusatzEingang.betrag });

  if (opt.mieteBar) {
    b.push({ tag: 2, text: 'Bargeldauszahlung GA', zweck: `${w.ort} Hauptstelle`, betrag: -Math.ceil(gesamtmiete / 50) * 50 });
  } else {
    b.push({ tag: ganz(r, 1, 3), text: fall.vermieter.name, zweck: `Dauerauftrag Miete ${monatName(monat)} ${w.strasse} ${w.hausnummer}, ${w.lage}`, betrag: -rund2(gesamtmiete) });
  }
  b.push({ tag: ganz(r, 10, 15), text: `Stadtwerke ${w.ort}`, zweck: `Abschlag Strom Vertragskonto ${ganz(r, 200000, 899999)}`, betrag: -ganz(r, 38, 72) });
  b.push({ tag: ganz(r, 4, 8), text: 'Telekom Deutschland GmbH', zweck: `Festnetz/Internet Kd-Nr ${ganz(r, 1000000, 9999999)}`, betrag: -39.95 });
  if (['01', '04', '07', '10'].includes(monat.slice(5))) b.push({ tag: 15, text: 'Rundfunk ARD, ZDF, DRadio', zweck: 'Rundfunkbeitrag Quartal', betrag: -55.08 });
  const einkaeufe = ganz(r, 9, 14);
  for (let i = 0; i < einkaeufe; i++) {
    b.push({ tag: ganz(r, 1, tage), text: wahl(r, HAENDLER), zweck: `Kartenzahlung girocard ${w.ort}`, betrag: -rund2(zwischen(r, 6, 88)) });
  }
  if (!opt.mieteBar) b.push({ tag: ganz(r, 16, 24), text: 'Bargeldauszahlung GA', zweck: `${w.ort}`, betrag: -wahl(r, [50, 100, 100, 150]) });

  b.sort((x, y) => x.tag - y.tag || y.betrag - x.betrag);
  const start = rund2(zwischen(r, 380, 1650));
  let saldo = start;
  const zeilen = b.map((x) => {
    saldo = rund2(saldo + x.betrag);
    const d = `${String(x.tag).padStart(2, '0')}.${monat.slice(5)}.`;
    return `<tr><td>${d}</td><td>${d}</td><td><b>${esc(x.text)}</b><br><span class="klein">${esc(x.zweck)}</span></td><td class="r ${x.betrag < 0 ? 'soll' : ''}">${x.betrag < 0 ? '−' : '+'} ${eur(Math.abs(x.betrag))}</td></tr>`;
  }).join('');
  const auszugNr = Number(monat.slice(5));
  const bank = fall.bank;
  const css = `
    .ka-kopf { display:flex; justify-content:space-between; border-bottom:0.8mm solid #c8102e; padding-bottom:2mm; }
    .ka td, .ka th { font-size: 8.4pt; padding: 1mm 1.2mm; border-bottom: 0.15mm solid #ddd; }
    .ka th { background:#f2f2f2; text-align:left; border-bottom:0.3mm solid #444; }
    .soll { color:#111; }
  `;
  const html = htmlDoc(`
    <div class="seite" style="padding-top:14mm">
      <div class="ka-kopf"><div style="font-size:15pt;font-weight:bold;color:#c8102e">${esc(bank.name)}</div>
      <div class="klein r">Kontoauszug ${auszugNr}/${monat.slice(0, 4)}<br>Blatt 1 von 1</div></div>
      <table style="margin:5mm 0 4mm;font-size:9pt"><tr>
        <td style="width:55%">${inhaber.map((p) => `${esc(p.vorname)} ${esc(p.nachname)}`).join(' und ')}<br>${esc(w.strasse)} ${esc(w.hausnummer)}<br>${esc(w.plz)} ${esc(w.ort)}</td>
        <td>Girokonto<br>IBAN ${esc(ibanFormat(bank.iban))}<br>BIC ${esc(bank.bic)}<br>Zeitraum 01.${monat.slice(5)}.${monat.slice(0, 4)} – ${tage}.${monat.slice(5)}.${monat.slice(0, 4)}</td>
      </tr></table>
      <table class="ka">
        <tr><th style="width:15mm">Buchung</th><th style="width:15mm">Wert</th><th>Vorgang</th><th class="r" style="width:28mm">Betrag EUR</th></tr>
        <tr><td colspan="3"><b>Alter Kontostand vom ${datum(`${monat}-01`)}</b></td><td class="r"><b>${eur(start)}</b></td></tr>
        ${zeilen}
        <tr><td colspan="3"><b>Neuer Kontostand vom ${tage}.${monat.slice(5)}.${monat.slice(0, 4)}</b></td><td class="r"><b>${eur(saldo)}</b></td></tr>
      </table>
      <p class="klein" style="margin-top:6mm">Bitte prüfen Sie diesen Auszug. Einwendungen gegen Belastungen aus Lastschriften sind innerhalb von 8 Wochen zu erheben.
      Guthaben sind als Einlagen nach Maßgabe des Einlagensicherungsgesetzes entschädigungsfähig.</p>
    </div>`, css);

  const p1 = fall.personen[0]!;
  return {
    art: 'kontoauszug', typ: 'kontoauszug', titel: `Kontoauszug ${monatName(monat)}`, person: p1.id,
    pdf: await htmlZuPdf(html),
    erwartet: {
      analyse: { mietzahlung_erkannt: !opt.mieteBar },
      identitaet: { nachname: p1.nachname, vorname: p1.vorname },
    },
  };
}
