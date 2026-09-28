/**
 * Wohngeld — Abgleich Antragsangaben ↔ eingereichte Belege (Plausibilität).
 *
 * Reine Funktionen, kein LLM, keine Berechnung von Wohngeld. Jede Regel vergleicht einen Wert
 * aus dem Antrag (Vorgang/Person) mit einem Wert aus einem Beleg (`dokument.analyse`, Felder laut
 * DokumentAnalyse-Vertrag in types.ts) und feuert nur, wenn BEIDE Seiten einen Wert haben.
 * Belegtexte nennen beide Werte und die Quelle; personenbezogene Befunde tragen `personId`.
 *
 * Spec: docs/wohngeld-antrag-beleg-abgleich-spec-2026-09-28.md
 * Katalog: regeln.ts (Wächter-Test regeln.test.ts).
 */
import { dayPart } from '../../kern/datum';
import { haushaltsVermoegen, vermoegensFreigrenze } from '../einkommen';
import { fastGleich, nachnameGleich, normName, vornameGleich } from '../haushalt';
import { normDate } from '../matching';
import type { Dokument, DokumentAnalyse, DokumentTyp, Einkommensposition, KontoEingangArt, Person, PruefBefund, VorgangSnapshot } from '../types';
import {
  ERSTATTUNG_STICHWOERTER, KEIN_EINKOMMEN_STICHWOERTER, KONSTANTEN, PFLEGEGELD_STICHWOERTER, toleranz, TRANSFER_STICHWOERTER,
  UMBUCHUNG_STICHWOERTER, type WohngeldKonstanten,
} from './konstanten';

const P = 'plausibilitaet' as const;

export interface AbgleichOptionen {
  /** Abweichende Schwellen (Tests, Konfiguration). */
  konstanten?: Partial<WohngeldKonstanten>;
}

// ── Formatierung ────────────────────────────────────────────────────────────

export function euro(n: number | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—';
}
function fmtDatum(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return '—';
  const [y, m, t] = d.split('-');
  return `${t}.${m}.${y}`;
}
function fmtMonat(monat?: string): string | undefined {
  const m = monat?.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : undefined;
}
function personLabel(p: Person): string {
  return `${p.vorname} ${p.nachname}`.trim() || 'die betreffende Person';
}

const TYP_LABEL: Partial<Record<DokumentTyp, string>> = {
  personalausweis: 'Ausweis', rentenbescheid: 'Rentenbescheid', gehaltsabrechnung: 'Gehaltsabrechnung',
  verdienstbescheinigung: 'Verdienstbescheinigung', kv_pv_nachweis: 'Versicherungsnachweis',
  schwerbehindertenausweis: 'Schwerbehindertenausweis', pflegenachweis: 'Pflegebescheid',
  kontoauszug: 'Kontoauszug', vermoegensnachweis: 'Vermögensnachweis', kindergeldnachweis: 'Kindergeldbescheid',
  unterhaltsnachweis: 'Unterhaltsnachweis', transferleistungsbescheid: 'Bescheid',
};

/** Quellenangabe eines Belegs, z. B. „Kontoauszug 07/2026", „Gehaltsabrechnung 06/2026". */
function dokLabel(d: Dokument): string {
  const a = d.analyse ?? {};
  const basis = d.typ === 'mietvertrag' || d.typ === 'mietbescheinigung' ? mietLabel(d) : TYP_LABEL[d.typ] ?? 'Beleg';
  const monat = fmtMonat(a.abrechnungsmonat) ?? (d.typ === 'kontoauszug' ? fmtMonat(dayPart(a.zeitraum_bis) ?? undefined) : undefined);
  if (monat) return `${basis} ${monat}`;
  return basis;
}

const mitAnalyse = (dokumente: Dokument[], ...typen: DokumentTyp[]) =>
  dokumente.filter((d): d is Dokument & { analyse: DokumentAnalyse } => typen.includes(d.typ) && !!d.analyse);

// ── Miete ───────────────────────────────────────────────────────────────────

type MietArt = NonNullable<DokumentAnalyse['mietdokument']>;
const MIET_LABEL: Record<MietArt, string> = {
  vermieterbescheinigung: 'Vermieterbescheinigung', mietvertrag: 'Mietvertrag', mieterhoehung: 'Mieterhöhung',
  untermietvertrag: 'Untermietvertrag', heimvertrag: 'Heimvertrag',
};
/** Aktualität ohne Datum: die Vermieterbescheinigung wird für den Antrag ausgestellt, die Mieterhöhung ändert den Vertrag. */
const MIET_RANG: Record<MietArt, number> = { vermieterbescheinigung: 3, mieterhoehung: 2, mietvertrag: 1, untermietvertrag: 1, heimvertrag: 1 };

function mietArt(d: Dokument): MietArt {
  return d.analyse?.mietdokument ?? (d.typ === 'mietbescheinigung' ? 'vermieterbescheinigung' : 'mietvertrag');
}
function mietLabel(d: Dokument): string {
  return MIET_LABEL[mietArt(d)];
}

/** Ist `b` aktueller als `a`? Datum (gültig ab) vor Dokumentart vor Reihenfolge im Vorgang. */
function aktueller(a: Dokument, b: Dokument): boolean {
  const da = dayPart(a.analyse?.miete_gueltig_ab), db = dayPart(b.analyse?.miete_gueltig_ab);
  if (da && db && da !== db) return db > da;
  const ra = MIET_RANG[mietArt(a)], rb = MIET_RANG[mietArt(b)];
  if (ra !== rb) return rb > ra;
  return true;
}

/**
 * Das maßgebliche (aktuellste) Mietdokument unter den Kandidaten. Ein Untermietvertrag zählt nur,
 * wenn kein anderes Mietdokument vorliegt (sonst ist die antragstellende Person meist Untervermieter).
 */
export function massgeblichesMietdokument(kandidaten: Dokument[]): Dokument | undefined {
  const ohneUntermiete = kandidaten.filter((d) => mietArt(d) !== 'untermietvertrag');
  const liste = ohneUntermiete.length ? ohneUntermiete : kandidaten;
  return liste.reduce<Dokument | undefined>((best, d) => (!best || aktueller(best, d) ? d : best), undefined);
}

