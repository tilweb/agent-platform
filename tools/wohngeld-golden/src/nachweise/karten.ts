/**
 * Kopien von Karten-Nachweisen (Vorder- und Rückseite auf einer A4-Seite, wie vom
 * Kopierer): elektronischer Aufenthaltstitel, Schwerbehindertenausweis,
 * elektronische Gesundheitskarte mit EHIC-Rückseite. Bewusst vereinfachte
 * Kartenlayouts ohne echte Sicherheitsmerkmale (Muster: personalausweis.ts).
 */
import { datum, esc, ganz, htmlDoc, htmlZuPdf, rng, wahl, type Rng } from '../lib';
import type { DokArt, DokSpec, ErzeugtesDokument, Fall, Generator, Person } from '../types';

// ── gemeinsame Bausteine ────────────────────────────────────────────────────

const CSS = `
  .karte { width: 111mm; height: 70mm; border-radius: 4mm; border: 0.3mm solid #777; position: relative; overflow: hidden;
           font-size: 7.5pt; color: #222; }
  .karte .band { position: absolute; top: 0; left: 0; right: 0; height: 8mm; background: rgba(0,0,0,0.06); font-weight: bold; font-size: 8pt; padding: 2mm 4mm; letter-spacing: 0.3mm; white-space: nowrap; }
  .karte .lbl { font-size: 5.5pt; color: #555; }
  .karte .val { font-size: 9pt; font-weight: bold; margin-bottom: 1.2mm; font-family: 'Courier New', monospace; }
  .karte .zeile { display: flex; gap: 6mm; }
  .foto { position: absolute; left: 4mm; top: 12mm; width: 28mm; height: 36mm; background: #cfd6d8; border-radius: 1mm; overflow: hidden; }
  .felder { position: absolute; left: 36mm; top: 11mm; right: 4mm; }
  .mrz { position: absolute; left: 4mm; right: 4mm; bottom: 3mm; font-family: 'Courier New', monospace; font-size: 8.4pt; letter-spacing: 0.35mm; line-height: 1.25; white-space: nowrap; }
`;

const SILHOUETTE = `<svg viewBox="0 0 28 36" style="position:absolute;inset:0;width:100%;height:100%"><circle cx="14" cy="13" r="6.5" fill="#9aa5a8"/><path d="M2 36 C3 25 9 22 14 22 C19 22 25 25 26 36 Z" fill="#9aa5a8"/></svg>`;

function personAus(fall: Fall, spec: DokSpec): Person {
  const id = spec.person ?? 'P1';
  const p = fall.personen.find((x) => x.id === id);
  if (!p) throw new Error(`${fall.id}: Person ${id} unbekannt`);
  return p;
}

function opt<T>(spec: DokSpec): Partial<T> {
  return (spec.optionen ?? {}) as Partial<T>;
}

/** ISO-Datum um Jahre/Tage verschieben. */
function isoPlus(iso: string, jahre: number, tage = 0): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y! + jahre, m! - 1, d! + tage));
  return dt.toISOString().slice(0, 10);
}

/** Zufallsdatum innerhalb [von, von + spanneTage]. */
function isoZufall(r: Rng, von: string, spanneTage: number): string {
  return isoPlus(von, 0, ganz(r, 0, spanneTage));
}

const ziffern = (r: Rng, n: number) => Array.from({ length: n }, () => String(ganz(r, 0, 9))).join('');
const ALNUM = 'CFGHJKLMNPRTVWXYZ0123456789';
const alnum = (r: Rng, n: number) => Array.from({ length: n }, () => wahl(r, ALNUM.split(''))).join('');

/** MRZ-taugliche Schreibweise (Umlaute ausgeschrieben, Diakritika wie Ç/Ş/Ğ/İ entfernt). */
function mrzName(s: string): string {
  return s.toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '<');
}
const mrzDatum = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
const lt = (n: number) => '&lt;'.repeat(Math.max(0, n));

