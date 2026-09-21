/**
 * Wohngeld — Zuordnungs-Matching (Posteingang → bestehender Vorgang).
 *
 * Reine, DB-freie, deterministische Funktion: identifizierende Daten einer
 * Nachreichung (`ident`) werden feld-für-feld mit den Vergleichsdaten bestehender
 * Vorgänge (`kandidaten`) abgeglichen. Ergebnis je Kandidat: ein gewichteter
 * `score`, ein `level` (hoch/mittel/gering) und — für die Transparenz-UI — eine
 * Vergleichsliste `vergleich[]` mit Status je Feld (gleich/abweichung/fehlt).
 *
 * Sicherheits-Leitplanke: Diese Funktion SCHLÄGT nur vor. Sie ordnet nichts zu.
 * Ohne identifizierendes Feld in `ident` gibt es KEINEN Vorschlag (leeres Array).
 */

/** Identifizierende Daten aus einer Nachreichung (Antrag-Stammdaten und/oder Nachweis-Identität). */
export interface MatchIdent {
  nachname?: string;
  vorname?: string;
  geburtsdatum?: string;
  plz?: string;
  ort?: string;
  strasse?: string;
  hausnummer?: string;
  /** Fachliche Antrags-ID, falls im Dokument genannt (sehr starkes Signal). */
  antragsId?: string;
  /** Alternatives Aktenzeichen, falls im Dokument genannt (wie antragsId gewertet). */
  aktenzeichen?: string;
}

/** Vergleichsdaten eines bestehenden Vorgangs (aus Vorgang + Akte + Antragsteller-Person). */
export interface MatchKandidat {
  vorgangId: string;
  antragsId?: string;
  akteName?: string;
  antragstellerName?: string;
  nachname?: string;
  vorname?: string;
  geburtsdatum?: string;
  plz?: string;
  ort?: string;
  strasse?: string;
  hausnummer?: string;
}

/** Status eines Feld-für-Feld-Vergleichs (Nachreichung ↔ Vorgang). */
export type VergleichStatus = 'gleich' | 'abweichung' | 'fehlt';

/** Eine Zeile der Transparenz-Vergleichstabelle. */
export interface VergleichZeile {
  feld: string;
  label: string;
  /** Wert aus der Nachreichung (Original, nicht normalisiert). */
  ausDokument?: string;
  /** Wert im bestehenden Vorgang (Original, nicht normalisiert). */
  imVorgang?: string;
  status: VergleichStatus;
}

/** Übereinstimmungs-Grad aus dem Score. */
export type MatchLevel = 'hoch' | 'mittel' | 'gering';

/** Bewerteter Kandidat inkl. transparentem Abgleich. */
export interface ScoredKandidat {
  vorgangId: string;
  antragsId?: string;
  akteName?: string;
  antragstellerName?: string;
  score: number;
  level: MatchLevel;
  vergleich: VergleichZeile[];
}

// ── Normalisierung (deterministisch) ─────────────────────────────────────────