function pruefeMiete(snapshot: VorgangSnapshot, k: WohngeldKonstanten): PruefBefund[] {
  const { vorgang, dokumente } = snapshot;
  const befunde: PruefBefund[] = [];
  const w = vorgang.wohnung ?? {};
  const miet = mitAnalyse(dokumente, 'mietvertrag', 'mietbescheinigung');
  const mietTol = (basis: number) => toleranz(k.MIETE_TOLERANZ_EUR, k.MIETE_TOLERANZ_PROZENT, basis);
  const antragHw = (w.heizkosten ?? 0) + (w.warmwasser ?? 0);

  // Miethöhe: Antrag (Bruttokaltmiete) ↔ maßgebliches Mietdokument.
  const mitMiete = miet.filter((d) => typeof d.analyse.miete === 'number');
  const m = massgeblichesMietdokument(mitMiete);
  if (m && typeof w.miete === 'number') {
    const beleg = m.analyse!.miete!;
    const diff = Math.abs(beleg - w.miete);
    // Abweichung genau in Höhe der Heiz-/Warmwasserkosten: Gesamt- statt Bruttokaltmiete gelesen, kein Widerspruch.
    const heizungErklaert = [m.analyse!.heizkosten_warmwasser ?? 0, antragHw]
      .some((hw) => hw > 0 && Math.abs(diff - hw) <= mietTol(hw));
    if (diff > mietTol(beleg) && !heizungErklaert) {
      const seit = dayPart(m.analyse!.miete_gueltig_ab) ? ` (gültig ab ${fmtDatum(m.analyse!.miete_gueltig_ab)})` : '';
      const aeltere = mitMiete.filter((d) => d !== m && Math.abs(d.analyse.miete! - beleg) > mietTol(beleg));
      const aeltereText = aeltere.length ? ` Weitere Mietunterlagen nennen ${aeltere.map((d) => `${euro(d.analyse.miete)} (${mietLabel(d)})`).join(', ')}.` : '';
      befunde.push({
        regelId: 'plausi-miethoehe-abweichung', kategorie: P, typ: 'anforderung',
        titel: 'Miethöhe klären',
        belegtext: `Maßgeblich ist die ${mietLabel(m)}${seit} mit einer Bruttokaltmiete von ${euro(beleg)}, im Antrag sind ${euro(w.miete)} angegeben. `
          + `Die Differenz von ${euro(diff)} ist zu klären.${aeltereText} Aktuelle Miethöhe (z. B. Mieterhöhung) feststellen und im Vorgang eintragen (§§ 9, 11 WoGG).`,
        quellDokumentId: m.id,
      });
    }
  }

  // Wohnfläche: Antrag ↔ maßgebliches Mietdokument mit Flächenangabe.
  const f = massgeblichesMietdokument(miet.filter((d) => typeof d.analyse.wohnflaeche_qm === 'number'));
  if (f && typeof w.wohnflaeche_qm === 'number' && Math.abs(f.analyse!.wohnflaeche_qm! - w.wohnflaeche_qm) >= 0.01) {
    befunde.push({
      regelId: 'plausi-wohnflaeche-abweichung', kategorie: P, typ: 'info',
      titel: 'Wohnfläche prüfen',
      belegtext: `Wohnfläche im Antrag (${w.wohnflaeche_qm} m²) weicht von der ${mietLabel(f)} (${f.analyse!.wohnflaeche_qm} m²) ab.`,
      quellDokumentId: f.id,
    });
  }

  // Mietzahlung auf dem Kontoauszug ↔ Antrag-Miete (Zahlung enthält meist auch Heizung/Warmwasser).
  if (typeof w.miete === 'number') {
    const hwWerte = [antragHw, m?.analyse?.heizkosten_warmwasser ?? 0].filter((x) => x > 0);
    // Passt die Zahlung zum maßgeblichen Mietdokument, meldet schon die Miethöhe den Widerspruch (keine Doppelmeldung).
    const belegMiete = m?.analyse?.miete;
    const erwartet = [w.miete, ...hwWerte.map((hw) => w.miete! + hw),
      ...(typeof belegMiete === 'number' ? [belegMiete, ...hwWerte.map((hw) => belegMiete + hw)] : [])];
    const abweichend: Array<{ dok: Dokument; betrag: number }> = [];
    for (const d of mitAnalyse(dokumente, 'kontoauszug')) {
      const z = d.analyse.mietzahlung_betrag;
      if (typeof z !== 'number' || z <= 0) continue;
      const passt = hwWerte.length
        ? erwartet.some((e) => Math.abs(z - e) <= mietTol(e))
        : z >= w.miete - mietTol(w.miete); // ohne bekannte Heizkosten: nur eine zu niedrige Zahlung ist ein Widerspruch
      if (!passt) abweichend.push({ dok: d, betrag: z });
    }
    if (abweichend.length) {
      const soll = hwWerte.length ? `${euro(w.miete)} Bruttokaltmiete bzw. ${euro(w.miete + hwWerte[0]!)} einschließlich Heizung/Warmwasser` : `${euro(w.miete)} Bruttokaltmiete`;
      befunde.push({
        regelId: 'plausi-mietzahlung-abweichung', kategorie: P, typ: 'info',
        titel: 'Mietzahlung weicht von der Miete ab',
        belegtext: `Laut Antrag beträgt die Miete ${soll}; abgebucht wurden ${abweichend.map((x) => `${euro(x.betrag)} (${dokLabel(x.dok)})`).join(', ')}. `
          + 'Klären, ob sich die Miete geändert hat, Teil- oder Nachzahlungen vorliegen oder weitere Kosten enthalten sind (§ 9 WoGG).',
        quellDokumentId: abweichend[0]!.dok.id,
      });
    }
  }
  return befunde;
}

// ── Einkommen je Person ─────────────────────────────────────────────────────