/** Staatsangehörigkeit → Länderkennung (ICAO), soweit bekannt. */
const LAENDER: Record<string, string> = {
  deutsch: 'D', türkisch: 'TUR', syrisch: 'SYR', afghanisch: 'AFG', irakisch: 'IRQ', ukrainisch: 'UKR',
  russisch: 'RUS', polnisch: 'POL', rumänisch: 'ROU', italienisch: 'ITA', griechisch: 'GRC', kroatisch: 'HRV',
  serbisch: 'SRB', kosovarisch: 'RKS', bosnisch: 'BIH', iranisch: 'IRN', eritreisch: 'ERI', vietnamesisch: 'VNM',
};
const laenderCode = (s: string) => LAENDER[s.trim().toLowerCase()] ?? mrzName(s).replace(/</g, '').slice(0, 3);

const geschlechtKurz = (p: Person) => (p.geschlecht === 'maennlich' ? 'M' : p.geschlecht === 'weiblich' ? 'F' : 'X');

function seite(vorder: string, rueck: string): string {
  return htmlDoc(`<div class="seite" style="padding-top:30mm"><div style="display:flex;flex-direction:column;gap:22mm;align-items:center">${vorder}${rueck}</div></div>`, CSS);
}

const identitaet = (p: Person) => ({ identitaet: { nachname: p.nachname, vorname: p.vorname, geburtsdatum: p.geburtsdatum } });

// ── Aufenthaltstitel (eAT) ──────────────────────────────────────────────────

export interface AufenthaltstitelOptionen {
  /** Art des Titels. Default „Niederlassungserlaubnis". */
  titelArt?: string;
  /** Kartennummer (9-stellig, alphanumerisch). Default: reproduzierbar erzeugt. */
  kartennummer?: string;
  /** ISO. Default: ca. 1–4 Jahre vor Antragsdatum. */
  ausgestellt?: string;
  /** ISO. Default: ausgestellt + 5 Jahre (Niederlassungserlaubnis) bzw. + 2 Jahre (sonst). */
  gueltigBis?: string;
  /** Anmerkungen (Rückseite). Default ["Erwerbstätigkeit gestattet."]. */
  anmerkungen?: string[];
  /** Ausstellende Behörde. Default „Ausländerbehörde <Wohnort>". */
  behoerde?: string;
}

