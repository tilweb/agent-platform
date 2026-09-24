/**
 * Wohngeld — Haushalt aus dem Antrag anlegen und Nachweise den Personen zuordnen.
 *
 * Reine, DB-freie, deterministische Funktionen (kein LLM). Genutzt vom Posteingang
 * (`verteileDokumente`, Direkt-Upload) und vom Golden-Messwerkzeug — beide rechnen
 * damit exakt gleich.
 *
 * Leitplanken: Angelegte Personen sind KI-Vorschläge (Feld-Status setzt der Aufrufer),
 * Einkommenspositionen tragen `beruecksichtigt: false`. Eine Zuordnung erfolgt nur bei
 * eindeutigem Treffer; sonst bleibt das Dokument ohne Person und bekommt einen Hinweis.
 *
 * Spec: docs/wohngeld-posteingang-haushalt-zuordnung-spec-2026-09-24.md
 */
import type { ExtrahierteStammdaten, HaushaltAngaben, Identitaet } from './extraction';
import { normDate, normText } from './matching';
import type { Ausschluss, AusschlussGrund, DokumentFlag, DokumentTyp, Einkommensposition, Erwerbsstatus, Person, PersonRolle } from './types';

// ── Normalisierung ───────────────────────────────────────────────────────────

/** Namensvergleich: ohne Diakritika, Kleinschreibung, nur Buchstaben/Leerzeichen/Bindestrich. */
export function normName(v?: string): string {
  if (!v) return '';
  // Erst deutsche Umlaute umschreiben (ü → ue), dann übrige Diakritika entfernen (ş → s, ı → i).
  const basis = normText(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
  return basis.replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
const ersterVorname = (v?: string) => normName(v).split(/[\s-]+/)[0] ?? '';

/** Vornamen gleich, wenn der erste Vorname übereinstimmt oder einer im anderen vollständig enthalten ist. */
export function vornameGleich(a?: string, b?: string): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y || ersterVorname(a) === ersterVorname(b)) return true;
  const tx = new Set(x.split(/[\s-]+/)), ty = y.split(/[\s-]+/);
  return ty.every((t) => tx.has(t)) || [...tx].every((t) => ty.includes(t));
}
export function nachnameGleich(a?: string, b?: string): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Doppelnamen: „Müller-Lüdenscheidt" ↔ „Müller"
  const tx = x.split(/[\s-]+/), ty = y.split(/[\s-]+/);
  return tx.some((t) => t.length > 2 && ty.includes(t));
}

/** Alter in vollen Jahren zum Stichtag (ISO-Daten); undefined ohne gültiges Geburtsdatum. */
export function alterAm(geburtsdatum: string | undefined, stichtag: string): number | undefined {
  const g = normDate(geburtsdatum), s = normDate(stichtag);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return Number(s.slice(0, 4)) - Number(g.slice(0, 4)) - (s.slice(5) < g.slice(5) ? 1 : 0);
}

// ── Abbildung der Formulartexte ─────────────────────────────────────────────

export function rolleAusVerhaeltnis(v?: string): PersonRolle {
  const t = normName(v);
  if (/ehe(mann|frau|gatt|partner)|^gatt/.test(t)) return 'ehegatte';
  if (/lebens(partner|gefaehrt)|partner/.test(t)) return 'lebenspartner';
  if (/sohn|tochter|kind|enkel|stief|pflege/.test(t)) return 'kind';
  return 'haushaltsmitglied';
}

export function erwerbsstatusAusText(v?: string): Erwerbsstatus | undefined {
  const t = normName(v);
  if (!t) return undefined;
  if (/arbeitnehmer|angestellt|beschaeftigt/.test(t)) return 'angestellt';
  if (/selbst/.test(t)) return 'selbststaendig';
  if (/auszubild|student|ausbildung|schueler/.test(t)) return 'ausbildung_studium';
  if (/rentner|pension|rente/.test(t)) return 'rente_pension';
  if (/arbeitslos/.test(t)) return 'arbeitslos';
  if (/nichterwerb|ohne erwerb|hausfrau|hausmann/.test(t)) return 'ohne_erwerb';
  return 'sonstiges';
}