/** Monatswert einer Antragsposition (jährlich → ÷ 12); ohne Betrag undefined. */
export function monatswert(e: Einkommensposition): number | undefined {
  if (typeof e.betrag_monatlich === 'number') return e.betrag_monatlich;
  if (typeof e.betrag_jaehrlich === 'number') return e.betrag_jaehrlich / 12;
  return undefined;
}
/** Summe der Monatswerte; fehlt ein Betrag, ist die Angabe unvollständig ⇒ undefined. */
function summeMonatlich(pos: Einkommensposition[]): number | undefined {
  if (!pos.length) return undefined;
  const werte = pos.map(monatswert);
  return werte.every((x): x is number => typeof x === 'number') ? werte.reduce((s, x) => s + x, 0) : undefined;
}
const bez = (e: Einkommensposition) => (e.bezeichnung ?? '').toLowerCase();
/** Einmal-/Sonderzahlungen und Lohnersatz (Kurzarbeitergeld) stehen nicht im Monatsbrutto der Abrechnung. */
const SONDERZAHLUNG = /weihnacht|urlaubsgeld|sonderzahl|einmal|abfindung|bonus|prämie|praemie|13\.|nachzahl|kurzarbeitergeld|\bkug\b/;
/** Renten, die kein Bescheid der gesetzlichen Rentenversicherung ausweist. */
const NICHT_GESETZLICHE_RENTE = /betriebs|zusatz|vbl|zvk|pensionskasse|riester|privat|werks|beamt|pension|ruhegehalt|versorgungswerk|ausland/;

type RentenKategorie = 'alter' | 'hinterbliebene' | 'waise' | 'em' | 'unbestimmt';
function rentenKategorie(text?: string): RentenKategorie {
  const t = normName(text);
  if (!t) return 'unbestimmt';
  if (/witw|hinterblieb/.test(t)) return 'hinterbliebene';
  if (/waise/.test(t)) return 'waise';
  if (/erwerbsminder|\bem\b/.test(t)) return 'em';
  if (/alter|regel|rente|vollrente|schwerbehind/.test(t)) return 'alter';
  return 'unbestimmt';
}
/** Neuester Beleg nach „gültig ab", sonst der letzte im Vorgang. */
function neuester(list: Dokument[]): Dokument | undefined {
  return list.reduce<Dokument | undefined>((best, d) => {
    if (!best) return d;
    const a = dayPart(best.analyse?.betrag_gueltig_ab), b = dayPart(d.analyse?.betrag_gueltig_ab);
    return a && b && a !== b ? (b > a ? d : best) : d;
  }, undefined);
}

function pruefeRente(p: Person, dokumente: Dokument[], k: WohngeldKonstanten): PruefBefund[] {
  const pos = (p.einkommen ?? []).filter((e) => e.art === 'rente' && !NICHT_GESETZLICHE_RENTE.test(bez(e)));
  if (!pos.length) return [];
  const bescheide = mitAnalyse(dokumente, 'rentenbescheid')
    .filter((d) => d.personId === p.id && (typeof d.analyse.betrag === 'number' || typeof d.analyse.zahlbetrag === 'number'));
  if (!bescheide.length) return [];
  const gruppen = new Map<RentenKategorie, Dokument[]>();
  for (const d of bescheide) {
    const kat = rentenKategorie(d.analyse.rentenart);
    gruppen.set(kat, [...(gruppen.get(kat) ?? []), d]);
  }
  const eineKategorie = gruppen.size === 1;
  const brutto: string[] = [], zahl: string[] = [];
  let quellBrutto: string | undefined, quellZahl: string | undefined;
  for (const [kat, docs] of gruppen) {
    const d = neuester(docs)!;
    const antragPos = pos.filter((e) => { const ek = rentenKategorie(e.bezeichnung); return ek === kat || (eineKategorie && (ek === 'unbestimmt' || kat === 'unbestimmt')); });
    const antrag = summeMonatlich(antragPos);
    if (antrag === undefined) continue;
    const a = d.analyse!;
    const quelle = `${dokLabel(d)}${a.rentenart ? ` (${a.rentenart})` : ''}${dayPart(a.betrag_gueltig_ab) ? ` ab ${fmtDatum(a.betrag_gueltig_ab)}` : ''}`;
    if (typeof a.betrag === 'number') {
      if (Math.abs(antrag - a.betrag) > k.RENTE_TOLERANZ_EUR) {
        brutto.push(`Antrag ${euro(antrag)}, laut ${quelle} ${euro(a.betrag)} brutto`);
        quellBrutto ??= d.id;
      }
    } else if (typeof a.zahlbetrag === 'number') {
      const plausibel = antrag >= a.zahlbetrag - k.RENTE_TOLERANZ_EUR && antrag <= a.zahlbetrag * k.RENTE_BRUTTO_ZAHLBETRAG_FAKTOR + k.RENTE_TOLERANZ_EUR;
      if (!plausibel) {
        zahl.push(`Antrag ${euro(antrag)} brutto, laut ${quelle} Zahlbetrag ${euro(a.zahlbetrag)}`);
        quellZahl ??= d.id;
      }
    }
  }
  const out: PruefBefund[] = [];
  if (brutto.length) {
    out.push({
      regelId: 'plausi-rente-abweichung', personId: p.id, kategorie: P, typ: 'anforderung',
      titel: 'Rentenbetrag weicht ab',
      belegtext: `Die Rentenangabe von ${personLabel(p)} passt nicht zum Rentenbescheid — ${brutto.join('; ')}. `
        + 'Aktuelle Bruttorente klären (z. B. Rentenanpassung zum 01.07.) und die Angabe berichtigen lassen (§ 14 WoGG).',
      quellDokumentId: quellBrutto,
    });
  }
  if (zahl.length) {
    out.push({
      regelId: 'plausi-rente-zahlbetrag-pruefen', personId: p.id, kategorie: P, typ: 'info',
      titel: 'Rentenhöhe prüfen (nur Zahlbetrag belegt)',
      belegtext: `Für ${personLabel(p)} weist der Bescheid nur den Zahlbetrag (nach Kranken-/Pflegeversicherung) aus — ${zahl.join('; ')}. `
        + `Die Bruttorente liegt üblicherweise bis zu ${Math.round((k.RENTE_BRUTTO_ZAHLBETRAG_FAKTOR - 1) * 100)} % über dem Zahlbetrag; die Angabe liegt außerhalb dieser Spanne. Bruttorente klären (§ 14 WoGG).`,
      quellDokumentId: quellZahl,
    });
  }
  return out;
}

