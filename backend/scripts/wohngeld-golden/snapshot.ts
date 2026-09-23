/**
 * Golden-Dataset-Messung — Prüf-Zustände (VorgangSnapshot) für die App-Regeln.
 *
 * - `posteingangSnapshot`: Nachbau von `verteileDokumente` ohne DB. Vorgang aus den
 *   extrahierten Antrags-Stammdaten, nur die antragstellende Person, Dokumente ohne
 *   Personenbezug — genau der Stand, den die App nach „Zuordnen" automatisch prüft.
 * - `regelwerkSnapshot`: korrekt erfasster Fall (Personen wie aus dem Antrag erfasst,
 *   Dokumente mit Personenbezug und den ERWARTETEN Analysewerten) — misst die Regeln selbst.
 */
import type {
  Dokument, DokumentAnalyse, DokumentTyp, Erwerbsstatus, Person, PersonRolle, Vorgang, VorgangSnapshot,
} from '../../src/apps/wohngeld/types';
import type { ExtrahierteStammdaten } from '../../src/apps/wohngeld/extraction';

const JETZT = '2026-09-24T00:00:00.000Z';
const basis = { created_at: JETZT, updated_at: JETZT, version: 1 };

function vorgangAus(s: ExtrahierteStammdaten | undefined): Vorgang {
  return {
    ...basis, id: 'V', akteId: 'A', antragsId: 'WG-GOLDEN', status: 'posteingang', prioritaet: 'normal',
    wohngeldart: s?.wohngeldart ?? 'mietzuschuss',
    antragsart: s?.antragsart ?? 'erstantrag',
    antragsdatum: s?.antragsdatum ?? undefined,
    wohnung: {
      strasse: s?.adresse?.strasse, hausnummer: s?.adresse?.hausnummer, plz: s?.adresse?.plz, ort: s?.adresse?.ort,
      miete: s?.wohnung?.miete ?? undefined, wohnflaeche_qm: s?.wohnung?.wohnflaeche_qm ?? undefined,
    },
  } as Vorgang;
}

function dokument(i: number, typ: DokumentTyp, analyse: DokumentAnalyse | undefined, personId?: string): Dokument {
  return { ...basis, id: `D${i + 1}`, vorgangId: 'V', typ, istOriginal: false, analyse, ...(personId ? { personId } : {}) } as Dokument;
}

/** Extraktionsergebnis eines Dokuments (Ausschnitt von ExtraktionErgebnis). */
export interface ExtraktionKurz {
  typ: DokumentTyp;
  analyse?: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;
}

export function posteingangSnapshot(dokumente: ExtraktionKurz[]): VorgangSnapshot {
  const antrag = dokumente.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const s = antrag?.stammdaten;
  const personen: Person[] = [];
  if (s?.antragsteller && (s.antragsteller.vorname || s.antragsteller.nachname)) {
    personen.push({
      ...basis, id: 'P1', vorgangId: 'V', rolle: 'antragsteller',
      vorname: s.antragsteller.vorname ?? '', nachname: s.antragsteller.nachname ?? '', geburtsdatum: s.antragsteller.geburtsdatum,
    } as Person);
  }
  return { vorgang: vorgangAus(s), personen, dokumente: dokumente.map((d, i) => dokument(i, d.typ, d.analyse)) };
}

// ── Regelwerk: korrekt erfasster Fall ────────────────────────────────────────

/** Minimaler Ausschnitt des Fallmodells aus tools/wohngeld-golden (bewusst lose typisiert). */
export interface FallKurz {
  antragsdatum: string;
  personen: Array<{
    id: string; vorname: string; nachname: string; geburtsdatum: string; verhaeltnis?: string;
    erwerb: string; staatsangehoerigkeit: string; einnahmen: Array<{ art: string; brutto: number; turnus: string }>;
  }>;
  antrag?: {
    schwerbehinderung?: Array<{ person: string; gdb?: number; pflegegrad?: number; haeuslich?: boolean }>;
    vermoegen?: Record<string, number | undefined>;
    transfer?: Array<{ person: string; leistung: string; bewilligt?: string; weggefallen?: string; abgelehnt?: string }>;
  };
}

export interface ErwartungKurz {
  dokumente: Array<{ typ: DokumentTyp; person?: string; erwartet?: { stammdaten?: Record<string, unknown>; analyse?: Record<string, unknown> } }>;
}