export async function erzeugeAufenthaltstitel(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personAus(fall, spec);
  const o = opt<AufenthaltstitelOptionen>(spec);
  const r = rng(`${fall.id}:aufenthaltstitel:${p.id}`);
  const w = fall.wohnung;
  const titelArt = o.titelArt ?? 'Niederlassungserlaubnis';
  const nummer = o.kartennummer ?? `Y${alnum(r, 8)}`;
  const ausgestellt = o.ausgestellt ?? isoZufall(r, isoPlus(fall.antragsdatum, -4), 3 * 365);
  const gueltigBis = o.gueltigBis ?? isoPlus(ausgestellt, /niederlassung|daueraufenthalt/i.test(titelArt) ? 5 : 2, -1);
  const anmerkungen = o.anmerkungen ?? ['Erwerbstätigkeit gestattet.'];
  const behoerde = o.behoerde ?? `Ausländerbehörde ${w.ort}`;
  const land = laenderCode(p.staatsangehoerigkeit);

  const vorder = `
    <div class="karte" style="background: linear-gradient(135deg, #eef0e6 0%, #dfe6d6 45%, #ece4dc 100%)">
      <div class="band">AUFENTHALTSTITEL &nbsp;·&nbsp; RESIDENCE PERMIT</div>
      <div class="foto">${SILHOUETTE}</div>
      <div class="felder">
        <div class="lbl">Name / Surname</div><div class="val">${esc(p.nachname.toUpperCase())}</div>
        <div class="lbl">Vornamen / Given names</div><div class="val">${esc(p.vorname.toUpperCase())}</div>
        <div class="lbl">Art des Titels / Type of permit</div><div class="val">${esc(titelArt.toUpperCase())}</div>
        <div class="zeile"><div><div class="lbl">Geschlecht / Sex</div><div class="val">${geschlechtKurz(p)}</div></div>
        <div><div class="lbl">Staatsangehörigkeit / Nationality</div><div class="val">${esc(p.staatsangehoerigkeit.toUpperCase())}</div></div></div>
        <div class="zeile"><div><div class="lbl">Geburtstag / Date of birth</div><div class="val">${datum(p.geburtsdatum)}</div></div>
        <div><div class="lbl">Gültig bis / Valid until</div><div class="val">${datum(gueltigBis)}</div></div></div>
      </div>
      <div style="position:absolute;right:4mm;top:1.8mm;font-family:'Courier New',monospace;font-size:9pt;font-weight:bold">${esc(nummer)}</div>
      <div class="klein" style="position:absolute;left:4mm;bottom:3mm;font-size:6pt">Bundesrepublik Deutschland</div>
    </div>`;
  const rueck = `
    <div class="karte" style="background: linear-gradient(135deg, #eef0e6 0%, #dfe6d6 45%, #ece4dc 100%)">
      <div class="felder" style="left:4mm;top:5mm">
        <div class="lbl">Anmerkungen / Remarks</div>
        <div class="val" style="font-size:8pt;line-height:1.25">${anmerkungen.map((a) => esc(a)).join('<br>')}</div>
        <div class="zeile"><div><div class="lbl">Geburtsort / Place of birth</div><div class="val">${esc(p.geburtsort.toUpperCase())}</div></div>
        <div><div class="lbl">Ausstellungsdatum / Date of issue</div><div class="val">${datum(ausgestellt)}</div></div></div>
        <div class="lbl">Anschrift / Address</div>
        <div class="val">${esc(w.plz)} ${esc(w.ort.toUpperCase())}, ${esc(w.strasse.toUpperCase())} ${esc(w.hausnummer)}</div>
        <div class="lbl">Behörde / Authority</div><div class="val">${esc(behoerde.toUpperCase())}</div>
      </div>
      <div class="mrz">AR${esc('D')}${lt(3)}${esc(nummer.toUpperCase().replace(/[^A-Z0-9]/g, "<"))}${lt(16)}<br>${mrzDatum(p.geburtsdatum)}${ganz(r, 0, 9)}${geschlechtKurz(p)}${mrzDatum(gueltigBis)}${ganz(r, 0, 9)}${esc(land.padEnd(3, '<').replace(/</g, '&lt;'))}${lt(11)}${ganz(r, 0, 9)}<br>${esc(mrzName(p.nachname))}${lt(2)}${esc(mrzName(p.vorname))}${lt(Math.max(1, 26 - p.nachname.length - p.vorname.length))}</div>
    </div>`;
  return {
    art: 'aufenthaltstitel', typ: 'personalausweis', titel: `Aufenthaltstitel ${p.vorname} ${p.nachname}`, person: p.id,
    pdf: await htmlZuPdf(seite(vorder, rueck)),
    erwartet: identitaet(p),
  };
}

// ── Schwerbehindertenausweis ────────────────────────────────────────────────

/** Merkzeichen, die zur unentgeltlichen Beförderung berechtigen (Ausweis grün-orange). */
const MERKZEICHEN_ORANGE = ['G', 'aG', 'H', 'Bl', 'Gl'];

export interface SchwerbehindertenausweisOptionen {
  /** Grad der Behinderung. Default 50. */
  gdb?: number;
  /** Merkzeichen, z. B. ["G", "B"]. Default []. */
  merkzeichen?: string[];
  /** Ausweisnummer/Aktenzeichen. Default: reproduzierbar erzeugt. */
  ausweisnummer?: string;
  /** ISO. Default: ca. 1–3 Jahre vor Antragsdatum. */
  ausgestellt?: string;
  /** ISO oder „unbefristet". Default: ausgestellt + 5 Jahre. */
  gueltigBis?: string;
  /** Ausstellende Behörde. Default „Versorgungsamt <Wohnort>". */
  behoerde?: string;
}