const EINKOMMEN_LABEL: Record<string, string> = {
  lohn_gehalt: 'Erwerbseinkommen', alg1: 'Arbeitslosengeld', krankengeld: 'Krankengeld', elterngeld: 'Elterngeld',
};

function pruefeErwerbUndLohnersatz(p: Person, dokumente: Dokument[], k: WohngeldKonstanten): PruefBefund[] {
  const out: PruefBefund[] = [];
  const tol = (basis: number) => toleranz(k.EINKOMMEN_TOLERANZ_EUR, k.EINKOMMEN_TOLERANZ_PROZENT, basis);
  const eigene = dokumente.filter((d) => d.personId === p.id);
  /** Meldet, wenn `vergleich` außerhalb der Toleranz liegt; genannt wird `anzeige` (Standard: derselbe Wert). */
  const melde = (art: string, antrag: number, vergleich: number, quelle: string, dokId: string, zusatz = '', anzeige = vergleich) => {
    if (Math.abs(antrag - vergleich) <= tol(vergleich)) return;
    const beleg = anzeige;
    const diff = Math.abs(antrag - beleg);
    out.push({
      regelId: `plausi-einkommen-abweichung:${art}`, personId: p.id, kategorie: P, typ: 'anforderung',
      titel: `${EINKOMMEN_LABEL[art] ?? 'Einkommen'} weicht vom Nachweis ab`,
      belegtext: `Für ${personLabel(p)} ist im Antrag ${EINKOMMEN_LABEL[art] ?? 'Einkommen'} von ${euro(antrag)} monatlich angegeben, laut ${quelle} sind es ${euro(beleg)}${zusatz}. `
        + `Die Differenz von ${euro(diff)} ist zu klären; aktuelles Einkommen und Nachweise anfordern (§§ 14, 15 WoGG).`,
      quellDokumentId: dokId,
    });
  };

  // Erwerbseinkommen (Brutto): Gehaltsabrechnungen, sonst Verdienstbescheinigung.
  const lohnPos = (p.einkommen ?? []).filter((e) => e.art === 'lohn_gehalt' && !SONDERZAHLUNG.test(bez(e)));
  const lohnAntrag = summeMonatlich(lohnPos);
  if (lohnAntrag !== undefined) {
    const abr = mitAnalyse(eigene, 'gehaltsabrechnung')
      .filter((d) => typeof d.analyse.betrag === 'number' && (!d.analyse.einkommensart || d.analyse.einkommensart === 'lohn_gehalt'));
    const vb = mitAnalyse(eigene, 'verdienstbescheinigung')
      .filter((d) => typeof d.analyse.betrag === 'number' && d.analyse.einkommensart === 'lohn_gehalt');
    const ohneMonat = abr.some((d) => !d.analyse.abrechnungsmonat);
    if (abr.length && !(lohnPos.length > 1 && ohneMonat)) {
      // Je Monat summieren (mehrere Arbeitgeber); maßgeblich ist der aktuelle Stand: der letzte Monat
      // UND der Durchschnitt der letzten drei Monate müssen beide abweichen (Schwankungen, Kurzarbeit).
      const jeMonat = new Map<string, number>();
      for (const d of abr) jeMonat.set(d.analyse.abrechnungsmonat ?? d.id, (jeMonat.get(d.analyse.abrechnungsmonat ?? d.id) ?? 0) + d.analyse.betrag!);
      const monate = [...jeMonat.keys()];
      if (!ohneMonat) monate.sort();
      const letzte = monate.slice(-3).map((m) => jeMonat.get(m)!);
      const letzter = letzte.at(-1)!;
      const mittel3 = Math.round((letzte.reduce((s, x) => s + x, 0) / letzte.length) * 100) / 100;
      const tolL = toleranz(k.EINKOMMEN_TOLERANZ_EUR, k.EINKOMMEN_TOLERANZ_PROZENT, letzter);
      if (Math.abs(lohnAntrag - letzter) > tolL) {
        const letzterMonat = ohneMonat ? undefined : fmtMonat(monate.at(-1));
        const quelle = `Gehaltsabrechnung${letzterMonat ? ` ${letzterMonat}` : ' (zuletzt vorgelegt)'}`;
        const zusatz = letzte.length > 1 ? ` brutto (Durchschnitt der letzten ${letzte.length} Abrechnungen: ${euro(mittel3)})` : ' brutto';
        const dokLetzt = abr.filter((d) => (d.analyse.abrechnungsmonat ?? d.id) === monate.at(-1)).at(-1) ?? abr.at(-1)!;
        melde('lohn_gehalt', lohnAntrag, letzte.length > 1 ? mittel3 : letzter, quelle, dokLetzt.id, zusatz, letzter);
      }
    } else if (!abr.length && vb.length && !(lohnPos.length > 1 && vb.length < lohnPos.length)) {
      // Je Arbeitgeber die letzte Bescheinigung, summiert.
      const jeAg = new Map<string, Dokument>();
      for (const d of vb) jeAg.set(normName(d.analyse.arbeitgeber) || '_', d);
      const summe = [...jeAg.values()].reduce((s, d) => s + d.analyse!.betrag!, 0);
      melde('lohn_gehalt', lohnAntrag, summe, jeAg.size === 1 ? 'Verdienstbescheinigung' : `${jeAg.size} Verdienstbescheinigungen`, vb[0]!.id, ' brutto');
    }
  }

  // Lohnersatzleistungen: Bescheid mit erkannter Leistungsart.
  for (const art of ['alg1', 'krankengeld', 'elterngeld']) {
    const antrag = summeMonatlich((p.einkommen ?? []).filter((e) => e.art === art));
    if (antrag === undefined) continue;
    const d = neuester(mitAnalyse(eigene, 'verdienstbescheinigung').filter((x) => x.analyse.einkommensart === art && typeof x.analyse.betrag === 'number'));
    if (d) melde(art, antrag, d.analyse!.betrag!, `Bescheid (${EINKOMMEN_LABEL[art]})`, d.id);
  }
  return out;
}

