/**
 * Behördenbescheide als Nachweise (1–2 Seiten, DIN-5008-naher Brief):
 * Kindergeld, Unterhaltsvorschuss, Elterngeld, BAföG, Bürgergeld (Bewilligung,
 * Ablehnung, Aufforderung § 12a SGB II), Arbeitslosengeld, Pflegegrad,
 * Sterbegeld-Mitteilung, Kita-Gebührenbescheid.
 *
 * Beträge Stand 2026: Kindergeld 259 €/Kind, Regelbedarfe Bürgergeld 563/506/471/451/390/357 €,
 * UVG 227/299/394 €, BAföG-Höchstsatz 992 €, Pflegegeld PG2–5 347/599/800/990 €.
 * Alle dokumentspezifischen Werte sind über `spec.optionen` steuerbar (je Generator
 * ein exportiertes Options-Interface); Zufall ausschließlich seeded über `rng`.
 */
import { datum, esc, eur, ganz, htmlDoc, htmlZuPdf, ibanFormat, rng, rund2, unterschriftSvg, wahl } from '../lib';
import type { Rng } from '../lib';
import type { DokArt, DokSpec, DokumentTyp, ErzeugtesDokument, Fall, Generator, Person } from '../types';
import { BRIEF_CSS, brief, folgeseite } from './brief';
import { nettoLohn } from './gehaltsabrechnung';

// ── Options-Interfaces ──────────────────────────────────────────────────────

/** Gemeinsame Felder aller Bescheide. */
export interface BescheidBasisOptionen {
  /** Bescheiddatum (ISO). */
  datum?: string;
  /** Aktenzeichen / Kundennummer / Kassenzeichen. */
  aktenzeichen?: string;
  /** Name der ausstellenden Stelle (überschreibt den abgeleiteten Namen). */
  stelle?: string;
}

export interface KindergeldOptionen extends BescheidBasisOptionen {
  /** Personen-IDs der Kinder (Default: alle Kinder im Haushalt). */
  kinder?: string[];
  /** Kindergeld je Kind und Monat (Default 259). */
  betragProKind?: number;
  /** Festsetzung ab (ISO, Default: später von 01.01.2026 und Geburtsmonat). */
  ab?: string;
}

export interface UvsOptionen extends BescheidBasisOptionen {
  /** Personen-ID des Kindes (Default: jüngstes Kind). */
  kind?: string;
  /** Unterhaltsvorschuss je Monat (Default nach Altersstufe 227/299/394). */
  betrag?: number;
  /** Bewilligt ab (ISO). */
  ab?: string;
  /** Bewilligt bis (ISO, Default: Monat vor dem 18. Geburtstag). */
  bis?: string;
  /** Name des unterhaltspflichtigen Elternteils. */
  unterhaltspflichtiger?: string;
}

export interface ElterngeldOptionen extends BescheidBasisOptionen {
  /** Personen-ID des Kindes (Default: jüngstes Kind). */
  kind?: string;
  /** Geburtsdatum, falls das Kind nicht in `fall.personen` steht (ISO). */
  geburtsdatum?: string;
  /** Basiselterngeld je Lebensmonat (Default: aus Einnahme „Elterngeld" oder 65 % des Nettolohns, 300–1.800). */
  betrag?: number;
  /** Bezugsmonate = Lebensmonate 1..n (Default 12). */
  bezugsmonate?: number;
}

export interface BafoegOptionen extends BescheidBasisOptionen {
  /** Monatlicher Förderungsbetrag (Default: aus Einnahme „BAföG" oder gewürfelt 620–992). */
  betrag?: number;
  /** Bewilligungszeitraum (ISO, Default: Wintersemester vor Antragsdatum, 12 Monate). */
  von?: string;
  bis?: string;
  hochschule?: string;
  studiengang?: string;
  fachsemester?: number;
}

export interface BuergergeldOptionen extends BescheidBasisOptionen {
  /** Personen-IDs der Bedarfsgemeinschaft (Default: nur die adressierte Person). */
  bgMitglieder?: string[];
  /** Gesamter monatlicher Leistungsbetrag (Default: Regelbedarfe + KdU-Kopfteil − Einkommen). */
  betrag?: number;
  /** Angerechnetes Einkommen je Monat (Default 0). */
  einkommen?: number;
  /** Bewilligungszeitraum (ISO, Default: 12 Monate ab 4 Monate vor Antragsdatum). */
  von?: string;
  bis?: string;
}

export interface JobcenterAblehnungOptionen extends BescheidBasisOptionen {
  /** Datum des abgelehnten Antrags (ISO, Default: Antragsdatum − 75 Tage). */
  antragVom?: string;
  /** Personen-IDs der Bedarfsgemeinschaft (Default: alle Personen des Falls). */
  bgMitglieder?: string[];
  /** Gesamtbedarf (Default: Regelbedarfe + Kosten der Unterkunft). */
  bedarf?: number;
  /** Bereinigtes Einkommen (Default: aus den Einnahmen, mindestens Bedarf + 1). */
  einkommen?: number;
}

export interface JobcenterAufforderungOptionen extends BescheidBasisOptionen {
  /** Frist zur Vorlage des Nachweises (ISO, Default: Datum + 28 Tage). */
  frist?: string;
  /** Kinderzuschlag zusätzlich anfordern (Default: ja, wenn Kinder im Haushalt). */
  kinderzuschlag?: boolean;
}

export interface Alg1Optionen extends BescheidBasisOptionen {
  /** Täglicher Leistungsbetrag (Default: aus Einnahme „Arbeitslosengeld" /30 oder aus dem Gehalt berechnet). */
  leistungssatz?: number;
  /** Bruttoarbeitsentgelt je Monat im Bemessungszeitraum (Default: Gehalt der Person oder gewürfelt). */
  bruttoMonat?: number;
  /** Anspruchsbeginn (ISO, Default: Antragsdatum − 3 Monate, Monatserster). */
  von?: string;
  /** Anspruchsdauer in Kalendertagen (Default 360). */
  anspruchsdauer?: number;
  /** Leistungssatz 60 oder 67 % (Default: 67 bei Kindern im Haushalt). */
  prozent?: 60 | 67;
}

export interface PflegeOptionen extends BescheidBasisOptionen {
  /** Pflegegrad 1–5 (Default 2). */
  pflegegrad?: number;
  /** Versorgungsart (Default häuslich, Pflegegeld). */
  versorgung?: 'haeuslich' | 'stationaer';
  /** Leistungen ab (ISO, Default: Monatserster 3 Monate vor Datum). */
  ab?: string;
  /** Pflegegeld / Leistungsbetrag je Monat (Default nach Pflegegrad). */
  pflegegeld?: number;
  /** Gesamtpunkte der Begutachtung (Default: im Punktekorridor des Pflegegrads). */
  punkte?: number;
}

export interface SterbegeldOptionen extends BescheidBasisOptionen {
  /** Personen-ID der verstorbenen Person, falls in `fall.personen` geführt. */
  verstorben?: string;
  /** Name der verstorbenen Person (sonst abgeleitet). */
  verstorbenName?: string;
  /** Sterbedatum (ISO, Default: Antragsdatum − 5 Monate). */
  sterbedatum?: string;
  /** Auszahlungsbetrag gesamt (Default 3.000 + Überschussbeteiligung). */
  betrag?: number;
  /** Auszahlungsdatum (ISO, Default: Sterbedatum + 24 Tage). */
  auszahlung?: string;
}

export interface KitaOptionen extends BescheidBasisOptionen {
  /** Personen-IDs der betreuten Kinder (Default: Kinder unter 7 Jahren). */
  kinder?: string[];
  /** Monatlicher Betreuungsbeitrag für das erste Kind (Default gewürfelt 160–340). */
  beitrag?: number;
  /** Ermäßigung ab dem zweiten Kind in Prozent (Default 50). */
  geschwisterermaessigung?: number;
  /** Verpflegungsentgelt je Kind und Monat, separat ausgewiesen (Default 72). */
  essensgeld?: number;
  /** Name der Einrichtung. */
  einrichtung?: string;
  /** Betreuungsumfang (Default „Ganztag, bis 45 Std./Woche"). */
  umfang?: string;
  /** Beitragspflicht ab (ISO, Default: 01.08. des laufenden Kita-Jahres). */
  ab?: string;
}

// ── Datums- und Personenhelfer ──────────────────────────────────────────────

const d0 = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoVon = (d: Date) => d.toISOString().slice(0, 10);

