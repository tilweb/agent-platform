/**
 * Grundsicherung — Personen aus dem Antrag anlegen und Nachweise den Personen zuordnen.
 *
 * Reine, DB-freie, deterministische Funktionen (kein LLM). Genutzt vom Posteingang
 * (`verteileDokumente`) und vom Upload am Vorgang.
 *
 * Leitplanken: angelegte Personen sind KI-Vorschläge (Feld-Status setzt der Aufrufer). Eine
 * Zuordnung erfolgt nur bei eindeutigem Treffer; sonst bleibt das Dokument ohne Person und
 * bekommt den Hinweis „Person nicht eindeutig zuordenbar". Die Regel-Engine liest
 * personenbezogene Nachweise NUR über `Dokument.personId` — daher ist die Zuordnung Pflicht.
 */
import { genId } from '../_antrag-kern/ids';
import { nachnameGleich, normDate, normName, vornameGleich } from './namen';
import type { DokumentFlag, DokumentTyp, ExtrahierteStammdaten, Identitaet, Person, PersonRolle } from './types';

/** Entwurf einer anzulegenden Person (ohne System-/Vorgangsfelder). */
export type PersonEntwurf = Omit<Person, 'id' | 'vorgangId' | 'version' | 'created_at' | 'updated_at'>;

/**
 * Personen aus den Antragsdaten: Antragsteller:in, Partner:in, Haushaltsangehörige — mit
 * Einkommen, Vermögen, KV, Schwerbehinderung, Mehrbedarf, Unterhalt-Angabe. Listenpositionen
 * bekommen IDs. `vermoegen: []` bleibt erhalten („kein Vermögen" ist eine Erklärung).
 */
export function personenAusAntrag(s: ExtrahierteStammdaten | undefined): PersonEntwurf[] {
  const out: PersonEntwurf[] = [];
  for (const p of s?.personen ?? []) {
    if (!p.nachname && !p.vorname && p.rolle !== 'antragsteller') continue;
    const { einkommen, vermoegen, verhaeltnis, ...rest } = p;
    const e: PersonEntwurf = {
      ...rest,
      nachname: p.nachname ?? '',
      vorname: p.vorname ?? '',
      ...(einkommen ? { einkommen: einkommen.map((x) => ({ ...x, id: genId('eink') })) } : {}),
      ...(vermoegen ? { vermoegen: vermoegen.map((x) => ({ ...x, id: genId('verm') })) } : {}),
      ...(verhaeltnis ? { bemerkung: `Verhältnis laut Antrag: ${verhaeltnis}` } : {}),
    };
    out.push(e);
  }
  return out;
}

/**
 * Feld-Status-Pfade einer aus dem Antrag angelegten Person — alles, was die KI in die Person
 * schreibt, ist ein KI-Vorschlag. Listen/Objekte als Ganzes.
 */
export function feldStatusPersonPfade(p: Partial<PersonEntwurf>): string[] {
  const out: string[] = [];
  const skalare: Array<keyof PersonEntwurf> = [
    'nachname', 'vorname', 'geburtsname', 'geburtsdatum', 'familienstand', 'staatsangehoerigkeit', 'betreuung', 'mehrbedarf_ernaehrung',
  ];
  for (const k of skalare) if (p[k] !== undefined && p[k] !== '') out.push(k);
  const objekte: Array<keyof PersonEntwurf> = ['erwerbsminderung', 'schwerbehinderung', 'krankenversicherung', 'unterhalt_kinder_eltern'];
  for (const k of objekte) if (p[k] && Object.keys(p[k] as object).length) out.push(k);
  if (p.einkommen?.length) out.push('einkommen');
  if (p.vermoegen !== undefined) out.push('vermoegen');
  return out;
}

// ── Nachweise den Personen zuordnen ──────────────────────────────────────────

/**
 * Dokumenttypen, die zu einer Person gehören (die Regel-Engine liest sie über `personId`).
 * Alle anderen (Mietvertrag, Nebenkosten, Wohngeldbescheid …) gelten für den Haushalt.
 */