/** lowercase, Umlaute → ae/oe/ue/ss, Whitespace kollabiert, getrimmt. */
export function normText(v?: string): string {
  if (!v) return '';
  return v
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Datum auf ISO (JJJJ-MM-TT) normalisieren; toleriert TT.MM.JJJJ und JJJJ-MM-TT. */
export function normDate(v?: string): string {
  if (!v) return '';
  const s = v.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`;
  return normText(s);
}

/** IDs/Aktenzeichen: nur alphanumerisch, lowercase (Trennzeichen ignorieren). */
export function normId(v?: string): string {
  if (!v) return '';
  return v.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// ── Feld-Definitionen (Signal-Gewichte + Vergleich) ──────────────────────────

interface FeldDef {
  feld: string;
  label: string;
  weight: number;
  /** starkes Signal — eine Abweichung dämpft den Level (nie „hoch"). */
  strong: boolean;
  norm: (s?: string) => string;
  doc: (i: MatchIdent) => string | undefined;
  vorg: (k: MatchKandidat) => string | undefined;
}

const FELD_DEFS: FeldDef[] = [
  { feld: 'antragsId', label: 'Antrags-ID', weight: 60, strong: true, norm: normId, doc: (i) => i.antragsId || i.aktenzeichen, vorg: (k) => k.antragsId },
  { feld: 'nachname', label: 'Nachname', weight: 30, strong: true, norm: normText, doc: (i) => i.nachname, vorg: (k) => k.nachname },
  { feld: 'geburtsdatum', label: 'Geburtsdatum', weight: 25, strong: true, norm: normDate, doc: (i) => i.geburtsdatum, vorg: (k) => k.geburtsdatum },
  { feld: 'vorname', label: 'Vorname', weight: 12, strong: false, norm: normText, doc: (i) => i.vorname, vorg: (k) => k.vorname },
  { feld: 'plz', label: 'PLZ', weight: 6, strong: false, norm: normText, doc: (i) => i.plz, vorg: (k) => k.plz },
  { feld: 'ort', label: 'Ort', weight: 6, strong: false, norm: normText, doc: (i) => i.ort, vorg: (k) => k.ort },
  { feld: 'strasse', label: 'Straße', weight: 6, strong: false, norm: normText, doc: (i) => i.strasse, vorg: (k) => k.strasse },
  { feld: 'hausnummer', label: 'Hausnummer', weight: 6, strong: false, norm: normText, doc: (i) => i.hausnummer, vorg: (k) => k.hausnummer },
];

/** Score-Schwellen → Level. */
const LEVEL_HOCH = 55;
const LEVEL_MITTEL = 30;

function levelFromScore(score: number): MatchLevel {
  if (score >= LEVEL_HOCH) return 'hoch';
  if (score >= LEVEL_MITTEL) return 'mittel';
  return 'gering';
}

/** Enthält `ident` mindestens ein identifizierendes Feld (nach Normalisierung)? */
export function hatIdentifizierendeDaten(ident: MatchIdent): boolean {
  return FELD_DEFS.some((d) => d.norm(d.doc(ident)));
}

/**
 * Bewertet alle Kandidaten gegen `ident`. Rückgabe: nur Kandidaten mit score>0,
 * absteigend sortiert, Top 5. Ohne identifizierende Daten in `ident` → leeres
 * Array (kein Vorschlag — rein manuelle Zuordnung).
 */
export function matchVorgaenge(ident: MatchIdent, kandidaten: MatchKandidat[]): ScoredKandidat[] {
  if (!ident || !hatIdentifizierendeDaten(ident)) return [];

  const results: ScoredKandidat[] = [];

  for (const k of kandidaten) {
    let score = 0;
    let starkeAbweichung = false;
    const vergleich: VergleichZeile[] = [];

    for (const d of FELD_DEFS) {
      const docRaw = d.doc(ident);
      const vorgRaw = d.vorg(k);
      const docN = d.norm(docRaw);
      const vorgN = d.norm(vorgRaw);
      // Zeile nur zeigen, wenn mindestens eine Seite einen Wert hat.
      if (!docN && !vorgN) continue;

      let status: VergleichStatus;
      if (!docN || !vorgN) status = 'fehlt';
      else if (docN === vorgN) status = 'gleich';
      else status = 'abweichung';

      if (status === 'gleich') score += d.weight;
      if (status === 'abweichung' && d.strong) starkeAbweichung = true;

      vergleich.push({
        feld: d.feld,
        label: d.label,
        ausDokument: docRaw?.trim() || undefined,
        imVorgang: vorgRaw?.trim() || undefined,
        status,
      });
    }

    if (score <= 0) continue;

    let level = levelFromScore(score);
    // Eine Abweichung in einem starken Signal (Name/Geburtsdatum/Antrags-ID)
    // verhindert „hoch" — die Sachbearbeitung soll ausdrücklich prüfen.
    if (starkeAbweichung && level === 'hoch') level = 'mittel';

    results.push({
      vorgangId: k.vorgangId,
      antragsId: k.antragsId,
      akteName: k.akteName,
      antragstellerName: k.antragstellerName,
      score,
      level,
      vergleich,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}
