/**
 * Finanz-Nachweise: Einkommensteuerbescheid, Einnahmen-Überschuss-Rechnung,
 * KV-/PV-Beitragsbescheinigung (privat oder freiwillig gesetzlich), Depotauszug,
 * Verdienstbescheinigung des Arbeitgebers. Dokumentdaten über `spec.optionen`
 * (je Generator ein Options-Interface), Personendaten über `spec.person`.
 */
import { datum, esc, eur, ganz, htmlDoc, htmlZuPdf, ibanFormat, monatName, monatPlus, rng, rund2, unterschriftSvg, wahl, zwischen } from '../lib';
import type { Rng } from '../lib';
import type { DokArt, DokSpec, ErzeugtesDokument, Fall, Generator, Person } from '../types';
import { BRIEF_CSS, brief, folgeseite } from './brief';

// ── Gemeinsame Helfer ───────────────────────────────────────────────────────

function personVon(fall: Fall, spec: DokSpec): Person {
  const id = spec.person ?? 'P1';
  const p = fall.personen.find((x) => x.id === id);
  if (!p) throw new Error(`${fall.id}: Person ${id} unbekannt`);
  return p;
}

/** Ehe-/Lebenspartner der Person im Haushalt (nur für P1 bzw. dessen Partner). */
function partnerVon(fall: Fall, p: Person): Person | undefined {
  const istPartner = (x: Person) => /(ehe|partner)/i.test(x.verhaeltnis ?? '');
  if (p.id === 'P1') return fall.personen.find(istPartner);
  if (istPartner(p)) return fall.personen.find((x) => x.id === 'P1');
  return undefined;
}

const anrede = (p: Person) => (p.geschlecht === 'weiblich' ? 'Frau' : p.geschlecht === 'maennlich' ? 'Herrn' : '');
const nameVoll = (p: Person) => `${p.vorname} ${p.nachname}`;
const identitaet = (p: Person) => ({ nachname: p.nachname, vorname: p.vorname });

/** ISO-Datum minus n Tage. */
function isoMinus(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - tage);
  return d.toISOString().slice(0, 10);
}

/** Jahresbetrag einer Einnahme. */
const proJahr = (e: { brutto: number; turnus: string }) => (e.turnus === 'monatlich' ? e.brutto * 12 : e.brutto);

const gehaltMonat = (p: Person) => p.einnahmen.find((e) => /gehalt|lohn/i.test(e.art) && e.turnus === 'monatlich')?.brutto ?? 0;

/** Jahresgewinn einer selbständigen Person (aus den Einnahmen des Falls). */
function gewinnJahr(p: Person): number {
  const e = p.einnahmen.find((x) => /selbst|gewerb|betrieb|gewinn|honorar/i.test(x.art))
    ?? (p.erwerb === 'Selbständiger' ? p.einnahmen[0] : undefined);
  return e ? rund2(proJahr(e)) : 0;
}

/** Fiktive, aber plausible Straße für Behörden-/Firmenanschriften. */
const STRASSEN = ['Schillerstraße', 'Kaiser-Friedrich-Straße', 'Am Hauptbahnhof', 'Bahnhofstraße', 'Ludwigsplatz', 'Rheinallee', 'Goethestraße'];

// ── Einkommensteuerbescheid ─────────────────────────────────────────────────

export type EinkunftsArt = 'gewerbebetrieb' | 'selbstaendig' | 'nichtselbstaendig';

export interface SteuerbescheidEinkunft {
  art: EinkunftsArt;
  /** Einkünfte in EUR/Jahr (bei nichtselbständiger Arbeit NACH Arbeitnehmer-Pauschbetrag). */
  betrag: number;
  /** Personen-ID, Default 'P1'. */
  person?: string;
}

export interface SteuerbescheidOptionen {
  /** Veranlagungsjahr, Default 2025. */
  jahr?: number;
  /** Default: 'zusammen', wenn ein Ehe-/Lebenspartner im Haushalt lebt, sonst 'einzel'. */
  veranlagung?: 'zusammen' | 'einzel';
  /**
   * Default: aus den Fallpersonen abgeleitet — Selbständige ⇒ Gewerbebetrieb (Jahresgewinn),
   * Arbeitnehmer ⇒ nichtselbständige Arbeit (12 × Monatsbrutto − 1.230 € Pauschbetrag).
   */
  einkuenfte?: SteuerbescheidEinkunft[];
  /** Default: zufällig im Format "26/123/45678". */
  steuernummer?: string;
  /** Default: 20–120 Tage vor dem Antragsdatum. */
  bescheidDatum?: string;
  /** Default: `Finanzamt <Wohnort>`. */
  finanzamt?: string;
}

const ART_TEXT: Record<EinkunftsArt, string> = {
  gewerbebetrieb: 'Einkünfte aus Gewerbebetrieb',
  selbstaendig: 'Einkünfte aus selbständiger Arbeit',
  nichtselbstaendig: 'Einkünfte aus nichtselbständiger Arbeit',
};
const AN_PAUSCHBETRAG = 1230;

/** Tarifliche Einkommensteuer 2025 (§ 32a EStG, Grundtabelle). */
function estGrund(zve: number): number {
  const x = Math.floor(zve);
  if (x <= 12096) return 0;
  if (x <= 17443) { const y = (x - 12096) / 10000; return Math.floor((932.3 * y + 1400) * y); }
  if (x <= 68480) { const z = (x - 17443) / 10000; return Math.floor((176.64 * z + 2397) * z + 1015.13); }
  if (x <= 277825) return Math.floor(0.42 * x - 10911.92);
  return Math.floor(0.45 * x - 19246.67);
}

function standardEinkuenfte(personen: Person[]): SteuerbescheidEinkunft[] {
  const out: SteuerbescheidEinkunft[] = [];
  for (const p of personen) {
    if (p.erwerb === 'Selbständiger') {
      const g = gewinnJahr(p);
      if (g) out.push({ art: 'gewerbebetrieb', betrag: g, person: p.id });
    }
    const m = gehaltMonat(p);
    if (m) out.push({ art: 'nichtselbstaendig', betrag: rund2(m * 12 - AN_PAUSCHBETRAG), person: p.id });
  }
  return out;
}