// ── Kontoauszug: nicht angegebene Eingänge ─────────────────────────────────

const STOPP = new Set(['gmbh', 'mbh', 'ohg', 'gbr', 'kg', 'ag', 'co', 'und', 'the', 'holding', 'gruppe', 'group', 'service', 'services',
  'lohn', 'gehalt', 'verdienst', 'zum', 'zur', 'der', 'die', 'das', 'von', 'fuer', 'ev', 'eg', 'se', 'kgaa', 'ug', 'e', 'v']);
const tokens = (s?: string) => normName(s).split(/[\s-]+/).filter((t) => t.length >= 3 && !STOPP.has(t));
/** Absender-Schlüssel: die ersten zwei aussagekräftigen Wörter. */
const absenderKey = (s?: string) => tokens(s).slice(0, 2).join(' ');

/** Welche Einkommensarten im Antrag erklären einen Eingang dieser Art? `null` = nie melden. */
const ERKLAERT_DURCH: Record<KontoEingangArt, readonly string[] | null> = {
  erwerb: ['lohn_gehalt', 'selbststaendig'],
  rente: ['rente'], betriebsrente: ['rente'],
  unterhalt: ['unterhalt'],
  kapitalertrag: ['kapitalertraege'],
  miete_einnahme: ['v_und_v', '_untermietvertrag'],
  // Zuschüsse Dritter stehen im Antrag unter Frage 26, die das Profil nicht ausliest — kein Vergleich.
  zuwendung: null,
  sozialleistung: ['alg1', 'krankengeld', 'elterngeld', 'sonstiges', '_transfer'],
  kindergeld: null, wohngeld: null, erstattung: null, sonstige: null,
};
const EINGANG_LABEL: Record<KontoEingangArt, string> = {
  erwerb: 'Erwerbseinkommen', rente: 'Rente', betriebsrente: 'Betriebsrente', unterhalt: 'Unterhalt',
  kapitalertrag: 'Kapitalerträge', miete_einnahme: 'Mieteinnahmen', zuwendung: 'Zuwendungen', sozialleistung: 'Sozialleistung',
  kindergeld: 'Kindergeld', wohngeld: 'Wohngeld', erstattung: 'Erstattung', sonstige: 'Sonstiges',
};
/** Kapitalerträge zählen auch einmalig (wie die Einkunftsarten-Regel). */
const AUCH_EINMALIG: ReadonlySet<KontoEingangArt> = new Set(['kapitalertrag']);

const enthaeltStichwort = (text: string, liste: readonly string[]) => liste.some((w) => text.includes(w));
/** Arten, bei denen ein Haushaltsmitglied als Absender eine interne Zahlung bedeutet (Mietanteil, Kostenbeteiligung). */
const INTERN_MOEGLICH: ReadonlySet<KontoEingangArt> = new Set(['miete_einnahme', 'zuwendung', 'sonstige', 'erstattung']);

/**
 * Grund, aus dem ein Kontoeingang kein zu erklärendes Einkommen ist — oder undefined.
 * Jede Ausnahme ist konkret (Stichwortlisten in konstanten.ts, eigene IBAN, Haushaltsmitglied) und
 * wird im Belegtext genannt, wenn die Regel für die Person meldet. Keine Blanko-Unterdrückung.
 */
export function eingangAusnahme(
  e: { art?: KontoEingangArt; verwendungszweck?: string },
  ctx: { ibans: ReadonlySet<string>; personen: Person[]; arten: ReadonlySet<string> },
): string | undefined {
  const zweck = e.verwendungszweck ?? '';
  const t = normName(zweck.replace(/[/.,;:]/g, ' '));
  const kompakt = zweck.replace(/\s+/g, '').toUpperCase();
  if (enthaeltStichwort(t, UMBUCHUNG_STICHWOERTER) || [...ctx.ibans].some((iban) => iban.length >= 15 && kompakt.includes(iban))) return 'Umbuchung zwischen eigenen Konten';
  if (enthaeltStichwort(t, ERSTATTUNG_STICHWOERTER)) return 'Erstattung/Rückbuchung';
  if (enthaeltStichwort(t, KEIN_EINKOMMEN_STICHWOERTER)) return 'Kindergeld/Wohngeld, kein Einkommen nach § 14 WoGG';
  if (enthaeltStichwort(t, PFLEGEGELD_STICHWOERTER) && ctx.personen.some((p) => (p.pflege_behinderung?.pflegegrad ?? 0) > 0 || p.pflege_behinderung?.pflegebeduerftig)) return 'Pflegegeld bei erfasstem Pflegegrad';
  if (!e.art || INTERN_MOEGLICH.has(e.art)) {
    const woerter = new Set(t.split(/[\s-]+/));
    const mitglied = ctx.personen.find((p) => {
      const vn = normName(p.vorname).split(/[\s-]+/)[0], nn = normName(p.nachname).split(/[\s-]+/);
      return !!vn && vn.length >= 2 && woerter.has(vn) && nn.some((n) => n.length >= 2 && woerter.has(n));
    });
    if (mitglied) return `Zahlung von ${personLabel(mitglied)} (Haushaltsmitglied)`;
  }
  if (enthaeltStichwort(t, TRANSFER_STICHWOERTER) && ['_transfer', 'alg1', 'sonstiges'].some((a) => ctx.arten.has(a))) return 'im Antrag angegebene Transferleistung';
  return undefined;
}

