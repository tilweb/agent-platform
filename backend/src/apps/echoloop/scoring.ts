/**
 * Echo-Loop Scoring — deterministische Reifegrad-Kennzahlen.
 *
 * Erweitert die Logik aus `backend/src/tools/special/reifegrad-score.ts`
 * (Pflicht-Level-Raster WB44 §3b, RGQ, Gesamt-RG, Limiter) um die
 * Soll-Profil-Methode D-062 (docs/Echo-Loop-App/02_Standards/SOLL-PROFIL_METHODE.md):
 *
 *   - RG*  (relevanz-gefilterter harter Reifegrad) = min { Ist_i | r_i = 1 }
 *   - SE   (Soll-Erfuellung) = Σ r_i·min(Ist_i, Soll_i) / Σ r_i·Soll_i   (Ueber-Soll zaehlt NICHT)
 *   - RGQ  (absolute Quote)  = Σ Ist_i(D1..D10) / 50                     (Maske zaehlt hier NICHT)
 *   - Gesamt-RG (CMMI-Grade) = hoechste Stufe, deren Pflicht-Raster voll erfuellt ist (unmaskiert)
 *
 * D6b (Datenfluss) ist eine Zusatz-Dimension: sie geht in SE und RG* ein,
 * NICHT in RGQ und NICHT ins Pflicht-Raster (Skalen-Kompatibilitaet).
 *
 * Reine Funktionen, keine Seiteneffekte — LLM/Handler liefern nur die Levels,
 * die Mathematik lebt hier (so entfallen LLM-Rechenfehler).
 */

/** Kern-Dimensionen D1..D10 (Reihenfolge = Raster-Index 0..9). */
export const CORE_DIMS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const;
export type CoreDim = (typeof CORE_DIMS)[number];
/** Alle bewerteten Dimensionen inkl. Zusatz-Dimension D6b (Datenfluss). */
export const ALL_DIMS = [...CORE_DIMS, 'd6b'] as const;
export type Dim = (typeof ALL_DIMS)[number];

export const DIM_LABEL: Record<Dim, string> = {
  d1: 'Wahrnehmung/Anker',
  d2: 'Timing/Sync',
  d3: 'Fehler/Ausgänge',
  d4: 'Selbstheilung/Wiederanlauf',
  d5: 'Idempotenz/Konsistenz',
  d6: 'Konfiguration',
  d6b: 'Datenfluss',
  d7: 'Messung/Beobachtbarkeit',
  d8: 'Sicherheit/Compliance',
  d9: 'Modularität',
  d10: 'Portabilität',
};

/** Pflicht-Mindestlevel je Gesamtstufe (Index 0=D1 … 9=D10). 0 = nicht gefordert. WB44 §3b. */
const RASTER: Record<number, number[]> = {
  1: [3, 2, 2, 1, 1, 0, 0, 1, 1, 0],
  2: [3, 2, 2, 2, 2, 1, 1, 1, 1, 0],
  3: [3, 3, 4, 3, 2, 2, 1, 2, 1, 1],
  4: [3, 3, 4, 3, 3, 3, 3, 2, 2, 2],
  5: [4, 3, 4, 4, 3, 4, 3, 3, 4, 4],
};

/** Bewertung einer Dimension: Ist/Soll-Level (0-5) + Relevanz-Maske (1=zählt, 0=belegt irrelevant). */
export interface DimAssessment {
  ist: number;
  soll: number;
  relevanz: 0 | 1;
}

export type DimInput = Partial<Record<Dim, Partial<DimAssessment>>>;

export interface ScoreResult {
  /** normalisierte Bewertung je Dimension (geclampt, defaults gefüllt) */
  dimensionen: Record<Dim, DimAssessment>;
  /** Σ Ist(D1..D10) */
  levelSum: number;
  /** absolute Quote in % = Σ Ist(D1..D10) / 50 */
  rgq: number;
  /** CMMI-Gesamtreifegrad 0-5 (Pflicht-Raster, unmaskiert) */
  gesamtRg: number;
  /** relevanz-gefilterter harter Reifegrad = min{ Ist | relevanz=1 } über alle Dims inkl. D6b */
  rgStar: number;
  /** Soll-Erfüllung in % = Σ r·min(Ist,Soll) / Σ r·Soll (Über-Soll gekappt) */
  seQuotient: number;
  /** Dimensionen, die die nächste Gesamtstufe blockieren, z.B. "D3 (L1→L2)" */
  limiter: string[];
  /** kompakte Noten-Zeile für Reports */
  notenZeile: string;
}

