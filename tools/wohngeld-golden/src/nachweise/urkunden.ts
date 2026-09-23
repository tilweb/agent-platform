/**
 * Verträge, Urkunden und Erklärungen: Untermietvertrag, Heimvertrag (WBVG),
 * Betreuungsvereinbarung (Wechselmodell), Abfindungsvereinbarung,
 * Betreuerausweis, Sterbeurkunde, Zuwendungserklärung Dritter, Unterhaltsnachweis
 * (Jugendamtsurkunde oder Überweisungsbestätigung).
 *
 * Dokumentdaten kommen über `spec.optionen` (je Generator ein Options-Interface
 * mit Defaults); die betroffene Person über `spec.person` (Default 'P1').
 */
import { datum, esc, eur, ganz, htmlDoc, htmlZuPdf, iban, ibanFormat, monatName, rng, rund2, unterschriftSvg, wahl } from '../lib';
import type { DokArt, DokSpec, ErzeugtesDokument, Fall, Generator, Person } from '../types';
import { BRIEF_CSS, brief } from './brief';

// ── Helfer ──────────────────────────────────────────────────────────────────

interface NameGeb { vorname: string; nachname: string; geburtsdatum: string }
interface Name { vorname: string; nachname: string }

function personVon(fall: Fall, spec: DokSpec): Person {
  const p = fall.personen.find((x) => x.id === (spec.person ?? 'P1'));
  if (!p) throw new Error(`${fall.id}: Person ${spec.person} unbekannt`);
  return p;
}

const opt = <T,>(spec: DokSpec) => (spec.optionen ?? {}) as Partial<T>;
const nm = (p: Name) => `${p.vorname} ${p.nachname}`;
const identitaet = (p: Person) => ({ nachname: p.nachname, vorname: p.vorname });
const zahl = (n: number) => String(n).replace('.', ',');
const ortOhnePlz = (plzOrt: string) => plzOrt.replace(/^\d+\s*/, '');

/** ISO-Datum um n Tage verschieben. */
function tagePlus(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Erster des Monats, delta Monate relativ zu iso. */
function monatsErster(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

/** Letzter des Monats, delta Monate relativ zu iso. */
function monatsLetzter(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! + delta, 0));
  return d.toISOString().slice(0, 10);
}

function anschrift(fall: Fall): string {
  const w = fall.wohnung;
  return `${w.strasse} ${w.hausnummer}, ${w.plz} ${w.ort}`;
}

const herrFrau = (p: Person) => (p.geschlecht === 'weiblich' ? 'Frau' : p.geschlecht === 'maennlich' ? 'Herr' : '');

/** Runder Dienstsiegel-Abdruck als Inline-SVG. */
function siegel(umschrift: string, groesseMm = 28): string {
  const id = `s${Math.abs([...umschrift].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}`;
  return `<svg viewBox="0 0 100 100" style="width:${groesseMm}mm;height:${groesseMm}mm;opacity:0.72">
    <defs><path id="${id}" d="M 50 50 m -37 0 a 37 37 0 1 1 74 0 a 37 37 0 1 1 -74 0"/></defs>
    <circle cx="50" cy="50" r="47" fill="none" stroke="#2c3e8c" stroke-width="2"/>
    <circle cx="50" cy="50" r="29" fill="none" stroke="#2c3e8c" stroke-width="1"/>
    <text font-size="9.5" font-family="Arial" fill="#2c3e8c" letter-spacing="0.6"><textPath href="#${id}">${esc(umschrift)} ★</textPath></text>
    <path d="M50 30 L56 44 L70 44 L59 53 L63 67 L50 58 L37 67 L41 53 L30 44 L44 44 Z" fill="none" stroke="#2c3e8c" stroke-width="1.4"/>
  </svg>`;
}

const VERTRAG_CSS = `
  .mv { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.45; }
  .mv h1 { text-align: center; font-size: 17pt; margin: 0 0 1mm; letter-spacing: 0.5mm; }
  .mv h2 { font-size: 11pt; margin: 4.5mm 0 1.5mm; }
  .mv p { margin: 0 0 2mm; text-align: justify; }
  .mv ul { margin: 0 0 2mm 0; padding-left: 8mm; }
  .mv .fuss { position: absolute; bottom: 10mm; left: 22mm; right: 20mm; font-size: 8pt; color: #555; display: flex; justify-content: space-between; border-top: 0.2mm solid #999; padding-top: 1.5mm; }
  .mv table.kosten td { padding: 0.8mm 0; } .mv table.kosten td.b { text-align: right; width: 32mm; }
  .mv table.kosten th { text-align: right; font-weight: normal; font-size: 9pt; color: #444; }
  .mv table.kosten tr.summe td { border-top: 0.3mm solid #222; font-weight: bold; }
  .sig { display: flex; justify-content: space-between; margin-top: 10mm; }
  .sig > div { width: 72mm; }
  .sig .linie { border-top: 0.3mm solid #222; padding-top: 1mm; font-size: 9pt; }
  .sig .feld { height: 18mm; display: flex; align-items: flex-end; }
`;

const VORNAMEN_W = ['Gisela', 'Renate', 'Monika', 'Sabine', 'Petra', 'Claudia', 'Martina', 'Andrea'] as const;
const VORNAMEN_M = ['Klaus', 'Jürgen', 'Rainer', 'Thomas', 'Frank', 'Stefan', 'Michael', 'Uwe'] as const;
const NACHNAMEN = ['Becker', 'Schulte', 'Wagner', 'Neumann', 'Kessler', 'Lorenz', 'Hartmann', 'Vogt', 'Brandt', 'Seidel'] as const;

// ── Untermietvertrag ────────────────────────────────────────────────────────

export interface UntermietvertragOptionen {
  /** Untermieter (Default: erfundene Person, *1998). */
  untermieter: NameGeb;
  /** Zimmergröße in m² (Default 14). */
  zimmerQm: number;
  /** Grundentgelt Zimmer inkl. Möblierung (Default 250). */
  grundentgelt: number;
  /** Anteil Betriebskosten (Default 60). */
  anteilNebenkosten: number;
  /** Anteil Heizung/Warmwasser (Default 40). */
  anteilHeizung: number;
  /** Mietbeginn ISO (Default: Erster, 6 Monate vor Antragsdatum). */
  beginn: string;
  /** Datum der Zustimmung des Vermieters (Default: 3 Wochen vor Beginn). */
  zustimmungVom: string;
  /** Unterschriften vorhanden (Default true). */
  unterschrieben: boolean;
}