function pruefeKontoEingaenge(snapshot: VorgangSnapshot): PruefBefund[] {
  const { personen, dokumente } = snapshot;
  const arten = new Set(personen.flatMap((p) => (p.einkommen ?? []).map((e) => e.art)));
  if (personen.some((p) => (p.ausschluesse?.length ?? 0) > 0 || (p.transferleistungenDetail?.length ?? 0) > 0)) arten.add('_transfer');
  const ibans = new Set(mitAnalyse(dokumente, 'kontoauszug').map((d) => d.analyse.iban?.replace(/\s+/g, '').toUpperCase()).filter((x): x is string => !!x));
  const ausnahme = (e: { art?: KontoEingangArt; verwendungszweck?: string }) => eingangAusnahme(e, { ibans, personen, arten });
  // Untervermietung ist mit dem Untermietvertrag belegt (Antrag Fragen 28/29, nicht Frage 12).
  if (dokumente.some((d) => d.analyse?.mietdokument === 'untermietvertrag')) arten.add('_untermietvertrag');

  // Arbeitgeber mit Nachweis. Geprüft wird ein Erwerbseingang nur, wenn jede Person mit angegebenem
  // Erwerbseinkommen einen Nachweis mit lesbarem Arbeitgeber hat (sonst meldet schon die Vollständigkeit).
  const lohnNachweise = dokumente.filter((d) => d.typ === 'gehaltsabrechnung' || (d.typ === 'verdienstbescheinigung' && d.analyse?.einkommensart === 'lohn_gehalt'));
  // Je Person mindestens so viele Arbeitgeber mit Nachweis wie angegebene Beschäftigungen.
  const alleNachgewiesen = lohnNachweise.length > 0 && lohnNachweise.every((d) => !!d.analyse?.arbeitgeber)
    && personen.every((p) => {
      const beschaeftigungen = (p.einkommen ?? []).filter((e) => e.art === 'lohn_gehalt' && !SONDERZAHLUNG.test(bez(e))).length;
      const ag = new Set(lohnNachweise.filter((d) => d.personId === p.id).map((d) => normName(d.analyse?.arbeitgeber)));
      return ag.size >= beschaeftigungen;
    });
  const arbeitgeber = lohnNachweise.map((d) => tokens(d.analyse?.arbeitgeber)).filter((t) => t.length);
  const vomArbeitgeber = (zweck?: string) => { const z = new Set(tokens(zweck)); return arbeitgeber.some((ag) => ag.some((t) => z.has(t))); };

  const gruppen = new Map<string, Dokument[]>();
  for (const d of mitAnalyse(dokumente, 'kontoauszug')) {
    if (!d.analyse.eingaenge?.length) continue;
    const key = d.personId ?? '';
    gruppen.set(key, [...(gruppen.get(key) ?? []), d]);
  }
  const out: PruefBefund[] = [];
  for (const [personId, docs] of gruppen) {
    // Absender, die auf irgendeinem Auszug als erklärt/ausgenommen gelesen wurden (z. B. einmal „Zuschuss",
    // einmal nur der Name), bleiben insgesamt außen vor — die Art-Einordnung des Modells schwankt.
    const unauffaellig = new Set<string>();
    const artVon = (e: { art?: KontoEingangArt; verwendungszweck?: string }): KontoEingangArt | undefined =>
      !e.art || !e.verwendungszweck ? undefined : /zuschuss/.test(normName(e.verwendungszweck)) ? 'zuwendung' : e.art;
    // Ausnahmen (Umbuchung, Erstattung, Haushaltsmitglied …). Im Belegtext genannt werden die, die die
    // Regel nach der gelesenen Art sonst gemeldet hätte — nachvollziehbar statt still verworfen.
    const ausgenommen = new Map<string, string>();
    const erwaehnen = new Map<string, string>();
    for (const d of docs) for (const e of d.analyse!.eingaenge!) {
      const grund = ausnahme(e);
      if (grund && e.verwendungszweck) {
        ausgenommen.set(e.verwendungszweck, grund);
        const a = artVon(e), erk = a ? ERKLAERT_DURCH[a] : null;
        if (erk && !erk.some((x) => arten.has(x))) erwaehnen.set(e.verwendungszweck, grund);
        continue;
      }
      const art = artVon(e);
      if (!art) continue;
      const erk = ERKLAERT_DURCH[art];
      if (erk === null || (erk.some((a) => arten.has(a)) && art !== 'erwerb')) unauffaellig.add(absenderKey(e.verwendungszweck));
    }
    // Je Absender sammeln (über alle Auszüge der Person).
    const jeAbsender = new Map<string, { art: KontoEingangArt; zweck: string; betraege: number[]; docs: Dokument[]; wiederkehrend: boolean; grund?: string }>();
    for (const d of docs) {
      for (const e of d.analyse!.eingaenge!) {
        // „Zuschuss" im Verwendungszweck ist ein Zuschuss Dritter (Frage 26), auch wenn als Miete gelesen.
        const art = artVon(e);
        if (!art || !e.verwendungszweck || ausgenommen.has(e.verwendungszweck)) continue;
        const erklaerer = ERKLAERT_DURCH[art];
        if (erklaerer === null || (absenderKey(e.verwendungszweck) && unauffaellig.has(absenderKey(e.verwendungszweck)))) continue;
        let grund: string | undefined;
        if (!erklaerer.some((a) => arten.has(a))) grund = 'im Antrag keine entsprechende Einkommensart';
        else if (art === 'erwerb' && alleNachgewiesen && !vomArbeitgeber(e.verwendungszweck)) grund = 'kein Nachweis dieses Arbeitgebers';
        if (!grund) continue;
        const key = absenderKey(e.verwendungszweck) || normName(e.verwendungszweck);
        const g = jeAbsender.get(key) ?? { art, zweck: e.verwendungszweck, betraege: [], docs: [], wiederkehrend: false, grund };
        if (typeof e.betrag === 'number') g.betraege.push(e.betrag);
        if (!g.docs.includes(d)) g.docs.push(d);
        if (e.wiederkehrend === true || (e.anzahl ?? 0) > 1) g.wiederkehrend = true;
        jeAbsender.set(key, g);
      }
    }
    const treffer = [...jeAbsender.values()].filter((g) => g.wiederkehrend || g.docs.length > 1 || AUCH_EINMALIG.has(g.art));
    if (!treffer.length) continue;
    const p = personen.find((x) => x.id === personId);
    const teile = treffer.map((g) => {
      const betraege = [...new Set(g.betraege.map((b) => euro(b)))];
      return `„${g.zweck}"${betraege.length ? ` à ${betraege.join(' / ')}` : ''} (${g.docs.map(dokLabel).join(', ')}; ${EINGANG_LABEL[g.art]} — ${g.grund})`;
    });
    const nichtGemeldet = [...erwaehnen.entries()].map(([zweck, grund]) => `„${zweck}" (${grund})`);
    out.push({
      regelId: 'plausi-kontoauszug-unerklaerte-eingaenge', ...(p ? { personId: p.id } : {}), kategorie: P, typ: 'anforderung',
      titel: 'Nicht angegebene Eingänge auf dem Konto',
      belegtext: `Auf dem Konto${p ? ` von ${personLabel(p)}` : ''} gehen Zahlungen ein, die im Antrag nicht als Einkommen erscheinen: ${teile.join('; ')}. `
        + 'Herkunft klären, ggf. als Einkommen erfassen und Nachweise anfordern (§ 14 WoGG).'
        + (nichtGemeldet.length ? ` Nicht als Einkommen gewertet: ${nichtGemeldet.join('; ')}.` : ''),
      quellDokumentId: treffer[0]!.docs[0]!.id,
    });
  }
  return out;
}