const ERWERB: Record<string, Erwerbsstatus> = {
  Arbeitnehmer: 'angestellt', 'Selbständiger': 'selbststaendig', Azubi: 'ausbildung_studium', Rentner: 'rente_pension',
  Arbeitslos: 'arbeitslos', Nichterwerbsperson: 'ohne_erwerb',
};

function rolle(verhaeltnis: string | undefined, id: string): PersonRolle {
  if (id === 'P1') return 'antragsteller';
  const v = (verhaeltnis ?? '').toLowerCase();
  if (/ehe/.test(v)) return 'ehegatte';
  if (/partner|lebensgef/.test(v)) return 'lebenspartner';
  if (/sohn|tochter|kind/.test(v)) return 'kind';
  return 'haushaltsmitglied';
}

function einkommensArt(art: string): string {
  if (/rente|pension/i.test(art)) return 'rente';
  if (/gehalt|lohn|minijob|vergütung|entgelt|geringfügig/i.test(art)) return 'lohn_gehalt';
  if (/kindergeld/i.test(art)) return 'kindergeld';
  return 'sonstige';
}

const alter = (geb: string, stichtag: string) => Number(stichtag.slice(0, 4)) - Number(geb.slice(0, 4)) - (stichtag.slice(5) < geb.slice(5) ? 1 : 0);

/** Punktpfad-Objekt ({'wohnung.miete': 1}) → verschachtelt, null → weggelassen. */
function entfalte(flach: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [pfad, wert] of Object.entries(flach ?? {})) {
    if (wert === null || wert === undefined) continue;
    const teile = pfad.split('.');
    let cur = out;
    teile.slice(0, -1).forEach((t) => { cur = (cur[t] ??= {}) as Record<string, unknown>; });
    cur[teile.at(-1)!] = wert;
  }
  return out;
}

export function regelwerkSnapshot(fall: FallKurz, erwartung: ErwartungKurz): VorgangSnapshot {
  const antragDok = erwartung.dokumente.find((d) => d.typ === 'wohngeldantrag' && d.erwartet?.stammdaten);
  const stamm = entfalte(antragDok?.erwartet?.stammdaten) as ExtrahierteStammdaten;
  const a = fall.antrag ?? {};
  const kinderUnter18 = fall.personen.some((p) => p.id !== 'P1' && alter(p.geburtsdatum, fall.antragsdatum) < 18);
  const kgEmpfaenger = erwartung.dokumente.find((d) => d.typ === 'kindergeldnachweis')?.person ?? 'P1';
  const vermoegen = Object.values(a.vermoegen ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);

  const personen: Person[] = fall.personen.map((p, i) => {
    const sb = a.schwerbehinderung?.find((x) => x.person === p.id);
    const transfer = (a.transfer ?? []).filter((t) => t.person === p.id && t.bewilligt && !t.weggefallen && !t.abgelehnt);
    return {
      ...basis, id: p.id, vorgangId: 'V', rolle: rolle(p.verhaeltnis, p.id),
      vorname: p.vorname, nachname: p.nachname, geburtsdatum: p.geburtsdatum,
      staatsangehoerigkeit: p.staatsangehoerigkeit, erwerbsstatus: ERWERB[p.erwerb] ?? 'sonstiges',
      einkommen: p.einnahmen.map((e, j) => ({
        id: `E${i}-${j}`, art: einkommensArt(e.art), bezeichnung: e.art,
        betrag_monatlich: e.turnus === 'monatlich' ? e.brutto : undefined,
        betrag_jaehrlich: e.turnus === 'jährlich' ? e.brutto : undefined, beruecksichtigt: true,
      })),
      erhaelt_kindergeld: kinderUnter18 && p.id === kgEmpfaenger,
      ...(sb ? { pflege_behinderung: { schwerbehinderungsgrad: sb.gdb, pflegegrad: sb.pflegegrad, pflegebeduerftig: sb.haeuslich } } : {}),
      ...(p.id === 'P1' && vermoegen > 0 ? { vermoegen } : {}),
      ...(transfer.some((t) => /bürgergeld|sgb ii/i.test(t.leistung)) ? { ausschluesse: [{ id: 'X1', grund: 'sgb2_buergergeld' as const }] } : {}),
    } as Person;
  });

  const dokumente = erwartung.dokumente.map((d, i) =>
    dokument(i, d.typ, entfalte(d.erwartet?.analyse) as DokumentAnalyse, d.person));
  return { vorgang: vorgangAus(stamm), personen, dokumente };
}
