/**
 * Grundsicherung — gemeinsame, reine Helfer der Regel-Engine (Prüfkontext, Formatierung,
 * Dokument-Zugriff, abgeleitete Merkmale). Keine DB, kein LLM.
 */
import { dayPart, toUtcDay } from '../../_antrag-kern/datum';
import { altersgrenzeErreichtAm, altersgrenzeMonat } from '../altersgrenze';
import { berechneBwzVorschlag } from '../bwz';
import {
  analyseVon, EINKOMMENS_ARTEN, VERMOEGENS_ARTEN,
  type Dokument, type DokumentAnalyseJeTyp, type DokumentTyp, type Person, type Vorgang, type VorgangSnapshot,
} from '../types';
import { KONSTANTEN, type GrundsicherungKonstanten } from './konstanten';

export interface PruefOptionen {
  /** „Heute" (ISO) — Stichtag, wenn kein Antragsdatum erfasst ist. Default: aktuelles Datum. */
  heute?: string;
  /** Abweichende Schwellen (Tests, Konfiguration). */
  konstanten?: Partial<GrundsicherungKonstanten>;
}

export interface PruefKontext {
  vorgang: Vorgang;
  personen: Person[];
  dokumente: Dokument[];
  /** Einsatzgemeinschaft: Antragsteller:in + Partner:in. */
  eg: Person[];
  antragsteller?: Person;
  partner?: Person;
  /** Weitere Haushaltsangehörige (nur Kopfteil/Plausibilität). */
  haushaltsangehoerige: Person[];
  /** Maßgebliches Antragsdatum (früheres von Ersteingang § 16 Abs. 2 SGB I und Antragsdatum). */
  antragsdatum?: string;
  /** Antragsdatum, sonst heute. */
  stichtag: string;
  /** Bewilligungszeitraum (erfasst oder Vorschlag 12 Monate). */
  bwz: { start: string; ende: string } | null;
  k: GrundsicherungKonstanten;
}

export function baueKontext(snapshot: VorgangSnapshot, optionen: PruefOptionen = {}): PruefKontext {
  const { vorgang, personen, dokumente } = snapshot;
  const eg = personen.filter((p) => p.rolle === 'antragsteller' || p.rolle === 'partner');
  const kandidaten = [dayPart(vorgang.antragsdatum), dayPart(vorgang.ersteingang?.datum)].filter((d): d is string => !!d).sort();
  const antragsdatum = kandidaten[0];
  const heute = dayPart(optionen.heute) ?? new Date().toISOString().slice(0, 10);
  const erfasst = vorgang.bwz?.start && vorgang.bwz?.ende ? { start: vorgang.bwz.start, ende: vorgang.bwz.ende } : null;
  return {
    vorgang, personen, dokumente, eg,
    antragsteller: personen.find((p) => p.rolle === 'antragsteller'),
    partner: personen.find((p) => p.rolle === 'partner'),
    haushaltsangehoerige: personen.filter((p) => p.rolle === 'haushaltsangehoerig'),
    antragsdatum,
    stichtag: antragsdatum ?? heute,
    bwz: erfasst ?? berechneBwzVorschlag(antragsdatum),
    k: { ...KONSTANTEN, ...(optionen.konstanten ?? {}) },
  };
}

// ── Formatierung ────────────────────────────────────────────────────────────

export function euro(n: number | undefined): string {
  return typeof n === 'number'
    ? n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    : '—';
}

/** ISO → TT.MM.JJJJ. */
export function fmtDatum(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return '—';
  const [y, m, t] = d.split('-');
  return `${t}.${m}.${y}`;
}

/** ISO → MM/JJJJ. */
export function fmtMonat(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return '—';
  const [y, m] = d.split('-');
  return `${m}/${y}`;
}

export function personLabel(p?: Person): string {
  if (!p) return 'die betreffende Person';
  return `${p.vorname} ${p.nachname}`.trim() || (p.rolle === 'partner' ? 'Partner:in' : 'Antragsteller:in');
}

/** „Kontoauszug 05/2026" o. ä. als Quellenangabe. */
export function dokLabel(d: Dokument, bezeichnung: string): string {
  const k = analyseVon(d, 'kontoauszug');
  const monat = k?.zeitraum_bis ?? k?.zeitraum_von;
  if (monat) return `${bezeichnung} ${fmtMonat(monat)}`;
  return d.titel?.trim() ? `${bezeichnung} „${d.titel.trim()}"` : bezeichnung;
}