// ── Vermögen ↔ Kontostand/Vermögensnachweise ───────────────────────────────

/**
 * Durch Belege ausgewiesenes Vermögen: Vermögensnachweise (`betrag`) + letzter positiver Endsaldo je
 * Konto (IBAN; Auszüge ohne IBAN gelten als ein Konto). Gemeinsame Quelle für
 * `plausi-vermoegen-beleg-abweichung` und den Vorrang-Hinweis Grundsicherung.
 */
export function belegtesVermoegen(dokumente: Dokument[]): { summe: number; quellen: string[]; quellDok?: string } {
  const quellen: string[] = [];
  let belegt = 0;
  let quellDok: string | undefined;
  for (const d of mitAnalyse(dokumente, 'vermoegensnachweis')) {
    if (typeof d.analyse.betrag !== 'number' || d.analyse.betrag <= 0) continue;
    belegt += d.analyse.betrag;
    quellen.push(`${d.titel?.trim() || 'Vermögensnachweis'}: ${euro(d.analyse.betrag)}`);
    quellDok ??= d.id;
  }
  // Letzter Endsaldo je Konto (IBAN; Auszüge ohne IBAN gelten als ein Konto — nie doppelt zählen).
  const jeKonto = new Map<string, Dokument>();
  for (const d of mitAnalyse(dokumente, 'kontoauszug')) {
    if (typeof d.analyse.endsaldo !== 'number') continue;
    const key = d.analyse.iban || '_';
    const vorher = jeKonto.get(key);
    const a = dayPart(vorher?.analyse?.zeitraum_bis), b = dayPart(d.analyse.zeitraum_bis);
    if (!vorher || !(a && b && b < a)) jeKonto.set(key, d);
  }
  for (const d of jeKonto.values()) {
    const saldo = d.analyse!.endsaldo!;
    if (saldo <= 0) continue;
    belegt += saldo;
    quellen.push(`${dokLabel(d)}: Endsaldo ${euro(saldo)}`);
    quellDok ??= d.id;
  }
  return { summe: Math.round(belegt * 100) / 100, quellen, quellDok };
}

function pruefeVermoegen(snapshot: VorgangSnapshot, k: WohngeldKonstanten): PruefBefund[] {
  const { personen, dokumente } = snapshot;
  const { summe: belegt, quellen, quellDok } = belegtesVermoegen(dokumente);
  if (belegt <= 0 || !personen.length) return [];
  const angabe = haushaltsVermoegen(personen);
  const n = personen.length;
  const freigrenze = vermoegensFreigrenze(n);
  const hatAntrag = dokumente.some((d) => d.typ === 'wohngeldantrag');
  let text: string | undefined;
  if (angabe > 0) {
    if (belegt - angabe > toleranz(k.VERMOEGEN_TOLERANZ_EUR, k.VERMOEGEN_TOLERANZ_PROZENT, angabe)) {
      text = `Im Antrag ist ein Vermögen von ${euro(angabe)} angegeben, die Belege weisen ${euro(belegt)} aus (${quellen.join('; ')}). Vermögensangabe klären und berichtigen lassen (§ 21 Nr. 3 WoGG).`;
    }
  } else if (hatAntrag && belegt > freigrenze) {
    text = `Im Antrag ist kein Vermögen über der Freigrenze angegeben (Frage 20), die Belege weisen zusammen ${euro(belegt)} aus (${quellen.join('; ')}) — mehr als die Freigrenze von ${euro(freigrenze)} für ${n} Haushaltsmitglied${n === 1 ? '' : 'er'}. `
      + 'Vermögensangabe berichtigen lassen, Vermögen erfassen und Zweckerklärung anfordern (§ 21 Nr. 3 WoGG).';
  }
  return text ? [{
    regelId: 'plausi-vermoegen-beleg-abweichung', kategorie: P, typ: 'anforderung',
    titel: 'Vermögensangabe weicht von den Belegen ab', belegtext: text, quellDokumentId: quellDok,
  }] : [];
}

// ── Identität ───────────────────────────────────────────────────────────────

function nachnamePasst(beleg: string | undefined, p: Person): boolean {
  if (!beleg) return true;
  return [p.nachname, p.geburtsname].some((n) => !!n && (nachnameGleich(beleg, n) || fastGleich(normName(beleg), normName(n))));
}
function vornamePasst(beleg: string | undefined, p: Person): boolean {
  if (!beleg || !p.vorname) return true;
  return vornameGleich(beleg, p.vorname) || fastGleich(normName(beleg), normName(p.vorname));
}