/** Art einer Einnahme (Formulartext) → Einkommensart der App; `null` = „keine Einnahmen". */
export function einkommensArtAusText(v?: string): string | null {
  const t = normName(v);
  if (!t || /keine einnahme/.test(t)) return null;
  if (/rente|pension|ruhegehalt/.test(t)) return 'rente';
  if (/arbeitslosengeld|alg/.test(t)) return 'alg1';
  if (/krankengeld/.test(t)) return 'krankengeld';
  if (/elterngeld|mutterschaft/.test(t)) return 'elterngeld';
  if (/unterhalt/.test(t)) return 'unterhalt';
  if (/kapital|zins|dividend/.test(t)) return 'kapitalertraege';
  if (/vermietung|verpachtung|untermiet|mieteinnahm/.test(t)) return 'v_und_v';
  if (/selbst|gewerbe|freiberuf/.test(t)) return 'selbststaendig';
  if (/gehalt|lohn|minijob|geringfueg|verguetung|entgelt|aushilf|kurzarbeit|beschaeftigung|nebentaetig/.test(t)) return 'lohn_gehalt';
  return 'sonstiges';
}

export function ausschlussGrundAusText(v?: string): AusschlussGrund {
  const t = normName(v);
  if (/buergergeld|sgb ii\b|arbeitslosengeld ii|jobcenter/.test(t) && !/auszubild/.test(t)) return 'sgb2_buergergeld';
  if (/grundsicherung/.test(t)) return 'grundsicherung_alter_em';
  if (/stationaer/.test(t)) return 'hilfe_stationaer';
  if (/sozialhilfe|lebensunterhalt|sgb xii/.test(t)) return /bvg|ergaenzend/.test(t) ? 'ergaenzende_hilfe_bvg' : 'hilfe_lebensunterhalt_sgb12';
  if (/jugendhilfe|sgb viii/.test(t)) return 'kinder_jugendhilfe_sgb8';
  if (/asyl/.test(t)) return 'asylblg';
  if (/auszubild|bafoeg|bab/.test(t)) return 'ausbildungsfoerderung';
  return 'sonstiger_grund';
}

const TURNUS_JAEHRLICH = /jaehr|jahr/;

// ── Haushalt aus dem Antrag ──────────────────────────────────────────────────

/** Entwurf einer Person, wie sie der Posteingang anlegen würde (ohne DB-Felder). */
export interface PersonEntwurf extends Omit<Partial<Person>, 'id' | 'vorgangId' | 'created_at' | 'updated_at' | 'version'> {
  /** Stabiler Schlüssel innerhalb des Entwurfs: P1 = antragstellende Person, P2… = Frage 6 in Reihenfolge. */
  schluessel: string;
  rolle: PersonRolle;
  vorname: string;
  nachname: string;
}

/** Passt ein Antragsblock (Name) zu einer Person? Vorname entscheidet, Nachname als Bestätigung. */
function blockPasst(block: { vorname?: string; nachname?: string }, p: { vorname?: string; nachname?: string }): boolean {
  if (block.vorname && p.vorname) return vornameGleich(block.vorname, p.vorname) && (!block.nachname || !p.nachname || nachnameGleich(block.nachname, p.nachname));
  return !!block.nachname && nachnameGleich(block.nachname, p.nachname);
}
/** Eindeutige Person zu einem Block; mehrdeutig/keine ⇒ undefined. */
function personZuBlock<T extends { vorname?: string; nachname?: string }>(block: { vorname?: string; nachname?: string }, personen: T[]): T | undefined {
  const treffer = personen.filter((p) => blockPasst(block, p));
  return treffer.length === 1 ? treffer[0] : undefined;
}

/**
 * Haushalt laut Antrag → Personen-Entwürfe. Ohne antragstellende Person (Name) → leer.
 * Einnahmen/Behinderung/Transfer werden über den Namen im jeweiligen Block der Person
 * zugeordnet; nicht eindeutig zuordenbare Blöcke werden gezählt (`nichtZugeordnet`).
 */