// ── Datum ───────────────────────────────────────────────────────────────────

/** Monat (`YYYY-MM`) eines ISO-Datums. */
export function monatVon(iso?: string): string | null {
  return dayPart(iso)?.slice(0, 7) ?? null;
}

/** Nächster Monat (`YYYY-MM`). */
export function folgemonat(monat: string): string {
  const [y, m] = monat.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Monate zwischen zwei ISO-Daten (a vor b), grob über Tage/30,44. */
export function monateZwischen(a: string, b: string): number {
  return (toUtcDay(b) - toUtcDay(a)) / (24 * 60 * 60 * 1000) / 30.44;
}

export function tageInklusive(von: string, bis: string): number {
  return Math.round((toUtcDay(bis) - toUtcDay(von)) / (24 * 60 * 60 * 1000)) + 1;
}

// ── Dokumente ───────────────────────────────────────────────────────────────

export function docs(ctx: PruefKontext, typ: DokumentTyp): Dokument[] {
  return ctx.dokumente.filter((d) => d.typ === typ);
}

/** Dokumente eines Typs, die der Person zugeordnet sind. */
export function docsFuer(ctx: PruefKontext, typ: DokumentTyp, personId: string): Dokument[] {
  return ctx.dokumente.filter((d) => d.typ === typ && d.personId === personId);
}

/** Dokumente eines Typs für die Person ODER ohne Personenzuordnung (Haushaltsdokument). */
export function docsFuerOderOhne(ctx: PruefKontext, typ: DokumentTyp, personId: string): Dokument[] {
  return ctx.dokumente.filter((d) => d.typ === typ && (d.personId === personId || !d.personId));
}

/** Analysen aller Dokumente eines Typs (mit Dokument). */
export function analysen<T extends DokumentTyp>(list: Dokument[], typ: T): Array<{ dok: Dokument; a: DokumentAnalyseJeTyp[T] }> {
  return list.flatMap((dok) => {
    const a = analyseVon(dok, typ);
    return a ? [{ dok, a }] : [];
  });
}

// ── Personenmerkmale ────────────────────────────────────────────────────────

export function hatEinkommensart(p: Person, arten: readonly string[]): boolean {
  return (p.einkommen ?? []).some((e) => arten.includes(e.art));
}

export function einkommenBetrag(p: Person, arten: readonly string[]): number | undefined {
  const pos = (p.einkommen ?? []).filter((e) => arten.includes(e.art) && typeof e.betrag_monat === 'number');
  return pos.length ? pos.reduce((s, e) => s + (e.betrag_monat ?? 0), 0) : undefined;
}

export function beziehtGesetzlicheRente(p: Person): boolean {
  return hatEinkommensart(p, EINKOMMENS_ARTEN.gesetzlicheRente);
}

/** Geburtsdatum aus Angabe, sonst Ausweis, sonst Rentenbescheid. */
export function geburtsdatumBelegt(ctx: PruefKontext, p: Person): string | undefined {
  if (dayPart(p.geburtsdatum)) return dayPart(p.geburtsdatum)!;
  for (const { a } of analysen(docsFuer(ctx, 'personalausweis', p.id), 'personalausweis')) if (dayPart(a.geburtsdatum)) return dayPart(a.geburtsdatum)!;
  for (const { a } of analysen(docsFuer(ctx, 'rentenbescheid', p.id), 'rentenbescheid')) if (dayPart(a.geburtsdatum)) return dayPart(a.geburtsdatum)!;
  return undefined;
}

/** Altersgrenze bis Ende des Stichtagsmonats erreicht? `null` = unbekannt. */
export function altersgrenzeErreicht(ctx: PruefKontext, p: Person): boolean | null {
  const monat = altersgrenzeMonat(geburtsdatumBelegt(ctx, p));
  return monat ? monat <= ctx.stichtag.slice(0, 7) : null;
}

export { altersgrenzeErreichtAm };

/** Alter in vollen Jahren am Stichtag (für Minderjährigkeit/Plausibilität). */
export function alterAm(geburtsdatum: string | undefined, stichtag: string): number | null {
  const g = dayPart(geburtsdatum);
  const s = dayPart(stichtag);
  if (!g || !s) return null;
  const [gy, gm, gd] = g.split('-').map(Number) as [number, number, number];
  const [sy, sm, sd] = s.split('-').map(Number) as [number, number, number];
  return sy - gy - ((sm < gm || (sm === gm && sd < gd)) ? 1 : 0);
}

/**
 * Ist Erwerbsminderung für diese Person der Anspruchsgrund? Antragsteller:in bei Anspruchsgrund
 * „erwerbsminderung"; Partner:in, wenn Erwerbsminderung erfasst ist und die Altersgrenze nicht
 * erreicht ist.
 */
export function emIstAnspruchsgrund(ctx: PruefKontext, p: Person): boolean {
  if (p.rolle === 'antragsteller') return ctx.vorgang.anspruchsgrund === 'erwerbsminderung';
  if (p.rolle === 'partner') return !!p.erwerbsminderung && altersgrenzeErreicht(ctx, p) === false;
  return false;
}

export interface EmBefund {
  /** Befristung (Bescheid bzw. Angabe). */
  befristet?: { bis?: string; quelle: string; dokId?: string };
  /** Teilweise EM oder Arbeitsmarktrente. */
  teilweiseOderArbeitsmarkt?: { grund: 'teilweise' | 'arbeitsmarkt'; quelle: string; dokId?: string };
  /** Unbefristete, volle, arbeitsmarktunabhängige EM-Rente durch Bescheid belegt. */
  dauerhaftBelegt: boolean;
  /** RV-Feststellung liegt vor (Dokument). */
  feststellung?: { dauerhaft?: boolean; dokId: string };
}

/** Auswertung der EM-Nachweise einer Person (Rentenbescheid, RV-Feststellung, Angaben). */
export function emBefund(ctx: PruefKontext, p: Person): EmBefund {
  const out: EmBefund = { dauerhaftBelegt: false };
  for (const { dok, a } of analysen(docsFuer(ctx, 'rentenbescheid', p.id), 'rentenbescheid')) {
    if (a.rentenart !== 'volle_em' && a.rentenart !== 'teilweise_em') continue;
    const befristet = !!dayPart(a.befristet_bis) || a.unbefristet === false;
    if (befristet && !out.befristet) out.befristet = { bis: dayPart(a.befristet_bis) ?? undefined, quelle: 'Rentenbescheid', dokId: dok.id };
    if (a.rentenart === 'teilweise_em' && !out.teilweiseOderArbeitsmarkt) out.teilweiseOderArbeitsmarkt = { grund: 'teilweise', quelle: 'Rentenbescheid', dokId: dok.id };
    else if (a.arbeitsmarktabhaengig === true && !out.teilweiseOderArbeitsmarkt) out.teilweiseOderArbeitsmarkt = { grund: 'arbeitsmarkt', quelle: 'Rentenbescheid', dokId: dok.id };
    if (a.rentenart === 'volle_em' && !befristet && a.arbeitsmarktabhaengig !== true && a.unbefristet === true) out.dauerhaftBelegt = true;
  }
  const em = p.erwerbsminderung;
  if (em) {
    if (!out.befristet && dayPart(em.befristet_bis)) out.befristet = { bis: dayPart(em.befristet_bis)!, quelle: 'Angabe im Antrag' };
    if (!out.teilweiseOderArbeitsmarkt && em.voll === false) out.teilweiseOderArbeitsmarkt = { grund: 'teilweise', quelle: 'Angabe im Antrag' };
    if (!out.teilweiseOderArbeitsmarkt && em.arbeitsmarktabhaengig === true) out.teilweiseOderArbeitsmarkt = { grund: 'arbeitsmarkt', quelle: 'Angabe im Antrag' };
  }
  const fest = analysen(docsFuer(ctx, 'em_feststellung_rv', p.id), 'em_feststellung_rv')[0];
  const festDok = fest?.dok ?? docsFuer(ctx, 'em_feststellung_rv', p.id)[0];
  if (festDok) out.feststellung = { dauerhaft: fest?.a.dauerhaft_voll_erwerbsgemindert, dokId: festDok.id };
  if (out.feststellung?.dauerhaft === true) out.dauerhaftBelegt = true;
  return out;
}

// ── Vermögen ────────────────────────────────────────────────────────────────

export interface VermoegenUebersicht {
  /** Summe der angegebenen Barvermögenspositionen der Einsatzgemeinschaft (ohne Schonvermögen). */
  angaben: number;
  /** Summe der belegten Stände (Vermögensnachweise + letzter Endsaldo je Konto). */
  nachweise: number;
  /** Maßgeblicher Wert = das Höhere von beidem (keine Addition, um Doppelzählung zu vermeiden). */
  wert: number;
  quellen: string[];
  /** Barbetrag der Einsatzgemeinschaft. */
  schonbetrag: number;
  volljaehrige: number;
  unterhaltene: number;
}

function istBarvermoegen(art: string): boolean {
  return !(VERMOEGENS_ARTEN.keinBarvermoegen as readonly string[]).includes(art);
}

export function vermoegenUebersicht(ctx: PruefKontext): VermoegenUebersicht {
  const egIds = new Set(ctx.eg.map((p) => p.id));
  const quellen: string[] = [];
  let angaben = 0;
  for (const p of ctx.eg) {
    for (const v of p.vermoegen ?? []) {
      if (v.schonvermoegen || !istBarvermoegen(v.art) || typeof v.betrag !== 'number') continue;
      angaben += v.betrag;
    }
  }
  if (angaben > 0) quellen.push(`Angaben im Antrag ${euro(angaben)}`);

  let nachweise = 0;
  const egDoc = (d: Dokument) => !d.personId || egIds.has(d.personId);
  for (const { dok, a } of analysen(docs(ctx, 'vermoegensnachweis').filter(egDoc), 'vermoegensnachweis')) {
    if (a.art === 'riester') continue;
    const wert = typeof a.rueckkaufswert === 'number' ? a.rueckkaufswert : a.stand;
    if (typeof wert === 'number') {
      nachweise += wert;
      quellen.push(`${dokLabel(dok, 'Vermögensnachweis')}${a.art ? ` (${a.art})` : ''}: ${euro(wert)}`);
    }
  }
  // letzter Endsaldo je Konto (IBAN, sonst je Dokument)
  const jeKonto = new Map<string, { bis: string; saldo: number; dok: Dokument }>();
  for (const { dok, a } of analysen(docs(ctx, 'kontoauszug').filter(egDoc), 'kontoauszug')) {
    if (typeof a.endsaldo !== 'number') continue;
    const key = a.iban?.replace(/\s+/g, '') || dok.id;
    const bis = dayPart(a.zeitraum_bis) ?? '';
    const vorher = jeKonto.get(key);
    if (!vorher || bis > vorher.bis) jeKonto.set(key, { bis, saldo: a.endsaldo, dok });
  }
  for (const { saldo, dok } of jeKonto.values()) {
    if (saldo <= 0) continue;
    nachweise += saldo;
    quellen.push(`${dokLabel(dok, 'Kontoauszug')}: Endsaldo ${euro(saldo)}`);
  }

  const volljaehrige = ctx.eg.filter((p) => (alterAm(p.geburtsdatum, ctx.stichtag) ?? 99) >= 18).length || 1;
  const unterhaltene = ctx.haushaltsangehoerige.filter((p) => (alterAm(p.geburtsdatum, ctx.stichtag) ?? 99) < 18).length;
  const schonbetrag = volljaehrige * ctx.k.SCHONBETRAG_JE_PERSON + unterhaltene * ctx.k.SCHONBETRAG_UNTERHALTENE;
  return { angaben, nachweise, wert: Math.max(angaben, nachweise), quellen, schonbetrag, volljaehrige, unterhaltene };
}

// ── Wohnen ──────────────────────────────────────────────────────────────────

export function istMietwohnung(v: Vorgang): boolean {
  return v.wohnsituation === 'miete' || v.wohnsituation === 'untermiete';
}

/** Eigene Wohnung (Miete, Untermiete, Eigentum) — Heizkosten und Warmwasser relevant. */
export function istEigeneWohnung(v: Vorgang): boolean {
  return istMietwohnung(v) || v.wohnsituation === 'eigentum';
}

/** Toleranz für Mietvergleiche: das Größere aus Prozent- und Euro-Toleranz. */
export function mietToleranz(ctx: PruefKontext, basis: number): number {
  return Math.max(ctx.k.MIETE_TOLERANZ_EUR, Math.abs(basis) * ctx.k.MIETE_TOLERANZ_PROZENT);
}

/** Namensvergleich (Groß-/Kleinschreibung, Umlaute grob, Leerraum). */
export function normName(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Passt ein Name („Vorname Nachname" oder „Nachname, Vorname") zu einer Person? */
export function nameGehoertZu(name: string, p: Person): boolean {
  const n = normName(name);
  const nach = normName(p.nachname);
  const vor = normName(p.vorname).split(' ')[0] ?? '';
  return !!nach && n.includes(nach) && (!vor || n.includes(vor));
}
