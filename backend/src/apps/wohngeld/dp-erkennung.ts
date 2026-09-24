/**
 * Wohngeld — Erkennung über das Document-Processing-Segmentprofil „Wohngeld-Eingang".
 *
 * Ein Sammel-PDF wird vom DP seitenweise klassifiziert (Bilderkennung, auch für Scans),
 * in Abschnitte getrennt und je Abschnitt ausgelesen. Diese Datei bildet das Ergebnis
 * auf Wohngeld-Dokumenttypen und -Felder ab (Stammdaten, Analyse, Identität) und
 * berechnet die Bruttokaltmiete aus den gelesenen Bestandteilen.
 *
 * Spec: docs/wohngeld-dp-segmentprofil-spec-2026-09-24.md
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtractionProject, SegmentInstance, TrainingExample } from '../../extraction/learning/types';
import { WOHNGELD_PROFIL_ID, WOHNGELD_PROFIL_VORLAGE_STAND, buildWohngeldEingangProject } from '../../extraction/templates/wohngeld-eingang';
import type { PipelineRunResult } from '../../services/extraction';
import { stableHash } from '../../extraction/learning/snapshot';
import { baueExtraktionsUebersicht } from './extraction-schema';
import { nachnameGleich, normName, vornameGleich } from './haushalt';
import type { ExtrahierteStammdaten, ExtraktionErgebnis, HaushaltAngaben, Identitaet } from './extraction';
import type { DokumentAnalyse, DokumentTyp } from './types';

export { WOHNGELD_PROFIL_ID };

/** Abschnittstyp des Profils → Wohngeld-Dokumenttyp. Unbekannte/fremde → sonstiges. */
export const ABSCHNITT_ZU_TYP: Record<string, DokumentTyp> = {
  wohngeldantrag: 'wohngeldantrag',
  zusatzblatt: 'wohngeldantrag',
  vermieterbescheinigung: 'mietbescheinigung',
  mietvertrag: 'mietvertrag',
  untermietvertrag: 'mietvertrag',
  heimvertrag: 'mietvertrag',
  mieterhoehung: 'mietvertrag',
  personalausweis: 'personalausweis',
  aufenthaltstitel: 'personalausweis',
  gehaltsabrechnung: 'gehaltsabrechnung',
  verdienstbescheinigung: 'verdienstbescheinigung',
  lohnersatzbescheid: 'verdienstbescheinigung',
  steuerunterlagen: 'verdienstbescheinigung',
  rentenbescheid: 'rentenbescheid',
  kontoauszug: 'kontoauszug',
  kv_nachweis: 'kv_pv_nachweis',
  schwerbehindertenausweis: 'schwerbehindertenausweis',
  pflegebescheid: 'pflegenachweis',
  kindergeldbescheid: 'kindergeldnachweis',
  unterhaltsnachweis: 'unterhaltsnachweis',
  transferleistungsbescheid: 'transferleistungsbescheid',
  vermoegensnachweis: 'vermoegensnachweis',
  sonstiges: 'sonstiges',
};

/** Ein erkannter Abschnitt, abgebildet auf Wohngeld-Begriffe. */
export interface ErkannterAbschnitt extends ExtraktionErgebnis {
  /** Abschnittstyp des Profils (z. B. „lohnersatzbescheid"). */
  abschnitt: string;
  seiteVon: number;
  seiteBis: number;
  /** Klassifikations-Konfidenz (kleinste Seiten-Konfidenz des Abschnitts). */
  konfidenz: number;
  /** Text des Abschnitts (Layout-Text), für Vorschau und Lernbeispiele. */
  text: string;
  /** Rohwerte des Profils — Grundlage für Lernbeispiele (Initialextraktion). */
  rohwerte: Record<string, unknown>;
}

// ── Reine Abbildung ──────────────────────────────────────────────────────────

const zahl = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const s = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
    const n = Number(s.replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const wahr = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined);
const rund = (n: number) => Math.round(n * 100) / 100;