function clampLevel(v: unknown): number {
  const n = Number(v);
  if (v === undefined || v === null || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

/** Normalisiert die Eingabe: fehlende Dims → ist/soll 0, relevanz default 1. */
export function normalizeDims(input: DimInput): Record<Dim, DimAssessment> {
  const out = {} as Record<Dim, DimAssessment>;
  for (const d of ALL_DIMS) {
    const raw = input[d] ?? {};
    const relevanz: 0 | 1 = raw.relevanz === 0 ? 0 : 1;
    out[d] = { ist: clampLevel(raw.ist), soll: clampLevel(raw.soll), relevanz };
  }
  return out;
}

/**
 * Berechnet alle Kennzahlen deterministisch aus den Dimensions-Bewertungen.
 */
export function computeScores(input: DimInput): ScoreResult {
  const dims = normalizeDims(input);

  // RGQ + Gesamt-RG: nur Kern-Dims D1..D10, Maske zählt hier NICHT (absolute Skala).
  const coreIst = CORE_DIMS.map((d) => dims[d].ist);
  const levelSum = coreIst.reduce((s, v) => s + v, 0);
  const rgq = Math.round((levelSum / 50) * 100);

  const meets = (n: number) => (RASTER[n] ?? []).every((min, i) => (coreIst[i] ?? 0) >= min);
  let gesamtRg = 0;
  for (let n = 1; n <= 5; n++) {
    if (meets(n)) gesamtRg = n;
    else break;
  }

  // Limiter = Pflicht-Dimensionen, die die nächste Stufe blockieren.
  const target = Math.min(gesamtRg + 1, 5);
  const limiter: string[] = [];
  if (gesamtRg < 5) {
    (RASTER[target] ?? []).forEach((min, i) => {
      const ist = coreIst[i] ?? 0;
      if (min > 0 && ist < min) {
        const d = CORE_DIMS[i]!;
        limiter.push(`${d.toUpperCase()} (L${ist}→L${min})`);
      }
    });
  }

  // RG* = min über relevante Dims (inkl. D6b). Ohne relevante Dim → 0.
  const relevant = ALL_DIMS.filter((d) => dims[d].relevanz === 1);
  const rgStar = relevant.length ? Math.min(...relevant.map((d) => dims[d].ist)) : 0;

  // SE = Σ r·min(Ist,Soll) / Σ r·Soll (über alle Dims inkl. D6b; Über-Soll gekappt).
  let seNum = 0;
  let seDen = 0;
  for (const d of ALL_DIMS) {
    const { ist, soll, relevanz } = dims[d];
    if (relevanz !== 1) continue;
    seNum += Math.min(ist, soll);
    seDen += soll;
  }
  const seQuotient = seDen > 0 ? Math.round((seNum / seDen) * 100) : 0;

  const notenZeile =
    `RG-Gesamt: RG${gesamtRg} · RG*: ${rgStar} · ` +
    CORE_DIMS.map((d) => `${d.toUpperCase()} L${dims[d].ist}`).join(' · ') +
    ` · RGQ: ${rgq}% · SE: ${seQuotient}% · Limiter: ${limiter.length ? limiter.map((l) => l.split(' ')[0]).join('/') : '—'}`;

  return { dimensionen: dims, levelSum, rgq, gesamtRg, rgStar, seQuotient, limiter, notenZeile };
}

// ── Zwei-Naturen der Reife (STANDARD_Zwei-Naturen-der-Reife_v1) ──────────────
//
// L1–L3 = Robustheit (GEBAUT, am Einzelprozess nachweisbar).
// L4–L5 = Skalierung (VEREINBART, nur gegen den Haus-Standard nachweisbar). L0 = Boden.
//
// Wichtig (A-1): Wir bauen NUR Darstellung + Prüfung der Vereinbarungs-Gates.
// Die SE-Formel bleibt unverändert (SE-B/SE-W ist Deutung, KEIN Formelsplit).
// Ein „Papier-Level" senkt hier NICHT automatisch das Ist — die normative
// WB44-§3b-Änderung zieht Seb im Review nach; wir liefern die Prüf-Flags.

export type LevelKlasse = 'boden' | 'robustheit' | 'skalierung';

/** Natur eines Levels: L0 Boden · L1–L3 Robustheit (gebaut) · L4–L5 Skalierung (vereinbart). */
export function levelKlasse(level: number): LevelKlasse {
  if (level <= 0) return 'boden';
  if (level <= 3) return 'robustheit';
  return 'skalierung';
}

/** Ein Vereinbarungs-Gate: sitzt auf genau einer (Dimension, Level)-Zelle (R2). */
export interface VereinbarungsGate {
  id: string;        // 'D6-L3'
  dim: CoreDim;
  level: number;     // Level-Zelle, an der das Gate sitzt
  fordert: string;   // Wortlaut der Forderung (R2-Tabelle)
}

/** Die vier Gates aus R2 (D6-L3/D7-L4/D9-L4/D10-L2) — D10-L2 ist der Namens-Sonderfall auf L2. */
export const VEREINBARUNGS_GATES: VereinbarungsGate[] = [
  { id: 'D6-L3', dim: 'd6', level: 3, fordert: 'Einstellungs-Datei mit benannten, versionierten Schlüsseln + Config-Bootstrap (fester Anker, Existenz-Gate, Versionszeile — K-23)' },
  { id: 'D7-L4', dim: 'd7', level: 4, fordert: 'Kennzahlen-Felder folgen dem Haus-Schema (Lauf-Protokoll-Spalten normiert) — sonst keine Aggregierbarkeit' },
  { id: 'D9-L4', dim: 'd9', level: 4, fordert: 'Bausteine folgen der dokumentierten Namenskonvention + liegen im Bibliotheks-Namensraum' },
  { id: 'D10-L2', dim: 'd10', level: 2, fordert: 'Namen ohne Umgebungs-/Personen-Bezüge (kein TEST_, kein Vorname, kein Server)' },
];

/**
 * Doppel-Nachweis je Gate (R3): T-A (Statik: Schema/Namen/Version im Export sichtbar)
 * + T-B/T-C-Stichprobe (gelebt: Stand aktuell, Owner benannt, Protokoll wird geschrieben).
 * Beide Teile offen (undefined) = noch nicht erhoben → Panel-Frage.
 */
export interface GateNachweis {
  statik?: boolean;    // T-A
  gelebt?: boolean;    // T-B/T-C
  belegStatik?: string;
  belegGelebt?: string;
}

export type GateStatus =
  | 'nicht_relevant'   // Level weder erreicht noch angestrebt
  | 'offen'            // als Soll angestrebt, aber Ist < Gate-Level → Org-Vereinbarung ausstehend
  | 'nachgewiesen'     // Ist ≥ Gate-Level UND T-A + T-B/T-C erfüllt
  | 'papier'           // Ist ≥ Gate-Level, Statik da, aber NICHT gelebt → Papier-Level
  | 'ungeprueft'       // Ist ≥ Gate-Level, aber Nachweis (noch) nicht erhoben → ❓ am Panel
  | 'nicht_belegt';    // Ist ≥ Gate-Level, aber Statik fehlt → Behauptung ohne Beleg

export interface GateBewertung extends VereinbarungsGate {
  istLevel: number;
  sollLevel: number;
  klasse: LevelKlasse;
  status: GateStatus;
  statik: boolean | null;
  gelebt: boolean | null;
  /** Kundenfähiger Hinweis mit Org-Träger-Benennung (R6) — nur bei offenen/Papier-Gates gesetzt. */
  hinweis?: string;
}

const GATE_ORGTRAEGER: Record<string, string> = {
  'D6-L3': 'Fachbereich/Admin (Einstellungs-Datei + Versionierung)',
  'D7-L4': 'Management (Kennzahlen-/Feld-Schema des Hauses)',
  'D9-L4': 'Plattform-/Bibliotheks-Owner (Namenskonvention + Namensraum)',
  'D10-L2': 'Betrieb (umgebungs-/personenfreie Namensgebung)',
};

/**
 * Bewertet die vier Vereinbarungs-Gates gegen die Ist/Soll-Levels + optionale
 * Doppel-Nachweise. Rein deterministisch; ändert weder Ist noch SE.
 */
export function bewerteVereinbarungsGates(
  input: DimInput,
  nachweise: Partial<Record<string, GateNachweis>> = {},
): GateBewertung[] {
  const dims = normalizeDims(input);
  return VEREINBARUNGS_GATES.map((g) => {
    const ist = dims[g.dim].ist;
    const soll = dims[g.dim].soll;
    const relevanz = dims[g.dim].relevanz;
    const nw = nachweise[g.id] ?? {};
    const statik = nw.statik ?? null;
    const gelebt = nw.gelebt ?? null;

    let status: GateStatus;
    if (relevanz === 1 && ist >= g.level) {
      if (statik === false) status = 'nicht_belegt';
      else if (statik === true && gelebt === true) status = 'nachgewiesen';
      else if (statik === true && gelebt === false) status = 'papier';
      else status = 'ungeprueft';
    } else if (relevanz === 1 && soll >= g.level) {
      status = 'offen';
    } else {
      status = 'nicht_relevant';
    }

    const org = GATE_ORGTRAEGER[g.id] ?? 'die Organisation';
    let hinweis: string | undefined;
    if (status === 'offen') hinweis = `${g.id} (${g.fordert}) ist ein Vereinbarungs-Gate — Träger: ${org}. Bau allein hebt das Level nicht.`;
    else if (status === 'papier') hinweis = `${g.id}: statisch vorhanden, aber nicht gelebt (Papier-Level) — ${org} muss es tragen.`;
    else if (status === 'nicht_belegt') hinweis = `${g.id}: als erreicht geführt, aber ohne statischen Beleg — am Panel klären.`;
    else if (status === 'ungeprueft') hinweis = `${g.id}: Doppel-Nachweis (Statik + gelebt) noch offen — ❓ am Panel prüfen.`;

    return { ...g, istLevel: ist, sollLevel: soll, klasse: levelKlasse(g.level), status, statik, gelebt, hinweis };
  });
}

/** Gates, deren geführtes Level nicht sauber getragen ist (Papier/unbelegt) — für Panel-Warnung. */
export function papierLevelWarnungen(bewertungen: GateBewertung[]): GateBewertung[] {
  return bewertungen.filter((b) => b.status === 'papier' || b.status === 'nicht_belegt');
}