export async function erzeugeSchwerbehindertenausweis(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personAus(fall, spec);
  const o = opt<SchwerbehindertenausweisOptionen>(spec);
  const r = rng(`${fall.id}:schwerbehindertenausweis:${p.id}`);
  const gdb = o.gdb ?? 50;
  const merkzeichen = o.merkzeichen ?? [];
  const nummer = o.ausweisnummer ?? `${ziffern(r, 3)}/${ziffern(r, 2)}/${ziffern(r, 6)}`;
  const ausgestellt = o.ausgestellt ?? isoZufall(r, isoPlus(fall.antragsdatum, -3), 2 * 365);
  const gueltigBis = o.gueltigBis ?? isoPlus(ausgestellt, 5, -1);
  const gueltigText = /^\d{4}-\d{2}-\d{2}$/.test(gueltigBis) ? datum(gueltigBis) : gueltigBis.toUpperCase();
  const behoerde = o.behoerde ?? `Versorgungsamt ${fall.wohnung.ort}`;
  const orange = merkzeichen.some((m) => MERKZEICHEN_ORANGE.includes(m));
  const hg = orange
    ? 'linear-gradient(90deg, #cfe3c4 0%, #cfe3c4 50%, #f4c79a 50%, #f4c79a 100%)'
    : 'linear-gradient(135deg, #d6e9cc 0%, #c4dfb8 60%, #d9ead0 100%)';

  const vorder = `
    <div class="karte" style="background:${hg}">
      <div class="band">SCHWERBEHINDERTENAUSWEIS</div>
      <div class="foto">${SILHOUETTE}</div>
      <div class="felder">
        <div class="lbl">Name</div><div class="val">${esc(p.nachname.toUpperCase())}</div>
        <div class="lbl">Vorname</div><div class="val">${esc(p.vorname.toUpperCase())}</div>
        <div class="lbl">Geburtsdatum</div><div class="val">${datum(p.geburtsdatum)}</div>
        <div class="zeile"><div><div class="lbl">Ausweis-Nr.</div><div class="val">${esc(nummer)}</div></div></div>
        <div class="zeile"><div><div class="lbl">Gültig ab</div><div class="val">${datum(ausgestellt)}</div></div>
        <div><div class="lbl">Gültig bis</div><div class="val">${esc(gueltigText)}</div></div></div>
      </div>
      <div style="position:absolute;left:4mm;bottom:4mm;font-size:6pt;color:#333">Bundesrepublik Deutschland</div>
    </div>`;
  const rueck = `
    <div class="karte" style="background:${hg}">
      <div class="felder" style="left:5mm;top:5mm;right:5mm">
        <div class="zeile" style="gap:10mm">
          <div><div class="lbl">Grad der Behinderung (GdB)</div><div class="val" style="font-size:16pt">${gdb}</div></div>
          <div><div class="lbl">Merkzeichen</div><div class="val" style="font-size:16pt">${merkzeichen.length ? merkzeichen.map((m) => esc(m)).join('&nbsp;&nbsp;') : '—'}</div></div>
        </div>
        ${merkzeichen.includes('B') ? '<div style="font-size:7pt;margin:1mm 0 2mm">Die Berechtigung zur Mitnahme einer Begleitperson ist nachgewiesen.</div>' : '<div style="height:3mm"></div>'}
        <div class="lbl">Ausstellende Behörde</div><div class="val" style="font-size:8pt">${esc(behoerde)}</div>
        <div class="lbl">Ausgestellt am</div><div class="val">${datum(ausgestellt)}</div>
      </div>
      <div style="position:absolute;left:5mm;right:5mm;bottom:4mm;font-size:6pt;color:#333;line-height:1.3">Dieser Ausweis dient zum Nachweis für die Inanspruchnahme von Rechten und Nachteilsausgleichen nach dem SGB IX oder nach anderen Vorschriften.</div>
    </div>`;
  return {
    art: 'schwerbehindertenausweis', typ: 'schwerbehindertenausweis', titel: `Schwerbehindertenausweis ${p.vorname} ${p.nachname}`, person: p.id,
    pdf: await htmlZuPdf(seite(vorder, rueck)),
    erwartet: identitaet(p),
  };
}

// ── Elektronische Gesundheitskarte / EHIC ───────────────────────────────────

export interface KvKarteOptionen {
  /** Krankenkasse. Default „AOK Hessen". */
  kasse?: string;
  /** Kennnummer des Trägers (IK, 9 Ziffern). Default: reproduzierbar erzeugt. */
  kassenIk?: string;
  /** Versichertennummer (Buchstabe + 9 Ziffern). Default: reproduzierbar erzeugt. */
  versichertennummer?: string;
  /** Kennnummer der Karte (20 Ziffern). Default: reproduzierbar erzeugt. */
  kartennummer?: string;
  /** Ablaufdatum der Karte (ISO). Default: 2–5 Jahre nach Antragsdatum. */
  gueltigBis?: string;
}