export function personenAusAntrag(s: ExtrahierteStammdaten | undefined): { personen: PersonEntwurf[]; nichtZugeordnet: number } {
  const at = s?.antragsteller;
  if (!at || !(at.vorname || at.nachname)) return { personen: [], nichtZugeordnet: 0 };
  const h: HaushaltAngaben = s?.haushalt ?? { mitglieder: [], einnahmen: [], behinderung: [], transfer: [] };

  const personen: PersonEntwurf[] = [
    {
      schluessel: 'P1', rolle: 'antragsteller', vorname: at.vorname ?? '', nachname: at.nachname ?? '',
      ...(at.geburtsdatum ? { geburtsdatum: at.geburtsdatum } : {}),
      ...(h.antragstellerErwerbsstatus ? { erwerbsstatus: erwerbsstatusAusText(h.antragstellerErwerbsstatus) } : {}),
    },
    ...h.mitglieder.map((m, i): PersonEntwurf => ({
      schluessel: `P${i + 2}`, rolle: rolleAusVerhaeltnis(m.verhaeltnis),
      vorname: m.vorname ?? '', nachname: m.nachname || at.nachname || '',
      ...(m.geburtsdatum ? { geburtsdatum: m.geburtsdatum } : {}),
      ...(m.erwerbsstatus ? { erwerbsstatus: erwerbsstatusAusText(m.erwerbsstatus) } : {}),
    })),
  ];

  let nichtZugeordnet = 0;
  const zu = (block: { vorname?: string; nachname?: string }) => {
    const p = personZuBlock(block, personen);
    if (!p) nichtZugeordnet++;
    return p;
  };

  h.einnahmen.forEach((e, i) => {
    const art = einkommensArtAusText(e.art);
    const p = zu(e);
    if (!p || art === null) return;
    const jaehrlich = TURNUS_JAEHRLICH.test(normName(e.turnus));
    const pos: Einkommensposition = {
      id: `ek-${p.schluessel}-${i + 1}`, art, bezeichnung: e.art, beruecksichtigt: false,
      ...(e.brutto !== undefined ? (jaehrlich ? { betrag_jaehrlich: e.brutto } : { betrag_monatlich: e.brutto }) : {}),
    };
    p.einkommen = [...(p.einkommen ?? []), pos];
  });

  for (const b of h.behinderung) {
    const p = zu(b);
    if (!p) continue;
    p.pflege_behinderung = {
      ...(b.gdb ? { schwerbehinderungsgrad: b.gdb } : {}),
      ...(b.pflegegrad ? { pflegegrad: b.pflegegrad } : {}),
      ...(b.haeuslich ? { pflegebeduerftig: true } : {}),
    };
  }

  h.transfer.forEach((t, i) => {
    const p = zu(t);
    if (!p) return;
    if (!t.bewilligt || t.weggefallen || t.abgelehnt) return; // nur laufender Bezug schließt aus (§ 7)
    const grund = ausschlussGrundAusText(t.leistung);
    const a: Ausschluss = { id: `ax-${p.schluessel}-${i + 1}`, grund, von: normDate(t.bewilligt) || undefined, ...(grund === 'sonstiger_grund' && t.leistung ? { freitext: t.leistung } : {}) };
    p.ausschluesse = [...(p.ausschluesse ?? []), a];
  });

  if ((h.vermoegen ?? 0) > 0) personen[0]!.vermoegen = h.vermoegen;
  return { personen, nichtZugeordnet };
}

// ── Nachweise den Personen zuordnen ──────────────────────────────────────────

/** Dokumenttypen, die zu einer Person gehören (alle anderen: Haushalt). */
export const PERSONEN_TYPEN: ReadonlySet<DokumentTyp> = new Set<DokumentTyp>([
  'personalausweis', 'gehaltsabrechnung', 'verdienstbescheinigung', 'rentenbescheid', 'kv_pv_nachweis',
  'schwerbehindertenausweis', 'pflegenachweis', 'kindergeldnachweis', 'unterhaltsnachweis',
  'transferleistungsbescheid', 'vermoegensnachweis', 'kontoauszug',
]);