export async function erzeugeSteuerbescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec);
  const opt = (spec.optionen ?? {}) as SteuerbescheidOptionen;
  const r = rng(`${fall.id}:steuerbescheid:${p.id}`);
  const jahr = opt.jahr ?? 2025;
  const partner = partnerVon(fall, p);
  const veranlagung = opt.veranlagung ?? (partner ? 'zusammen' : 'einzel');
  const zusammen = veranlagung === 'zusammen' && !!partner;
  // Reihenfolge wie im Bescheid: Ehemann/Person A zuerst (P1).
  const beteiligte = zusammen ? [p, partner!].sort((a, b) => a.id.localeCompare(b.id)) : [p];
  const einkuenfte = opt.einkuenfte ?? standardEinkuenfte(beteiligte);
  if (!einkuenfte.length) throw new Error(`${fall.id}: Steuerbescheid ohne Einkünfte (optionen.einkuenfte setzen)`);
  const w = fall.wohnung;
  const finanzamt = opt.finanzamt ?? `Finanzamt ${w.ort}`;
  const stnr = opt.steuernummer ?? `${ganz(r, 10, 99)}/${ganz(r, 100, 999)}/${ganz(r, 10000, 99999)}`;
  const bescheidDatum = opt.bescheidDatum ?? isoMinus(fall.antragsdatum, ganz(r, 20, 120));
  const faStrasse = `${wahl(r, STRASSEN)} ${ganz(r, 2, 60)}`;
  const faPlz = `${w.plz.slice(0, 3)}${ganz(r, 10, 99)}`;

  const summe = rund2(einkuenfte.reduce((s, e) => s + e.betrag, 0));
  // Vorsorgeaufwendungen: AN grob 12 % des Bruttolohns, Selbständige Beiträge zur privaten KV/Altersvorsorge.
  const vorsorge = Math.round(einkuenfte.reduce((s, e) => s + (e.art === 'nichtselbstaendig'
    ? (e.betrag + AN_PAUSCHBETRAG) * 0.12
    : Math.min(e.betrag * 0.22, zwischen(r, 5200, 8400))), 0));
  const sonderPausch = zusammen ? 72 : 36;
  const zve = Math.max(0, Math.floor(summe - vorsorge - sonderPausch));
  const est = zusammen ? 2 * estGrund(zve / 2) : estGrund(zve);
  const soliGrenze = zusammen ? 39900 : 19950;
  const soli = est > soliGrenze ? rund2(Math.min(est * 0.055, (est - soliGrenze) * 0.119)) : 0;
  const kirche = beteiligte.some((x) => x.beschaeftigung?.kirche);
  const kist = kirche ? rund2(est * 0.09) : 0;
  const festgesetzt = rund2(est + soli + kist);
  // Anrechnung: Lohnsteuer für nichtselbständige Anteile, Vorauszahlungen für Gewinneinkünfte.
  const anteilLohn = summe > 0 ? einkuenfte.filter((e) => e.art === 'nichtselbstaendig').reduce((s, e) => s + e.betrag, 0) / summe : 0;
  const lohnsteuer = Math.round(est * anteilLohn * zwischen(r, 0.93, 1.06));
  const vorauszahlungen = anteilLohn < 1 ? Math.round((est * (1 - anteilLohn) * zwischen(r, 0.7, 0.95)) / 4) * 4 : 0;
  const angerechnet = rund2(lohnsteuer + vorauszahlungen + (soli ? soli * 0.9 : 0) + (kist ? kist * 0.95 : 0));
  const saldo = rund2(festgesetzt - angerechnet);

  const farbe = '#1d3f6e';
  const kopf = `<div><div style="font-size:14pt;font-weight:bold;color:${farbe}">${esc(finanzamt)}</div><div class="klein">${esc(faStrasse)} · ${esc(faPlz)} ${esc(w.ort)}</div></div>
    <div class="klein r">Steuerverwaltung<br>Telefon ${esc(/^0\d+/.exec(fall.telefon ?? '')?.[0] ?? '0800')} ${ganz(r, 100, 999)}-0</div>`;
  const empfaenger = zusammen
    ? [`${anrede(beteiligte[0]!)} ${nameVoll(beteiligte[0]!)}`, `und ${anrede(beteiligte[1]!)} ${nameVoll(beteiligte[1]!)}`, `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`]
    : [`${anrede(p)} ${nameVoll(p)}`.trim(), `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`];
  const bankHinweis = saldo < 0
    ? `Der Erstattungsbetrag von <b>${eur(-saldo)} EUR</b> wird auf das Konto IBAN ${esc(ibanFormat(fall.bank.iban))} bei der ${esc(fall.bank.name)} überwiesen.`
    : `Bitte zahlen Sie den Betrag von <b>${eur(saldo)} EUR</b> bis zum ${datum(isoMinus(bescheidDatum, -32))} unter Angabe der Steuernummer.`;
  const zeile = (t: string, v: number | string, kl = '') => `<tr${kl ? ` class="${kl}"` : ''}><td>${t}</td><td class="r">${typeof v === 'number' ? eur(v) : v}</td></tr>`;

  const seite1 = brief({
    kopf, farbe,
    ruecksendezeile: `${finanzamt}, ${faStrasse}, ${faPlz} ${w.ort}`,
    empfaenger,
    info: [['Steuernummer', stnr], ['Datum', datum(bescheidDatum)], ['Veranlagung', zusammen ? 'Zusammenveranlagung' : 'Einzelveranlagung'], ['Bearbeitung', `Arbeitnehmerbezirk ${ganz(r, 11, 48)}`]],
    betreff: `Bescheid für ${jahr} über Einkommensteuer, Solidaritätszuschlag${kirche ? ' und Kirchensteuer' : ''}`,
    seitenzahl: 'Seite 1 von 2',
    fuss: `<span>${esc(finanzamt)} · ${esc(faStrasse)} · ${esc(faPlz)} ${esc(w.ort)}</span><span>Öffnungszeiten: Mo–Do 8:00–15:30, Fr 8:00–12:00</span>`,
    inhalt: `
      <p>Der Bescheid ist nach § 165 Abs. 1 Satz 2 AO teilweise vorläufig. Die Festsetzung beruht auf den Angaben in Ihrer Steuererklärung${zusammen ? ' (Zusammenveranlagung)' : ''}.</p>
      <table class="tab" style="margin:2mm 0 5mm">
        <tr><th>Festsetzung</th><th class="r" style="width:30mm">Einkommen&shy;steuer EUR</th><th class="r" style="width:30mm">Solidaritäts&shy;zuschlag EUR</th>${kirche ? '<th class="r" style="width:26mm">Kirchen&shy;steuer EUR</th>' : ''}</tr>
        <tr><td>Festgesetzt werden</td><td class="r">${eur(est)}</td><td class="r">${eur(soli)}</td>${kirche ? `<td class="r">${eur(kist)}</td>` : ''}</tr>
      </table>
      <table class="tab" style="width:125mm;margin:0 0 5mm">
        <tr><th>Abrechnung (Beträge in EUR)</th><th class="r">Betrag</th></tr>
        ${zeile('Festgesetzt (Summe)', festgesetzt)}
        ${lohnsteuer ? zeile('abzüglich anzurechnende Lohnsteuer', lohnsteuer) : ''}
        ${vorauszahlungen ? zeile('abzüglich geleistete Vorauszahlungen', vorauszahlungen) : ''}
        ${soli || kist ? zeile('abzüglich anzurechnende Zuschlagsteuern', rund2(angerechnet - lohnsteuer - vorauszahlungen)) : ''}
        ${zeile(saldo < 0 ? 'Erstattung' : 'Nachzahlung', Math.abs(saldo), 'summe')}
      </table>
      <p>${bankHinweis}</p>
      <p>Die Besteuerungsgrundlagen und Erläuterungen finden Sie auf der folgenden Seite.</p>`,
  });

  const zeilenEinkuenfte = beteiligte.map((x) => {
    const eigene = einkuenfte.filter((e) => (e.person ?? 'P1') === x.id);
    if (!eigene.length) return `<tr><td colspan="2"><b>${esc(nameVoll(x))}</b></td></tr><tr><td>keine Einkünfte</td><td class="r">0,00</td></tr>`;
    return `<tr><td colspan="2"><b>${esc(nameVoll(x))}</b></td></tr>` + eigene.map((e) => e.art === 'nichtselbstaendig'
      ? `<tr><td>Bruttoarbeitslohn</td><td class="r">${eur(e.betrag + AN_PAUSCHBETRAG)}</td></tr><tr><td>abzüglich Arbeitnehmer-Pauschbetrag</td><td class="r">${eur(AN_PAUSCHBETRAG)}</td></tr>${zeile(ART_TEXT[e.art], e.betrag)}`
      : zeile(`${ART_TEXT[e.art]}${e.art === 'gewerbebetrieb' ? ' (Gewinn lt. Einnahmen-Überschuss-Rechnung)' : ''}`, e.betrag)).join('');
  }).join('');
  // Einkünfte von Personen außerhalb der Veranlagten (nur bei expliziten Optionen denkbar)
  const fremde = einkuenfte.filter((e) => !beteiligte.some((x) => x.id === (e.person ?? 'P1')));
  const seite2 = folgeseite({
    farbe, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(finanzamt)} · Steuernummer ${esc(stnr)} · Bescheid vom ${datum(bescheidDatum)}`,
    inhalt: `
      <div class="fett" style="font-size:11pt;margin-bottom:3mm">Ermittlung des zu versteuernden Einkommens ${jahr}</div>
      <table class="tab" style="margin-bottom:5mm">
        <tr><th>Besteuerungsgrundlagen</th><th class="r" style="width:35mm">EUR</th></tr>
        ${zeilenEinkuenfte}
        ${fremde.map((e) => zeile(ART_TEXT[e.art], e.betrag)).join('')}
        ${zeile('Summe der Einkünfte', summe, 'summe')}
        ${zeile('Gesamtbetrag der Einkünfte', summe)}
        ${zeile('abzüglich Vorsorgeaufwendungen', vorsorge)}
        ${zeile('abzüglich Sonderausgaben-Pauschbetrag', sonderPausch)}
        ${zeile('Einkommen / zu versteuerndes Einkommen', zve, 'summe')}
        ${zeile(`Tarifliche Einkommensteuer (${zusammen ? 'Splittingtarif' : 'Grundtarif'})`, est)}
      </table>
      <div class="fett" style="margin-bottom:1.5mm">Erläuterungen</div>
      <p style="margin:0 0 3mm">Die Vorsorgeaufwendungen wurden im Rahmen der gesetzlichen Höchstbeträge berücksichtigt (§ 10 Abs. 3 und 4 EStG).
      ${einkuenfte.some((e) => e.art !== 'nichtselbstaendig') ? 'Der Gewinn wurde entsprechend der eingereichten Anlage EÜR angesetzt.' : ''}
      Die Festsetzung des Solidaritätszuschlags erfolgt nach dem Solidaritätszuschlaggesetz 1995 in der geltenden Fassung.</p>
      ${vorauszahlungen ? `<p style="margin:0 0 3mm">Die Vorauszahlungen für ${jahr + 1} und die folgenden Jahre bleiben bis auf Weiteres unverändert.</p>` : ''}
      <div class="fett" style="margin:5mm 0 1.5mm">Rechtsbehelfsbelehrung</div>
      <p style="margin:0;font-size:8.8pt">Diese Bescheide können mit dem Einspruch angefochten werden. Der Einspruch ist beim oben bezeichneten Finanzamt
      schriftlich einzureichen, diesem elektronisch zu übermitteln oder dort zur Niederschrift zu erklären. Die Frist für die Einlegung des
      Einspruchs beträgt einen Monat. Sie beginnt mit Ablauf des Tages, an dem Ihnen dieser Bescheid bekannt gegeben worden ist. Bei Zusendung
      durch einfachen Brief gilt die Bekanntgabe mit dem dritten Tag nach Aufgabe zur Post als bewirkt, es sei denn, dass der Bescheid zu einem
      späteren Zeitpunkt zugegangen ist.</p>
      <p class="klein" style="margin-top:6mm">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>`,
    fuss: `<span>${esc(finanzamt)}</span><span>Steuernummer ${esc(stnr)}</span>`,
  });

  const betrag = rund2(einkuenfte.filter((e) => (e.person ?? 'P1') === p.id).reduce((s, e) => s + e.betrag, 0));
  return {
    art: 'steuerbescheid', typ: 'verdienstbescheinigung', titel: `Einkommensteuerbescheid ${jahr} ${p.nachname}`, person: p.id,
    pdf: await htmlZuPdf(htmlDoc(seite1 + seite2, BRIEF_CSS)),
    erwartet: { analyse: { betrag }, identitaet: identitaet(p) },
  };
}

// ── Einnahmen-Überschuss-Rechnung ───────────────────────────────────────────

export interface EuerOptionen {
  /** Wirtschaftsjahr, Default 2025. */
  jahr?: number;
  /** Default: `<Nachname> <Branche>` (seeded, z. B. "Hoffmann Haustechnik"). */
  firma?: string;
  /** Betriebseinnahmen: Gesamtbetrag oder Positionen. Default: aus Gewinn und Ausgabenquote (35–55 %). */
  einnahmen?: number | Array<{ bezeichnung: string; betrag: number }>;
  /** Betriebsausgaben nach Gruppen. Default: seeded Aufteilung (Einnahmen − Gewinn). */
  ausgaben?: Array<{ gruppe: string; betrag: number }>;
  /** Ziel-Gewinn für die Defaults, Default: Jahresgewinn der Person aus dem Fall (sonst 24.000 €). */
  gewinn?: number;
  /** Steuernummer im Kopf, Default seeded. */
  steuernummer?: string;
}

const AUSGABEN_GRUPPEN: Array<[string, number]> = [
  ['Waren, Rohstoffe und Hilfsstoffe', 0.34], ['Bezogene Fremdleistungen', 0.12], ['Aufwendungen für Kraftfahrzeuge', 0.14],
  ['Raumkosten und sonstige Grundstücksaufwendungen', 0.12], ['Absetzung für Abnutzung (AfA)', 0.08],
  ['Versicherungen, Beiträge, Gebühren', 0.06], ['Telekommunikation, Büro, Porto', 0.04], ['Übrige unbeschränkt abziehbare Betriebsausgaben', 0.10],
];

export async function erzeugeEuer(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec);
  const opt = (spec.optionen ?? {}) as EuerOptionen;
  const r = rng(`${fall.id}:euer:${p.id}`);
  const jahr = opt.jahr ?? 2025;
  const firma = opt.firma ?? `${p.nachname} ${wahl(r, ['Haustechnik', 'Malerbetrieb', 'Montageservice', 'Gebäudeservice', 'Elektrotechnik', 'Fliesenlegerei'])}`;
  const zielGewinn = opt.gewinn ?? (gewinnJahr(p) || 24000);
  const quote = zwischen(r, 0.35, 0.55);

  let einnahmen: Array<{ bezeichnung: string; betrag: number }>;
  if (Array.isArray(opt.einnahmen)) einnahmen = opt.einnahmen;
  else {
    const gesamt = typeof opt.einnahmen === 'number'
      ? opt.einnahmen
      : (opt.ausgaben ? zielGewinn + opt.ausgaben.reduce((s, a) => s + a.betrag, 0) : Math.round(zielGewinn / (1 - quote)));
    const ust = rund2((gesamt * 0.19) / 1.19);
    einnahmen = [
      { bezeichnung: 'Umsatzsteuerpflichtige Betriebseinnahmen (netto)', betrag: rund2(gesamt - ust) },
      { bezeichnung: 'Vereinnahmte Umsatzsteuer', betrag: ust },
    ];
  }
  const summeEin = rund2(einnahmen.reduce((s, e) => s + e.betrag, 0));
  let ausgaben: Array<{ gruppe: string; betrag: number }>;
  if (opt.ausgaben) ausgaben = opt.ausgaben;
  else {
    const gesamtAus = rund2(summeEin - zielGewinn);
    const gew = AUSGABEN_GRUPPEN.map(([, g]) => g * zwischen(r, 0.7, 1.3));
    const sg = gew.reduce((s, g) => s + g, 0);
    let rest = gesamtAus;
    ausgaben = AUSGABEN_GRUPPEN.map(([gruppe], i) => {
      const b = i === AUSGABEN_GRUPPEN.length - 1 ? rund2(rest) : rund2((gesamtAus * gew[i]!) / sg);
      rest = rund2(rest - b);
      return { gruppe, betrag: b };
    });
  }
  const summeAus = rund2(ausgaben.reduce((s, a) => s + a.betrag, 0));
  const gewinn = rund2(summeEin - summeAus);
  const stnr = opt.steuernummer ?? `${ganz(r, 10, 99)}/${ganz(r, 100, 999)}/${ganz(r, 10000, 99999)}`;
  const w = fall.wohnung;
  const erstellt = `${jahr + 1}-0${ganz(r, 3, 5)}-${String(ganz(r, 2, 27)).padStart(2, '0')}`;

  const css = `
    .eu th { text-align:left; font-size:8.6pt; background:#e9eef3; border-bottom:0.3mm solid #333; padding:1.2mm 1.5mm; }
    .eu td { font-size:9pt; padding:1.1mm 1.5mm; border-bottom:0.15mm solid #ccc; }
    .eu td.nr { width:10mm; color:#555; }
    .eu tr.summe td { font-weight:bold; border-top:0.3mm solid #333; border-bottom:0.3mm solid #333; background:#f6f6f6; }
  `;
  let nr = 10;
  const z = (t: string, v: number, summe = false) => `<tr${summe ? ' class="summe"' : ''}><td class="nr">${summe ? '' : nr++}</td><td>${esc(t)}</td><td class="r">${eur(v)}</td></tr>`;
  const html = htmlDoc(`
    <div class="seite" style="padding-top:16mm">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:0.6mm solid #333;padding-bottom:2mm">
        <div><div style="font-size:14pt;font-weight:bold">Einnahmen-Überschuss-Rechnung ${jahr}</div>
        <div class="klein">nach § 4 Abs. 3 EStG · Wirtschaftsjahr 01.01.${jahr} – 31.12.${jahr}</div></div>
        <div class="klein r">Steuernummer ${esc(stnr)}</div>
      </div>
      <table style="margin:5mm 0 6mm;font-size:9.5pt"><tr>
        <td style="width:55%"><b>${esc(firma)}</b><br>Inhaber: ${esc(nameVoll(p))}<br>${esc(w.strasse)} ${esc(w.hausnummer)}<br>${esc(w.plz)} ${esc(w.ort)}</td>
        <td class="klein">Art des Betriebs: ${esc(firma.replace(p.nachname, '').trim() || 'Gewerbebetrieb')}<br>Gewinnermittlung: Einnahmen-Überschuss-Rechnung<br>Umsatzbesteuerung: Regelbesteuerung</td>
      </tr></table>
      <table class="eu" style="margin-bottom:5mm">
        <tr><th></th><th>1. Betriebseinnahmen</th><th class="r" style="width:35mm">EUR</th></tr>
        ${einnahmen.map((e) => z(e.bezeichnung, e.betrag)).join('')}
        ${z('Summe Betriebseinnahmen', summeEin, true)}
      </table>
      <table class="eu" style="margin-bottom:5mm">
        <tr><th></th><th>2. Betriebsausgaben</th><th class="r" style="width:35mm">EUR</th></tr>
        ${ausgaben.map((a) => z(a.gruppe, a.betrag)).join('')}
        ${z('Summe Betriebsausgaben', summeAus, true)}
      </table>
      <table class="eu">
        <tr><th></th><th>3. Ermittlung des Gewinns</th><th class="r" style="width:35mm">EUR</th></tr>
        <tr><td class="nr"></td><td>Summe Betriebseinnahmen</td><td class="r">${eur(summeEin)}</td></tr>
        <tr><td class="nr"></td><td>abzüglich Summe Betriebsausgaben</td><td class="r">${eur(summeAus)}</td></tr>
        <tr class="summe"><td class="nr"></td><td>${gewinn < 0 ? 'Verlust' : 'Gewinn'}</td><td class="r">${eur(gewinn)}</td></tr>
      </table>
      <div style="position:absolute;bottom:22mm;left:22mm;right:20mm;display:flex;justify-content:space-between;align-items:flex-end;font-size:9pt">
        <div>${esc(w.ort)}, ${datum(erstellt)}</div>
        <div style="text-align:center">${unterschriftSvg(nameVoll(p), 40)}<div style="border-top:0.2mm solid #333;padding-top:1mm;width:60mm">${esc(nameVoll(p))}</div></div>
      </div>
    </div>`, css);

  return {
    art: 'euer', typ: 'verdienstbescheinigung', titel: `Einnahmen-Überschuss-Rechnung ${jahr} ${firma}`, person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { analyse: { betrag: gewinn }, identitaet: identitaet(p) },
  };
}

// ── KV-/PV-Beitragsbescheinigung ────────────────────────────────────────────

export interface KvBeitragsnachweisOptionen {
  /** 'privat' (PKV, Default) oder 'freiwillig' (freiwilliges GKV-Mitglied). */
  art?: 'privat' | 'freiwillig';
  /** Default seeded: erfundene PKV bzw. BKK/Ersatzkasse. */
  versicherer?: string;
  /** Monatsbeitrag Krankenversicherung. Default: PKV 380–620 €; freiwillig 17,5 % der Bemessungsgrundlage. */
  kvBeitrag?: number;
  /** Monatsbeitrag Pflegeversicherung. Default: PKV 45–75 €; freiwillig 3,6 %/4,2 % (kinderlos). */
  pvBeitrag?: number;
  /** Bescheinigungsjahr, Default: Jahr des Antragsdatums. */
  jahr?: number;
  /** Default seeded. */
  versicherungsnummer?: string;
  /** Default: 7–40 Tage vor dem Antragsdatum. */
  datum?: string;
}

export async function erzeugeKvBeitragsnachweis(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec);
  const opt = (spec.optionen ?? {}) as KvBeitragsnachweisOptionen;
  const r = rng(`${fall.id}:kv_beitragsnachweis:${p.id}`);
  const art = opt.art ?? 'privat';
  const jahr = opt.jahr ?? Number(fall.antragsdatum.slice(0, 4));
  const privat = art === 'privat';
  const versicherer = opt.versicherer ?? (privat
    ? wahl(r, ['Hanseatische Krankenversicherung a. G.', 'Pfalzia Private Krankenversicherung AG', 'Rheinland Kranken Versicherungsverein a. G.'])
    : wahl(r, ['BKK Mittelrhein', 'Südwest Ersatzkasse', 'BKK Rhein-Nahe']));
  const kinder = fall.personen.some((x) => /(sohn|tochter|kind)/i.test(x.verhaeltnis ?? ''));
  const einkommenMonat = p.einnahmen.reduce((s, e) => s + (e.turnus === 'monatlich' ? e.brutto : e.turnus === 'jährlich' ? e.brutto / 12 : 0), 0);
  const bemessung = rund2(Math.min(5512.5, Math.max(1248.33, einkommenMonat)));
  const kv = opt.kvBeitrag ?? (privat ? rund2(zwischen(r, 380, 620)) : rund2(bemessung * 0.175));
  const pv = opt.pvBeitrag ?? (privat ? rund2(zwischen(r, 45, 75)) : rund2(bemessung * (kinder ? 0.036 : 0.042)));
  const gesamt = rund2(kv + pv);
  const vnr = opt.versicherungsnummer ?? (privat ? `${ganz(r, 100, 999)}.${ganz(r, 100000, 999999)}-${ganz(r, 1, 9)}` : `${p.nachname[0]}${ganz(r, 100000000, 999999999)}`);
  const ausgestellt = opt.datum ?? isoMinus(fall.antragsdatum, ganz(r, 7, 40));
  const w = fall.wohnung;
  const sitz = wahl(r, ['Koblenz', 'Mannheim', 'Frankfurt am Main', 'Köln']);
  const farbe = privat ? '#005b5b' : '#7a1f5c';
  const tarif = privat ? `Tarif ${wahl(r, ['KomfortPlus', 'Classic 300', 'Vital Z'])}, Selbstbehalt ${wahl(r, [300, 600, 900])} EUR` : 'freiwillige Mitgliedschaft, allgemeiner Beitragssatz zzgl. Zusatzbeitrag';

  const inhalt = `
    <p>Sehr geehrte${p.geschlecht === 'weiblich' ? ' Frau' : p.geschlecht === 'maennlich' ? 'r Herr' : '(r)'} ${esc(p.nachname)},</p>
    <p>hiermit bescheinigen wir, dass ${esc(nameVoll(p))}, geboren am ${datum(p.geburtsdatum)}, ${privat
      ? 'bei uns in der privaten Krankheitskosten-Vollversicherung und in der privaten Pflegepflichtversicherung versichert ist'
      : 'bei uns freiwillig in der gesetzlichen Kranken- und Pflegeversicherung versichert ist'}.
    Die Versicherung besteht ununterbrochen und ungekündigt.</p>
    <table class="tab" style="width:140mm;margin:2mm 0 5mm">
      <tr><th>Beitrag ab 01.01.${jahr}</th><th class="r">monatlich EUR</th><th class="r">jährlich EUR</th></tr>
      <tr><td>Krankenversicherung${privat ? ' (Basis- und Wahlleistungen)' : ' (inkl. Zusatzbeitrag)'}</td><td class="r">${eur(kv)}</td><td class="r">${eur(rund2(kv * 12))}</td></tr>
      <tr><td>Pflegeversicherung${privat ? ' (Pflegepflichtversicherung)' : ''}</td><td class="r">${eur(pv)}</td><td class="r">${eur(rund2(pv * 12))}</td></tr>
      <tr class="summe"><td>Gesamtbeitrag</td><td class="r">${eur(gesamt)}</td><td class="r">${eur(rund2(gesamt * 12))}</td></tr>
    </table>
    <table style="width:140mm;font-size:9pt;margin-bottom:4mm">
      <tr><td style="width:45mm;color:#555">Versicherte Person</td><td>${esc(nameVoll(p))}</td></tr>
      <tr><td style="color:#555">Versicherungsumfang</td><td>${esc(tarif)}</td></tr>
      ${privat ? '' : `<tr><td style="color:#555">Beitragsbemessung</td><td>${eur(bemessung)} EUR monatlich</td></tr>`}
      <tr><td style="color:#555">Zahlungsweise</td><td>monatlich per SEPA-Lastschrift</td></tr>
    </table>
    <p>Die Beiträge werden ${privat ? 'vollständig von Ihnen getragen; ein Arbeitgeberzuschuss wird nicht gezahlt' : 'in voller Höhe von Ihnen als Selbstzahler getragen'}.
    Diese Bescheinigung dient zur Vorlage bei Behörden.</p>
    <p>Mit freundlichen Grüßen<br>${esc(versicherer)}<br><span class="klein">Kundenservice Beiträge</span></p>
    <p class="klein">Diese Bescheinigung wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>`;
  const html = htmlDoc(brief({
    farbe,
    kopf: `<div style="font-size:13pt;font-weight:bold;color:${farbe}">${esc(versicherer)}</div><div class="klein r">Postfach ${ganz(r, 1000, 9999)} ${ganz(r, 10, 99)}<br>${esc(sitz)}</div>`,
    ruecksendezeile: `${versicherer}, Postfach, ${sitz}`,
    empfaenger: [`${anrede(p)} ${nameVoll(p)}`.trim(), `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`],
    info: [[privat ? 'Versicherungsnummer' : 'Mitgliedsnummer', vnr], ['Datum', datum(ausgestellt)], ['Service-Telefon', `0800 ${ganz(r, 100, 999)} ${ganz(r, 1000, 9999)}`]],
    betreff: `Beitragsbescheinigung ${jahr} — Kranken- und Pflegeversicherung`,
    inhalt,
    fuss: `<span>${esc(versicherer)} · Sitz ${esc(sitz)}</span><span>${privat ? `Registergericht Amtsgericht ${esc(sitz)} HRB ${ganz(r, 1000, 29999)}` : 'Körperschaft des öffentlichen Rechts'}</span>`,
  }), BRIEF_CSS);

  return {
    art: 'kv_beitragsnachweis', typ: 'kv_pv_nachweis', titel: `Beitragsbescheinigung Kranken-/Pflegeversicherung ${p.nachname}`, person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { analyse: { betrag: gesamt }, identitaet: identitaet(p) },
  };
}

// ── Depotauszug / Vermögensaufstellung ──────────────────────────────────────

export interface DepotPosition { bezeichnung: string; wert: number }

export interface DepotauszugOptionen {
  /** Stichtag ISO, Default: letzter Tag des Vormonats des Antragsdatums. */
  stichtag?: string;
  /** Default: fall.bank.name. */
  bank?: string;
  /** Default seeded: Tagesgeld, ETF, Fonds, Aktie (Summe 8.000–30.000 €). */
  positionen?: DepotPosition[];
  /** Default seeded. */
  depotnummer?: string;
}

const istKonto = (b: string) => /tagesgeld|festgeld|spar|konto|guthaben/i.test(b);

function standardPositionen(r: Rng): DepotPosition[] {
  const pos: DepotPosition[] = [
    { bezeichnung: 'Tagesgeldkonto', wert: rund2(zwischen(r, 1500, 9000)) },
    { bezeichnung: wahl(r, ['iShares Core MSCI World UCITS ETF', 'Xtrackers MSCI World UCITS ETF 1C', 'Vanguard FTSE All-World UCITS ETF']), wert: rund2(zwischen(r, 3000, 14000)) },
    { bezeichnung: wahl(r, ['DWS Top Dividende LD', 'Deka-Nachhaltigkeit Aktien CF', 'UniGlobal Vorsorge']), wert: rund2(zwischen(r, 1500, 6000)) },
  ];
  if (r() < 0.6) pos.push({ bezeichnung: wahl(r, ['Allianz SE Namens-Aktien', 'Siemens AG Namens-Aktien', 'BASF SE Namens-Aktien']), wert: rund2(zwischen(r, 800, 3500)) });
  return pos;
}

function isin(r: Rng, konto: boolean, aktie: boolean): string {
  if (konto) return '—';
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = aktie ? 'DE000' : wahl(r, ['IE00', 'LU0', 'DE000']);
  while (s.length < 11) s += zeichen[Math.floor(r() * zeichen.length)];
  return s + ganz(r, 0, 9);
}

export async function erzeugeDepotauszug(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec);
  const opt = (spec.optionen ?? {}) as DepotauszugOptionen;
  const r = rng(`${fall.id}:depotauszug:${p.id}`);
  const stichtag = opt.stichtag ?? isoMinus(`${fall.antragsdatum.slice(0, 7)}-01`, 1);
  const bank = opt.bank ?? fall.bank.name;
  const positionen = opt.positionen ?? standardPositionen(r);
  const gesamt = rund2(positionen.reduce((s, x) => s + x.wert, 0));
  const depotnr = opt.depotnummer ?? `${ganz(r, 100, 999)} ${ganz(r, 100000, 999999)} ${ganz(r, 10, 99)}`;
  const w = fall.wohnung;
  const farbe = wahl(r, ['#c8102e', '#003d7c', '#00664f']);

  const zeilen = positionen.map((x) => {
    const konto = istKonto(x.bezeichnung);
    const kurs = konto ? 0 : rund2(zwischen(r, 18, 240));
    const stueck = konto ? 0 : Math.round((x.wert / kurs) * 1000) / 1000;
    const kat = konto ? 'Liquidität' : /etf/i.test(x.bezeichnung) ? 'ETF' : /aktie/i.test(x.bezeichnung) ? 'Aktie' : 'Investmentfonds';
    return `<tr><td><b>${esc(x.bezeichnung)}</b><br><span class="klein">${kat} · ISIN ${isin(r, konto, kat === 'Aktie')}</span></td>
      <td class="r">${konto ? '' : stueck.toLocaleString('de-DE', { minimumFractionDigits: 3 })}</td>
      <td class="r">${konto ? '' : eur(kurs)}</td><td class="r">${eur(x.wert)}</td><td class="r">${gesamt ? eur(rund2((x.wert / gesamt) * 100)) : '0,00'} %</td></tr>`;
  }).join('');
  const css = `
    .dp th { text-align:left; font-size:8.4pt; background:#f2f2f2; border-bottom:0.3mm solid #444; padding:1.2mm 1.5mm; }
    .dp td { font-size:8.8pt; padding:1.2mm 1.5mm; border-bottom:0.15mm solid #ddd; }
    .dp tr.summe td { font-weight:bold; border-top:0.4mm solid #333; border-bottom:none; }
  `;
  const html = htmlDoc(`
    <div class="seite" style="padding-top:14mm">
      <div style="display:flex;justify-content:space-between;border-bottom:0.8mm solid ${farbe};padding-bottom:2mm">
        <div style="font-size:15pt;font-weight:bold;color:${farbe}">${esc(bank)}</div>
        <div class="klein r">Depot- und Vermögensaufstellung<br>Blatt 1 von 1</div>
      </div>
      <table style="margin:6mm 0 6mm;font-size:9.3pt"><tr>
        <td style="width:55%">${esc(`${anrede(p)} ${nameVoll(p)}`.trim())}<br>${esc(w.strasse)} ${esc(w.hausnummer)}<br>${esc(w.plz)} ${esc(w.ort)}</td>
        <td><table style="font-size:8.8pt">
          <tr><td style="color:#555;width:30mm">Depotinhaber</td><td>${esc(nameVoll(p))}</td></tr>
          <tr><td style="color:#555">Depotnummer</td><td>${esc(depotnr)}</td></tr>
          <tr><td style="color:#555">Stichtag</td><td>${datum(stichtag)}</td></tr>
          <tr><td style="color:#555">Erstellt am</td><td>${datum(isoMinus(stichtag, -ganz(r, 1, 6)))}</td></tr>
        </table></td></tr></table>
      <div class="fett" style="font-size:11pt;margin-bottom:2mm">Vermögensaufstellung zum ${datum(stichtag)}</div>
      <table class="dp">
        <tr><th>Position</th><th class="r" style="width:24mm">Stück</th><th class="r" style="width:22mm">Kurs EUR</th><th class="r" style="width:28mm">Kurswert EUR</th><th class="r" style="width:18mm">Anteil</th></tr>
        ${zeilen}
        <tr class="summe"><td colspan="3">Gesamtwert</td><td class="r">${eur(gesamt)}</td><td class="r">100,00 %</td></tr>
      </table>
      <p class="klein" style="margin-top:6mm">Die Bewertung erfolgt zu den letzten verfügbaren Kursen des Stichtags (Handelsplatz Xetra bzw. Rücknahmepreis
      der Kapitalverwaltungsgesellschaft). Kontoguthaben werden mit dem Nominalwert inklusive aufgelaufener Zinsen ausgewiesen.
      Kursangaben ohne Gewähr. Diese Aufstellung wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>
    </div>`, css);

  return {
    art: 'depotauszug', typ: 'vermoegensnachweis', titel: `Depotauszug ${bank} zum ${datum(stichtag)}`, person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { analyse: { betrag: gesamt }, identitaet: identitaet(p) },
  };
}

// ── Verdienstbescheinigung des Arbeitgebers ─────────────────────────────────

export interface Einmalzahlung { monat: string; bezeichnung: string; betrag: number }

export interface VerdienstbescheinigungOptionen {
  /** Letzter abgerechneter Monat "YYYY-MM", Default: Vormonat des Antragsdatums. */
  bis?: string;
  /** Anzahl Monate, Default 12. */
  monate?: number;
  /** Monatsbrutto, Default: Einnahme „Gehalt/Lohn" der Person. */
  monatsbrutto?: number;
  /**
   * Default: Urlaubsgeld im Juni (30 % Monatsbrutto) und Weihnachtsgeld im November (50 %),
   * soweit im Zeitraum. `[]` = keine Einmalzahlungen.
   */
  einmalzahlungen?: Einmalzahlung[];
  /** Ausstellungsdatum, Default: 3–15 Tage vor dem Antragsdatum. */
  datum?: string;
  /** Unterschrift + Firmenstempel, Default true. */
  unterschrift?: boolean;
}

export async function erzeugeVerdienstbescheinigung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec);
  const b = p.beschaeftigung;
  if (!b) throw new Error(`${fall.id}: Person ${p.id} hat keine Beschäftigung`);
  const opt = (spec.optionen ?? {}) as VerdienstbescheinigungOptionen;
  const r = rng(`${fall.id}:verdienstbescheinigung:${p.id}`);
  const brutto = opt.monatsbrutto ?? gehaltMonat(p);
  const bis = opt.bis ?? monatPlus(fall.antragsdatum.slice(0, 7), -1);
  const anzahl = opt.monate ?? 12;
  const monate = Array.from({ length: anzahl }, (_, i) => monatPlus(bis, i - anzahl + 1));
  const einmal = opt.einmalzahlungen ?? monate.flatMap((m) => m.endsWith('-06')
    ? [{ monat: m, bezeichnung: 'Urlaubsgeld', betrag: rund2(brutto * 0.3) }]
    : m.endsWith('-11') ? [{ monat: m, bezeichnung: 'Weihnachtsgeld', betrag: rund2(brutto * 0.5) }] : []);
  const ausgestellt = opt.datum ?? isoMinus(fall.antragsdatum, ganz(r, 3, 15));
  const mitUnterschrift = opt.unterschrift ?? true;
  const sachbearbeiter = `${wahl(r, ['Sabine', 'Petra', 'Thomas', 'Andrea', 'Michael', 'Claudia'])} ${wahl(r, ['Weber', 'Schäfer', 'Keller', 'Braun', 'Zimmermann', 'Lang'])}`;
  const [agStrasse, agOrt] = b.arbeitgeberAnschrift.split(/,\s*/);
  const w = fall.wohnung;

  let summeLfd = 0;
  let summeEinmal = 0;
  const zeilen = monate.map((m) => {
    const e = einmal.filter((x) => x.monat === m);
    const eb = rund2(e.reduce((s, x) => s + x.betrag, 0));
    summeLfd = rund2(summeLfd + brutto);
    summeEinmal = rund2(summeEinmal + eb);
    return `<tr><td>${esc(monatName(m))}</td><td class="r">${eur(brutto)}</td><td class="r">${eb ? eur(eb) : '—'}</td><td>${esc(e.map((x) => x.bezeichnung).join(', '))}</td><td class="r">${eur(rund2(brutto + eb))}</td></tr>`;
  }).join('');
  const css = `
    .vb th { text-align:left; font-size:8.3pt; background:#eef1f4; border-bottom:0.3mm solid #333; padding:1mm 1.5mm; }
    .vb td { font-size:8.8pt; padding:0.9mm 1.5mm; border-bottom:0.15mm solid #ccc; }
    .vb tr.summe td { font-weight:bold; border-top:0.4mm solid #333; border-bottom:none; }
    .kv td { font-size:9pt; padding:0.6mm 0; }
    .kv td:first-child { color:#555; width:48mm; }
    .stempel { display:inline-block; border:0.6mm solid #2b4a9b; color:#2b4a9b; border-radius:2mm; padding:1.5mm 3mm; font-size:8pt; font-weight:bold; transform:rotate(-4deg); opacity:0.85; text-align:center; line-height:1.3; }
  `;
  const html = htmlDoc(`
    <div class="seite" style="padding-top:14mm">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:0.6mm solid #333;padding-bottom:2mm">
        <div><div style="font-size:13pt;font-weight:bold">${esc(b.arbeitgeber)}</div><div class="klein">${esc(b.arbeitgeberAnschrift)}</div></div>
        <div class="klein r">Personalabteilung<br>${esc(sachbearbeiter)}</div>
      </div>
      <div style="font-size:14pt;font-weight:bold;margin:7mm 0 1mm">Verdienstbescheinigung</div>
      <div style="font-size:9.5pt;margin-bottom:5mm">zur Vorlage bei der Wohngeldstelle</div>
      <table class="kv" style="margin-bottom:5mm">
        <tr><td>Arbeitnehmer/in</td><td>${esc(nameVoll(p))}, geb. ${datum(p.geburtsdatum)}</td></tr>
        <tr><td>Anschrift</td><td>${esc(w.strasse)} ${esc(w.hausnummer)}, ${esc(w.plz)} ${esc(w.ort)}</td></tr>
        <tr><td>Personalnummer</td><td>${esc(b.personalnummer)}</td></tr>
        <tr><td>Beschäftigt seit</td><td>${datum(b.eintritt)} (unbefristet)</td></tr>
        <tr><td>Wöchentliche Arbeitszeit</td><td>${b.wochenstunden} Stunden</td></tr>
        <tr><td>Steuerklasse</td><td>${esc(b.steuerklasse)}${b.kirche ? ', kirchensteuerpflichtig' : ''}</td></tr>
      </table>
      <p style="font-size:9pt;margin:0 0 2mm">Bruttoarbeitsentgelt der letzten ${anzahl} abgerechneten Monate:</p>
      <table class="vb" style="margin-bottom:4mm">
        <tr><th>Monat</th><th class="r" style="width:30mm">Laufendes Brutto EUR</th><th class="r" style="width:26mm">Einmalzahlung EUR</th><th style="width:30mm">Art</th><th class="r" style="width:28mm">Gesamt EUR</th></tr>
        ${zeilen}
        <tr class="summe"><td>Summe</td><td class="r">${eur(summeLfd)}</td><td class="r">${eur(summeEinmal)}</td><td></td><td class="r">${eur(rund2(summeLfd + summeEinmal))}</td></tr>
      </table>
      <p style="font-size:9pt;margin:0 0 2mm">Das laufende monatliche Bruttoentgelt beträgt derzeit <b>${eur(brutto)} EUR</b>. Änderungen sind nicht vereinbart.
      Sachbezüge und steuerfreie Zuschläge wurden nicht gewährt. Die Angaben entsprechen den Lohnunterlagen.</p>
      <div style="position:absolute;bottom:20mm;left:22mm;right:20mm;display:flex;justify-content:space-between;align-items:flex-end;font-size:9pt">
        <div>${esc((agOrt ?? w.ort).replace(/^\d{5}\s*/, ''))}, ${datum(ausgestellt)}</div>
        <div style="position:relative;width:75mm;text-align:center">
          ${mitUnterschrift ? `<div style="position:absolute;left:-42mm;bottom:3mm" class="stempel">${esc(b.arbeitgeber)}<br><span style="font-weight:normal">${esc(agStrasse ?? '')} · ${esc(agOrt ?? '')}</span></div>
          <div style="height:13mm">${unterschriftSvg(sachbearbeiter, 40)}</div>` : '<div style="height:13mm"></div>'}
          <div style="border-top:0.2mm solid #333;padding-top:1mm">${esc(sachbearbeiter)}, Personalabteilung</div>
        </div>
      </div>
    </div>`, css);

  return {
    art: 'verdienstbescheinigung', typ: 'verdienstbescheinigung', titel: `Verdienstbescheinigung ${b.arbeitgeber} ${p.nachname}`, person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { analyse: { betrag: brutto }, identitaet: identitaet(p) },
  };
}

// ── Registrierung ───────────────────────────────────────────────────────────

export const GENERATOREN_FINANZEN: Partial<Record<DokArt, Generator>> = {
  steuerbescheid: erzeugeSteuerbescheid,
  euer: erzeugeEuer,
  kv_beitragsnachweis: erzeugeKvBeitragsnachweis,
  depotauszug: erzeugeDepotauszug,
  verdienstbescheinigung: erzeugeVerdienstbescheinigung,
};