function plusTage(iso: string, n: number): string {
  const d = d0(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoVon(d);
}

function plusMonate(iso: string, n: number): string {
  const [y, m, t] = iso.split('-').map(Number);
  const letzter = new Date(Date.UTC(y!, m! - 1 + n + 1, 0)).getUTCDate();
  return isoVon(new Date(Date.UTC(y!, m! - 1 + n, Math.min(t!, letzter))));
}

const monatsErster = (iso: string) => `${iso.slice(0, 7)}-01`;
const monatsLetzter = (iso: string) => plusTage(plusMonate(monatsErster(iso), 1), -1);
const maxIso = (...xs: string[]) => xs.reduce((a, b) => (a > b ? a : b));
const minIso = (...xs: string[]) => xs.reduce((a, b) => (a < b ? a : b));

function alterAm(geb: string, stichtag: string): number {
  const [gy, gm, gd] = geb.split('-').map(Number);
  const [sy, sm, sd] = stichtag.split('-').map(Number);
  let a = sy! - gy!;
  if (sm! < gm! || (sm === gm && sd! < gd!)) a--;
  return a;
}

function personVon(fall: Fall, id?: string): Person {
  const p = fall.personen.find((x) => x.id === (id ?? 'P1'));
  if (!p) throw new Error(`${fall.id}: Person ${id} unbekannt`);
  return p;
}

const opt = <T,>(spec: DokSpec) => (spec.optionen ?? {}) as T;

/** Kinder im Haushalt: Verhältnis Sohn/Tochter/Kind oder minderjährig (außer P1). */
function kinderImHaushalt(fall: Fall, stichtag: string): Person[] {
  return fall.personen.filter((p) => p.id !== 'P1'
    && (/(sohn|tochter|kind|enkel)/i.test(p.verhaeltnis ?? '') || alterAm(p.geburtsdatum, stichtag) < 18));
}

/** Monatsbetrag einer Einnahme, deren Art auf `muster` passt. */
function einnahmeMonat(p: Person, muster: RegExp): number | undefined {
  const e = p.einnahmen.find((x) => muster.test(x.art));
  if (!e) return undefined;
  return e.turnus === 'jährlich' ? rund2(e.brutto / 12) : e.brutto;
}

const anrede = (p: Person) =>
  p.geschlecht === 'weiblich' ? `Sehr geehrte Frau ${esc(p.nachname)},`
    : p.geschlecht === 'maennlich' ? `Sehr geehrter Herr ${esc(p.nachname)},`
      : `Guten Tag ${esc(p.vorname)} ${esc(p.nachname)},`;

function empfaenger(fall: Fall, p: Person): string[] {
  const w = fall.wohnung;
  const z = p.geschlecht === 'weiblich' ? ['Frau'] : p.geschlecht === 'maennlich' ? ['Herrn'] : [];
  return [...z, `${p.vorname} ${p.nachname}`, `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`];
}

const nameVon = (p: Person) => `${p.vorname} ${p.nachname}`;

/** IBAN teilweise geschwärzt, wie in Bescheiden üblich. */
function ibanMaskiert(i: string): string {
  const f = ibanFormat(i);
  return `${f.slice(0, 4)} XXXX XXXX XXXX ${f.slice(-7)}`;
}

// ── Absender ────────────────────────────────────────────────────────────────

interface Stelle { name: string; zusatz: string; strasse: string; plzOrt: string; telefon: string; farbe: string; sachbearbeitung: string }

const STRASSEN = ['Bahnhofstraße', 'Friedrich-Ebert-Straße', 'Am Rathausplatz', 'Schillerstraße', 'Berliner Allee', 'Kaiser-Wilhelm-Ring', 'Lindenallee', 'Europaplatz'];
const SACHBEARBEITUNG = ['Frau Albrecht', 'Herr Dietz', 'Frau Özdemir', 'Herr Lorenz', 'Frau Winkler', 'Herr Baumann', 'Frau Schreiber', 'Herr Nowak'];

function stelle(fall: Fall, r: Rng, name: string, zusatz: string, farbe: string): Stelle {
  const w = fall.wohnung;
  const vorwahl = fall.telefon?.match(/^0\d{2,5}/)?.[0] ?? '0800';
  return {
    name, zusatz, farbe,
    strasse: `${wahl(r, STRASSEN)} ${ganz(r, 2, 60)}`,
    plzOrt: `${w.plz.slice(0, 3)}${String(ganz(r, 10, 99))} ${w.ort}`,
    telefon: `${vorwahl} ${ganz(r, 200, 989)}-${ganz(r, 0, 9)}${ganz(r, 10, 99)}`,
    sachbearbeitung: wahl(r, SACHBEARBEITUNG),
  };
}

/** Rücksendezeile einzeilig halten (Fensterbreite ca. 85 mm bei 6,5 pt). */
const rs = (s: Stelle, voll: string) => (voll.length <= 78 ? voll : `${s.name}, ${s.plzOrt}`);

const kopfHtml = (s: Stelle) =>
  `<div><div style="font-weight:bold;font-size:13pt;color:${s.farbe}">${esc(s.name)}</div><div class="klein">${esc(s.zusatz)}</div></div>`
  + `<div class="klein" style="text-align:right">${esc(s.strasse)}<br>${esc(s.plzOrt)}<br>Tel. ${esc(s.telefon)}</div>`;

const fussHtml = (s: Stelle, rechts: string) =>
  `<span>${esc(s.name)} · ${esc(s.strasse)} · ${esc(s.plzOrt)}</span><span>${esc(rechts)}</span>`;

/** Region für Familienkasse/Kassen grob aus der PLZ. */
function region(plz: string): string {
  const p = Number(plz.slice(0, 2));
  if (p === 34 || p === 35 || p === 36 || (p >= 60 && p <= 65)) return 'Hessen';
  if ((p >= 54 && p <= 56) || (p >= 66 && p <= 67)) return 'Rheinland-Pfalz-Saarland';
  if (p >= 68 && p <= 79) return 'Baden-Württemberg';
  if (p >= 80 && p <= 97) return 'Bayern';
  if (p >= 98 || p === 39 || p === 6 || p === 7) return 'Sachsen-Anhalt-Thüringen';
  if (p >= 1 && p <= 9) return 'Sachsen';
  if (p >= 10 && p <= 16) return 'Berlin-Brandenburg';
  if ((p >= 17 && p <= 25)) return 'Nord';
  if ((p >= 26 && p <= 31) || p === 37 || p === 38 || p === 49) return 'Niedersachsen-Bremen';
  return 'Nordrhein-Westfalen';
}

function rechtsbehelf(stelleName: string, art: 'widerspruch' | 'einspruch' = 'widerspruch'): string {
  if (art === 'einspruch') {
    return `<p class="fett">Rechtsbehelfsbelehrung</p>
      <p>Gegen diesen Bescheid kann innerhalb eines Monats nach seiner Bekanntgabe Einspruch eingelegt werden. Der Einspruch ist
      bei der ${esc(stelleName)} schriftlich einzureichen, dieser elektronisch zu übermitteln oder dort zur Niederschrift zu erklären.
      Die Frist für die Einlegung des Einspruchs beginnt mit Ablauf des Tages, an dem Ihnen dieser Bescheid bekannt gegeben worden ist.</p>`;
  }
  return `<p class="fett">Rechtsbehelfsbelehrung</p>
    <p>Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Widerspruch erhoben werden. Der Widerspruch ist schriftlich,
    in elektronischer Form nach § 36a Absatz 2 des Ersten Buches Sozialgesetzbuch oder zur Niederschrift bei der im Briefkopf
    genannten Stelle (${esc(stelleName)}) einzulegen.</p>`;
}

async function pdf(seiten: string, extraCss = ''): Promise<Uint8Array> {
  return htmlZuPdf(htmlDoc(seiten, BRIEF_CSS + extraCss));
}

function ergebnis(art: DokArt, typ: DokumentTyp, titel: string, p: Person, pdfBytes: Uint8Array, betrag?: number): ErzeugtesDokument {
  return {
    art, typ, titel, person: p.id, pdf: pdfBytes,
    erwartet: {
      ...(betrag !== undefined ? { analyse: { betrag } } : {}),
      identitaet: { nachname: p.nachname, vorname: p.vorname },
    },
  };
}

const CSS_EXTRA = `
  .kasten { border: 0.3mm solid var(--akzent, #333); padding: 2.5mm 3.5mm; margin: 3mm 0 4mm; }
  table.kasten { border-collapse: separate; border-spacing: 0; padding: 1.5mm 0; }
  table.kasten td { padding: 0.6mm 3.5mm; }
  .inhalt p, .folge p { margin: 0 0 2.6mm 0; }
`;

// ── Regelbedarfe (Bürgergeld 2026) ──────────────────────────────────────────

function regelbedarf(fall: Fall, bg: Person[], p: Person, stichtag: string): { stufe: string; betrag: number } {
  const a = alterAm(p.geburtsdatum, stichtag);
  if (a < 6) return { stufe: 'Regelbedarfsstufe 6', betrag: 357 };
  if (a < 14) return { stufe: 'Regelbedarfsstufe 5', betrag: 390 };
  if (a < 18) return { stufe: 'Regelbedarfsstufe 4', betrag: 471 };
  const erwachsene = bg.filter((x) => alterAm(x.geburtsdatum, stichtag) >= 18 && !/(sohn|tochter|kind)/i.test(x.verhaeltnis ?? ''));
  if (erwachsene.length >= 2 && erwachsene.includes(p)) return { stufe: 'Regelbedarfsstufe 2', betrag: 506 };
  if (a < 25 && fall.personen.length > bg.length && p.id !== 'P1') return { stufe: 'Regelbedarfsstufe 3', betrag: 451 };
  return { stufe: 'Regelbedarfsstufe 1', betrag: 563 };
}

/** Kosten der Unterkunft und Heizung nach Kopfteilen. */
function kduAnteil(fall: Fall, anzahl: number): { grund: number; heiz: number } {
  const w = fall.wohnung;
  const kopf = anzahl / fall.personen.length;
  return { grund: rund2((w.grundmiete + w.nebenkosten) * kopf), heiz: rund2((w.heizkosten + w.warmwasser) * kopf) };
}

// ── Kindergeld ──────────────────────────────────────────────────────────────

async function kindergeldbescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<KindergeldOptionen>(spec);
  const r = rng(`${fall.id}:kindergeldbescheid:${p.id}`);
  const kinder = o.kinder ? o.kinder.map((id) => personVon(fall, id)) : kinderImHaushalt(fall, fall.antragsdatum);
  if (!kinder.length) throw new Error(`${fall.id}: Kindergeldbescheid ohne Kinder`);
  const proKind = o.betragProKind ?? 259;
  const abJe = kinder.map((k) => o.ab ?? maxIso('2026-01-01', monatsErster(k.geburtsdatum)));
  const spaetestesAb = maxIso(...abJe);
  const dat = o.datum ?? minIso(plusTage(spaetestesAb, 18), plusTage(fall.antragsdatum, -10));
  const kgNr = o.aktenzeichen ?? `${ganz(r, 100, 999)}FK${ganz(r, 100000, 999999)}`;
  const endziffer = Number(kgNr.replace(/\D/g, '').slice(-1));
  const zahltag = [5, 6, 7, 8, 11, 12, 13, 14, 15, 18][endziffer] ?? 10;
  const summe = rund2(proKind * kinder.length);
  const s = stelle(fall, r, o.stelle ?? `Familienkasse ${region(fall.wohnung.plz)}`, 'Bundesagentur für Arbeit', '#b3123a');
  s.telefon = '0800 4 5555 30';
  const fuss = fussHtml(s, `Kindergeldnummer ${kgNr}`);
  const zeilen = kinder.map((k, i) => {
    const bis = monatsLetzter(plusMonate(k.geburtsdatum, 18 * 12));
    return `<tr><td>${i + 1}.</td><td>${esc(k.vorname)} ${esc(k.nachname)}</td><td>${datum(k.geburtsdatum)}</td><td>${datum(abJe[i]!)} – ${datum(bis)}</td><td class="r">${eur(proKind)}</td></tr>`;
  }).join('');

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Kindergeldnummer', kgNr], ['Ihr Zeichen', '—'], ['Servicetelefon', s.telefon], ['Datum', datum(dat)]],
    betreff: 'Bescheid über die Festsetzung von Kindergeld',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>für die nachstehend genannten Kinder wird Ihnen nach § 62 ff. Einkommensteuergesetz (EStG) Kindergeld festgesetzt:</p>
      <table class="tab" style="margin:3mm 0 4mm">
        <tr><th>Nr.</th><th>Kind</th><th>geboren am</th><th>Festsetzungszeitraum</th><th class="r">EUR/Monat</th></tr>
        ${zeilen}
        <tr class="summe"><td></td><td colspan="3">Kindergeld insgesamt monatlich</td><td class="r">${eur(summe)}</td></tr>
      </table>
      <p>Das Kindergeld beträgt für jedes Kind monatlich ${eur(proKind)} EUR. Es wird monatlich auf das Konto
      ${esc(ibanMaskiert(fall.bank.iban))} bei der ${esc(fall.bank.name)} überwiesen. Maßgeblich für den Zahltag ist die
      letzte Ziffer Ihrer Kindergeldnummer; das Kindergeld geht in der Regel um den ${zahltag}. eines Monats auf Ihrem Konto ein.</p>
      <p>Die Festsetzung endet mit Ablauf des Monats, in dem das jeweilige Kind das 18. Lebensjahr vollendet. Ein Anspruch über
      diesen Zeitpunkt hinaus (z. B. wegen Schul- oder Berufsausbildung) muss gesondert nachgewiesen werden.</p>
      <p>Mit freundlichen Grüßen<br>Ihre ${esc(s.name)}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Kindergeldnummer ${esc(kgNr)} · Bescheid vom ${datum(dat)}`,
    inhalt: `<div class="folge">
      <p class="fett">Hinweise zu Ihren Mitwirkungspflichten</p>
      <p>Sie sind verpflichtet, der Familienkasse alle Änderungen in Ihren Verhältnissen und in den Verhältnissen der Kinder, die für den
      Anspruch auf Kindergeld erheblich sind, unverzüglich mitzuteilen (§ 68 Abs. 1 EStG). Dazu gehören insbesondere:</p>
      <ul style="margin:0 0 3mm 0;padding-left:6mm">
        <li>ein Kind lebt nicht mehr in Ihrem Haushalt,</li>
        <li>Sie oder ein Kind ziehen ins Ausland,</li>
        <li>Änderungen Ihrer Anschrift oder Bankverbindung,</li>
        <li>ein anderer Elternteil beantragt Kindergeld für dasselbe Kind.</li>
      </ul>
      <p>Zu Unrecht gezahltes Kindergeld muss zurückgezahlt werden. Die Verletzung der Mitwirkungspflichten kann als Steuerordnungswidrigkeit
      oder Steuerstraftat verfolgt werden.</p>
      <p class="fett">Hinweis zur Verwendung als Nachweis</p>
      <p>Dieser Bescheid kann gegenüber anderen Stellen (z. B. Wohngeldbehörde, Kita-Träger) als Nachweis über den Kindergeldbezug vorgelegt werden.</p>
      ${rechtsbehelf(s.name, 'einspruch')}</div>`,
  });
  return ergebnis('kindergeldbescheid', 'kindergeldnachweis', `Kindergeldbescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), summe);
}