/** Belege, deren Namensangabe sich auf die Person selbst bezieht (nicht Kontoinhaber, Zahlungsempfänger …). */
const NAMENS_TYPEN: ReadonlySet<DokumentTyp> = new Set<DokumentTyp>([
  'personalausweis', 'rentenbescheid', 'gehaltsabrechnung', 'verdienstbescheinigung', 'kv_pv_nachweis',
  'schwerbehindertenausweis', 'pflegenachweis',
]);

function pruefeIdentitaet(snapshot: VorgangSnapshot): PruefBefund[] {
  const out: PruefBefund[] = [];
  for (const p of snapshot.personen) {
    const docs = mitAnalyse(snapshot.dokumente, ...([...NAMENS_TYPEN, 'kontoauszug', 'kindergeldnachweis', 'unterhaltsnachweis', 'transferleistungsbescheid', 'vermoegensnachweis'] as DokumentTyp[]))
      .filter((d) => d.personId === p.id);
    const geb = normDate(p.geburtsdatum);
    if (/^\d{4}-\d{2}-\d{2}$/.test(geb)) {
      const abw = docs.filter((d) => { const g = normDate(d.analyse.person_geburtsdatum); return /^\d{4}-\d{2}-\d{2}$/.test(g) && g !== geb; });
      if (abw.length) {
        out.push({
          regelId: 'plausi-geburtsdatum-abweichung', personId: p.id, kategorie: P, typ: 'anforderung',
          titel: 'Geburtsdatum weicht ab',
          belegtext: `Das Geburtsdatum von ${personLabel(p)} ist uneinheitlich: Antrag ${fmtDatum(geb)}, ${abw.map((d) => `${dokLabel(d)} ${fmtDatum(normDate(d.analyse.person_geburtsdatum))}`).join(', ')}. `
            + 'Richtiges Datum klären und die Zuordnung des Belegs prüfen — es bestimmt u. a., ob die Person volljährig ist und welche Nachweise nötig sind (§ 60 SGB I).',
          quellDokumentId: abw[0]!.id,
        });
      }
    }
    const nameAbw = docs.filter((d) => NAMENS_TYPEN.has(d.typ)
      && (d.analyse.person_nachname || d.analyse.person_vorname)
      && (!nachnamePasst(d.analyse.person_nachname, p) || !vornamePasst(d.analyse.person_vorname, p)));
    if (nameAbw.length && (p.nachname || p.vorname)) {
      out.push({
        regelId: 'plausi-name-abweichung', personId: p.id, kategorie: P, typ: 'info',
        titel: 'Name im Beleg weicht ab',
        belegtext: `Im Antrag heißt die Person „${personLabel(p)}", ${nameAbw.map((d) => `im Beleg ${dokLabel(d)} „${[d.analyse.person_vorname, d.analyse.person_nachname].filter(Boolean).join(' ')}"`).join(', ')}. `
          + 'Prüfen, ob der Beleg zu dieser Person gehört (Namensänderung, Geburtsname, Schreibweise).',
        quellDokumentId: nameAbw[0]!.id,
      });
    }
  }
  return out;
}

// ── Haushalt ↔ Mietvertrag ──────────────────────────────────────────────────

function pruefeMieterImHaushalt(snapshot: VorgangSnapshot): PruefBefund[] {
  const { personen, dokumente } = snapshot;
  if (!personen.length) return [];
  const fehlend: Array<{ name: string; dok: Dokument }> = [];
  for (const d of mitAnalyse(dokumente, 'mietvertrag')) {
    if (mietArt(d) !== 'mietvertrag') continue;
    for (const m of d.analyse.mieter ?? []) {
      if (!m.vorname && !m.nachname) continue;
      const gebM = normDate(m.geburtsdatum);
      const bekannt = personen.some((p) =>
        (/^\d{4}-\d{2}-\d{2}$/.test(gebM) && gebM === normDate(p.geburtsdatum))
        || ((m.vorname ? vornamePasst(m.vorname, p) && !!p.vorname : true) && (m.nachname ? nachnamePasst(m.nachname, p) : true)));
      const name = [m.vorname, m.nachname].filter(Boolean).join(' ');
      if (!bekannt && !fehlend.some((f) => normName(f.name) === normName(name))) fehlend.push({ name, dok: d });
    }
  }
  if (!fehlend.length) return [];
  const namen = fehlend.map((f) => `„${f.name}"`).join(', ');
  return [{
    regelId: 'plausi-mieter-nicht-im-haushalt', kategorie: P, typ: 'info',
    titel: 'Mieter:in nicht im Haushalt erfasst',
    belegtext: `Im Mietvertrag ${fehlend.length === 1 ? 'ist' : 'sind'} ${namen} als Mieter:in genannt, im Antrag aber nicht als Haushaltsmitglied erfasst. `
      + 'Klären, ob die Person (noch) in der Wohnung lebt — dann gehört sie mit Einkommen zum Haushalt (§§ 5, 6 WoGG) — oder ausgezogen ist (Nachweis, z. B. Abmeldung).',
    quellDokumentId: fehlend[0]!.dok.id,
  }];
}

// ── Einstieg ────────────────────────────────────────────────────────────────

export function pruefeAbgleiche(snapshot: VorgangSnapshot, optionen: AbgleichOptionen = {}): PruefBefund[] {
  const k: WohngeldKonstanten = { ...KONSTANTEN, ...(optionen.konstanten ?? {}) };
  const befunde: PruefBefund[] = [...pruefeMiete(snapshot, k)];
  for (const p of snapshot.personen) {
    befunde.push(...pruefeRente(p, snapshot.dokumente, k), ...pruefeErwerbUndLohnersatz(p, snapshot.dokumente, k));
  }
  befunde.push(...pruefeKontoEingaenge(snapshot), ...pruefeVermoegen(snapshot, k), ...pruefeIdentitaet(snapshot), ...pruefeMieterImHaushalt(snapshot));
  return befunde;
}