/** Bruttokaltmiete = Gesamtmiete − Heizung − Warmwasser − Garage − Haushaltsenergie (§ 9 WoGG). */
export function bruttokalt(w: { gesamtmiete?: unknown; heizkosten?: unknown; warmwasser?: unknown; garage?: unknown; haushaltsenergie?: unknown }): number | undefined {
  const gesamt = zahl(w.gesamtmiete);
  if (gesamt === undefined) return undefined;
  return rund(gesamt - (zahl(w.heizkosten) ?? 0) - (zahl(w.warmwasser) ?? 0) - (zahl(w.garage) ?? 0) - (zahl(w.haushaltsenergie) ?? 0));
}

function identitaetAus(w: Record<string, unknown>): Identitaet | undefined {
  const id: Identitaet = { nachname: text(w.nachname), vorname: text(w.vorname), geburtsdatum: text(w.geburtsdatum) };
  return id.nachname || id.vorname ? id : undefined;
}

const zeilen = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((z): z is Record<string, unknown> => !!z && typeof z === 'object' && !Array.isArray(z));
const name = (z: Record<string, unknown>) => ({ nachname: text(z.nachname), vorname: text(z.vorname) });
/** Entfernt undefined-Werte (kompakte, vergleichbare Objekte). */
/** Gleiche Person nach Name (Vorname entscheidet, Nachname falls beidseitig vorhanden). */
const gleichePerson = (a: { vorname?: string; nachname?: string }, b: { vorname?: string; nachname?: string }) =>
  vornameGleich(a.vorname, b.vorname) && (!a.nachname || !b.nachname || nachnameGleich(a.nachname, b.nachname));
const kompakt = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Haushaltsangaben des Antrags aus den Profil-Rohwerten (Fragen 1, 6, 10, 12, 15, 20). */
export function haushaltAusRohwerten(w: Record<string, unknown>): HaushaltAngaben | undefined {
  // Die Extraktion liest den Antrag abschnittsweise; Namen aus anderen Formularteilen (Einnahmen, Frage 15)
  // tauchen dann als fast leere Zusatzeinträge auf. Gleiche Person ⇒ zusammenführen (Felder ergänzen);
  // die antragstellende Person gehört nicht in Frage 6.
  const at = { vorname: text(w.antragsteller_vorname), nachname: text(w.antragsteller_nachname) };
  const mitglieder: HaushaltAngaben['mitglieder'] = [];
  for (const z of zeilen(w.haushaltsmitglieder)) {
    const m = kompakt({ ...name(z), geburtsdatum: text(z.geburtsdatum), verhaeltnis: text(z.verhaeltnis), erwerbsstatus: text(z.erwerbsstatus) });
    if (!m.nachname && !m.vorname) continue;
    if (gleichePerson(m, at)) continue;
    const vorhanden = mitglieder.find((x) => gleichePerson(x, m));
    if (vorhanden) { for (const [k, v] of Object.entries(m)) if ((vorhanden as Record<string, unknown>)[k] === undefined) (vorhanden as Record<string, unknown>)[k] = v; continue; }
    mitglieder.push(m);
  }
  const einnahmen: HaushaltAngaben['einnahmen'] = [];
  for (const z of zeilen(w.einnahmen)) {
    const e = kompakt({ ...name(z), art: text(z.art), brutto: zahl(z.brutto), turnus: text(z.turnus) });
    if (!e.art && e.brutto === undefined) continue;
    if (einnahmen.some((x) => gleichePerson(x, e) && normName(x.art) === normName(e.art) && x.brutto === e.brutto)) continue;
    einnahmen.push(e);
  }
  const behinderung = zeilen(w.behinderung_pflege)
    .map((z) => kompakt({ ...name(z), gdb: zahl(z.gdb), pflegegrad: zahl(z.pflegegrad), haeuslich: wahr(z.haeuslich_pflegebeduerftig) }))
    .filter((b) => (b.nachname || b.vorname) && (b.gdb || b.pflegegrad || b.haeuslich));
  const transfer = zeilen(w.transferleistungen)
    .map((z) => kompakt({ ...name(z), leistung: text(z.leistung), beantragt: text(z.datum_beantragung), bewilligt: text(z.datum_bewilligung), weggefallen: text(z.datum_wegfall), abgelehnt: text(z.datum_ablehnung) }))
    .filter((t) => (t.nachname || t.vorname) && t.leistung);
  const summe = ['vermoegen_immobilien', 'vermoegen_geld', 'vermoegen_wertgegenstaende', 'vermoegen_sonstige']
    .reduce((acc, k) => acc + (zahl(w[k]) ?? 0), 0);
  const erwerb = text(w.antragsteller_erwerbsstatus);
  if (!mitglieder.length && !einnahmen.length && !behinderung.length && !transfer.length && !summe && !erwerb) return undefined;
  return kompakt({ antragstellerErwerbsstatus: erwerb, mitglieder, einnahmen, behinderung, transfer, vermoegen: summe > 0 ? rund(summe) : undefined });
}

