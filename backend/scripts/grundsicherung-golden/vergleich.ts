/**
 * Grundsicherung-Golden — reine Helfer der Messung (ohne DB, ohne LLM):
 *  - `posteingangSnapshot`: Nachbau von `verteileDokumente` (neuer Vorgang) mit DENSELBEN reinen
 *    Funktionen wie die App (stammdatenUebernahme, personenAusAntrag, ordneNachweisZu) → Stand,
 *    den die App nach „Zuordnen" automatisch prüft.
 *  - Abschnitts-Zuordnung (erwartet ↔ erkannt) und Split-Metrik.
 *  - Feldvergleich über Pfade wie `stammdaten.personen[rolle=antragsteller].einkommen[art=altersrente].betrag_monat`.
 */
import { pruefeVorgang } from '../../src/apps/grundsicherung/checker';
import { ordneNachweisZu, personenAusAntrag } from '../../src/apps/grundsicherung/haushalt';
import { stammdatenUebernahme } from '../../src/apps/grundsicherung/stammdaten-uebernahme';
import type {
  Dokument, DokumentAnalyse, DokumentTyp, ExtrahierteStammdaten, Identitaet, Person, Vorgang, VorgangSnapshot,
} from '../../src/apps/grundsicherung/types';

/** Ergebnis eines Abschnitts in App-Begriffen. */
export interface AbschnittKurz {
  typ: DokumentTyp;
  analyse?: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;
  identitaet?: Identitaet;
}

const basis = { version: 1, created_at: '2026-09-28T00:00:00.000Z', updated_at: '2026-09-28T00:00:00.000Z' };
export const HEUTE = '2026-09-28';

/** Posteingang → neuer Vorgang (wie `verteileDokumente` ohne `vorgangId`). */
export function posteingangSnapshot(abschnitte: AbschnittKurz[]): VorgangSnapshot & { zuordnung: Array<string | undefined> } {
  const antrag = abschnitte.find((a) => a.typ === 'grundsicherungsantrag' && a.stammdaten);
  const s = antrag?.stammdaten;
  let vorgang: Vorgang = {
    ...basis, id: 'V', akteId: 'A', vorgangsnummer: 'GS-GOLDEN', status: 'posteingang', prioritaet: 'normal',
    antragsart: s?.antragsart ?? 'erstantrag',
    ...(s?.anspruchsgrund ? { anspruchsgrund: s.anspruchsgrund } : {}),
    ...(s?.antragsdatum ? { antragsdatum: s.antragsdatum } : {}),
  };
  if (s) vorgang = { ...vorgang, ...stammdatenUebernahme(vorgang, s, false).updates };
  const personen: Person[] = personenAusAntrag(s).map((e, i) => ({ ...basis, ...e, id: `P${i + 1}`, vorgangId: 'V' }) as Person);
  const zuordnung: Array<string | undefined> = [];
  const dokumente: Dokument[] = abschnitte.map((a, i) => {
    const z = ordneNachweisZu(a.typ, a.identitaet, personen);
    zuordnung.push(z.personId);
    return { ...basis, id: `D${i + 1}`, vorgangId: 'V', typ: a.typ, istOriginal: false, analyse: a.analyse ?? {}, ...(z.personId ? { personId: z.personId } : {}) } as Dokument;
  });
  return { vorgang, personen, dokumente, zuordnung };
}

/** Regel-IDs (eindeutig, sortiert) für einen Posteingang-Stand. */
export function befundeFuer(abschnitte: AbschnittKurz[]): string[] {
  return [...new Set(pruefeVorgang(posteingangSnapshot(abschnitte), { heute: HEUTE }).map((b) => b.regelId))].sort();
}

// ── Abschnitte ───────────────────────────────────────────────────────────────

export interface Bereich { von: number; bis: number }

const ueberlappung = (a: Bereich, b: Bereich) => Math.max(0, Math.min(a.bis, b.bis) - Math.max(a.von, b.von) + 1);

/**
 * Ordnet jedem erwarteten Dokument höchstens einen erkannten Abschnitt zu: exakter Seitenbereich
 * zuerst, sonst größte Überlappung (gleicher Typ bevorzugt). -1 = kein Abschnitt.
 */