// ── Unterhaltsvorschuss ─────────────────────────────────────────────────────

async function uvsBescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<UvsOptionen>(spec);
  const r = rng(`${fall.id}:uvs_bescheid:${p.id}`);
  const kinder = kinderImHaushalt(fall, fall.antragsdatum);
  const kind = o.kind ? personVon(fall, o.kind) : [...kinder].sort((a, b) => (a.geburtsdatum < b.geburtsdatum ? 1 : -1))[0];
  if (!kind) throw new Error(`${fall.id}: UVS-Bescheid ohne Kind`);
  const ab = o.ab ?? maxIso(monatsErster(plusMonate(fall.antragsdatum, -8)), monatsErster(plusMonate(kind.geburtsdatum, 1)));
  const bis = o.bis ?? monatsLetzter(plusMonate(plusMonate(kind.geburtsdatum, 18 * 12), -1));
  const alter = alterAm(kind.geburtsdatum, ab);
  const [stufe, mindest] = alter < 6 ? ['1. Altersstufe (0–5 Jahre)', 486] : alter < 12 ? ['2. Altersstufe (6–11 Jahre)', 558] : ['3. Altersstufe (12–17 Jahre)', 653];
  const standard = mindest - 259;
  const betrag = o.betrag ?? einnahmeMonat(kind, /unterhaltsvorschuss/i) ?? einnahmeMonat(p, /unterhaltsvorschuss/i) ?? standard;
  const anrechnung = rund2(Math.max(0, standard - betrag));
  const dat = o.datum ?? plusTage(ab, 23);
  const az = o.aktenzeichen ?? `51.3-UV ${ganz(r, 1000, 9999)}/${ab.slice(2, 4)}`;
  const pflichtiger = o.unterhaltspflichtiger
    ?? `${wahl(r, ['Marco', 'Sven', 'Daniel', 'Tobias', 'Kevin', 'Patrick'])} ${wahl(r, ['Reuter', 'Keller', 'Brandt', 'Sommer', 'Hahn', 'Vogt'])}`;
  const s = stelle(fall, r, o.stelle ?? `Stadt ${fall.wohnung.ort}`, 'Jugendamt – Unterhaltsvorschusskasse', '#2b5c8a');
  const fuss = fussHtml(s, `Aktenzeichen ${az}`);

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name} · Jugendamt, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Aktenzeichen', az], ['Sachbearbeitung', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: `Bescheid nach dem Unterhaltsvorschussgesetz (UVG) für ${nameVon(kind)}, geb. ${datum(kind.geburtsdatum)}`,
    inhalt: `
      <p>${anrede(p)}</p>
      <p>auf Ihren Antrag werden für Ihr Kind <b>${esc(nameVon(kind))}</b> Leistungen nach dem Unterhaltsvorschussgesetz bewilligt.</p>
      <table class="kasten" style="width:100%">
        <tr><td style="width:55mm">Bewilligungszeitraum</td><td><b>${datum(ab)} bis ${datum(bis)}</b></td></tr>
        <tr><td>Unterhaltsvorschuss monatlich</td><td><b>${eur(betrag)} EUR</b></td></tr>
        <tr><td>Unterhaltspflichtiger Elternteil</td><td>${esc(pflichtiger)}</td></tr>
      </table>
      <table class="tab" style="margin:1mm 0 4mm">
        <tr><th>Berechnung ab ${datum(ab)}</th><th class="r">EUR/Monat</th></tr>
        <tr><td>Mindestunterhalt ${esc(stufe)} (§ 1612a BGB)</td><td class="r">${eur(mindest)}</td></tr>
        <tr><td>abzüglich Kindergeld für ein erstes Kind (§ 2 Abs. 2 UVG)</td><td class="r">– ${eur(259)}</td></tr>
        ${anrechnung > 0 ? `<tr><td>abzüglich anzurechnender Einkünfte des Kindes (§ 2 Abs. 3 UVG)</td><td class="r">– ${eur(anrechnung)}</td></tr>` : ''}
        <tr class="summe"><td>Unterhaltsvorschuss</td><td class="r">${eur(betrag)}</td></tr>
      </table>
      <p>Der Betrag wird monatlich im Voraus auf Ihr Konto ${esc(ibanMaskiert(fall.bank.iban))} überwiesen. Mit der Zahlung gehen
      die Unterhaltsansprüche des Kindes gegen den anderen Elternteil in Höhe der Leistung auf das Land über (§ 7 UVG).</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Unterhaltsvorschusskasse · Az. ${esc(az)}`,
    inhalt: `<div class="folge">
      <p class="fett">Begründung</p>
      <p>Das Kind lebt bei Ihnen als alleinerziehendem Elternteil und erhält von dem anderen Elternteil keinen oder nicht regelmäßig
      Unterhalt in Höhe des Mindestunterhalts (§ 1 Abs. 1 UVG). Die Voraussetzungen für die Leistung liegen damit vor.</p>
      <p class="fett">Anzeigepflichten (§ 6 Abs. 4 UVG)</p>
      <p>Sie sind verpflichtet, uns unverzüglich alle Änderungen mitzuteilen, die für die Leistung erheblich sind, insbesondere wenn</p>
      <ul style="margin:0 0 3mm 0;padding-left:6mm">
        <li>das Kind nicht mehr bei Ihnen lebt,</li>
        <li>Sie heiraten oder mit dem anderen Elternteil zusammenziehen,</li>
        <li>der andere Elternteil Unterhalt zahlt oder sein Aufenthalt bekannt wird,</li>
        <li>Sie umziehen.</li>
      </ul>
      <p>Zu Unrecht erhaltene Leistungen sind zu ersetzen (§ 5 UVG).</p>
      ${rechtsbehelf(`${s.name}, Jugendamt`)}
      <p style="margin-top:6mm">Mit freundlichen Grüßen<br>Im Auftrag</p>
      <div style="height:13mm">${unterschriftSvg(`${s.sachbearbeitung}${fall.id}`, 38)}</div>
      <p>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p></div>`,
  });
  return ergebnis('uvs_bescheid', 'unterhaltsnachweis', `Unterhaltsvorschuss-Bescheid ${kind.vorname}`, p, await pdf(s1 + s2, CSS_EXTRA), betrag);
}

