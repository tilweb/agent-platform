/**
 * Rentenanpassungsmitteilung zum 1. Juli 2026 (2 Seiten) — typischer
 * Rentennachweis im Wohngeldantrag. Nennt Rentenart, Bruttorente, KV/PV-Beiträge, Zahlbetrag.
 */
import { datum, eur, esc, htmlDoc, htmlZuPdf, rund2 } from '../lib';
import type { ErzeugtesDokument, Fall, Person } from '../types';
import { BRIEF_CSS, brief, folgeseite } from './brief';

export async function erzeugeRentenbescheid(fall: Fall, person: Person): Promise<ErzeugtesDokument> {
  const r = person.rente;
  if (!r) throw new Error(`Person ${person.id} hat keine Rentendaten`);
  const w = fall.wohnung;
  const kv = rund2(r.brutto * 0.0875);      // 7,3 % + halber Zusatzbeitrag 1,45 %
  const pv = rund2(r.brutto * 0.036);
  const zahl = rund2(r.brutto - kv - pv);
  const vorher = rund2(r.brutto / 1.0421);   // Anpassung 4,21 %
  const anrede = person.geschlecht === 'weiblich' ? 'Sehr geehrte Frau' : 'Sehr geehrter Herr';
  const farbe = '#1d4f91';
  const kopf = `<div style="font-weight:bold;font-size:13pt;color:${farbe}">${esc(r.traeger)}</div><div class="klein" style="text-align:right">${esc(r.traegerAnschrift)}<br>Servicetelefon 0800 1000 4800</div>`;
  const fuss = `<span>${esc(r.traeger)} · ${esc(r.traegerAnschrift)}</span><span>Versicherungsnummer ${esc(r.versicherungsnummer)}</span>`;

  const s1 = brief({
    kopf, farbe, fuss,
    ruecksendezeile: `${r.traeger}, ${r.traegerAnschrift}`,
    empfaenger: [`${person.geschlecht === 'weiblich' ? 'Frau' : 'Herrn'}`, `${person.vorname} ${person.nachname}`, `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`],
    info: [['Versicherungsnummer', r.versicherungsnummer], ['Rentenart', r.art], ['Datum', datum('2026-06-12')]],
    betreff: 'Rentenanpassung zum 1. Juli 2026',
    seitenzahl: 'Seite 1 von 2',
    inhalt: `
      <p>${anrede} ${esc(person.nachname)},</p>
      <p>die Renten werden zum 1. Juli 2026 angepasst. Ihre <b>${esc(r.art)}</b> wird deshalb neu berechnet.
      Die Rente wird seit dem ${datum(r.rentenbeginn)} gezahlt.</p>
      <table class="tab" style="margin:4mm 0 5mm">
        <tr><th>Berechnung ab 01.07.2026</th><th class="r">bisher (EUR)</th><th class="r">neu (EUR)</th></tr>
        <tr><td>Monatliche Rente (brutto)</td><td class="r">${eur(vorher)}</td><td class="r">${eur(r.brutto)}</td></tr>
        <tr><td>Beitragsanteil zur Krankenversicherung (7,3 % + 1,45 % Zusatzbeitrag)</td><td class="r">${eur(rund2(vorher * 0.0875))}</td><td class="r">– ${eur(kv)}</td></tr>
        <tr><td>Beitrag zur Pflegeversicherung (3,6 %)</td><td class="r">${eur(rund2(vorher * 0.036))}</td><td class="r">– ${eur(pv)}</td></tr>
        <tr class="summe"><td>Monatlicher Zahlbetrag</td><td class="r">${eur(rund2(vorher - vorher * 0.0875 - vorher * 0.036))}</td><td class="r">${eur(zahl)}</td></tr>
      </table>
      <p>Der Zahlbetrag wird wie bisher monatlich im Voraus auf Ihr Konto überwiesen. Die Beiträge zur Kranken- und
      Pflegeversicherung der Rentner behalten wir ein und führen sie an Ihre Krankenkasse ab.</p>
      <p>Bitte bewahren Sie diese Mitteilung auf. Sie dient auch als Nachweis gegenüber anderen Stellen, zum Beispiel
      bei einem Antrag auf Wohngeld.</p>
      <p>Mit freundlichen Grüßen<br>Ihre ${esc(r.traeger)}</p>
      <p class="klein">Dieses Schreiben wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>`,
  });
  const s2 = folgeseite({
    farbe, seitenzahl: 'Seite 2 von 2', fuss,
    kopfKlein: `${esc(r.traeger)} · Versicherungsnummer ${esc(r.versicherungsnummer)}`,
    inhalt: `
      <p class="fett">Erläuterungen</p>
      <p>Die Anpassung beruht auf der Rentenwertbestimmungsverordnung 2026. Der aktuelle Rentenwert beträgt ab 1. Juli 2026
      42,52 EUR. Ihre persönlichen Entgeltpunkte bleiben unverändert.</p>
      <p>Der Beitragssatz zur Krankenversicherung beträgt 14,6 %; zusätzlich wird der kassenindividuelle Zusatzbeitrag erhoben.
      Beide tragen Sie und wir jeweils zur Hälfte. Den Beitrag zur Pflegeversicherung tragen Sie allein.</p>
      <p class="fett">Mitteilungspflichten</p>
      <p>Bitte teilen Sie uns umgehend mit, wenn Sie Ihren Wohnsitz ins Ausland verlegen, eine Beschäftigung aufnehmen oder sich
      Ihr Krankenversicherungsschutz ändert.</p>
      <p class="fett">Rechtsbehelfsbelehrung</p>
      <p>Gegen diese Mitteilung kann innerhalb eines Monats nach Bekanntgabe Widerspruch erhoben werden. Der Widerspruch ist
      schriftlich oder zur Niederschrift bei der ${esc(r.traeger)} einzulegen.</p>`,
  });

  return {
    art: 'rentenbescheid', typ: 'rentenbescheid', titel: `Rentenanpassung 2026 ${person.nachname}`, person: person.id,
    pdf: await htmlZuPdf(htmlDoc(s1 + s2, BRIEF_CSS)),
    erwartet: {
      analyse: { rentenart_vorhanden: true, betrag: r.brutto },
      identitaet: { nachname: person.nachname, vorname: person.vorname },
    },
  };
}