export type ZuordnungsGrund = 'geburtsdatum' | 'name' | 'einzige-person' | 'haushalt' | 'unklar' | 'keine-person';

export interface PersonZuordnung {
  personId?: string;
  grund: ZuordnungsGrund;
}

export const FLAG_PERSON_UNKLAR = 'person-unklar';
export const flagPersonUnklar = (): DokumentFlag => ({ code: FLAG_PERSON_UNKLAR, hinweis: 'Person nicht eindeutig zuordenbar' });

interface Vergleichsperson { id: string; vorname?: string; nachname?: string; geburtsdatum?: string }

/**
 * Ordnet EINEN Nachweis einer Person zu (siehe Spec §3.4). Reihenfolge:
 * Geburtsdatum → Vor- und Nachname → nur ein Namensteil, wenn eindeutig → Ein-Personen-Haushalt.
 * Widerspruch (Name passt, Geburtsdatum weicht ab) oder Mehrdeutigkeit ⇒ `unklar`.
 */
export function ordneNachweisZu(typ: DokumentTyp, identitaet: Identitaet | undefined, personen: Vergleichsperson[]): PersonZuordnung {
  if (!PERSONEN_TYPEN.has(typ)) return { grund: 'haushalt' };
  if (!personen.length) return { grund: 'keine-person' };
  const id = identitaet ?? {};
  const geb = normDate(id.geburtsdatum);
  const hatName = !!(normName(id.vorname) || normName(id.nachname));

  if (!geb && !hatName) return personen.length === 1 ? { personId: personen[0]!.id, grund: 'einzige-person' } : { grund: 'unklar' };

  const widerspruchGeb = (p: Vergleichsperson) => !!geb && !!normDate(p.geburtsdatum) && normDate(p.geburtsdatum) !== geb;

  if (geb) {
    const perGeb = personen.filter((p) => normDate(p.geburtsdatum) === geb);
    if (perGeb.length === 1) {
      const p = perGeb[0]!;
      // Name darf das Geburtsdatum nicht widerlegen (beide Namensteile abweichend).
      const nameWiderspricht = !!(id.vorname && p.vorname && !vornameGleich(id.vorname, p.vorname)) && !!(id.nachname && p.nachname && !nachnameGleich(id.nachname, p.nachname));
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
  return personen.length === 1 && !widerspruchGeb(personen[0]!) && !hatName ? { personId: personen[0]!.id, grund: 'einzige-person' } : { grund: 'unklar' };
}

/** Zuordnung für eine Liste von Nachweisen. */
export function ordneNachweisePersonenZu(
  dokumente: Array<{ typ: DokumentTyp; identitaet?: Identitaet }>,
  personen: Vergleichsperson[],
): PersonZuordnung[] {
  return dokumente.map((d) => ordneNachweisZu(d.typ, d.identitaet, personen));
}

/**
 * Kindergeld-Merkmal (Spec §3.5): Leben Kinder unter 18 im Haushalt, bezieht die Person
 * Kindergeld, der ein Kindergeldbescheid zugeordnet ist — sonst die antragstellende Person.
 * Liefert die Personen-ID oder undefined (keine Kinder unter 18).
 */
export function kindergeldEmpfaenger(
  personen: Array<Vergleichsperson & { rolle: PersonRolle }>,
  dokumente: Array<{ typ: DokumentTyp; personId?: string }>,
  stichtag: string,
): string | undefined {
  const kinder = personen.some((p) => p.rolle !== 'antragsteller' && (alterAm(p.geburtsdatum, stichtag) ?? 99) < 18);
  if (!kinder) return undefined;
  const mitBescheid = dokumente.find((d) => d.typ === 'kindergeldnachweis' && d.personId && personen.some((p) => p.id === d.personId));
  return mitBescheid?.personId ?? personen.find((p) => p.rolle === 'antragsteller')?.id;
}