// ── Elterngeld ──────────────────────────────────────────────────────────────

async function elterngeldbescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<ElterngeldOptionen>(spec);
  const r = rng(`${fall.id}:elterngeldbescheid:${p.id}`);
  const kind = o.kind ? personVon(fall, o.kind)
    : [...kinderImHaushalt(fall, fall.antragsdatum)].sort((a, b) => (a.geburtsdatum < b.geburtsdatum ? 1 : -1))[0];
  const geb = o.geburtsdatum ?? kind?.geburtsdatum;
  if (!geb) throw new Error(`${fall.id}: Elterngeldbescheid ohne Kind/Geburtsdatum`);
  const kindName = kind ? nameVon(kind) : `Kind ${p.nachname}`;
  const monate = o.bezugsmonate ?? 12;
  const brutto = einnahmeMonat(p, /gehalt|lohn/i);
  const netto = brutto ? nettoLohn(brutto, p, true).netto : undefined;
  const standard = netto ? Math.min(1800, Math.max(300, rund2(netto * 0.65))) : 300;
  const betrag = o.betrag ?? einnahmeMonat(p, /elterngeld/i) ?? standard;
  const bemessung = netto ?? rund2(betrag / 0.65);
  const dat = o.datum ?? plusTage(geb, 52);
  const az = o.aktenzeichen ?? `EG-${ganz(r, 10, 99)}-${ganz(r, 100000, 999999)}`;
  const s = stelle(fall, r, o.stelle ?? `Stadt ${fall.wohnung.ort}`, 'Elterngeldstelle', '#6a3d8f');
  const fuss = fussHtml(s, `Aktenzeichen ${az}`);
  const bis = plusTage(plusMonate(geb, monate), -1);
  const zeilen = Array.from({ length: monate }, (_, i) => {
    const von = plusMonate(geb, i);
    const bisM = plusTage(plusMonate(geb, i + 1), -1);
    return `<tr><td>${i + 1}.</td><td>${datum(von)} – ${datum(bisM)}</td><td>Basiselterngeld</td><td class="r">${eur(betrag)}</td></tr>`;
  }).join('');

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name} · Elterngeldstelle, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Aktenzeichen', az], ['Sachbearbeitung', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: `Bescheid über Elterngeld nach dem BEEG für ${kindName}, geb. ${datum(geb)}`,
    inhalt: `
      <p>${anrede(p)}</p>
      <p>auf Ihren Antrag wird Ihnen für die Betreuung Ihres Kindes <b>${esc(kindName)}</b> Elterngeld nach dem
      Bundeselterngeld- und Elternzeitgesetz (BEEG) bewilligt.</p>
      <table class="kasten" style="width:100%">
        <tr><td style="width:55mm">Leistungsart</td><td>Basiselterngeld</td></tr>
        <tr><td>Bezugszeitraum</td><td><b>${monate}. Lebensmonat${monate > 1 ? 'e' : ''}: ${datum(geb)} bis ${datum(bis)}</b></td></tr>
        <tr><td>Elterngeld monatlich</td><td><b>${eur(betrag)} EUR</b></td></tr>
        <tr><td>Elterngeld insgesamt</td><td>${eur(rund2(betrag * monate))} EUR</td></tr>
      </table>
      <p class="fett">Berechnung</p>
      <table class="tab" style="margin:1mm 0 4mm">
        <tr><th>Grundlage</th><th class="r">EUR</th></tr>
        <tr><td>Durchschnittliches Nettoeinkommen im Bemessungszeitraum (12 Kalendermonate vor der Geburt)</td><td class="r">${eur(bemessung)}</td></tr>
        <tr><td>Ersatzrate</td><td class="r">65 %</td></tr>
        <tr class="summe"><td>Basiselterngeld je Lebensmonat (mindestens 300, höchstens 1.800 EUR)</td><td class="r">${eur(betrag)}</td></tr>
      </table>
      <p>Das Elterngeld wird jeweils am Ende des Lebensmonats, für den es bestimmt ist, auf das Konto
      ${esc(ibanMaskiert(fall.bank.iban))} gezahlt. Die Aufstellung der Lebensmonate finden Sie auf Seite 2.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Elterngeldstelle · Az. ${esc(az)}`,
    inhalt: `<div class="folge">
      <p class="fett">Aufstellung der Bezugsmonate</p>
      <table class="tab" style="margin:1mm 0 5mm">
        <tr><th>Lebensmonat</th><th>Zeitraum</th><th>Leistung</th><th class="r">EUR</th></tr>
        ${zeilen}
        <tr class="summe"><td colspan="3">Summe</td><td class="r">${eur(rund2(betrag * monate))}</td></tr>
      </table>
      <p class="fett">Hinweise</p>
      <p>Das Elterngeld wird unter dem Vorbehalt des Widerrufs für den Fall gezahlt, dass Sie im Bezugszeitraum Einkommen aus
      Erwerbstätigkeit erzielen (§ 8 BEEG). Nach Ablauf des Bezugszeitraums ist das tatsächlich erzielte Einkommen nachzuweisen.
      Änderungen, insbesondere die Aufnahme einer Erwerbstätigkeit oder ein Wechsel der Betreuung, sind unverzüglich mitzuteilen.</p>
      <p>Das Elterngeld unterliegt dem Progressionsvorbehalt (§ 32b EStG) und ist in der Einkommensteuererklärung anzugeben.</p>
      ${rechtsbehelf(`${s.name}, Elterngeldstelle`)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Im Auftrag<br>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('elterngeldbescheid', 'verdienstbescheinigung', `Elterngeldbescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), betrag);
}

// ── BAföG ───────────────────────────────────────────────────────────────────