/**
 * Bildet die Werte EINES Abschnitts auf Wohngeld-Strukturen ab. `conf` enthält
 * die Konfidenzen je Profilfeld (ohne Abschnitts-Präfix).
 */
export function mappeAbschnitt(abschnitt: string, w: Record<string, unknown>, conf: Record<string, number> = {}): ExtraktionErgebnis {
  const typ = ABSCHNITT_ZU_TYP[abschnitt] ?? 'sonstiges';
  const analyse: DokumentAnalyse = {};
  const setze = <K extends keyof DokumentAnalyse>(k: K, v: DokumentAnalyse[K] | undefined) => { if (v !== undefined) analyse[k] = v; };

  if (abschnitt === 'wohngeldantrag') {
    const stammdaten: ExtrahierteStammdaten = {
      antragsdatum: text(w.antragsdatum),
      wohngeldart: text(w.wohngeldart)?.toLowerCase().includes('lasten') ? 'lastenzuschuss' : 'mietzuschuss',
      antragsart: text(w.antragsart)?.toLowerCase().includes('weiter') || text(w.wohngeldnummer) ? 'weiterleistungsantrag' : 'erstantrag',
      antragsteller: { vorname: text(w.antragsteller_vorname), nachname: text(w.antragsteller_nachname), geburtsdatum: text(w.antragsteller_geburtsdatum) },
      adresse: { strasse: text(w.strasse), hausnummer: text(w.hausnummer), plz: text(w.plz), ort: text(w.ort) },
      wohnung: { miete: bruttokalt(w), wohnflaeche_qm: zahl(w.wohnflaeche_qm) },
    };
    const haushalt = haushaltAusRohwerten(w);
    if (haushalt) stammdaten.haushalt = haushalt;
    setze('unterschrift_vorhanden', wahr(w.unterschrift_vorhanden));
    setze('datum_vorhanden', wahr(w.datum_vorhanden));
    const c = (f: string) => conf[f];
    const confidenceByPfad: Record<string, number> = {};
    const paar: Array<[string, number | undefined]> = [
      ['antragsdatum', c('antragsdatum')], ['wohngeldart', c('wohngeldart')], ['antragsart', c('antragsart')],
      ['wohnung.strasse', c('strasse')], ['wohnung.hausnummer', c('hausnummer')], ['wohnung.plz', c('plz')], ['wohnung.ort', c('ort')],
      ['wohnung.miete', c('gesamtmiete')], ['wohnung.wohnflaeche_qm', c('wohnflaeche_qm')],
      ['vorname', c('antragsteller_vorname')], ['nachname', c('antragsteller_nachname')], ['geburtsdatum', c('antragsteller_geburtsdatum')],
    ];
    for (const [pfad, v] of paar) if (typeof v === 'number') confidenceByPfad[pfad] = v;
    const at = stammdaten.antragsteller!;
    return {
      typ, titel: 'Wohngeldantrag', analyse, stammdaten,
      identitaet: at.nachname || at.vorname ? { nachname: at.nachname, vorname: at.vorname, geburtsdatum: at.geburtsdatum } : undefined,
      confidenceByPfad,
    };
  }

  switch (abschnitt) {
    case 'vermieterbescheinigung':
    case 'mietvertrag':
      setze('miete', abschnitt === 'mietvertrag' && zahl(w.gesamtmiete) === undefined && zahl(w.grundmiete) !== undefined
        ? rund((zahl(w.grundmiete) ?? 0) + (zahl(w.nebenkosten) ?? 0))
        : bruttokalt(w));
      setze('wohnflaeche_qm', zahl(w.wohnflaeche_qm));
      setze('unterschrift_vorhanden', wahr(w.unterschrift_vorhanden));
      break;
    case 'untermietvertrag':
      setze('miete', zahl(w.entgelt));
      setze('wohnflaeche_qm', zahl(w.zimmer_qm));
      setze('unterschrift_vorhanden', wahr(w.unterschrift_vorhanden));
      break;
    case 'heimvertrag':
      setze('miete', zahl(w.unterkunft_gesamt));
      setze('unterschrift_vorhanden', wahr(w.unterschrift_vorhanden));
      break;
    case 'mieterhoehung': {
      const g = zahl(w.neue_gesamtmiete);
      setze('miete', g !== undefined ? rund(g - (zahl(w.heizung_warmwasser) ?? 0)) : undefined);
      break;
    }
    case 'rentenbescheid':
      setze('rentenart_vorhanden', text(w.rentenart) ? true : w.rentenart === undefined ? undefined : false);
      setze('grundrentenzeiten_vorhanden', wahr(w.grundrentenzeiten_vorhanden));
      setze('betrag', zahl(w.betrag));
      break;
    case 'kontoauszug': {
      setze('mietzahlung_erkannt', wahr(w.mietzahlung_erkannt));
      const einkuenfte: string[] = [];
      if (wahr(w.kapitalertraege_erkannt)) einkuenfte.push('kapitalertraege');
      if (wahr(w.mieteinnahmen_erkannt)) einkuenfte.push('v_und_v');
      if (einkuenfte.length) analyse.erkannte_einkuenfte = einkuenfte;
      break;
    }
    case 'gehaltsabrechnung': setze('betrag', zahl(w.brutto)); break;
    case 'verdienstbescheinigung': setze('betrag', zahl(w.monatsbrutto)); break;
    case 'lohnersatzbescheid':
    case 'kindergeldbescheid':
    case 'unterhaltsnachweis': setze('betrag', zahl(w.betrag)); break;
    case 'steuerunterlagen': setze('betrag', zahl(w.jahreseinkuenfte)); break;
    case 'vermoegensnachweis': setze('betrag', zahl(w.gesamtwert)); break;
    default: break;
  }
  const def = buildWohngeldEingangProject().segments?.[abschnitt];
  return { typ, titel: def?.label ?? 'Sonstiges Schreiben', analyse, identitaet: identitaetAus(w) };
}

