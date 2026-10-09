/**
 * DP-Qualitaetssuite — Bewertung je Fall und Aggregation je Set (Spezifikation §4).
 *
 * Feldvergleich ueber `compareField` der Profil-Evaluation (typ-normalisiert, Listen als
 * Multimenge). Bewertet werden nur die Schluessel, die die Erwartung enthaelt — eine
 * Annotation muss nicht jedes Feld fuellen. Segmentprofile werden je Abschnitts-Instanz
 * und Feld bewertet (die Produkt-Eval vergleicht nur ganze Instanzen — zu grob, um zu
 * sehen, WAS kippt).
 */

import { compareField } from '../../../src/extraction/learning/eval';
import type { ExtractionProject, ProjectField, SegmentInstance } from '../../../src/extraction/learning/types';
import type { VertragsAuswertung } from '../../../src/services/extraction/contract/types';
import type { TokenMessung } from '../../../src/services/llm/token-meter';
import { vergleiche, type Pruefung } from '../../vertrag-pilot/vergleich';
import type { FallDef } from './korpus';

export interface FeldErgebnis { pfad: string; ok: boolean; kritisch: boolean; sicher: boolean; erwartet: unknown; ist: unknown }

export interface SegmentBewertung {
  erwartet: number; exakt: number; typRichtig: number;
  schnitteErwartet: number; schnitteGefunden: number; fehlschnitte: number;
  zusaetzlicheInstanzen: number;
}

export interface Betrieb { seiten: number; sekunden: number; aufrufe: number; promptTokens: number; completionTokens: number; ohneAngabe: number }

export interface FallBewertung {
  id: string; split: FallDef['split']; gruppe?: string; fehler?: string;
  felder: FeldErgebnis[];
  segmente?: SegmentBewertung;
  vertrag?: Pruefung[];
  betrieb: Betrieb;
}

/** Was der Runner je Fall vom Extraktionsergebnis braucht (Teilmenge von `extract()`). */
export interface FallErgebnis {
  success: boolean; error?: string;
  data: Record<string, unknown>;
  fieldConfidences?: Record<string, number>;
  segments?: SegmentInstance[];
  vertrag?: VertragsAuswertung;
  seiten: number; sekunden: number;
  verbrauch?: TokenMessung;
  /** Verarbeitungsfehler (Endpunkt/Timeout) einzelner Schritte — Infrastruktur, nicht Qualitaet. */
  verarbeitungsfehler?: string[];
}

const TEXT: ProjectField = { type: 'text', required: false, label: '' };
const istLeer = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

/** Feldpfad ohne Instanznummer (fuer die Genauigkeit je Feld ueber alle Faelle). */
export const feldSchluessel = (pfad: string) => pfad.replace(/\[\d+\]/g, '[]');

function kritischPassend(pfad: string, kritische: string[]): boolean {
  const s = feldSchluessel(pfad);
  return kritische.some((k) => k === pfad || k === s || feldSchluessel(k) === s);
}

/** Feldvergleich (flach oder je Segment-Instanz). */
export function bewerteFelder(
  profil: ExtractionProject, erwartet: Record<string, unknown>, ist: Record<string, unknown>,
  konfidenzen: Record<string, number>, opts: { kritische: string[]; sicherAb: number },
): { felder: FeldErgebnis[]; zusaetzlicheInstanzen: number } {
  const felder: FeldErgebnis[] = [];
  let zusaetzlicheInstanzen = 0;
  const add = (pfad: string, def: ProjectField, e: unknown, i: unknown) => {
    const ok = compareField(def, e, i);
    const konf = konfidenzen[pfad];
    felder.push({ pfad, ok, kritisch: kritischPassend(pfad, opts.kritische), sicher: typeof konf === 'number' && konf >= opts.sicherAb && !istLeer(i), erwartet: e, ist: i });
  };
  for (const [schluessel, ew] of Object.entries(erwartet)) {
    if (schluessel.startsWith('_')) continue;
    const seg = profil.segments?.[schluessel];
    if (!seg) { add(schluessel, profil.fields[schluessel] ?? TEXT, ew, ist[schluessel]); continue; }
    const segFelder = seg.fields ?? {};
    const instanzenE = seg.repeatable ? (Array.isArray(ew) ? ew : []) : [ew];
    const iw = ist[schluessel];
    const instanzenI = seg.repeatable ? (Array.isArray(iw) ? iw : []) : [iw];
    if (seg.repeatable && instanzenI.length > instanzenE.length) zusaetzlicheInstanzen += instanzenI.length - instanzenE.length;
    instanzenE.forEach((inst, n) => {
      const e = (inst ?? {}) as Record<string, unknown>;
      const i = (instanzenI[n] ?? {}) as Record<string, unknown>;
      for (const [feld, wert] of Object.entries(e)) {
        if (feld.startsWith('_')) continue;
        add(seg.repeatable ? `${schluessel}[${n + 1}].${feld}` : `${schluessel}.${feld}`, segFelder[feld] ?? TEXT, wert, i[feld]);
      }
    });
  }
  return { felder, zusaetzlicheInstanzen };
}