async function bafoegBescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<BafoegOptionen>(spec);
  const r = rng(`${fall.id}:bafoeg_bescheid:${p.id}`);
  const ort = fall.wohnung.ort;
  const [ay, am] = fall.antragsdatum.split('-').map(Number);
  const wsJahr = am! >= 10 ? ay! : ay! - 1;
  const von = o.von ?? `${wsJahr}-10-01`;
  const bis = o.bis ?? plusTage(plusMonate(von, 12), -1);
  const bedarf: Array<[string, number]> = [
    ['Grundbedarf (§ 13 Abs. 1 Nr. 2 BAföG)', 475],
    ['Bedarf für die Unterkunft, nicht bei den Eltern wohnend (§ 13 Abs. 2 Nr. 2 BAföG)', 380],
    ['Kranken­versicherungs­zuschlag (§ 13a Abs. 1 BAföG)', 102],
    ['Pflege­versicherungs­zuschlag (§ 13a Abs. 2 BAföG)', 35],
  ];
  const gesamtBedarf = bedarf.reduce((a, [, v]) => a + v, 0);
  const betrag = o.betrag ?? einnahmeMonat(p, /bafög|bafoeg|ausbildungsförderung/i) ?? ganz(r, 62, 99) * 10 - (ganz(r, 0, 1) ? 0 : 8);
  const anrechnung = rund2(Math.max(0, gesamtBedarf - betrag));
  const dat = o.datum ?? plusTage(von, ganz(r, 20, 50));
  const az = o.aktenzeichen ?? `${ganz(r, 100, 999)} ${ganz(r, 10, 99)} ${ganz(r, 1000, 9999)} ${ganz(r, 0, 9)}`;
  const hochschule = o.hochschule ?? `Hochschule ${ort}`;
  const studiengang = o.studiengang ?? wahl(r, ['Soziale Arbeit (B.A.)', 'Betriebswirtschaftslehre (B.Sc.)', 'Lehramt an Grundschulen (B.Ed.)', 'Wirtschaftsinformatik (B.Sc.)']);
  const semester = o.fachsemester ?? ganz(r, 1, 5);
  const s = stelle(fall, r, o.stelle ?? `Studierendenwerk ${ort}`, 'Amt für Ausbildungsförderung', '#0f6b6b');
  const fuss = fussHtml(s, `Förderungsnummer ${az}`);

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name} · Amt für Ausbildungsförderung, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Förderungsnummer', az], ['Sachbearbeitung', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: 'Bescheid über Ausbildungsförderung nach dem Bundesausbildungsförderungsgesetz (BAföG)',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>für Ihre Ausbildung im Studiengang ${esc(studiengang)} an der ${esc(hochschule)} (${semester}. Fachsemester) wird Ihnen
      Ausbildungsförderung bewilligt.</p>
      <table class="kasten" style="width:100%">
        <tr><td style="width:55mm">Bewilligungszeitraum</td><td><b>${datum(von)} bis ${datum(bis)}</b></td></tr>
        <tr><td>Förderungsbetrag monatlich</td><td><b>${eur(betrag)} EUR</b></td></tr>
        <tr><td>davon Zuschuss / Darlehen</td><td>${eur(rund2(betrag / 2))} EUR / ${eur(rund2(betrag / 2))} EUR</td></tr>
      </table>
      <table class="tab" style="margin:1mm 0 4mm">
        <tr><th>Berechnung des monatlichen Förderungsbetrags</th><th class="r">EUR</th></tr>
        ${bedarf.map(([t, v]) => `<tr><td>${esc(t)}</td><td class="r">${eur(v)}</td></tr>`).join('')}
        <tr><td class="fett">Gesamtbedarf</td><td class="r fett">${eur(gesamtBedarf)}</td></tr>
        <tr><td>abzüglich anzurechnendes Einkommen der Eltern (§§ 11, 24 BAföG)</td><td class="r">– ${eur(anrechnung)}</td></tr>
        <tr class="summe"><td>Förderungsbetrag</td><td class="r">${eur(betrag)}</td></tr>
      </table>
      <p>Die Zahlung erfolgt monatlich im Voraus auf das Konto ${esc(ibanMaskiert(fall.bank.iban))}.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Amt für Ausbildungsförderung · Förderungsnummer ${esc(az)}`,
    inhalt: `<div class="folge">
      <p class="fett">Erläuterungen</p>
      <p>Der Förderungsbetrag wird zur Hälfte als Zuschuss und zur Hälfte als unverzinsliches Staatsdarlehen geleistet
      (§ 17 Abs. 2 BAföG). Über die Rückzahlung des Darlehens erhalten Sie nach Ende der Förderungshöchstdauer einen gesonderten
      Bescheid des Bundesverwaltungsamtes.</p>
      <p>Der Bescheid ergeht unter dem Vorbehalt der Rückforderung, soweit sich das Einkommen Ihrer Eltern oder Ihr eigenes
      Einkommen im Bewilligungszeitraum ändert (§ 24 Abs. 3 BAföG).</p>
      <p class="fett">Mitteilungspflichten</p>
      <p>Bitte teilen Sie uns unverzüglich mit, wenn Sie die Ausbildung unterbrechen oder abbrechen, die Fachrichtung wechseln,
      umziehen oder eigenes Einkommen bzw. Vermögen über den Freibeträgen erzielen (§ 60 SGB I).</p>
      <p>Für den weiteren Bewilligungszeitraum stellen Sie bitte rechtzeitig, spätestens zwei Monate vor dessen Ablauf, einen
      Weiterförderungsantrag, damit die Leistung ohne Unterbrechung gezahlt werden kann.</p>
      ${rechtsbehelf(`${s.name}, Amt für Ausbildungsförderung`)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Im Auftrag<br>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('bafoeg_bescheid', 'verdienstbescheinigung', `BAföG-Bescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), betrag);
}

// ── Jobcenter: Bürgergeld-Bewilligung ───────────────────────────────────────

function bgNummer(r: Rng): string {
  return `${ganz(r, 10000, 99999)}BG${String(ganz(r, 1, 9999999)).padStart(7, '0')}`;
}

async function buergergeldBescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<BuergergeldOptionen>(spec);
  const r = rng(`${fall.id}:buergergeld_bescheid:${p.id}`);
  const bg = (o.bgMitglieder ?? [p.id]).map((id) => personVon(fall, id));
  const von = o.von ?? monatsErster(plusMonate(fall.antragsdatum, -4));
  const bis = o.bis ?? plusTage(plusMonate(von, 12), -1);
  const kdu = kduAnteil(fall, bg.length);
  const einkommen = o.einkommen ?? 0;
  const zeilen = bg.map((m) => ({ m, rb: regelbedarf(fall, bg, m, von) }));
  const regelSumme = zeilen.reduce((a, z) => a + z.rb.betrag, 0);
  const berechnet = rund2(regelSumme + kdu.grund + kdu.heiz - einkommen);
  const betrag = o.betrag ?? einnahmeMonat(p, /bürgergeld|buergergeld|sgb ii/i) ?? berechnet;
  const dat = o.datum ?? plusTage(von, -9);
  const nr = o.aktenzeichen ?? bgNummer(r);
  const s = stelle(fall, r, o.stelle ?? `Jobcenter ${fall.wohnung.ort}`, 'Leistungen zur Sicherung des Lebensunterhalts', '#c8102e');
  const fuss = fussHtml(s, `BG-Nummer ${nr}`);
  const n = bg.length;
  const kopfteil = n === fall.personen.length ? '' : ` (Kopfteil ${n} von ${fall.personen.length} Personen)`;

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Nummer der BG', nr], ['Ansprechpartner', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: 'Bewilligungsbescheid über Leistungen zur Sicherung des Lebensunterhalts nach dem SGB II (Bürgergeld)',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>auf Ihren Antrag bewillige ich Ihnen und den mit Ihnen in der Bedarfsgemeinschaft lebenden Personen Leistungen zur
      Sicherung des Lebensunterhalts nach dem Zweiten Buch Sozialgesetzbuch (SGB II) für die Zeit vom
      <b>${datum(von)} bis ${datum(bis)}</b> in folgender Höhe:</p>
      <table class="tab" style="margin:3mm 0 4mm">
        <tr><th>Mitglied der Bedarfsgemeinschaft</th><th>geb. am</th><th class="r">Regelbedarf</th><th class="r">Unterkunft/Heizung</th><th class="r">Gesamt</th></tr>
        ${zeilen.map((z) => {
          const k = rund2((kdu.grund + kdu.heiz) / n);
          return `<tr><td>${esc(nameVon(z.m))}</td><td>${datum(z.m.geburtsdatum)}</td><td class="r">${eur(z.rb.betrag)}</td><td class="r">${eur(k)}</td><td class="r">${eur(rund2(z.rb.betrag + k))}</td></tr>`;
        }).join('')}
        ${einkommen > 0 ? `<tr><td colspan="4">abzüglich zu berücksichtigendes Einkommen</td><td class="r">– ${eur(einkommen)}</td></tr>` : ''}
        <tr class="summe"><td colspan="4">Leistungsanspruch der Bedarfsgemeinschaft monatlich</td><td class="r">${eur(betrag)}</td></tr>
      </table>
      <p>Der Betrag wird monatlich im Voraus auf das Konto ${esc(ibanMaskiert(fall.bank.iban))} überwiesen. Für die
      Dauer des Leistungsbezugs sind Sie in der gesetzlichen Kranken- und Pflegeversicherung versichert; die Beiträge trägt das Jobcenter.</p>
      <p>Die Berechnung im Einzelnen entnehmen Sie bitte der Anlage auf Seite 2.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · BG-Nummer ${esc(nr)} · Bescheid vom ${datum(dat)}`,
    inhalt: `<div class="folge">
      <p class="fett">Berechnungsbogen</p>
      <table class="tab" style="margin:1mm 0 5mm">
        <tr><th>Bedarf</th><th class="r">EUR/Monat</th></tr>
        ${zeilen.map((z) => `<tr><td>Regelbedarf ${esc(z.m.vorname)} (${esc(z.rb.stufe)}, § 20 SGB II)</td><td class="r">${eur(z.rb.betrag)}</td></tr>`).join('')}
        <tr><td>Grundmiete und kalte Nebenkosten${esc(kopfteil)}</td><td class="r">${eur(kdu.grund)}</td></tr>
        <tr><td>Heizkosten und Warmwasser${esc(kopfteil)}</td><td class="r">${eur(kdu.heiz)}</td></tr>
        <tr><td class="fett">Gesamtbedarf</td><td class="r fett">${eur(rund2(regelSumme + kdu.grund + kdu.heiz))}</td></tr>
        <tr><td>zu berücksichtigendes Einkommen</td><td class="r">– ${eur(einkommen)}</td></tr>
        <tr class="summe"><td>Leistungsanspruch</td><td class="r">${eur(betrag)}</td></tr>
      </table>
      <p class="fett">Hinweise</p>
      <p>Die Kosten der Unterkunft werden nach der Anzahl der in der Wohnung lebenden Personen aufgeteilt (Kopfteilprinzip).
      Sie sind verpflichtet, jede Änderung in Ihren persönlichen und wirtschaftlichen Verhältnissen, insbesondere die Aufnahme
      einer Beschäftigung, Einkommen, Umzug oder Änderungen der Miete, unverzüglich mitzuteilen (§ 60 SGB I).</p>
      <p>Einen Weiterbewilligungsantrag stellen Sie bitte rechtzeitig vor Ablauf des Bewilligungszeitraums.</p>
      ${rechtsbehelf(s.name)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Im Auftrag<br>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('buergergeld_bescheid', 'transferleistungsbescheid', `Bürgergeld-Bescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), betrag);
}

// ── Jobcenter: Ablehnung ────────────────────────────────────────────────────