/** Ergebnis des DP-Aufrufs (Ausschnitt von `extract()`). */
export interface ProfilErgebnis {
  segments?: SegmentInstance[];
  data: Record<string, unknown>;
  fieldConfidences?: Record<string, number>;
  segmentContexts?: Record<string, string>;
}

/**
 * Zerlegt ein DP-Segmentergebnis in Wohngeld-Abschnitte (nach Seiten sortiert).
 * Leerseiten sind keine Abschnitte; `unbekannt` wird zu „sonstiges".
 */
export function abschnitteAusErgebnis(r: ProfilErgebnis, profil: ExtractionProject): ErkannterAbschnitt[] {
  const defs = profil.segments ?? {};
  const out: ErkannterAbschnitt[] = [];
  for (const seg of [...(r.segments ?? [])].sort((a, b) => a.pageFrom - b.pageFrom)) {
    if (seg.type === 'leerseite') continue;
    const def = defs[seg.type];
    const key = def?.repeatable ? `${seg.type}[${seg.instance}]` : seg.type;
    const rohAlle = r.data[seg.type];
    const roh = (def?.repeatable ? (Array.isArray(rohAlle) ? rohAlle[seg.instance - 1] : undefined) : rohAlle) as Record<string, unknown> | undefined;
    const werte = { ...(roh ?? {}) };
    delete werte._beleg;
    const conf: Record<string, number> = {};
    for (const [pfad, v] of Object.entries(r.fieldConfidences ?? {})) if (pfad.startsWith(`${key}.`)) conf[pfad.slice(key.length + 1)] = v;
    const abschnitt = def ? seg.type : 'sonstiges';
    const e = mappeAbschnitt(abschnitt, werte, conf);
    const uebersichtConf: Record<string, number> = {};
    if (e.stammdaten) {
      for (const [pfad, v] of Object.entries(e.confidenceByPfad ?? {})) {
        const baum = pfad.startsWith('wohnung.') && !/miete|wohnflaeche/.test(pfad) ? `adresse.${pfad.slice(8)}` : ['vorname', 'nachname', 'geburtsdatum'].includes(pfad) ? `antragsteller.${pfad}` : ['antragsdatum', 'wohngeldart', 'antragsart'].includes(pfad) ? `antrag.${pfad}` : pfad;
        uebersichtConf[baum] = v;
      }
    }
    out.push({
      ...e,
      titel: seg.type === 'unbekannt' ? 'Nicht erkanntes Dokument' : e.titel,
      extraktion: baueExtraktionsUebersicht(e.typ, { stammdaten: e.stammdaten, analyse: e.analyse, identitaet: e.identitaet }, { fieldConfidences: uebersichtConf } as unknown as PipelineRunResult),
      abschnitt: seg.type, seiteVon: seg.pageFrom, seiteBis: seg.pageTo, konfidenz: seg.confidence,
      text: r.segmentContexts?.[key] ?? '',
      rohwerte: werte,
    });
  }
  return out;
}