export function ordneZu(erwartet: Array<Bereich & { typ: string }>, erkannt: Array<Bereich & { typ: string }>): number[] {
  const vergeben = new Set<number>();
  const out = erwartet.map(() => -1);
  erwartet.forEach((e, i) => {
    const j = erkannt.findIndex((k, jj) => !vergeben.has(jj) && k.von === e.von && k.bis === e.bis);
    if (j >= 0) { out[i] = j; vergeben.add(j); }
  });
  erwartet.forEach((e, i) => {
    if (out[i]! >= 0) return;
    let best = -1, score = 0;
    erkannt.forEach((k, j) => {
      if (vergeben.has(j)) return;
      const s = ueberlappung(e, k) + (ueberlappung(e, k) > 0 && k.typ === e.typ ? 0.5 : 0);
      if (s > score) { score = s; best = j; }
    });
    if (best >= 0) { out[i] = best; vergeben.add(best); }
  });
  return out;
}

export interface SplitMetrik { erwarteteSchnitte: number; treffer: number; fehlschnitte: number; verfehlt: number[]; zusaetzlich: number[] }

/** Schnitt = erste Seite eines Dokuments (außer Seite 1). */
export function splitMetrik(erwartet: Bereich[], erkannt: Bereich[]): SplitMetrik {
  const soll = new Set(erwartet.map((b) => b.von).filter((v) => v > 1));
  const ist = new Set(erkannt.map((b) => b.von).filter((v) => v > 1));
  const verfehlt = [...soll].filter((s) => !ist.has(s));
  const zusaetzlich = [...ist].filter((s) => !soll.has(s));
  return { erwarteteSchnitte: soll.size, treffer: soll.size - verfehlt.length, fehlschnitte: zusaetzlich.length, verfehlt, zusaetzlich };
}

// ── Felder ───────────────────────────────────────────────────────────────────

/** Wert an einem Pfad; Segment `name[key=wert]` wählt das erste Listenelement mit passendem Schlüssel. */
export function holePfad(obj: unknown, pfad: string): unknown {
  let cur: unknown = obj;
  for (const seg of pfad.split('.')) {
    if (cur === undefined || cur === null) return undefined;
    const m = seg.match(/^([^[]+)\[([^=\]]+)=([^\]]*)\]$/);
    if (m) {
      const liste = (cur as Record<string, unknown>)[m[1]!];
      cur = Array.isArray(liste) ? liste.find((x) => x && String((x as Record<string, unknown>)[m[2]!]) === m[3]) : undefined;
    } else {
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

const norm = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();

/** Vergleich Soll ↔ Ist. `null` erwartet: Ist muss fehlen (leere Liste/leeres Objekt zählt als fehlend). */
export function gleich(soll: unknown, ist: unknown): boolean {
  if (soll === null) return ist === undefined || ist === null || (Array.isArray(ist) && ist.length === 0);
  if (ist === undefined || ist === null) return false;
  if (typeof soll === 'number') {
    const n = typeof ist === 'number' ? ist : Number(String(ist).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) && Math.abs(n - soll) < 0.011;
  }
  if (typeof soll === 'boolean') return ist === soll;
  if (Array.isArray(soll)) {
    if (!Array.isArray(ist)) return false;
    if (soll.length === 0) return ist.length === 0;
    const a = soll.map((x) => norm(String(x))).sort();
    const b = ist.map((x) => norm(String(x))).sort();
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return norm(String(soll)) === norm(String(ist));
}

export interface FeldErgebnis { pfad: string; soll: unknown; ist: unknown; ok: boolean }

export function vergleicheFelder(kern: Record<string, unknown>, ergebnis: AbschnittKurz | undefined): FeldErgebnis[] {
  return Object.entries(kern).map(([pfad, soll]) => {
    const ist = ergebnis ? holePfad(ergebnis, pfad) : undefined;
    return { pfad, soll, ist, ok: ergebnis ? gleich(soll, ist) : false };
  });
}