export const PERSONEN_TYPEN: ReadonlySet<DokumentTyp> = new Set<DokumentTyp>([
  'grundsicherungsantrag', 'personalausweis', 'betreuerausweis', 'rentenbescheid', 'rentenanpassungsmitteilung',
  'em_feststellung_rv', 'betriebsrente_mitteilung', 'kontoauszug', 'vermoegensnachweis', 'bestattungsvorsorge',
  'kv_pv_nachweis', 'schwerbehindertenausweis', 'aerztliche_bescheinigung', 'transferleistungsbescheid',
]);

export type ZuordnungsGrund = 'antrag' | 'geburtsdatum' | 'name' | 'einzige-person' | 'haushalt' | 'unklar' | 'keine-person';

export interface PersonZuordnung {
  personId?: string;
  grund: ZuordnungsGrund;
}

export const FLAG_PERSON_UNKLAR = 'person-unklar';
export const flagPersonUnklar = (): DokumentFlag => ({ code: FLAG_PERSON_UNKLAR, hinweis: 'Person nicht eindeutig zuordenbar' });

export interface Vergleichsperson { id: string; rolle?: PersonRolle; vorname?: string; nachname?: string; geburtsdatum?: string }

/**
 * Ordnet EINEN Nachweis einer Person zu. Reihenfolge: Antrag → antragstellende Person;
 * Geburtsdatum → Vor- und Nachname → nur ein Namensteil, wenn eindeutig → einzige Person der
 * Einsatzgemeinschaft (ohne lesbaren Namen). Widerspruch oder Mehrdeutigkeit ⇒ `unklar`.
 */
export function ordneNachweisZu(typ: DokumentTyp, identitaet: Identitaet | undefined, personen: Vergleichsperson[]): PersonZuordnung {
  if (!PERSONEN_TYPEN.has(typ)) return { grund: 'haushalt' };
  if (!personen.length) return { grund: 'keine-person' };
  if (typ === 'grundsicherungsantrag') {
    const at = personen.find((p) => p.rolle === 'antragsteller');
    return at ? { personId: at.id, grund: 'antrag' } : { grund: 'unklar' };
  }
  const id = identitaet ?? {};
  const geb = normDate(id.geburtsdatum);
  const hatName = !!(normName(id.vorname) || normName(id.nachname));
  const eg = personen.filter((p) => p.rolle !== 'haushaltsangehoerig');
  const einzige = eg.length === 1 ? eg[0]! : personen.length === 1 ? personen[0]! : undefined;

  if (!geb && !hatName) return einzige ? { personId: einzige.id, grund: 'einzige-person' } : { grund: 'unklar' };

  const widerspruchGeb = (p: Vergleichsperson) => !!geb && !!normDate(p.geburtsdatum) && normDate(p.geburtsdatum) !== geb;

  if (geb) {
    const perGeb = personen.filter((p) => normDate(p.geburtsdatum) === geb);
    if (perGeb.length === 1) {
      const p = perGeb[0]!;
      const nameWiderspricht = !!(id.vorname && p.vorname && !vornameGleich(id.vorname, p.vorname))
        && !!(id.nachname && p.nachname && !nachnameGleich(id.nachname, p.nachname));
      return nameWiderspricht ? { grund: 'unklar' } : { personId: p.id, grund: 'geburtsdatum' };
    }
  }

  const voll = personen.filter((p) => vornameGleich(id.vorname, p.vorname) && nachnameGleich(id.nachname, p.nachname));
  if (voll.length === 1) return widerspruchGeb(voll[0]!) ? { grund: 'unklar' } : { personId: voll[0]!.id, grund: 'name' };
  if (voll.length > 1) return { grund: 'unklar' };

  // Nur ein Namensteil lesbar oder Nachname abweichend (z. B. Geburtsname): eindeutiger Vorname genügt.
  const nurVor = id.vorname ? personen.filter((p) => vornameGleich(id.vorname, p.vorname)) : [];
  if (nurVor.length === 1 && !widerspruchGeb(nurVor[0]!)) return { personId: nurVor[0]!.id, grund: 'name' };
  if (!id.vorname) {
    const nurNach = personen.filter((p) => nachnameGleich(id.nachname, p.nachname));
    if (nurNach.length === 1 && !widerspruchGeb(nurNach[0]!)) return { personId: nurNach[0]!.id, grund: 'name' };
  }
  return { grund: 'unklar' };
}