// ── Profil laden / anlegen ───────────────────────────────────────────────────

/** Fingerabdruck der pflegbaren Profilteile — erkennt, ob ein Profil in der Oberfläche bearbeitet wurde. */
export function vorlagenHash(p: Pick<ExtractionProject, 'segments' | 'instructions' | 'extraction' | 'fields'>): string {
  // Reihenfolgeunabhängig: Postgres (jsonb) sortiert Objektschlüssel um.
  return stableHash([p.segments ?? null, p.instructions ?? null, p.extraction ?? null, p.fields ?? null]).slice(0, 16);
}

interface VorlagenMarke { stand: string; hash: string }

/**
 * Lädt das Profil aus der DP-Datenbank (UI-gepflegter Stand) und legt es beim
 * ersten Gebrauch aus der Vorlage an. Ohne erreichbare Datenbank läuft die
 * Vorlage im Speicher (Messwerkzeug, Tests). Nie bearbeitete Profile werden auf
 * neue Vorlagenstände angehoben (Fingerabdruck in `learning.wohngeld_vorlage`).
 */
export async function ladeProfil(): Promise<{ profil: ExtractionProject; beispiele: TrainingExample[]; quelle: 'datenbank' | 'vorlage' }> {
  try {
    const { getProject, createProject, updateProject, mutateProject } = await import('../../extraction/learning/projects');
    const { getExamples } = await import('../../extraction/learning/examples');
    const vorlage = buildWohngeldEingangProject();
    const marke: VorlagenMarke = { stand: WOHNGELD_PROFIL_VORLAGE_STAND, hash: vorlagenHash(vorlage) };
    const markieren = () => mutateProject(WOHNGELD_PROFIL_ID, (p) => ({ learning: { ...p.learning, wohngeld_vorlage: marke } as ExtractionProject['learning'] }));

    let profil = await getProject(WOHNGELD_PROFIL_ID);
    if (!profil) {
      await createProject({ name: vorlage.name, description: vorlage.description, fields: vorlage.fields, instructions: vorlage.instructions, extraction: vorlage.extraction, segments: vorlage.segments });
      await markieren();
      profil = await getProject(WOHNGELD_PROFIL_ID);
      console.log('[wohngeld] Document-Processing-Profil „Wohngeld-Eingang" aus Vorlage angelegt');
    } else {
      const bisher = (profil.learning as unknown as { wohngeld_vorlage?: VorlagenMarke }).wohngeld_vorlage;
      if (bisher?.stand !== marke.stand || bisher.hash !== marke.hash) {
        const unbearbeitet = !!bisher && vorlagenHash(profil) === bisher.hash;
        if (unbearbeitet) {
          // Neuer Vorlagenstand, Profil nie in der Oberfläche geändert → anheben.
          await updateProject(WOHNGELD_PROFIL_ID, { description: vorlage.description, instructions: vorlage.instructions, extraction: vorlage.extraction, segments: vorlage.segments, fields: vorlage.fields });
          await markieren();
          profil = await getProject(WOHNGELD_PROFIL_ID) ?? profil;
          console.log(`[wohngeld] DP-Profil auf Vorlage ${WOHNGELD_PROFIL_VORLAGE_STAND} angehoben`);
        } else {
          console.warn(`[wohngeld] DP-Profil „Wohngeld-Eingang" ist gepflegt (oder ohne Vorlagen-Marke) — Vorlage ${WOHNGELD_PROFIL_VORLAGE_STAND} bitte bei Bedarf in der Document-Processing-Oberfläche übernehmen.`);
        }
      }
    }
    if (profil) return { profil, beispiele: await getExamples(WOHNGELD_PROFIL_ID), quelle: 'datenbank' };
  } catch (err) {
    console.warn('[wohngeld] DP-Profil nicht aus der Datenbank ladbar — Vorlage im Speicher:', err instanceof Error ? err.message : err);
  }
  return { profil: buildWohngeldEingangProject(), beispiele: [], quelle: 'vorlage' };
}