/** Struktur: Schnitte (Startseiten > 1, ohne Leerseiten), exakte Abschnitte, Typ. */
export function bewerteSegmente(erwartet: Array<{ typ: string; von: number; bis: number }>, ist: SegmentInstance[]): Omit<SegmentBewertung, 'zusaetzlicheInstanzen'> {
  const echt = ist.filter((s) => s.type !== 'leerseite');
  const schnitteE = new Set(erwartet.map((s) => s.von).filter((p) => p > 1));
  const schnitteI = new Set(echt.map((s) => s.pageFrom).filter((p) => p > 1));
  let exakt = 0; let typRichtig = 0;
  for (const e of erwartet) {
    const t = echt.find((s) => s.pageFrom === e.von && s.pageTo === e.bis);
    if (t) { exakt++; if (t.type === e.typ) typRichtig++; }
  }
  return {
    erwartet: erwartet.length, exakt, typRichtig,
    schnitteErwartet: schnitteE.size,
    schnitteGefunden: [...schnitteE].filter((p) => schnitteI.has(p)).length,
    fehlschnitte: [...schnitteI].filter((p) => !schnitteE.has(p)).length,
  };
}

export function bewerteFall(profil: ExtractionProject, fall: FallDef, e: FallErgebnis, opts: { kritische: string[]; sicherAb: number }): FallBewertung {
  const betrieb: Betrieb = {
    seiten: e.seiten, sekunden: e.sekunden, aufrufe: e.verbrauch?.aufrufe ?? 0,
    promptTokens: e.verbrauch?.promptTokens ?? 0, completionTokens: e.verbrauch?.completionTokens ?? 0, ohneAngabe: e.verbrauch?.ohneAngabe ?? 0,
  };
  if (!e.success) return { id: fall.id, split: fall.split, gruppe: fall.gruppe, fehler: e.error ?? 'Auswertung fehlgeschlagen', felder: [], betrieb };
  // Teilausfall (z. B. Seite wegen 503 nicht gelesen): als Ausfall werten, sonst erscheint ein
  // Infrastrukturproblem als Qualitaetsrueckgang und verzerrt Baseline und Rauschband.
  if (e.verarbeitungsfehler?.length) {
    return { id: fall.id, split: fall.split, gruppe: fall.gruppe, fehler: `Teilausfall (${e.verarbeitungsfehler.length}×): ${e.verarbeitungsfehler[0]!.slice(0, 120)}`, felder: [], betrieb };
  }
  const { felder, zusaetzlicheInstanzen } = fall.erwartet.daten
    ? bewerteFelder(profil, fall.erwartet.daten, e.data, e.fieldConfidences ?? {}, opts)
    : { felder: [], zusaetzlicheInstanzen: 0 };
  const b: FallBewertung = { id: fall.id, split: fall.split, gruppe: fall.gruppe, felder, betrieb };
  if (fall.erwartet.segmente) b.segmente = { ...bewerteSegmente(fall.erwartet.segmente, e.segments ?? []), zusaetzlicheInstanzen };
  if (fall.erwartet.vertrag) {
    b.vertrag = e.vertrag
      ? vergleiche(e.vertrag, e.data, fall.erwartet.vertrag)
      : [{ kategorie: 'katalog', was: 'Vertragsauswertung vorhanden', ok: false }];
  }
  return b;
}