async function erzeugeUntermietvertrag(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:untermietvertrag`);
  const o = opt<UntermietvertragOptionen>(spec);
  const hm = personVon(fall, spec);
  const w = fall.wohnung;
  const v = fall.vermieter;
  const um: NameGeb = o.untermieter ?? { vorname: wahl(r, ['Jonas', 'Lea', 'Felix', 'Hannah', 'Tim', 'Sophie']), nachname: wahl(r, NACHNAMEN), geburtsdatum: `1998-0${ganz(r, 1, 9)}-1${ganz(r, 0, 9)}` };
  const qm = o.zimmerQm ?? 14;
  const grund = o.grundentgelt ?? 250;
  const nk = o.anteilNebenkosten ?? 60;
  const hz = o.anteilHeizung ?? 40;
  const gesamt = rund2(grund + nk + hz);
  const beginn = o.beginn ?? monatsErster(fall.antragsdatum, -6);
  const zustimmung = o.zustimmungVom ?? tagePlus(beginn, -21);
  const unterschrieben = o.unterschrieben ?? true;
  const vertragsdatum = tagePlus(beginn, -10);
  const fuss = (n: number) => `<div class="fuss"><span>Untermietvertrag · ${esc(anschrift(fall))}</span><span>Seite ${n} von 2</span></div>`;

  const s1 = `
  <div class="seite mv">
    <h1>UNTERMIETVERTRAG</h1>
    <p style="text-align:center;margin-bottom:6mm">über ein möbliertes Zimmer</p>
    <p>Zwischen</p>
    <p style="margin-left:10mm"><b>${esc(nm(hm))}</b>, geb. ${datum(hm.geburtsdatum)}<br>${esc(anschrift(fall))}<br>— nachstehend „Hauptmieter" genannt —</p>
    <p>und</p>
    <p style="margin-left:10mm"><b>${esc(nm(um))}</b>, geb. ${datum(um.geburtsdatum)}<br>— nachstehend „Untermieter" genannt —</p>
    <p>wird folgender Untermietvertrag geschlossen:</p>
    <h2>§ 1 Mietgegenstand</h2>
    <p>(1) Der Hauptmieter vermietet dem Untermieter in der von ihm gemieteten Wohnung ${esc(anschrift(fall))}, ${esc(w.lage)},
    ein möbliertes Zimmer zur alleinigen Nutzung. Die Größe des Zimmers beträgt <b>${zahl(qm)} m²</b>.</p>
    <p>(2) Das Zimmer ist mit folgendem Inventar ausgestattet: Bett mit Lattenrost und Matratze, Kleiderschrank, Schreibtisch mit
    Stuhl, Bücherregal, Deckenleuchte und Vorhänge.</p>
    <p>(3) Küche, Bad/WC und Flur dürfen vom Untermieter mitbenutzt werden. Der Untermieter erhält einen Haus- und einen
    Wohnungsschlüssel sowie einen Schlüssel für sein Zimmer.</p>
    <h2>§ 2 Zustimmung des Vermieters</h2>
    <p>Der Vermieter der Wohnung, ${esc(v.name)}, ${esc(v.strasse)}, ${esc(v.plzOrt)}, hat der Untervermietung mit Schreiben vom
    ${datum(zustimmung)} gemäß § 540 BGB zugestimmt. Das Untermietverhältnis endet spätestens mit der Beendigung des
    Hauptmietverhältnisses.</p>
    <h2>§ 3 Mietzeit</h2>
    <p>Das Untermietverhältnis beginnt am <b>${datum(beginn)}</b> und läuft auf unbestimmte Zeit. Da das Zimmer Teil der vom
    Hauptmieter selbst bewohnten Wohnung ist und überwiegend von ihm eingerichtet wurde, ist die Kündigung spätestens am
    15. eines Monats zum Ablauf dieses Monats zulässig (§ 573c Abs. 3 BGB).</p>
    <h2>§ 4 Mietentgelt</h2>
    <p>(1) Das monatliche Entgelt beträgt:</p>
    <table class="kosten" style="width:125mm;margin:0 0 3mm 10mm">
      <tr><td>Grundentgelt Zimmer einschließlich Möblierung</td><td class="b">${eur(grund)} EUR</td></tr>
      <tr><td>Anteil Betriebskosten</td><td class="b">${eur(nk)} EUR</td></tr>
      <tr><td>Anteil Heizung und Warmwasser</td><td class="b">${eur(hz)} EUR</td></tr>
      <tr class="summe"><td>Gesamtentgelt monatlich</td><td class="b">${eur(gesamt)} EUR</td></tr>
    </table>
    <p>(2) Die Anteile für Betriebs- und Heizkosten sind als Pauschale vereinbart; eine gesonderte Abrechnung erfolgt nicht.
    Strom und Internet sind im Entgelt enthalten.</p>
    ${fuss(1)}
  </div>`;

  const sig = (name: string, rolle: string) => `
    <div><div class="feld">${unterschrieben ? unterschriftSvg(name, 48) : ''}</div>
    <div class="linie">${esc(rolle)}: ${esc(name)}</div></div>`;
  const s2 = `
  <div class="seite mv">
    <h2>§ 5 Zahlung</h2>
    <p>Das Entgelt ist monatlich im Voraus, spätestens am dritten Werktag des Monats, auf das Konto des Hauptmieters bei der
    ${esc(fall.bank.name)}, IBAN ${esc(ibanFormat(fall.bank.iban))}, zu überweisen.</p>
    <h2>§ 6 Kaution</h2>
    <p>Der Untermieter leistet bei Einzug eine Kaution in Höhe von ${eur(grund * 2)} EUR. Sie wird nach Beendigung des
    Untermietverhältnisses und Rückgabe des Zimmers samt Inventar in ordnungsgemäßem Zustand zurückgezahlt.</p>
    <h2>§ 7 Nutzung, Hausordnung</h2>
    <p>(1) Das Zimmer darf nur zu Wohnzwecken durch den Untermieter selbst genutzt werden. Eine Weitervermietung ist nicht gestattet.
    Übernachtungsbesuch ist gelegentlich zulässig.</p>
    <p>(2) Die Hausordnung des Hauptmietvertrags gilt entsprechend. Gemeinschaftlich genutzte Räume sind im wöchentlichen
    Wechsel zu reinigen. Rauchen ist in der gesamten Wohnung nicht gestattet.</p>
    <h2>§ 8 Rückgabe</h2>
    <p>Bei Beendigung des Untermietverhältnisses ist das Zimmer geräumt, gereinigt und mit sämtlichem Inventar sowie allen
    Schlüsseln zurückzugeben. Ein Übergabeprotokoll wird bei Ein- und Auszug gefertigt.</p>
    <h2>§ 9 Schlussbestimmungen</h2>
    <p>Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt die
    Wirksamkeit der übrigen Bestimmungen unberührt. Jede Vertragspartei erhält eine Ausfertigung.</p>
    <p style="margin-top:10mm">${esc(w.ort)}, den ${datum(vertragsdatum)}</p>
    <div class="sig">${sig(nm(hm), 'Hauptmieter')}${sig(nm(um), 'Untermieter')}</div>
    ${fuss(2)}
  </div>`;

  return {
    art: 'untermietvertrag', typ: 'mietvertrag', titel: 'Untermietvertrag (möbliertes Zimmer)', person: hm.id,
    pdf: await htmlZuPdf(htmlDoc(s1 + s2, VERTRAG_CSS)),
    erwartet: { identitaet: identitaet(hm), analyse: { miete: gesamt, wohnflaeche_qm: qm, unterschrift_vorhanden: unterschrieben } },
  };
}

// ── Heimvertrag (WBVG) ──────────────────────────────────────────────────────

export interface HeimvertragOptionen {
  /** Träger (Default: „Diakonische Altenhilfe <Ort> gGmbH"). */
  traeger: { name: string; strasse: string; plzOrt: string };
  /** Name der Einrichtung (Default „Seniorenzentrum Am Lindenhof"); Anschrift = fall.wohnung. */
  einrichtung: string;
  /** Rechtlicher Betreuer, unterschreibt (Default: erfundener Betreuer). */
  betreuer: Name;
  /** Zimmerbezeichnung (Default „Einzelzimmer Nr. 2.14, Wohnbereich 2"). */
  zimmer: string;
  /** Zimmergröße m² (Default 18,5). */
  zimmerQm: number;
  /** Pflegegrad (Default 4). */
  pflegegrad: number;
  /** Tagessätze in EUR (Defaults: 23,85 / 12,40 / 16,90 / 101,35). */
  tagUnterkunft: number;
  tagVerpflegung: number;
  tagInvestition: number;
  tagPflege: number;
  /** Leistungsbetrag der Pflegekasse monatlich (Default 1.855,00). */
  pflegekasse: number;
  /** Vertragsbeginn ISO (Default: Erster, 4 Monate vor Antragsdatum). */
  beginn: string;
  /** Unterschrift vorhanden (Default true). */
  unterschrieben: boolean;
}

const TAGE_MONAT = 30.42;

async function erzeugeHeimvertrag(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:heimvertrag`);
  const o = opt<HeimvertragOptionen>(spec);
  const b = personVon(fall, spec);
  const w = fall.wohnung;
  const traeger = o.traeger ?? { name: `Diakonische Altenhilfe ${w.ort} gGmbH`, strasse: 'Kirchplatz 4', plzOrt: `${w.plz} ${w.ort}` };
  const einrichtung = o.einrichtung ?? 'Seniorenzentrum Am Lindenhof';
  const betreuer: Name = o.betreuer ?? { vorname: wahl(r, VORNAMEN_M), nachname: wahl(r, NACHNAMEN) };
  const zimmer = o.zimmer ?? 'Einzelzimmer Nr. 2.14, Wohnbereich 2';
  const qm = o.zimmerQm ?? 18.5;
  const pg = o.pflegegrad ?? 4;
  const tag = { u: o.tagUnterkunft ?? 23.85, v: o.tagVerpflegung ?? 12.4, i: o.tagInvestition ?? 16.9, p: o.tagPflege ?? 101.35 };
  const mon = { u: rund2(tag.u * TAGE_MONAT), v: rund2(tag.v * TAGE_MONAT), i: rund2(tag.i * TAGE_MONAT), p: rund2(tag.p * TAGE_MONAT) };
  const gesamt = rund2(mon.u + mon.v + mon.i + mon.p);
  const kasse = o.pflegekasse ?? 1855;
  const eigen = rund2(gesamt - kasse);
  const beginn = o.beginn ?? monatsErster(fall.antragsdatum, -4);
  const unterschrieben = o.unterschrieben ?? true;
  const vertragsdatum = tagePlus(beginn, -6);
  const kundennr = `B-${ganz(r, 10000, 99999)}`;
  const leitung = `${wahl(r, VORNAMEN_W)} ${wahl(r, NACHNAMEN)}`;
  const bew = `${herrFrau(b) === 'Frau' ? 'Die Bewohnerin' : 'Der Bewohner'}`;
  const fuss = (n: number) => `<div class="fuss"><span>Wohn- und Betreuungsvertrag · ${esc(einrichtung)} · Bewohner-Nr. ${kundennr}</span><span>Seite ${n} von 3</span></div>`;

  const s1 = `
  <div class="seite mv">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:0.5mm solid #5b2a86;padding-bottom:2mm;margin-bottom:8mm">
      <div><div style="font-family:Arial;font-weight:bold;font-size:13pt;color:#5b2a86">${esc(einrichtung)}</div>
      <div style="font-family:Arial;font-size:8pt;color:#444">${esc(w.strasse)} ${esc(w.hausnummer)} · ${esc(w.plz)} ${esc(w.ort)}</div></div>
      <div style="font-family:Arial;font-size:8pt;color:#444;text-align:right">Ein Haus der<br>${esc(traeger.name)}</div>
    </div>
    <h1>WOHN- UND BETREUUNGSVERTRAG</h1>
    <p style="text-align:center;margin-bottom:6mm">für die vollstationäre Pflege nach dem Wohn- und Betreuungsvertragsgesetz (WBVG)</p>
    <p>Zwischen</p>
    <p style="margin-left:10mm"><b>${esc(traeger.name)}</b>, ${esc(traeger.strasse)}, ${esc(traeger.plzOrt)},<br>als Träger der Einrichtung
    ${esc(einrichtung)}, vertreten durch die Einrichtungsleitung<br>— nachstehend „Einrichtung" genannt —</p>
    <p>und</p>
    <p style="margin-left:10mm"><b>${esc(nm(b))}</b>, geb. ${datum(b.geburtsdatum)},<br>
    vertreten durch den rechtlichen Betreuer ${esc(nm(betreuer))}<br>— nachstehend „Bewohner" genannt —</p>
    <p>wird folgender Vertrag geschlossen:</p>
    <h2>§ 1 Vertragsgegenstand</h2>
    <p>Die Einrichtung überlässt dem Bewohner Wohnraum und erbringt Pflege- und Betreuungsleistungen nach Maßgabe dieses Vertrags
    und des Versorgungsvertrags nach § 72 SGB XI. Die Einrichtung ist eine zugelassene vollstationäre Pflegeeinrichtung.</p>
    <h2>§ 2 Wohnraum</h2>
    <p>(1) Dem Bewohner wird ${esc(zimmer)} mit einer Größe von <b>${zahl(qm)} m²</b> einschließlich eigenem Duschbad/WC zur
    alleinigen Nutzung überlassen. Das Zimmer ist mit Pflegebett, Nachttisch, Kleiderschrank, Tisch, zwei Stühlen und
    Rufanlage ausgestattet.</p>
    <p>(2) Gemeinschaftsräume, Speisesaal, Garten und Kapelle stehen zur Mitbenutzung zur Verfügung. Eigene Möbel können nach
    Absprache eingebracht werden.</p>
    <h2>§ 3 Vertragsbeginn und -dauer</h2>
    <p>Der Vertrag beginnt am <b>${datum(beginn)}</b> und wird auf unbestimmte Zeit geschlossen. Der Einzug erfolgte am
    ${datum(beginn)}.</p>
    ${fuss(1)}
  </div>`;

  const s2 = `
  <div class="seite mv">
    <h2>§ 4 Leistungen der Einrichtung</h2>
    <p>(1) <b>Unterkunft:</b> Überlassung des Wohnraums, Reinigung, Wäscheversorgung, Heizung, Strom, Wasser und Instandhaltung.</p>
    <p>(2) <b>Verpflegung:</b> Vollverpflegung mit drei Hauptmahlzeiten, Zwischenmahlzeiten und Getränken; Diät- und Schonkost nach
    ärztlicher Verordnung.</p>
    <p>(3) <b>Pflege und Betreuung:</b> allgemeine Pflegeleistungen entsprechend dem Pflegegrad, soziale Betreuung sowie
    medizinische Behandlungspflege nach § 43 SGB XI.</p>
    <h2>§ 5 Entgelt</h2>
    <p>(1) Das Entgelt setzt sich nach der geltenden Vergütungsvereinbarung wie folgt zusammen (Pflegegrad ${pg},
    Berechnungsgrundlage ${zahl(TAGE_MONAT)} Tage je Monat):</p>
    <table class="kosten" style="width:150mm;margin:0 0 3mm 5mm">
      <tr><td></td><th>je Tag</th><th>je Monat</th></tr>
      <tr><td>Entgelt für Unterkunft</td><td class="b">${eur(tag.u)} EUR</td><td class="b">${eur(mon.u)} EUR</td></tr>
      <tr><td>Entgelt für Verpflegung</td><td class="b">${eur(tag.v)} EUR</td><td class="b">${eur(mon.v)} EUR</td></tr>
      <tr><td>Investitionskosten (§ 82 Abs. 3 SGB XI)</td><td class="b">${eur(tag.i)} EUR</td><td class="b">${eur(mon.i)} EUR</td></tr>
      <tr><td>Pflegebedingter Aufwand (Pflegegrad ${pg})</td><td class="b">${eur(tag.p)} EUR</td><td class="b">${eur(mon.p)} EUR</td></tr>
      <tr class="summe"><td>Gesamtentgelt</td><td class="b">${eur(rund2(tag.u + tag.v + tag.i + tag.p))} EUR</td><td class="b">${eur(gesamt)} EUR</td></tr>
      <tr><td>abzüglich Leistungsbetrag der Pflegekasse (§ 43 SGB XI)</td><td class="b"></td><td class="b">– ${eur(kasse)} EUR</td></tr>
      <tr class="summe"><td>Vom Bewohner zu tragender Betrag</td><td class="b"></td><td class="b">${eur(eigen)} EUR</td></tr>
    </table>
    <p>(2) Der Leistungszuschlag der Pflegekasse nach § 43c SGB XI wird, sobald er bewilligt ist, gesondert in der Monatsrechnung
    ausgewiesen und mindert den Eigenanteil.</p>
    <p>(3) Bei Abwesenheit von mehr als drei Kalendertagen wird das Entgelt nach Maßgabe des Rahmenvertrags nach § 75 SGB XI
    um 25 % gekürzt.</p>
    <h2>§ 6 Zahlung</h2>
    <p>Das Entgelt ist monatlich im Voraus bis zum 15. des Monats fällig. ${bew} erteilt der Einrichtung ein SEPA-Lastschriftmandat
    für das Konto bei der ${esc(fall.bank.name)}, IBAN ${esc(ibanFormat(fall.bank.iban))}.</p>
    ${fuss(2)}
  </div>`;

  const s3 = `
  <div class="seite mv">
    <h2>§ 7 Entgelterhöhung</h2>
    <p>Die Einrichtung kann eine Erhöhung des Entgelts verlangen, wenn sich die bisherige Berechnungsgrundlage verändert.
    Die Erhöhung wird schriftlich mindestens vier Wochen vor ihrem Wirksamwerden mitgeteilt und begründet (§ 9 WBVG).</p>
    <h2>§ 8 Kündigung</h2>
    <p>(1) Der Bewohner kann den Vertrag spätestens am dritten Werktag eines Kalendermonats zum Ablauf desselben Monats
    schriftlich kündigen (§ 11 WBVG).</p>
    <p>(2) Die Einrichtung kann den Vertrag nur aus wichtigem Grund kündigen (§ 12 WBVG).</p>
    <h2>§ 9 Datenschutz</h2>
    <p>Personenbezogene Daten werden nur verarbeitet, soweit dies zur Durchführung dieses Vertrags erforderlich ist.
    Die Datenschutzhinweise (Anlage 3) wurden ausgehändigt.</p>
    <h2>§ 10 Schlussbestimmungen</h2>
    <p>Änderungen dieses Vertrags bedürfen der Schriftform. Bestandteile des Vertrags sind: Anlage 1 Leistungsbeschreibung,
    Anlage 2 Entgeltübersicht, Anlage 3 Datenschutzhinweise, Anlage 4 Hausordnung. ${bew} hat vor Vertragsschluss die
    Informationen nach § 3 WBVG erhalten.</p>
    <p style="margin-top:10mm">${esc(w.ort)}, den ${datum(vertragsdatum)}</p>
    <div class="sig">
      <div><div class="feld">${unterschrieben ? unterschriftSvg(leitung, 44) : ''}</div>
      <div class="linie">Für die Einrichtung: ${esc(leitung)}, Einrichtungsleitung</div></div>
      <div><div class="feld">${unterschrieben ? unterschriftSvg(nm(betreuer), 48) : ''}</div>
      <div class="linie">${esc(nm(betreuer))}, als rechtlicher Betreuer für ${esc(nm(b))}</div></div>
    </div>
    ${fuss(3)}
  </div>`;

  return {
    art: 'heimvertrag', typ: 'mietvertrag', titel: 'Wohn- und Betreuungsvertrag (Pflegeheim)', person: b.id,
    pdf: await htmlZuPdf(htmlDoc(s1 + s2 + s3, VERTRAG_CSS)),
    erwartet: { identitaet: identitaet(b), analyse: { miete: rund2(mon.u + mon.i), unterschrift_vorhanden: unterschrieben } },
  };
}

