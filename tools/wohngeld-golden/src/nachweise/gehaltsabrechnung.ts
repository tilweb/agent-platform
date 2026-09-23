/**
 * Monatliche Entgeltabrechnung (1 Seite). Steuer/SV bewusst vereinfacht, aber
 * in plausiblen Größenordnungen (2026): KV 7,3 % + 1,45 %, PV 1,8 %/2,4 % (kinderlos),
 * RV 9,3 %, AV 1,3 %; Lohnsteuer über eine grobe Tarif-Näherung je Steuerklasse.
 */
import { esc, eur, htmlDoc, htmlZuPdf, monatName, rund2 } from '../lib';
import type { DokSpec, ErzeugtesDokument, Fall, Person } from '../types';

/** Kinder im Haushalt (senkt den PV-Beitrag). */
export const hatKinder = (fall: Fall) => fall.personen.some((p) => /(sohn|tochter|kind)/i.test(p.verhaeltnis ?? ''));

export function nettoLohn(brutto: number, p: Person, kinder = false) {
  const kv = rund2(brutto * 0.0875);
  const pv = rund2(brutto * (kinder ? 0.018 : 0.024));
  const rv = rund2(brutto * 0.093);
  const av = rund2(brutto * 0.013);
  const kl = p.beschaeftigung?.steuerklasse ?? 'I';
  const freib: Record<string, number> = { I: 1330, II: 1680, III: 2480, IV: 1330, V: 120, VI: 0 };
  const satz: Record<string, number> = { I: 0.19, II: 0.18, III: 0.15, IV: 0.19, V: 0.24, VI: 0.26 };
  const lst = rund2(Math.max(0, (brutto - (freib[kl] ?? 1330)) * (satz[kl] ?? 0.19)));
  const kist = p.beschaeftigung?.kirche ? rund2(lst * 0.09) : 0;
  const netto = rund2(brutto - kv - pv - rv - av - lst - kist);
  return { kv, pv, rv, av, lst, kist, netto };
}

export async function erzeugeGehaltsabrechnung(fall: Fall, person: Person, spec: DokSpec): Promise<ErzeugtesDokument> {
  const b = person.beschaeftigung;
  if (!b) throw new Error(`Person ${person.id} hat keine Beschäftigung`);
  const monat = spec.monat ?? fall.antragsdatum.slice(0, 7);
  const brutto = person.einnahmen.find((e) => /gehalt|lohn/i.test(e.art))?.brutto ?? 0;
  const n = nettoLohn(brutto, person, hatKinder(fall));
  const w = fall.wohnung;
  const css = `
    .ga td, .ga th { font-size: 8.8pt; padding: 1mm 1.5mm; }
    .ga th { text-align:left; background:#e8edf2; border-bottom:0.3mm solid #334; }
    .box { border: 0.3mm solid #334; padding: 2mm 3mm; font-size: 8.8pt; }
  `;
  const zeile = (t: string, v: number, fett = false) => `<tr${fett ? ' style="font-weight:bold;border-top:0.3mm solid #334"' : ''}><td>${t}</td><td class="r">${eur(v)}</td></tr>`;
  const html = htmlDoc(`
    <div class="seite" style="padding-top:14mm">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:13pt;font-weight:bold">${esc(b.arbeitgeber)}</div><div class="klein">${esc(b.arbeitgeberAnschrift)}</div></div>
        <div class="r"><div style="font-size:13pt;font-weight:bold">Verdienstabrechnung</div><div>${esc(monatName(monat))}</div></div>
      </div>
      <table style="margin:8mm 0 5mm"><tr>
        <td style="width:55%;font-size:9.5pt">${esc(person.vorname)} ${esc(person.nachname)}<br>${esc(w.strasse)} ${esc(w.hausnummer)}<br>${esc(w.plz)} ${esc(w.ort)}</td>
        <td><table class="box" style="width:100%">
          <tr><td>Personal-Nr.</td><td class="r">${esc(b.personalnummer)}</td></tr>
          <tr><td>Eintritt</td><td class="r">${b.eintritt.split('-').reverse().join('.')}</td></tr>
          <tr><td>Steuerklasse</td><td class="r">${esc(b.steuerklasse)}</td></tr>
          <tr><td>Wochenarbeitszeit</td><td class="r">${b.wochenstunden} Std.</td></tr>
          <tr><td>Konfession</td><td class="r">${b.kirche ? 'rk' : '—'}</td></tr>
        </table></td></tr></table>
      <table class="ga" style="margin-bottom:5mm">
        <tr><th>Bezüge</th><th class="r" style="width:35mm">Betrag EUR</th></tr>
        ${zeile('Gehalt / Grundlohn', brutto)}
        ${zeile('Gesamtbrutto', brutto, true)}
      </table>
      <table class="ga" style="margin-bottom:5mm">
        <tr><th>Gesetzliche Abzüge</th><th class="r" style="width:35mm">Betrag EUR</th></tr>
        ${zeile('Lohnsteuer', n.lst)}
        ${zeile('Solidaritätszuschlag', 0)}
        ${zeile('Kirchensteuer', n.kist)}
        ${zeile('Krankenversicherung (AN-Anteil inkl. Zusatzbeitrag)', n.kv)}
        ${zeile('Pflegeversicherung (AN-Anteil)', n.pv)}
        ${zeile('Rentenversicherung (AN-Anteil)', n.rv)}
        ${zeile('Arbeitslosenversicherung (AN-Anteil)', n.av)}
        ${zeile('Summe Abzüge', rund2(brutto - n.netto), true)}
      </table>
      <table class="ga">
        <tr><th>Auszahlung</th><th class="r" style="width:35mm">Betrag EUR</th></tr>
        ${zeile('Nettoverdienst', n.netto)}
        ${zeile('Überweisung', n.netto, true)}
        <tr><td colspan="2" class="klein">Bankverbindung: IBAN ${esc(fall.bank.iban.replace(/(.{4})/g, '$1 ').trim())}</td></tr>
      </table>
      <p class="klein" style="position:absolute;bottom:12mm;left:22mm;right:20mm">Jahressummen und Meldungen zur Sozialversicherung erhalten Sie mit der Dezemberabrechnung. Diese Abrechnung wurde maschinell erstellt.</p>
    </div>`, css);

  return {
    art: 'gehaltsabrechnung', typ: 'gehaltsabrechnung', titel: `Verdienstabrechnung ${monatName(monat)} ${person.nachname}`, person: person.id,
    pdf: await htmlZuPdf(html),
    erwartet: {
      analyse: { betrag: brutto },
      identitaet: { nachname: person.nachname, vorname: person.vorname },
    },
  };
}