// ── Aggregation je Set ──────────────────────────────────────────────────────
export interface SetMetriken {
  faelle: number; ausfaelle: number;
  /** Quoten in Prozent (1 Dezimale); null, wenn nicht anwendbar. */
  quoten: Record<string, number | null>;
  /** Genauigkeit je Feldschluessel (Prozent). */
  jeFeld: Record<string, number>;
  /** Zaehler (fuer Warnungen). */
  zaehler: { sicherAberFalsch: number; fehlschnitte: number; zusaetzlicheInstanzen: number; felder: number; kritisch: number };
  betrieb: { sekundenJeSeite: number; tokensJeSeite: number; aufrufeJeSeite: number; tokenAngabeFehlt: number };
}

const pz = (z: number, n: number) => (n ? Math.round((z / n) * 1000) / 10 : null);

export function aggregiere(bewertungen: FallBewertung[]): SetMetriken {
  const ok = bewertungen.filter((b) => !b.fehler);
  const felder = ok.flatMap((b) => b.felder);
  const kritisch = felder.filter((f) => f.kritisch);
  const jeFeldZ = new Map<string, { ok: number; n: number }>();
  for (const f of felder) {
    const k = feldSchluessel(f.pfad);
    const z = jeFeldZ.get(k) ?? { ok: 0, n: 0 };
    z.n++; if (f.ok) z.ok++;
    jeFeldZ.set(k, z);
  }
  const mitFeldern = ok.filter((b) => b.felder.length);
  const seg = ok.map((b) => b.segmente).filter((s): s is SegmentBewertung => !!s);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const vertrag = ok.flatMap((b) => b.vertrag ?? []);
  const quoten: Record<string, number | null> = {
    felder: pz(felder.filter((f) => f.ok).length, felder.length),
    kritische_felder: pz(kritisch.filter((f) => f.ok).length, kritisch.length),
    dokumente_vollstaendig: pz(mitFeldern.filter((b) => b.felder.every((f) => f.ok)).length, mitFeldern.length),
    schnitte_gefunden: pz(sum(seg.map((s) => s.schnitteGefunden)), sum(seg.map((s) => s.schnitteErwartet))),
    abschnitte_exakt: pz(sum(seg.map((s) => s.exakt)), sum(seg.map((s) => s.erwartet))),
    abschnitte_typ: pz(sum(seg.map((s) => s.typRichtig)), sum(seg.map((s) => s.exakt))),
    vertrag: pz(vertrag.filter((p) => p.ok).length, vertrag.length),
  };
  for (const kat of new Set(vertrag.map((p) => p.kategorie))) {
    const xs = vertrag.filter((p) => p.kategorie === kat);
    quoten[`vertrag_${kat}`] = pz(xs.filter((p) => p.ok).length, xs.length);
  }
  const seiten = sum(ok.map((b) => b.betrieb.seiten)) || 1;
  return {
    faelle: bewertungen.length,
    ausfaelle: bewertungen.length - ok.length,
    quoten,
    jeFeld: Object.fromEntries([...jeFeldZ].map(([k, z]) => [k, Math.round((z.ok / z.n) * 1000) / 10])),
    zaehler: {
      sicherAberFalsch: felder.filter((f) => f.sicher && !f.ok).length,
      fehlschnitte: sum(seg.map((s) => s.fehlschnitte)),
      zusaetzlicheInstanzen: sum(seg.map((s) => s.zusaetzlicheInstanzen)),
      felder: felder.length, kritisch: kritisch.length,
    },
    betrieb: {
      sekundenJeSeite: Math.round((sum(ok.map((b) => b.betrieb.sekunden)) / seiten) * 10) / 10,
      tokensJeSeite: Math.round(sum(ok.map((b) => b.betrieb.promptTokens + b.betrieb.completionTokens)) / seiten),
      aufrufeJeSeite: Math.round((sum(ok.map((b) => b.betrieb.aufrufe)) / seiten) * 100) / 100,
      tokenAngabeFehlt: sum(ok.map((b) => b.betrieb.ohneAngabe)),
    },
  };
}