// ── Betreuungsvereinbarung (Wechselmodell) ──────────────────────────────────

export interface BetreuungsvereinbarungOptionen {
  /** Kind (Default: Haushaltsmitglied mit Verhältnis Sohn/Tochter, sonst erfunden). */
  kind: NameGeb;
  /** Anderer Elternteil (Default: erfunden, Anschrift erfunden im selben Ort). */
  andererElternteil: Name & { anschrift: string };
  /** Betreuungsanteil der Person aus spec.person in Prozent (Default 40). */
  anteilProzent: number;
  /** Gültig ab ISO (Default: Erster, 10 Monate vor Antragsdatum). */
  ab: string;
  /** Wer das Kindergeld bezieht (Default 'person' = Person aus spec.person). */
  kindergeldBei: 'person' | 'anderer';
  /** Unterschriften vorhanden (Default true). */
  unterschrieben: boolean;
}

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

async function erzeugeBetreuungsvereinbarung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:betreuungsvereinbarung`);
  const o = opt<BetreuungsvereinbarungOptionen>(spec);
  const p = personVon(fall, spec);
  const kindP = fall.personen.find((x) => /(sohn|tochter|kind)/i.test(x.verhaeltnis ?? ''));
  const kind: NameGeb = o.kind ?? (kindP ? { vorname: kindP.vorname, nachname: kindP.nachname, geburtsdatum: kindP.geburtsdatum } : { vorname: wahl(r, ['Mia', 'Emil', 'Lina', 'Paul']), nachname: p.nachname, geburtsdatum: '2017-04-12' });
  const anderer = o.andererElternteil ?? {
    vorname: p.geschlecht === 'weiblich' ? wahl(r, VORNAMEN_M) : wahl(r, VORNAMEN_W),
    nachname: kind.nachname !== p.nachname ? kind.nachname : wahl(r, NACHNAMEN),
    anschrift: `${wahl(r, ['Lindenweg', 'Am Hang', 'Gartenstraße', 'Mühlgasse'])} ${ganz(r, 2, 40)}, ${fall.wohnung.plz} ${fall.wohnung.ort}`,
  };
  const anteil = o.anteilProzent ?? 40;
  const ab = o.ab ?? monatsErster(fall.antragsdatum, -10);
  const unterschrieben = o.unterschrieben ?? true;
  // 14-Tage-Rhythmus: Nächte bei der Person in zwei zusammenhängenden Blöcken.
  const n = Math.round((14 * anteil) / 100);
  const a = Math.ceil(n / 2);
  const bb = n - a;
  const beiPerson = (woche: number, t: number) => (woche === 0 ? t < a : t >= 7 - bb);
  const zeilen = WOCHENTAGE.map((tag, t) => `<tr><td>${tag}</td>${[0, 1].map((wo) => `<td>${beiPerson(wo, t) ? esc(nm(p)) : esc(nm(anderer))}</td>`).join('')}</tr>`).join('');
  const ort = fall.wohnung.ort;
  const datumV = tagePlus(ab, -12);

  const html = htmlDoc(`
  <div class="seite mv">
    <h1 style="font-size:15pt">Vereinbarung über die Betreuung unseres Kindes</h1>
    <p style="text-align:center;margin-bottom:6mm">(Wechselmodell)</p>
    <p>Wir, die getrennt lebenden Eltern</p>
    <p style="margin-left:10mm"><b>${esc(nm(p))}</b>, geb. ${datum(p.geburtsdatum)}, ${esc(anschrift(fall))}, und<br>
    <b>${esc(nm(anderer))}</b>, ${esc(anderer.anschrift)},</p>
    <p>vereinbaren für unser gemeinsames Kind <b>${esc(nm(kind))}</b>, geb. ${datum(kind.geburtsdatum)}, mit Wirkung ab dem
    <b>${datum(ab)}</b> Folgendes:</p>
    <p>1. Die elterliche Sorge üben wir weiterhin gemeinsam aus. ${esc(kind.vorname)} lebt abwechselnd in beiden Haushalten.
    Der Betreuungsanteil von ${esc(nm(p))} beträgt <b>${anteil} %</b>, der von ${esc(nm(anderer))} ${100 - anteil} %.</p>
    <p>2. Die Betreuung erfolgt in einem zweiwöchigen Rhythmus nach folgendem Plan (Übernachtung):</p>
    <table style="width:150mm;margin:0 0 3mm 5mm;font-size:9.5pt;font-family:Arial" class="wp">
      <tr><th>Tag</th><th>Woche A</th><th>Woche B</th></tr>${zeilen}
    </table>
    <p>3. Die Übergabe erfolgt jeweils nach Schul- bzw. Kitaschluss. Ferien und Feiertage teilen wir hälftig auf und stimmen sie
    bis zum 31. Januar eines Jahres ab.</p>
    <p>4. Das Kindergeld wird weiterhin an ${esc(nm((o.kindergeldBei ?? 'person') === 'person' ? p : anderer))} ausgezahlt. Kosten für Kleidung, Schulbedarf und Freizeit tragen wir
    im Verhältnis unserer Betreuungsanteile.</p>
    <p>5. Änderungen dieser Vereinbarung treffen wir einvernehmlich und schriftlich.</p>
    <p style="margin-top:6mm">${esc(ort)}, den ${datum(datumV)}</p>
    <div class="sig" style="margin-top:4mm">
      <div><div class="feld">${unterschrieben ? unterschriftSvg(nm(p), 46) : ''}</div><div class="linie">${esc(nm(p))}</div></div>
      <div><div class="feld">${unterschrieben ? unterschriftSvg(nm(anderer), 46) : ''}</div><div class="linie">${esc(nm(anderer))}</div></div>
    </div>
  </div>`, `${VERTRAG_CSS}
    .wp th, .wp td { border: 0.2mm solid #666; padding: 1mm 2mm; text-align: left; } .wp th { background: #eee; }`);

  return {
    art: 'betreuungsvereinbarung', typ: 'sonstiges', titel: 'Betreuungsvereinbarung (Wechselmodell)', person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: identitaet(p) },
  };
}