export async function erzeugeKvKarte(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personAus(fall, spec);
  const o = opt<KvKarteOptionen>(spec);
  const r = rng(`${fall.id}:kv_karte:${p.id}`);
  const kasse = o.kasse ?? 'AOK Hessen';
  const ik = o.kassenIk ?? `10${ziffern(r, 7)}`;
  const vnr = o.versichertennummer ?? `${mrzName(p.nachname).charAt(0) || 'A'}${ziffern(r, 9)}`;
  const kartennr = o.kartennummer ?? `80276${ik.slice(0, 9)}${ziffern(r, 6)}`.slice(0, 20);
  const gueltigBis = o.gueltigBis ?? isoZufall(r, isoPlus(fall.antragsdatum, 2), 3 * 365);
  const hg = 'linear-gradient(135deg, #e3eef7 0%, #cfe0ef 55%, #e6eef5 100%)';

  const vorder = `
    <div class="karte" style="background:${hg}">
      <div class="band" style="background:rgba(0,70,130,0.12);display:flex;justify-content:space-between"><span>${esc(kasse)}</span><span style="font-weight:normal">Gesundheitskarte</span></div>
      <div class="foto">${SILHOUETTE}</div>
      <div class="felder" style="top:16mm">
        <div class="lbl">Name</div><div class="val">${esc(p.vorname)} ${esc(p.nachname)}</div>
        <div class="lbl">Versichertennummer</div><div class="val">${esc(vnr)}</div>
        <div class="lbl">Kennnummer des Trägers</div><div class="val">${esc(ik)}</div>
      </div>
      <div style="position:absolute;left:4mm;top:49mm;width:10mm;height:8mm;border-radius:1.2mm;background:linear-gradient(135deg,#d8c27a,#b99a45);border:0.2mm solid #8a7330"></div>
    </div>`;
  const rueck = `
    <div class="karte" style="background: linear-gradient(135deg, #e7ecf5 0%, #d4dcec 60%, #e7ecf5 100%)">
      <div class="band" style="background:rgba(0,40,120,0.14)">EUROPÄISCHE KRANKENVERSICHERUNGSKARTE</div>
      <div style="position:absolute;right:4mm;top:10mm;width:13mm;height:9mm;background:#26408b;border-radius:1mm;color:#f2c230;font-weight:bold;font-size:10pt;text-align:center;line-height:9mm">D</div>
      <div class="felder" style="left:4mm;top:11mm;right:20mm">
        <div class="lbl">3 Name</div><div class="val">${esc(p.nachname.toUpperCase())}</div>
        <div class="lbl">4 Vornamen</div><div class="val">${esc(p.vorname.toUpperCase())}</div>
        <div class="zeile"><div><div class="lbl">5 Geburtsdatum</div><div class="val">${datum(p.geburtsdatum)}</div></div>
        <div><div class="lbl">6 Persönliche Kennnummer</div><div class="val">${esc(vnr)}</div></div></div>
        <div class="lbl">7 Kennnummer des Trägers</div><div class="val">${esc(ik)} - ${esc(kasse.toUpperCase())}</div>
        <div class="zeile"><div><div class="lbl">8 Kennnummer der Karte</div><div class="val">${esc(kartennr)}</div></div>
        <div><div class="lbl">9 Ablaufdatum</div><div class="val">${datum(gueltigBis)}</div></div></div>
      </div>
    </div>`;
  return {
    art: 'kv_karte', typ: 'kv_pv_nachweis', titel: `Gesundheitskarte ${p.vorname} ${p.nachname}`, person: p.id,
    pdf: await htmlZuPdf(seite(vorder, rueck)),
    erwartet: identitaet(p),
  };
}

// ── Registrierung ───────────────────────────────────────────────────────────

export const GENERATOREN_KARTEN: Partial<Record<DokArt, Generator>> = {
  aufenthaltstitel: erzeugeAufenthaltstitel,
  schwerbehindertenausweis: erzeugeSchwerbehindertenausweis,
  kv_karte: erzeugeKvKarte,
};