/** Erkennungsweg: Profil (Standard) oder bisheriger Weg (`WOHNGELD_ERKENNUNG=legacy`). */
export const erkennungPerProfil = () => (process.env.WOHNGELD_ERKENNUNG ?? 'profil').toLowerCase() !== 'legacy';

/**
 * Erkennt alle Dokumente eines PDFs über das Segmentprofil. Wirft bei
 * Verarbeitungsfehlern (der Aufrufer fällt dann auf den bisherigen Weg zurück).
 */
export async function erkenneDokumente(
  bytes: Uint8Array,
  opts: { filename?: string; userId?: string; profil?: Awaited<ReturnType<typeof ladeProfil>> } = {},
): Promise<{ abschnitte: ErkannterAbschnitt[]; seiten: number; quelle: 'datenbank' | 'vorlage'; profilHash?: string; hinweise: string[] }> {
  const { extract, captureSnapshot } = await import('../../extraction/learning/service');
  const geladen = opts.profil ?? await ladeProfil();
  const snapshot = await captureSnapshot(geladen.profil, geladen.beispiele);
  const dir = await mkdtemp(join(tmpdir(), 'wg-dp-'));
  try {
    const pfad = join(dir, 'eingang.pdf');
    await writeFile(pfad, bytes);
    const r = await extract(WOHNGELD_PROFIL_ID, { type: 'file', path: pfad, filename: opts.filename ?? 'eingang.pdf' }, opts.userId, snapshot);
    if (!r.success) throw new Error(r.error ?? 'Document Processing lieferte kein Ergebnis');
    const abschnitte = abschnitteAusErgebnis(r, geladen.profil);
    const seiten = (r.pageImages?.length ?? 0) || Math.max(0, ...abschnitte.map((a) => a.seiteBis));
    const hinweise = (r.validations ?? []).filter((v) => v.rule_id === 'segmentierung').map((v) => v.message);
    return { abschnitte, seiten, quelle: geladen.quelle, profilHash: r.audit?.profile_hash, hinweise };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