// ── Abfindungsvereinbarung ──────────────────────────────────────────────────

export interface AbfindungsvereinbarungOptionen {
  /** Abfindung brutto in EUR (Default 18.000). */
  betrag: number;
  /** Beendigung des Arbeitsverhältnisses ISO (Default: Monatsletzter, 3 Monate nach Antragsdatum). */
  beendigung: string;
  /** Auszahlung ISO (Default: mit der Abrechnung des Beendigungsmonats, 15 Tage nach Beendigung). */
  auszahlung: string;
  /** Datum der Vereinbarung ISO (Default: 5 Wochen vor Antragsdatum). */
  vom: string;
  /** Arbeitgeber, falls die Person keine `beschaeftigung` hat (Default: erfundener Betrieb). */
  arbeitgeber: string;
  arbeitgeberAnschrift: string;
  /** Unterschriften vorhanden (Default true). */
  unterschrieben: boolean;
}

async function erzeugeAbfindungsvereinbarung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:abfindungsvereinbarung`);
  const o = opt<AbfindungsvereinbarungOptionen>(spec);
  const p = personVon(fall, spec);
  const ag = o.arbeitgeber ?? p.beschaeftigung?.arbeitgeber ?? 'Kerner Metallbau GmbH';
  const agAdr = o.arbeitgeberAnschrift ?? p.beschaeftigung?.arbeitgeberAnschrift ?? `Industriestraße 12, ${fall.wohnung.plz} ${fall.wohnung.ort}`;
  const eintritt = p.beschaeftigung?.eintritt ?? '2014-04-01';
  const pnr = p.beschaeftigung?.personalnummer ?? String(ganz(r, 10000, 99999));
  const betrag = o.betrag ?? 18000;
  const beendigung = o.beendigung ?? monatsLetzter(fall.antragsdatum, 3);
  const auszahlung = o.auszahlung ?? tagePlus(beendigung, 15);
  const vom = o.vom ?? tagePlus(fall.antragsdatum, -35);
  const unterschrieben = o.unterschrieben ?? true;
  const gf = `${wahl(r, VORNAMEN_M)} ${wahl(r, NACHNAMEN)}`;
  const agOrt = agAdr.replace(/^.*\d{5}\s*/, '');
  const fuss = (n: number) => `<div class="fuss"><span>Aufhebungsvertrag · ${esc(ag)} / ${esc(nm(p))} · Pers.-Nr. ${esc(pnr)}</span><span>Seite ${n} von 2</span></div>`;

  const s1 = `
  <div class="seite mv">
    <h1>AUFHEBUNGSVERTRAG</h1>
    <p style="text-align:center;margin-bottom:6mm">mit Abfindungsvereinbarung</p>
    <p>Zwischen</p>
    <p style="margin-left:10mm"><b>${esc(ag)}</b>, ${esc(agAdr)},<br>vertreten durch den Geschäftsführer ${esc(gf)}<br>— nachstehend „Arbeitgeber" genannt —</p>
    <p>und</p>
    <p style="margin-left:10mm"><b>${esc(nm(p))}</b>, geb. ${datum(p.geburtsdatum)}, ${esc(anschrift(fall))}<br>— nachstehend „Arbeitnehmer" genannt —</p>
    <p>wird Folgendes vereinbart:</p>
    <h2>§ 1 Beendigung des Arbeitsverhältnisses</h2>
    <p>Die Parteien sind sich einig, dass das seit dem ${datum(eintritt)} bestehende Arbeitsverhältnis auf Veranlassung des
    Arbeitgebers aus betriebsbedingten Gründen im gegenseitigen Einvernehmen mit Ablauf des <b>${datum(beendigung)}</b> endet.
    Die ordentliche Kündigungsfrist wird eingehalten.</p>
    <h2>§ 2 Vergütung bis zur Beendigung</h2>
    <p>Bis zum Beendigungszeitpunkt wird das Arbeitsverhältnis ordnungsgemäß abgerechnet. Der Arbeitnehmer erhält die vertragsgemäße
    Vergütung einschließlich anteiliger Sonderzahlungen.</p>
    <h2>§ 3 Abfindung</h2>
    <p>(1) Für den Verlust des Arbeitsplatzes zahlt der Arbeitgeber dem Arbeitnehmer eine Abfindung entsprechend §§ 9, 10 KSchG in
    Höhe von <b>${eur(betrag)} EUR brutto</b>.</p>
    <p>(2) Die Abfindung ist mit Beendigung des Arbeitsverhältnisses entstanden und vererblich. Sie wird mit der Abrechnung für den
    letzten Monat am <b>${datum(auszahlung)}</b> auf das bekannte Gehaltskonto des Arbeitnehmers ausgezahlt.</p>
    <p>(3) Die Abfindung wird unter Anwendung der Fünftelregelung (§ 34 EStG) versteuert, soweit die Voraussetzungen vorliegen.
    Sozialversicherungsbeiträge fallen nicht an.</p>
    ${fuss(1)}
  </div>`;

  const sig = (name: string, rolle: string) => `
    <div><div class="feld">${unterschrieben ? unterschriftSvg(name, 46) : ''}</div><div class="linie">${esc(rolle)}</div></div>`;
  const s2 = `
  <div class="seite mv">
    <h2>§ 4 Freistellung und Urlaub</h2>
    <p>Der Arbeitnehmer wird ab dem ${datum(monatsErster(beendigung, 0))} unter Fortzahlung der Vergütung und Anrechnung
    seines Resturlaubs unwiderruflich von der Arbeitsleistung freigestellt.</p>
    <h2>§ 5 Zeugnis</h2>
    <p>Der Arbeitnehmer erhält ein wohlwollendes, qualifiziertes Arbeitszeugnis mit der Gesamtbewertung „gut".</p>
    <h2>§ 6 Rückgabe von Firmeneigentum</h2>
    <p>Der Arbeitnehmer gibt sämtliche ihm überlassenen Gegenstände, insbesondere Schlüssel, Werksausweis und Arbeitskleidung,
    spätestens am letzten Arbeitstag zurück.</p>
    <h2>§ 7 Hinweise</h2>
    <p>Der Arbeitnehmer wurde darauf hingewiesen, dass er sich spätestens drei Monate vor Beendigung des Arbeitsverhältnisses
    bei der Agentur für Arbeit arbeitsuchend melden muss (§ 38 SGB III) und dass der Abschluss dieses Vertrags zu einer Sperrzeit
    beim Arbeitslosengeld führen kann. Über steuer- und sozialrechtliche Folgen hat er sich selbst informiert.</p>
    <h2>§ 8 Erledigung</h2>
    <p>Mit Erfüllung dieses Vertrags sind alle gegenseitigen Ansprüche aus dem Arbeitsverhältnis und seiner Beendigung erledigt,
    soweit gesetzlich zulässig.</p>
    <h2>§ 9 Schlussbestimmungen</h2>
    <p>Änderungen bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.</p>
    <p style="margin-top:10mm">${esc(agOrt)}, den ${datum(vom)}</p>
    <div class="sig">${sig(gf, `Für den Arbeitgeber: ${gf}, Geschäftsführer`)}${sig(nm(p), `Arbeitnehmer: ${nm(p)}`)}</div>
    ${fuss(2)}
  </div>`;

  return {
    art: 'abfindungsvereinbarung', typ: 'sonstiges', titel: 'Aufhebungsvertrag mit Abfindungsvereinbarung', person: p.id,
    pdf: await htmlZuPdf(htmlDoc(s1 + s2, VERTRAG_CSS)),
    erwartet: { identitaet: identitaet(p), analyse: { betrag } },
  };
}

// ── Betreuerausweis ─────────────────────────────────────────────────────────

export interface BetreuerausweisOptionen {
  /** Betreuer (Default: erfundener Berufsbetreuer; anschrift erfunden). */
  betreuer: Name & { anschrift?: string; beruflich?: boolean };
  /** Amtsgericht (Default „Amtsgericht <Ort der Wohnung>"). */
  amtsgericht: string;
  /** Aufgabenkreise (Default: Vermögenssorge, Behördenangelegenheiten, Wohnungsangelegenheiten). */
  aufgabenkreise: string[];
  /** Bestellung (Beschluss) ISO (Default: 14 Monate vor Antragsdatum). */
  bestelltAm: string;
  /** Aktenzeichen (Default erfunden „XVII 000/JJ"). */
  aktenzeichen: string;
}

async function erzeugeBetreuerausweis(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:betreuerausweis`);
  const o = opt<BetreuerausweisOptionen>(spec);
  const b = personVon(fall, spec);
  const w = fall.wohnung;
  const bt = o.betreuer ?? { vorname: wahl(r, VORNAMEN_M), nachname: wahl(r, NACHNAMEN) };
  const btAdr = bt.anschrift ?? `${wahl(r, ['Bahnhofstraße', 'Schillerplatz', 'Große Bleiche', 'Am Markt'])} ${ganz(r, 2, 60)}, ${w.plz} ${w.ort}`;
  const beruflich = bt.beruflich ?? true;
  const gericht = o.amtsgericht ?? `Amtsgericht ${w.ort}`;
  const kreise = o.aufgabenkreise ?? ['Vermögenssorge', 'Vertretung gegenüber Behörden, Versicherungen, Renten- und Sozialleistungsträgern', 'Wohnungsangelegenheiten einschließlich Heimangelegenheiten'];
  const bestellt = o.bestelltAm ?? tagePlus(fall.antragsdatum, -425);
  const az = o.aktenzeichen ?? `XVII ${ganz(r, 100, 999)}/${bestellt.slice(2, 4)}`;
  const ueberpruefung = `${Number(bestellt.slice(0, 4)) + 7}${bestellt.slice(4)}`;
  const rpfl = `${wahl(r, VORNAMEN_W)} ${wahl(r, NACHNAMEN)}`;
  const ausgestellt = tagePlus(bestellt, 9);

  const html = htmlDoc(`
  <div class="seite">
    <div style="border:0.5mm solid #222;padding:10mm 12mm;height:250mm;position:relative">
      <div style="display:flex;justify-content:space-between;font-size:9pt">
        <div><b style="font-size:12pt">${esc(gericht)}</b><br>– Betreuungsgericht –</div>
        <div class="r">Geschäftsnummer: <b>${esc(az)}</b><br>${esc(w.ort)}, ${datum(ausgestellt)}</div>
      </div>
      <h1 style="text-align:center;font-size:22pt;letter-spacing:1mm;margin:14mm 0 1mm">BETREUERAUSWEIS</h1>
      <p style="text-align:center;margin:0 0 10mm;font-size:9pt">Urkunde über die Bestellung zum Betreuer (§ 290 FamFG)</p>
      <table style="font-size:10.5pt;line-height:1.5" class="ba">
        <tr><td>Betreuer${beruflich ? ' (beruflich)' : ''}</td><td><b>${esc(nm(bt))}</b><br>${esc(btAdr)}</td></tr>
        <tr><td>ist bestellt für</td><td><b>${esc(nm(b))}</b>, geb. ${datum(b.geburtsdatum)} in ${esc(b.geburtsort)}<br>wohnhaft ${esc(anschrift(fall))}</td></tr>
        <tr><td>durch Beschluss vom</td><td>${datum(bestellt)}</td></tr>
        <tr><td>Aufgabenkreise</td><td><ul style="margin:0;padding-left:5mm">${kreise.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></td></tr>
        <tr><td>Einwilligungsvorbehalt</td><td>nicht angeordnet</td></tr>
        <tr><td>Überprüfung spätestens</td><td>${datum(ueberpruefung)}</td></tr>
      </table>
      <p style="margin-top:8mm;font-size:9.5pt;line-height:1.45;text-align:justify">Der Betreuer vertritt die betreute Person in den
      genannten Aufgabenkreisen gerichtlich und außergerichtlich (§ 1823 BGB). Dieser Ausweis ist kein Nachweis über den Fortbestand
      der Betreuung. Er ist nach Beendigung des Amtes unverzüglich an das Betreuungsgericht zurückzugeben.</p>
      <div style="position:absolute;bottom:16mm;left:12mm;right:12mm;display:flex;justify-content:space-between;align-items:flex-end">
        <div>${siegel(gericht.toUpperCase(), 30)}</div>
        <div style="width:75mm"><div style="height:16mm;display:flex;align-items:flex-end">${unterschriftSvg(rpfl, 42)}</div>
        <div style="border-top:0.3mm solid #222;padding-top:1mm;font-size:9pt">${esc(rpfl)}, Rechtspflegerin</div></div>
      </div>
    </div>
  </div>`, `.ba td { padding: 1.5mm 0; } .ba td:first-child { width: 48mm; color: #444; }`);

  return {
    art: 'betreuerausweis', typ: 'sonstiges', titel: 'Betreuerausweis', person: b.id,
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: identitaet(b) },
  };
}