async function jobcenterAblehnung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<JobcenterAblehnungOptionen>(spec);
  const r = rng(`${fall.id}:jobcenter_ablehnung:${p.id}`);
  const bg = (o.bgMitglieder ?? fall.personen.map((x) => x.id)).map((id) => personVon(fall, id));
  const antragVom = o.antragVom ?? plusTage(fall.antragsdatum, -75);
  const dat = o.datum ?? plusTage(antragVom, 27);
  const kdu = kduAnteil(fall, bg.length);
  const zeilen = bg.map((m) => ({ m, rb: regelbedarf(fall, bg, m, antragVom) }));
  const bedarf = o.bedarf ?? rund2(zeilen.reduce((a, z) => a + z.rb.betrag, 0) + kdu.grund + kdu.heiz);
  const bruttoSumme = bg.reduce((a, m) => a + m.einnahmen.reduce((b, e) => b + (e.turnus === 'monatlich' ? e.brutto : e.turnus === 'jährlich' ? e.brutto / 12 : 0), 0), 0);
  const einkommen = o.einkommen ?? Math.max(rund2(bruttoSumme * 0.68), rund2(bedarf + ganz(r, 40, 180)));
  const nr = o.aktenzeichen ?? bgNummer(r);
  const s = stelle(fall, r, o.stelle ?? `Jobcenter ${fall.wohnung.ort}`, 'Leistungen zur Sicherung des Lebensunterhalts', '#c8102e');
  const fuss = fussHtml(s, `BG-Nummer ${nr}`);

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Nummer der BG', nr], ['Ansprechpartner', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: `Ablehnung Ihres Antrags auf Bürgergeld vom ${datum(antragVom)}`,
    inhalt: `
      <p>${anrede(p)}</p>
      <p>Ihren Antrag vom ${datum(antragVom)} auf Leistungen zur Sicherung des Lebensunterhalts nach dem Zweiten Buch
      Sozialgesetzbuch (SGB II) lehne ich ab.</p>
      <p class="fett">Begründung</p>
      <p>Leistungen nach dem SGB II erhält nur, wer hilfebedürftig ist (§ 7 Abs. 1 Satz 1 Nr. 3 i. V. m. § 9 SGB II). Hilfebedürftig
      ist, wer seinen Lebensunterhalt nicht oder nicht ausreichend aus dem zu berücksichtigenden Einkommen oder Vermögen sichern kann.
      Das zu berücksichtigende Einkommen Ihrer Bedarfsgemeinschaft übersteigt den Bedarf:</p>
      <table class="tab" style="width:130mm;margin:2mm 0 4mm">
        <tr><th>Gegenüberstellung (monatlich)</th><th class="r">EUR</th></tr>
        <tr><td>Gesamtbedarf der Bedarfsgemeinschaft (${bg.length} Person${bg.length > 1 ? 'en' : ''})</td><td class="r">${eur(bedarf)}</td></tr>
        <tr><td>bereinigtes Einkommen (nach Abzug der Freibeträge, § 11b SGB II)</td><td class="r">${eur(einkommen)}</td></tr>
        <tr class="summe"><td>übersteigendes Einkommen</td><td class="r">${eur(rund2(einkommen - bedarf))}</td></tr>
      </table>
      <p>Hilfebedürftigkeit liegt damit nicht vor. Die Einzelberechnung ist als Anlage beigefügt.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · BG-Nummer ${esc(nr)} · Bescheid vom ${datum(dat)}`,
    inhalt: `<div class="folge">
      <p class="fett">Anlage: Bedarfsberechnung</p>
      <table class="tab" style="margin:1mm 0 5mm">
        <tr><th>Position</th><th class="r">EUR/Monat</th></tr>
        ${zeilen.map((z) => `<tr><td>Regelbedarf ${esc(nameVon(z.m))} (${esc(z.rb.stufe)})</td><td class="r">${eur(z.rb.betrag)}</td></tr>`).join('')}
        <tr><td>Kosten der Unterkunft (Grundmiete, kalte Nebenkosten)</td><td class="r">${eur(kdu.grund)}</td></tr>
        <tr><td>Kosten der Heizung und Warmwasserbereitung</td><td class="r">${eur(kdu.heiz)}</td></tr>
        <tr class="summe"><td>Gesamtbedarf</td><td class="r">${eur(bedarf)}</td></tr>
      </table>
      <p class="fett">Hinweis auf vorrangige Leistungen</p>
      <p>Nach den vorliegenden Unterlagen könnten Sie Anspruch auf Wohngeld${fall.personen.some((x) => alterAm(x.geburtsdatum, dat) < 18) ? ' und Kinderzuschlag' : ''} haben.
      Wohngeld beantragen Sie bei der Wohngeldbehörde Ihrer Stadt oder Gemeinde. Bitte stellen Sie den Antrag zeitnah, da
      Wohngeld frühestens ab dem Monat der Antragstellung gezahlt wird.</p>
      ${rechtsbehelf(s.name)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Im Auftrag<br>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('jobcenter_ablehnung', 'transferleistungsbescheid', 'Ablehnungsbescheid Jobcenter', p, await pdf(s1 + s2, CSS_EXTRA));
}

// ── Jobcenter: Aufforderung § 12a SGB II ────────────────────────────────────

async function jobcenterAufforderung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<JobcenterAufforderungOptionen>(spec);
  const r = rng(`${fall.id}:jobcenter_aufforderung:${p.id}`);
  const dat = o.datum ?? plusTage(fall.antragsdatum, -40);
  const frist = o.frist ?? plusTage(dat, 28);
  const kiz = o.kinderzuschlag ?? fall.personen.some((x) => alterAm(x.geburtsdatum, dat) < 18);
  const nr = o.aktenzeichen ?? bgNummer(r);
  const s = stelle(fall, r, o.stelle ?? `Jobcenter ${fall.wohnung.ort}`, 'Leistungen zur Sicherung des Lebensunterhalts', '#c8102e');
  const leistungen = kiz ? '<b>Wohngeld</b> bei der Wohngeldbehörde Ihrer Stadt und <b>Kinderzuschlag</b> bei der Familienkasse' : '<b>Wohngeld</b> bei der Wohngeldbehörde Ihrer Stadt';

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, seitenzahl: 'Seite 1 von 1',
    fuss: fussHtml(s, `BG-Nummer ${nr}`),
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Nummer der BG', nr], ['Ansprechpartner', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: 'Aufforderung zur Beantragung vorrangiger Leistungen (§ 12a SGB II)',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>Leistungen nach dem SGB II (Bürgergeld) sind nachrangig. Nach § 12a SGB II sind Sie verpflichtet, Sozialleistungen anderer
      Träger in Anspruch zu nehmen und die dafür erforderlichen Anträge zu stellen, sofern dies zur Vermeidung, Beseitigung, Verkürzung
      oder Verminderung der Hilfebedürftigkeit erforderlich ist.</p>
      <p>Nach Prüfung Ihrer Unterlagen kann Ihr Bedarf voraussichtlich durch vorrangige Leistungen gedeckt werden. Ich fordere Sie
      daher auf, ${leistungen} zu beantragen.</p>
      <div class="kasten">Bitte legen Sie mir <b>bis zum ${datum(frist)}</b> einen Nachweis über die Antragstellung
      (Eingangsbestätigung oder Kopie des Antrags) und, sobald vorhanden, den Bescheid vor.</div>
      <p>Sollten Sie den Antrag nicht fristgerecht stellen, kann das Jobcenter den Antrag nach § 5 Abs. 3 SGB II selbst stellen.
      Wirken Sie bei der Antragstellung nicht mit, können die Leistungen nach § 66 SGB I bis zur Nachholung der Mitwirkung ganz oder
      teilweise versagt werden.</p>
      <p>Bei Fragen erreichen Sie mich unter der oben genannten Telefonnummer.</p>
      <p style="margin-bottom:0">Mit freundlichen Grüßen<br>Im Auftrag</p>
      <div style="height:12mm">${unterschriftSvg(`${s.sachbearbeitung}${fall.id}jc`, 36)}</div>
      <p>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p>`,
  });
  return ergebnis('jobcenter_aufforderung', 'sonstiges', 'Jobcenter-Aufforderung § 12a SGB II', p, await pdf(s1, CSS_EXTRA));
}

// ── Arbeitslosengeld (SGB III) ──────────────────────────────────────────────