// ── Sterbeurkunde ───────────────────────────────────────────────────────────

export interface SterbeurkundeOptionen {
  /** Verstorbene Person (Default: Ehegatte der Person, Sterbedatum ca. 5 Monate vor Antrag, Sterbeort = Wohnort). */
  verstorben: NameGeb & { sterbedatum: string; sterbeort: string; geburtsort?: string; geburtsname?: string };
  /** Standesamt (Default „Standesamt <Ort>"). */
  standesamt: string;
  /** Registernummer (Default erfunden „S 000/JJJJ"). */
  registernummer: string;
  /** Ausstellungsdatum ISO (Default: 6 Tage nach Sterbedatum). */
  ausgestellt: string;
}

async function erzeugeSterbeurkunde(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:sterbeurkunde`);
  const o = opt<SterbeurkundeOptionen>(spec);
  const p = personVon(fall, spec);
  const w = fall.wohnung;
  const vs = o.verstorben ?? {
    vorname: p.geschlecht === 'weiblich' ? wahl(r, VORNAMEN_M) : wahl(r, VORNAMEN_W),
    nachname: p.nachname,
    geburtsdatum: tagePlus(p.geburtsdatum, -ganz(r, 200, 900)),
    sterbedatum: tagePlus(monatsErster(fall.antragsdatum, -5), ganz(r, 3, 25)),
    sterbeort: w.ort,
  };
  const geburtsort = vs.geburtsort ?? wahl(r, ['Worms', 'Alzey', 'Darmstadt', 'Kassel', 'Koblenz']);
  const amt = o.standesamt ?? `Standesamt ${w.ort}`;
  const regnr = o.registernummer ?? `S ${ganz(r, 100, 1999)}/${vs.sterbedatum.slice(0, 4)}`;
  const ausgestellt = o.ausgestellt ?? tagePlus(vs.sterbedatum, 6);
  const uhr = `${String(ganz(r, 0, 23)).padStart(2, '0')}:${String(ganz(r, 0, 59)).padStart(2, '0')}`;
  const beamter = `${wahl(r, VORNAMEN_W)} ${wahl(r, NACHNAMEN)}`;
  const zeile = (k: string, v: string) => `<tr><td>${k}</td><td>${v}</td></tr>`;

  const html = htmlDoc(`
  <div class="seite">
    <div style="border:0.4mm solid #7a6a3a;outline:0.2mm solid #7a6a3a;outline-offset:1.2mm;padding:12mm 14mm;height:255mm;position:relative;background:#fbf8ef">
      <div style="display:flex;justify-content:space-between;font-size:9pt">
        <div><b>${esc(amt)}</b></div><div>Registernummer <b>${esc(regnr)}</b></div>
      </div>
      <h1 style="text-align:center;font-size:24pt;letter-spacing:1.5mm;margin:14mm 0 12mm;font-family:'Times New Roman',serif">Sterbeurkunde</h1>
      <table class="su">
        ${zeile('Familienname', `<b>${esc(vs.nachname)}</b>`)}
        ${vs.geburtsname ? zeile('Geburtsname', esc(vs.geburtsname)) : ''}
        ${zeile('Vornamen', `<b>${esc(vs.vorname)}</b>`)}
        ${zeile('Geburtstag', datum(vs.geburtsdatum))}
        ${zeile('Geburtsort', esc(geburtsort))}
        ${zeile('Letzter Wohnsitz', esc(anschrift(fall)))}
        ${zeile('Familienstand', 'verheiratet')}
        ${zeile('Ehegatte', `${esc(nm(p))}${p.geburtsname ? `, geb. ${esc(p.geburtsname)}` : ''}`)}
        <tr><td colspan="2" style="height:6mm"></td></tr>
        ${zeile('Sterbetag', `<b>${datum(vs.sterbedatum)}</b> um ${uhr} Uhr`)}
        ${zeile('Sterbeort', esc(vs.sterbeort))}
      </table>
      <p style="margin-top:10mm;font-size:9pt">Anmerkungen: keine</p>
      <div style="position:absolute;bottom:22mm;left:14mm;right:14mm;display:flex;justify-content:space-between;align-items:flex-end">
        <div>${siegel(amt.toUpperCase(), 30)}</div>
        <div style="width:80mm;font-size:10pt">${esc(w.ort)}, ${datum(ausgestellt)}<br>Die Standesbeamtin
          <div style="height:15mm;display:flex;align-items:flex-end">${unterschriftSvg(beamter, 42)}</div>
          <div style="border-top:0.3mm solid #222;padding-top:1mm;font-size:9pt">${esc(beamter)}</div></div>
      </div>
    </div>
  </div>`, `.su { font-size: 11pt; } .su td { padding: 2mm 0; border-bottom: 0.2mm dotted #999; } .su td:first-child { width: 50mm; color: #555; font-size: 9.5pt; }`);

  return {
    art: 'sterbeurkunde', typ: 'sonstiges', titel: `Sterbeurkunde ${nm(vs)}`, person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: identitaet(p) },
  };
}

// ── Zuwendungserklärung Dritter ─────────────────────────────────────────────

export interface ZuwendungserklaerungOptionen {
  /** Zuwendende Person (Default: erfundene Großmutter). */
  von: Name & { anschrift: string };
  /** Verhältnis zur Familie (Default „Großmutter"). */
  verhaeltnis: string;
  /** Monatlicher Betrag in EUR (Default 150). */
  betrag: number;
  /** Seit ISO (Default: Erster, 8 Monate vor Antragsdatum). */
  seit: string;
  /** Befristet bis ISO (Default: unbefristet). */
  bis?: string;
  /** Zahlungsweise (Default 'dauerauftrag'). */
  zahlungsweise: 'dauerauftrag' | 'bar';
  /** Datum der Erklärung ISO (Default: 7 Tage vor Antragsdatum). */
  datum: string;
}

async function erzeugeZuwendungserklaerung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:zuwendungserklaerung`);
  const o = opt<ZuwendungserklaerungOptionen>(spec);
  const p = personVon(fall, spec);
  const von = o.von ?? { vorname: wahl(r, VORNAMEN_W), nachname: wahl(r, NACHNAMEN), anschrift: `${wahl(r, ['Birkenweg', 'Rosenstraße', 'Talstraße'])} ${ganz(r, 1, 30)}, 55${ganz(r, 200, 599)} ${wahl(r, ['Nieder-Olm', 'Ingelheim', 'Nackenheim'])}` };
  const verh = o.verhaeltnis ?? 'Großmutter';
  const betrag = o.betrag ?? 150;
  const seit = o.seit ?? monatsErster(fall.antragsdatum, -8);
  const dat = o.datum ?? tagePlus(fall.antragsdatum, -7);
  const weise = o.zahlungsweise ?? 'dauerauftrag';
  const [strasse, plzOrt] = von.anschrift.split(/,\s*/);
  const behoerde = fall.behoerde.split('\n');

  const html = htmlDoc(brief({
    kopf: `<div style="font-family:Georgia,serif;font-size:12pt">${esc(nm(von))}</div><div class="klein r">${esc(strasse)}<br>${esc(plzOrt)}</div>`,
    ruecksendezeile: `${nm(von)}, ${von.anschrift}`,
    empfaenger: behoerde,
    info: [['Betrifft', `Wohngeldantrag ${nm(p)}`], ['Datum', datum(dat)]],
    betreff: 'Erklärung über regelmäßige finanzielle Unterstützung',
    inhalt: `
      <div style="font-family:Georgia,serif;font-size:10.5pt">
      <p>Sehr geehrte Damen und Herren,</p>
      <p>hiermit erkläre ich, ${esc(nm(von))}, dass ich meine Familie — ${esc(nm(p))} und alle Angehörigen im Haushalt,
      wohnhaft ${esc(anschrift(fall))} — seit dem <b>${datum(seit)}</b> ${o.bis ? `bis zum <b>${datum(o.bis)}</b>` : 'bis auf Weiteres'}
      mit einem monatlichen Betrag von <b>${eur(betrag)} EUR</b> unterstütze.</p>
      <p>${weise === 'dauerauftrag'
        ? `Der Betrag wird per Dauerauftrag jeweils zum Monatsanfang auf das Konto von ${esc(nm(p))} (IBAN ${esc(ibanFormat(fall.bank.iban))}) überwiesen.`
        : `Den Betrag übergebe ich jeweils zu Monatsbeginn in bar.`}
      Es handelt sich um eine freiwillige Zuwendung als ${esc(verh)}; eine Rückzahlung ist nicht vereinbart, ein Rechtsanspruch
      besteht nicht.</p>
      <p>Für Rückfragen bin ich unter der oben genannten Anschrift erreichbar.</p>
      <p>Mit freundlichen Grüßen</p>
      <div style="height:15mm">${unterschriftSvg(nm(von), 44)}</div>
      <p>${esc(nm(von))}</p>
      </div>`,
  }), BRIEF_CSS);

  return {
    art: 'zuwendungserklaerung', typ: 'sonstiges', titel: `Zuwendungserklärung ${nm(von)}`, person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: identitaet(p), analyse: { betrag } },
  };
}

// ── Unterhaltszahlung ───────────────────────────────────────────────────────

export interface UnterhaltszahlungOptionen {
  /** 'zahlungen' = Bankbestätigung über 3 Überweisungen (Default), 'titel' = Jugendamtsurkunde. */
  variante: 'zahlungen' | 'titel';
  /** Unterhaltsberechtigtes Kind (Default: erfunden, Nachname der Person). */
  fuer: NameGeb;
  /** Monatlicher Unterhalt in EUR (Default 356). */
  betrag: number;
  /** Empfänger/gesetzlicher Vertreter des Kindes (Default: erfundener anderer Elternteil). */
  empfaenger: Name;
  /** Titel: Beurkundungsdatum ISO (Default: 20 Monate vor Antragsdatum). */
  beurkundetAm: string;
  /** Titel: Unterhalt ab ISO (Default: Erster des Folgemonats der Beurkundung). */
  ab: string;
  /** Zahlungen: letzter bezahlter Monat „JJJJ-MM" (Default: Vormonat des Antrags). */
  bisMonat: string;
}

async function erzeugeUnterhaltszahlung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:unterhaltszahlung`);
  const o = opt<UnterhaltszahlungOptionen>(spec);
  const p = personVon(fall, spec);
  const w = fall.wohnung;
  const variante = o.variante ?? 'zahlungen';
  const kind: NameGeb = o.fuer ?? { vorname: wahl(r, ['Ben', 'Lena', 'Noah', 'Emma']), nachname: p.nachname, geburtsdatum: '2016-09-05' };
  const betrag = o.betrag ?? 356;
  const empf: Name = o.empfaenger ?? { vorname: p.geschlecht === 'weiblich' ? wahl(r, VORNAMEN_M) : wahl(r, VORNAMEN_W), nachname: wahl(r, NACHNAMEN) };
  const empfIban = iban(String(ganz(r, 10000000, 79999999)), String(ganz(r, 100000000, 999999999)));

  let html: string;
  if (variante === 'titel') {
    const beurk = o.beurkundetAm ?? tagePlus(fall.antragsdatum, -600);
    const ab = o.ab ?? monatsErster(beurk, 1);
    const urnr = `${ganz(r, 40, 480)}/${beurk.slice(0, 4)}`;
    const up = `${wahl(r, VORNAMEN_W)} ${wahl(r, NACHNAMEN)}`;
    html = htmlDoc(`
    <div class="seite mv">
      <div style="display:flex;justify-content:space-between;font-family:Arial;font-size:9pt;border-bottom:0.4mm solid #333;padding-bottom:2mm">
        <div><b style="font-size:11pt">Stadt ${esc(w.ort)}</b><br>Jugendamt – Beistandschaften, Beurkundungen</div>
        <div class="r">Urkundenregister-Nr. <b>${esc(urnr)}</b><br>Ausfertigung</div>
      </div>
      <h1 style="font-size:15pt;margin-top:10mm">Urkunde<br><span style="font-size:12pt;font-weight:normal">über die Verpflichtung zur Zahlung von Unterhalt<br>(§ 59 Abs. 1 Satz 1 Nr. 3 SGB VIII)</span></h1>
      <p style="margin-top:8mm">Verhandelt am ${datum(beurk)} in ${esc(w.ort)} vor der unterzeichnenden Urkundsperson des Jugendamts der Stadt ${esc(w.ort)}.</p>
      <p>Es erschien, ausgewiesen durch gültigen Personalausweis:</p>
      <p style="margin-left:10mm"><b>${esc(nm(p))}</b>, geb. ${datum(p.geburtsdatum)} in ${esc(p.geburtsort)},<br>wohnhaft ${esc(anschrift(fall))}.</p>
      <p>Der/Die Erschienene erklärte:</p>
      <p>1. Ich erkenne an, dass ich meinem Kind <b>${esc(nm(kind))}</b>, geb. ${datum(kind.geburtsdatum)}, zum Unterhalt verpflichtet bin.</p>
      <p>2. Ich verpflichte mich, ab dem <b>${datum(ab)}</b> einen monatlichen Unterhalt in Höhe von <b>${eur(betrag)} EUR</b>
      zu zahlen, fällig monatlich im Voraus bis zum 3. eines jeden Monats, zu Händen des gesetzlichen Vertreters
      ${esc(nm(empf))} auf das Konto IBAN ${esc(ibanFormat(empfIban))}.</p>
      <p>3. Wegen dieser Verpflichtung unterwerfe ich mich der sofortigen Zwangsvollstreckung aus dieser Urkunde.</p>
      <p>4. Das Kindergeld ist bei der Bemessung berücksichtigt.</p>
      <p>Vorgelesen, genehmigt und unterschrieben.</p>
      <div class="sig">
        <div><div class="feld">${unterschriftSvg(nm(p), 46)}</div><div class="linie">${esc(nm(p))}</div></div>
        <div><div class="feld">${unterschriftSvg(up, 44)}</div><div class="linie">${esc(up)}, Urkundsperson</div></div>
      </div>
      <div style="margin-top:8mm;display:flex;gap:8mm;align-items:center;font-size:9pt">
        ${siegel(`STADT ${w.ort.toUpperCase()} JUGENDAMT`, 26)}
        <div>Vorstehende Ausfertigung stimmt mit der Urschrift überein und wird dem gesetzlichen Vertreter des Kindes zum Zwecke
        der Zwangsvollstreckung erteilt.<br>${esc(w.ort)}, ${datum(tagePlus(beurk, 3))}</div>
      </div>
    </div>`, VERTRAG_CSS);
  } else {
    const bis = o.bisMonat ?? monatsErster(fall.antragsdatum, -1).slice(0, 7);
    const monate = [-2, -1, 0].map((d) => monatsErster(`${bis}-01`, d));
    const zahlungen = monate.map((m) => ({ datum: tagePlus(m, ganz(r, 0, 2)), monat: m.slice(0, 7) }));
    const ref = String(ganz(r, 1000000, 9999999));
    html = htmlDoc(brief({
      farbe: '#c00000',
      kopf: `<div style="font-weight:bold;font-size:13pt;color:#c00000">${esc(fall.bank.name)}</div><div class="klein r">Kundenservice-Center<br>BIC ${esc(fall.bank.bic)}</div>`,
      ruecksendezeile: `${fall.bank.name}, Postfach, ${w.plz} ${w.ort}`,
      empfaenger: [nm(p), `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`],
      info: [['Konto (IBAN)', ibanFormat(fall.bank.iban)], ['Unser Zeichen', `ZB-${ref}`], ['Datum', datum(tagePlus(`${bis}-01`, 40))]],
      betreff: 'Bestätigung über ausgeführte Überweisungen (Dauerauftrag)',
      fuss: `<span>${esc(fall.bank.name)} · Anstalt des öffentlichen Rechts</span><span>Seite 1 von 1</span>`,
      inhalt: `
        <p>Sehr geehrte Kundin, sehr geehrter Kunde,</p>
        <p>auf Ihren Wunsch bestätigen wir, dass aus Ihrem oben genannten Konto folgende Überweisungen ausgeführt wurden:</p>
        <table class="tab" style="margin:3mm 0 4mm">
          <tr><th>Ausführung</th><th>Empfänger</th><th>Verwendungszweck</th><th class="r">Betrag EUR</th></tr>
          ${zahlungen.map((z) => `<tr><td>${datum(z.datum)}</td><td>${esc(nm(empf))}<br><span class="klein">${esc(ibanFormat(empfIban))}</span></td><td>Unterhalt ${esc(kind.vorname)} ${esc(monatName(z.monat))}</td><td class="r">${eur(betrag)}</td></tr>`).join('')}
          <tr class="summe"><td colspan="3">Summe</td><td class="r">${eur(betrag * 3)}</td></tr>
        </table>
        <p>Die Überweisungen beruhen auf dem Dauerauftrag Nr. ${ref.slice(0, 4)} über monatlich ${eur(betrag)} EUR zugunsten
        ${esc(nm(empf))} (Unterhalt für ${esc(nm(kind))}, geb. ${datum(kind.geburtsdatum)}), ausführend jeweils zum Monatsanfang.</p>
        <p>Diese Bestätigung wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>
        <p>Mit freundlichen Grüßen<br>Ihre ${esc(fall.bank.name)}</p>`,
    }), BRIEF_CSS);
  }

  return {
    art: 'unterhaltszahlung', typ: 'unterhaltsnachweis',
    titel: variante === 'titel' ? 'Unterhaltstitel (Jugendamtsurkunde)' : 'Nachweis Unterhaltszahlungen (Bankbestätigung)',
    person: p.id,
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: identitaet(p), analyse: { betrag } },
  };
}

// ── Registrierung ───────────────────────────────────────────────────────────

export const GENERATOREN_URKUNDEN: Partial<Record<DokArt, Generator>> = {
  untermietvertrag: erzeugeUntermietvertrag,
  heimvertrag: erzeugeHeimvertrag,
  betreuungsvereinbarung: erzeugeBetreuungsvereinbarung,
  abfindungsvereinbarung: erzeugeAbfindungsvereinbarung,
  betreuerausweis: erzeugeBetreuerausweis,
  sterbeurkunde: erzeugeSterbeurkunde,
  zuwendungserklaerung: erzeugeZuwendungserklaerung,
  unterhaltszahlung: erzeugeUnterhaltszahlung,
};