async function alg1Bescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<Alg1Optionen>(spec);
  const r = rng(`${fall.id}:alg1_bescheid:${p.id}`);
  const von = o.von ?? monatsErster(plusMonate(fall.antragsdatum, -3));
  const dauer = o.anspruchsdauer ?? 360;
  const prozent = o.prozent ?? (fall.personen.some((x) => alterAm(x.geburtsdatum, von) < 18) ? 67 : 60);
  const kl = p.beschaeftigung?.steuerklasse ?? 'I';
  const lstSatz: Record<string, number> = { I: 0.12, II: 0.1, III: 0.04, IV: 0.12, V: 0.21, VI: 0.23 };
  const abzugsquote = 0.2 + (lstSatz[kl] ?? 0.12);
  const monatAlg = einnahmeMonat(p, /arbeitslosengeld/i);
  let leistungssatz: number;
  let bemessung: number;
  if (o.leistungssatz ?? monatAlg) {
    leistungssatz = o.leistungssatz ?? rund2(monatAlg! / 30);
    bemessung = rund2(leistungssatz / (prozent / 100) / (1 - abzugsquote));
  } else {
    const brutto = o.bruttoMonat ?? einnahmeMonat(p, /gehalt|lohn/i) ?? ganz(r, 2400, 3400);
    bemessung = rund2((brutto * 12) / 365);
    leistungssatz = rund2(bemessung * (1 - abzugsquote) * (prozent / 100));
  }
  const leistungsentgelt = rund2(bemessung * (1 - abzugsquote));
  const monat = rund2(leistungssatz * 30);
  const dat = o.datum ?? plusTage(von, 12);
  const kdNr = o.aktenzeichen ?? `${ganz(r, 100, 999)}A${ganz(r, 100000, 999999)}`;
  const s = stelle(fall, r, o.stelle ?? `Agentur für Arbeit ${fall.wohnung.ort}`, 'Operativer Service', '#c8102e');
  s.telefon = '0800 4 5555 00';
  const fuss = fussHtml(s, `Kundennummer ${kdNr}`);

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Kundennummer', kdNr], ['Servicetelefon', s.telefon], ['Datum', datum(dat)]],
    betreff: 'Bewilligung von Arbeitslosengeld',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>auf Ihren Antrag bewillige ich Ihnen Arbeitslosengeld nach dem Dritten Buch Sozialgesetzbuch (SGB III)
      ab dem <b>${datum(von)}</b> für eine Anspruchsdauer von <b>${dauer} Kalendertagen</b>.</p>
      <table class="tab" style="margin:3mm 0 4mm">
        <tr><th>Berechnungsgrundlagen</th><th class="r">EUR</th></tr>
        <tr><td>Bemessungsentgelt täglich (§ 151 SGB III)</td><td class="r">${eur(bemessung)}</td></tr>
        <tr><td>Leistungsentgelt täglich (nach Abzug Sozialversicherungspauschale 20 %, Lohnsteuer Steuerklasse ${esc(kl)})</td><td class="r">${eur(leistungsentgelt)}</td></tr>
        <tr><td>Leistungssatz</td><td class="r">${prozent} %</td></tr>
        <tr class="summe"><td>Täglicher Leistungsbetrag</td><td class="r">${eur(leistungssatz)}</td></tr>
        <tr><td>Monatsbetrag (30 Kalendertage)</td><td class="r fett">${eur(monat)}</td></tr>
      </table>
      <p>Das Arbeitslosengeld wird monatlich nachträglich auf das Konto ${esc(ibanMaskiert(fall.bank.iban))} überwiesen.
      ${prozent === 67 ? 'Der erhöhte Leistungssatz wird berücksichtigt, weil mindestens ein Kind im Sinne des § 32 EStG in Ihrem Haushalt lebt.' : 'Es gilt der allgemeine Leistungssatz.'}</p>
      <p>Während des Leistungsbezugs sind Sie in der Kranken-, Pflege- und Rentenversicherung versichert.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Kundennummer ${esc(kdNr)} · Bescheid vom ${datum(dat)}`,
    inhalt: `<div class="folge">
      <p class="fett">Wichtige Hinweise</p>
      <p>Sie sind verpflichtet, der Agentur für Arbeit jede Änderung in Ihren Verhältnissen unverzüglich mitzuteilen, insbesondere
      die Aufnahme einer Beschäftigung oder selbständigen Tätigkeit (auch geringfügig), Arbeitsunfähigkeit, Ortsabwesenheit,
      Umzug oder den Bezug anderer Sozialleistungen (§ 60 SGB I).</p>
      <p>Ein Nebeneinkommen ist bis 165 Euro monatlich anrechnungsfrei; ein darüber hinausgehender Betrag mindert das Arbeitslosengeld.</p>
      <p>Die Leistung unterliegt dem Progressionsvorbehalt (§ 32b EStG). Die Agentur für Arbeit übermittelt die gezahlten Beträge
      nach Ablauf des Kalenderjahres an die Finanzverwaltung.</p>
      ${rechtsbehelf(s.name)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Ihre ${esc(s.name)}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('alg1_bescheid', 'verdienstbescheinigung', `Arbeitslosengeld-Bescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), monat);
}

// ── Pflegekasse ─────────────────────────────────────────────────────────────

const PFLEGE: Record<number, { geld: number; sach: number; stationaer: number; punkte: [number, number] }> = {
  1: { geld: 0, sach: 0, stationaer: 131, punkte: [12.5, 27] },
  2: { geld: 347, sach: 796, stationaer: 805, punkte: [27, 47.5] },
  3: { geld: 599, sach: 1497, stationaer: 1319, punkte: [47.5, 70] },
  4: { geld: 800, sach: 1859, stationaer: 1855, punkte: [70, 90] },
  5: { geld: 990, sach: 2299, stationaer: 2096, punkte: [90, 100] },
};

async function pflegebescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<PflegeOptionen>(spec);
  const r = rng(`${fall.id}:pflegebescheid:${p.id}`);
  const pg = Math.min(5, Math.max(1, Math.round(o.pflegegrad ?? 2)));
  const t = PFLEGE[pg]!;
  const stationaer = o.versorgung === 'stationaer';
  const dat = o.datum ?? plusTage(fall.antragsdatum, -ganz(r, 60, 200));
  const ab = o.ab ?? monatsErster(plusMonate(dat, -3));
  const leistung = o.pflegegeld ?? (stationaer ? t.stationaer : t.geld);
  const punkte = o.punkte ?? rund2(t.punkte[0] + (t.punkte[1] - t.punkte[0]) * (0.15 + r() * 0.7));
  const vnr = o.aktenzeichen ?? `${String.fromCharCode(65 + ganz(r, 0, 25))}${ganz(r, 100000000, 999999999)}`;
  const s = stelle(fall, r, o.stelle ?? `Pflegekasse bei der Gesundheitskasse ${region(fall.wohnung.plz)}`, 'Leistungszentrum Pflege', '#00785a');
  const fuss = fussHtml(s, `Versichertennummer ${vnr}`);

  // Modulpunkte (gewichtet) so verteilen, dass sie in Summe `punkte` ergeben.
  const module: Array<[string, number]> = [
    ['Modul 1: Mobilität', 10], ['Module 2/3: Kognitive und kommunikative Fähigkeiten / Verhaltensweisen', 15],
    ['Modul 4: Selbstversorgung', 40], ['Modul 5: Umgang mit krankheits- und therapiebedingten Anforderungen', 20],
    ['Modul 6: Gestaltung des Alltagslebens und sozialer Kontakte', 15],
  ];
  const anteil = punkte / 100;
  const werte = module.map(([, max]) => Math.min(max, rund2(max * anteil * (0.85 + r() * 0.3))));
  const rest = rund2(punkte - werte.reduce((a, b) => a + b, 0) + werte[2]!);
  werte[2] = Math.min(40, Math.max(0, rest));

  const leistungszeilen = stationaer
    ? `<tr><td>Leistungsbetrag bei vollstationärer Pflege (§ 43 SGB XI), Zahlung an die Einrichtung</td><td class="r">${eur(leistung)}</td></tr>`
    : pg === 1
      ? `<tr><td>Entlastungsbetrag (§ 45b SGB XI)</td><td class="r">${eur(131)}</td></tr>`
      : `<tr><td class="fett">Pflegegeld für selbst beschaffte Pflegehilfen (§ 37 SGB XI)</td><td class="r fett">${eur(leistung)}</td></tr>
         <tr><td>alternativ: Pflegesachleistung (§ 36 SGB XI) bis zu</td><td class="r">${eur(t.sach)}</td></tr>
         <tr><td>zusätzlich: Entlastungsbetrag (§ 45b SGB XI)</td><td class="r">${eur(131)}</td></tr>`;

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Versichertennummer', vnr], ['Ansprechpartner', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: `Bescheid über die Feststellung der Pflegebedürftigkeit – Pflegegrad ${pg}`,
    inhalt: `
      <p>${anrede(p)}</p>
      <p>auf Grundlage des Gutachtens des Medizinischen Dienstes stellen wir fest, dass bei Ihnen ab dem <b>${datum(ab)}</b>
      Pflegebedürftigkeit im Sinne des § 14 SGB XI vorliegt. Wir ordnen Sie dem</p>
      <div class="kasten" style="font-size:12pt;font-weight:bold;text-align:center">Pflegegrad ${pg}</div>
      <p>zu (Gesamtpunktzahl ${eur(punkte)} von 100). Die Pflege erfolgt ${stationaer ? 'vollstationär in einer Pflegeeinrichtung' : 'häuslich durch Angehörige bzw. selbst beschaffte Pflegepersonen'}.
      Ab dem ${datum(ab)} erhalten Sie folgende Leistungen:</p>
      <table class="tab" style="margin:2mm 0 4mm">
        <tr><th>Leistung</th><th class="r">EUR/Monat</th></tr>
        ${leistungszeilen}
      </table>
      <p>${stationaer ? 'Der Leistungsbetrag wird unmittelbar an die Pflegeeinrichtung gezahlt.' : `Das Pflegegeld wird monatlich im Voraus auf das Konto ${esc(ibanMaskiert(fall.bank.iban))} überwiesen.`}
      Der Bescheid gilt bis auf Weiteres.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Versichertennummer ${esc(vnr)} · Bescheid vom ${datum(dat)}`,
    inhalt: `<div class="folge">
      <p class="fett">Ergebnis der Begutachtung (gewichtete Punkte)</p>
      <table class="tab" style="margin:1mm 0 5mm">
        <tr><th>Modul</th><th class="r">max.</th><th class="r">Punkte</th></tr>
        ${module.map(([n, max], i) => `<tr><td>${esc(n)}</td><td class="r">${max}</td><td class="r">${eur(werte[i]!)}</td></tr>`).join('')}
        <tr class="summe"><td>Gesamtpunkte</td><td class="r">100</td><td class="r">${eur(punkte)}</td></tr>
      </table>
      ${!stationaer && pg >= 2 ? `<p class="fett">Beratungsbesuche</p>
      <p>Da Sie Pflegegeld beziehen, sind Sie verpflichtet, halbjährlich eine Beratung in der eigenen Häuslichkeit abzurufen
      (§ 37 Abs. 3 SGB XI). Wird die Beratung nicht abgerufen, kann das Pflegegeld gekürzt und im Wiederholungsfall entzogen werden.</p>` : ''}
      <p class="fett">Mitteilungspflichten</p>
      <p>Bitte teilen Sie uns Änderungen unverzüglich mit, z. B. einen Krankenhausaufenthalt über vier Wochen, einen Wechsel der
      Pflegeperson, den Umzug in eine Pflegeeinrichtung oder eine Änderung der Bankverbindung.</p>
      ${rechtsbehelf(s.name)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Ihre ${esc(s.name)}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('pflegebescheid', 'pflegenachweis', `Pflegegrad-Bescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), leistung > 0 ? leistung : undefined);
}

// ── Sterbegeld ──────────────────────────────────────────────────────────────

async function sterbegeldMitteilung(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<SterbegeldOptionen>(spec);
  const r = rng(`${fall.id}:sterbegeld_mitteilung:${p.id}`);
  const verstorbenPerson = o.verstorben ? personVon(fall, o.verstorben) : undefined;
  const verstorben = o.verstorbenName ?? (verstorbenPerson ? nameVon(verstorbenPerson)
    : `${p.geschlecht === 'weiblich' ? wahl(r, ['Heinz', 'Günter', 'Manfred', 'Klaus', 'Werner']) : wahl(r, ['Ingrid', 'Renate', 'Helga', 'Gisela', 'Monika'])} ${p.nachname}`);
  const sterbedatum = o.sterbedatum ?? plusMonate(fall.antragsdatum, -5);
  const auszahlung = o.auszahlung ?? plusTage(sterbedatum, 24);
  const dat = o.datum ?? plusTage(auszahlung, -2);
  const betrag = o.betrag ?? rund2(3000 + ganz(r, 8000, 42000) / 100);
  const summe = Math.min(betrag, Math.floor(betrag / 500) * 500) || betrag;
  const ueberschuss = rund2(betrag - summe);
  const vnr = o.aktenzeichen ?? `SV ${ganz(r, 100, 999)} ${ganz(r, 100, 999)} ${ganz(r, 10, 99)}`;
  const s = stelle(fall, r, o.stelle ?? `Sterbekasse ${region(fall.wohnung.plz)} VVaG`, 'Leistungsabteilung', '#4a4a4a');
  s.plzOrt = `${fall.wohnung.plz.slice(0, 2)}${ganz(r, 100, 999)} ${fall.wohnung.ort}`;

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, seitenzahl: 'Seite 1 von 1',
    fuss: fussHtml(s, `Versicherungsnummer ${vnr}`),
    ruecksendezeile: rs(s, `${s.name}, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Versicherungsnummer', vnr], ['Versicherte Person', verstorben], ['Ansprechpartner', s.sachbearbeitung], ['Datum', datum(dat)]],
    betreff: 'Auszahlung des Sterbegeldes',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>zunächst möchten wir Ihnen zum Tod von ${esc(verstorben)} unsere aufrichtige Anteilnahme aussprechen.</p>
      <p>Nach Vorlage der Sterbeurkunde haben wir den Leistungsfall geprüft. Die versicherte Person ist am ${datum(sterbedatum)}
      verstorben. Wir zahlen Ihnen als bezugsberechtigter Person das vereinbarte Sterbegeld einmalig aus:</p>
      <table class="tab" style="width:130mm;margin:2mm 0 4mm">
        <tr><th>Leistung</th><th class="r">EUR</th></tr>
        <tr><td>Versicherungssumme Sterbegeld</td><td class="r">${eur(summe)}</td></tr>
        <tr><td>Überschussbeteiligung (Schlussüberschuss)</td><td class="r">${eur(ueberschuss)}</td></tr>
        <tr class="summe"><td>Auszahlungsbetrag (einmalig)</td><td class="r">${eur(betrag)}</td></tr>
      </table>
      <p>Den Betrag haben wir am <b>${datum(auszahlung)}</b> auf Ihr Konto ${esc(ibanMaskiert(fall.bank.iban))} bei der
      ${esc(fall.bank.name)} überwiesen. Mit der Auszahlung ist der Versicherungsvertrag erloschen.</p>
      <p>Die Leistung ist nicht einkommensteuerpflichtig. Bitte bewahren Sie dieses Schreiben als Nachweis auf.</p>
      <p style="margin-bottom:0">Mit freundlichen Grüßen<br>${esc(s.name)}</p>
      <div style="height:12mm">${unterschriftSvg(`${s.sachbearbeitung}${fall.id}sg`, 36)}</div>
      <p>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}, Leistungsabteilung</p>`,
  });
  return ergebnis('sterbegeld_mitteilung', 'sonstiges', 'Sterbegeld-Mitteilung', p, await pdf(s1, CSS_EXTRA), betrag);
}

// ── Kita-Gebührenbescheid ───────────────────────────────────────────────────

async function kitaGebuehrenbescheid(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const p = personVon(fall, spec.person);
  const o = opt<KitaOptionen>(spec);
  const r = rng(`${fall.id}:kita_gebuehrenbescheid:${p.id}`);
  const [ay, am] = fall.antragsdatum.split('-').map(Number);
  const ab = o.ab ?? `${am! >= 8 ? ay : ay! - 1}-08-01`;
  const dat = o.datum ?? plusTage(ab, -18);
  const kinder = o.kinder ? o.kinder.map((id) => personVon(fall, id))
    : fall.personen.filter((x) => x.id !== 'P1' && alterAm(x.geburtsdatum, ab) < 7);
  if (!kinder.length) throw new Error(`${fall.id}: Kita-Gebührenbescheid ohne Kinder unter 7 Jahren`);
  const erster = o.beitrag ?? ganz(r, 16, 34) * 10 + wahl(r, [0, 5]);
  const erm = o.geschwisterermaessigung ?? 50;
  const essen = o.essensgeld ?? 72;
  const umfang = o.umfang ?? 'Ganztag, bis 45 Std./Woche';
  const einrichtung = o.einrichtung ?? `Kindertagesstätte ${wahl(r, ['Sonnenblume', 'Regenbogen', 'Pusteblume', 'Am Stadtpark', 'Kunterbunt'])}`;
  const beitraege = kinder.map((_, i) => (i === 0 ? erster : rund2(erster * (1 - erm / 100))));
  const summe = rund2(beitraege.reduce((a, b) => a + b, 0));
  const essenSumme = rund2(essen * kinder.length);
  const jahresEinkommen = fall.personen.reduce((a, x) => a + x.einnahmen.reduce((b, e) => b + (e.turnus === 'monatlich' ? e.brutto * 12 : e.turnus === 'jährlich' ? e.brutto : 0), 0), 0);
  const stufen: Array<[number, number]> = [[0, 25000], [25000, 37500], [37500, 50000], [50000, 62500], [62500, 75000], [75000, Infinity]];
  const stufeIdx = stufen.findIndex(([u, ob]) => jahresEinkommen >= u && jahresEinkommen < ob);
  const [su, so] = stufen[stufeIdx]!;
  const kz = o.aktenzeichen ?? `51.2-KT-${ganz(r, 10000, 99999)}`;
  const s = stelle(fall, r, o.stelle ?? `Stadt ${fall.wohnung.ort}`, 'Amt für Jugend und Familie – Kita-Beiträge', '#1f5fa8');
  const fuss = fussHtml(s, `Kassenzeichen ${kz}`);

  const s1 = brief({
    kopf: kopfHtml(s), farbe: s.farbe, fuss, seitenzahl: 'Seite 1 von 2',
    ruecksendezeile: rs(s, `${s.name} · Amt für Jugend und Familie, ${s.strasse}, ${s.plzOrt}`),
    empfaenger: empfaenger(fall, p),
    info: [['Kassenzeichen', kz], ['Sachbearbeitung', s.sachbearbeitung], ['Telefon', s.telefon], ['Datum', datum(dat)]],
    betreff: 'Bescheid über die Festsetzung des Elternbeitrags für die Kindertagesbetreuung',
    inhalt: `
      <p>${anrede(p)}</p>
      <p>für die Betreuung in der Einrichtung <b>${esc(einrichtung)}</b> wird der monatliche Elternbeitrag nach der Satzung über die
      Erhebung von Elternbeiträgen für Kindertageseinrichtungen der Stadt ${esc(fall.wohnung.ort)} ab dem <b>${datum(ab)}</b> wie folgt festgesetzt:</p>
      <table class="tab" style="margin:3mm 0 3mm">
        <tr><th>Kind</th><th>geb. am</th><th>Betreuungsumfang</th><th class="r">Betreuungsbeitrag EUR</th></tr>
        ${kinder.map((k, i) => `<tr><td>${esc(nameVon(k))}</td><td>${datum(k.geburtsdatum)}</td><td>${esc(umfang)}${i > 0 ? ` (Geschwisterermäßigung ${erm} %)` : ''}</td><td class="r">${eur(beitraege[i]!)}</td></tr>`).join('')}
        <tr class="summe"><td colspan="3">Betreuungsbeitrag monatlich</td><td class="r">${eur(summe)}</td></tr>
      </table>
      <p>Zusätzlich zum Betreuungsbeitrag wird ein <b>Verpflegungsentgelt</b> (Mittagessen) erhoben. Es ist nicht Teil des
      Elternbeitrags und wird gesondert ausgewiesen:</p>
      <table class="tab" style="width:130mm;margin:1mm 0 4mm">
        <tr><td>Verpflegungsentgelt ${kinder.length > 1 ? `${kinder.length} × ${eur(essen)} EUR` : ''}</td><td class="r">${eur(essenSumme)}</td></tr>
        <tr class="summe"><td>Gesamt zu zahlen monatlich</td><td class="r">${eur(rund2(summe + essenSumme))}</td></tr>
      </table>
      <p>Die Beträge sind jeweils zum 5. eines Monats fällig und werden per SEPA-Lastschrift vom Konto ${esc(ibanMaskiert(fall.bank.iban))} eingezogen.</p>`,
  });
  const s2 = folgeseite({
    farbe: s.farbe, fuss, seitenzahl: 'Seite 2 von 2',
    kopfKlein: `${esc(s.name)} · Kita-Beiträge · Kassenzeichen ${esc(kz)}`,
    inhalt: `<div class="folge">
      <p class="fett">Begründung</p>
      <p>Die Höhe des Elternbeitrags richtet sich nach dem Jahreseinkommen der Eltern, dem Betreuungsumfang und der Zahl der
      gleichzeitig betreuten Kinder. Nach den vorgelegten Einkommensnachweisen ist Ihr Haushalt der
      <b>Einkommensstufe ${stufeIdx + 1}</b> (${Number.isFinite(so) ? `über ${eur(su)} bis ${eur(so)} EUR` : `über ${eur(su)} EUR`} Jahreseinkommen) zuzuordnen.
      Für das zweite und jedes weitere gleichzeitig betreute Kind ermäßigt sich der Beitrag um ${erm} %.</p>
      <p>Der Beitrag ist für jeden angefangenen Monat des Betreuungsverhältnisses in voller Höhe zu entrichten, auch während der
      Schließzeiten der Einrichtung.</p>
      <p class="fett">Hinweise</p>
      <p>Änderungen Ihres Einkommens um mehr als 10 %, der Familienverhältnisse oder des Betreuungsumfangs sind unverzüglich
      mitzuteilen. Bei Bezug von Wohngeld, Kinderzuschlag oder Leistungen nach dem SGB II kann auf Antrag eine Befreiung vom
      Elternbeitrag erfolgen (§ 90 Abs. 4 SGB VIII). Das Verpflegungsentgelt kann über Leistungen für Bildung und Teilhabe
      bezuschusst werden.</p>
      ${rechtsbehelf(`${s.name}, Amt für Jugend und Familie`)}
      <p style="margin-top:5mm">Mit freundlichen Grüßen<br>Im Auftrag<br>${esc(s.sachbearbeitung.replace(/^(Frau|Herr) /, ''))}</p>
      <p class="klein">Dieser Bescheid wurde maschinell erstellt und ist ohne Unterschrift gültig.</p></div>`,
  });
  return ergebnis('kita_gebuehrenbescheid', 'sonstiges', `Kita-Gebührenbescheid ${p.nachname}`, p, await pdf(s1 + s2, CSS_EXTRA), summe);
}

// ── Registrierung ───────────────────────────────────────────────────────────

export const GENERATOREN_BESCHEIDE: Partial<Record<DokArt, Generator>> = {
  kindergeldbescheid,
  uvs_bescheid: uvsBescheid,
  elterngeldbescheid,
  bafoeg_bescheid: bafoegBescheid,
  buergergeld_bescheid: buergergeldBescheid,
  jobcenter_ablehnung: jobcenterAblehnung,
  jobcenter_aufforderung: jobcenterAufforderung,
  alg1_bescheid: alg1Bescheid,
  pflegebescheid,
  sterbegeld_mitteilung: sterbegeldMitteilung,
  kita_gebuehrenbescheid: kitaGebuehrenbescheid,
};
