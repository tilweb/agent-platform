/**
 * Grundsicherung — Zuordnungs-Matching (Posteingang → bestehender Vorgang).
 *
 * Reine, DB-freie, deterministische Funktion (gleiche Mechanik wie Wohngeld): identifizierende
 * Daten eines Eingangs (`ident`) werden feld-für-feld mit bestehenden Vorgängen verglichen.
 * Hauptsignale sind **Name + Geburtsdatum** (Spec „Posteingang und Erkennung"), dazu Aktenzeichen
 * und Anschrift. Ergebnis je Kandidat: `score`, `level` (hoch/mittel/gering) und eine
 * transparente Vergleichsliste.
 *
 * Leitplanke: schlägt nur vor, ordnet nichts zu. Ohne identifizierendes Feld kein Vorschlag.
 */
import { normDate, normId, normText } from './namen';

/** Identifizierende Daten eines Eingangs (Antrag-Stammdaten und/oder Nachweis-Identität). */
export interface MatchIdent {
  nachname?: string;
  vorname?: string;
  geburtsdatum?: string;
  plz?: string;
  ort?: string;
  strasse?: string;
  hausnummer?: string;
  /** Aktenzeichen des Sozialamts bzw. Vorgangsnummer, falls im Dokument genannt (sehr starkes Signal). */
  aktenzeichen?: string;
}

/** Vergleichsdaten eines bestehenden Vorgangs (Vorgang + Akte + Antragsteller-Person). */
export interface MatchKandidat {
  vorgangId: string;
  vorgangsnummer?: string;
  aktenzeichen?: string;
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

export type VergleichStatus = 'gleich' | 'abweichung' | 'fehlt';

export interface VergleichZeile {
  feld: string;
  label: string;
  ausDokument?: string;
  imVorgang?: string;
  status: VergleichStatus;
}

export type MatchLevel = 'hoch' | 'mittel' | 'gering';

/**
 * Bewerteter Kandidat. `antragsId` trägt (wie bei Wohngeld) die angezeigte Nummer des Vorgangs —
 * hier die Vorgangsnummer; `vorgangsnummer` ist derselbe Wert unter dem fachlichen Namen.
 */
export interface ScoredKandidat {
  vorgangId: string;
  antragsId?: string;
  vorgangsnummer?: string;
  akteName?: string;
  antragstellerName?: string;
  score: number;
  level: MatchLevel;
  vergleich: VergleichZeile[];
}

interface FeldDef {
  feld: string;
  label: string;
  weight: number;
  strong: boolean;
  norm: (s?: string) => string;
  doc: (i: MatchIdent) => string | undefined;
  vorg: (k: MatchKandidat) => string | undefined;
}

/** Aktenzeichen des Dokuments gegen Aktenzeichen ODER Vorgangsnummer des Vorgangs. */
function nummerImVorgang(i: MatchIdent, k: MatchKandidat): string | undefined {
  const doc = normId(i.aktenzeichen);
  if (doc && normId(k.vorgangsnummer) === doc) return k.vorgangsnummer;
  return k.aktenzeichen || k.vorgangsnummer;
}

const FELD_DEFS: FeldDef[] = [
  { feld: 'aktenzeichen', label: 'Aktenzeichen', weight: 60, strong: true, norm: normId, doc: (i) => i.aktenzeichen, vorg: () => undefined },
  { feld: 'nachname', label: 'Nachname', weight: 30, strong: true, norm: normText, doc: (i) => i.nachname, vorg: (k) => k.nachname },
  { feld: 'geburtsdatum', label: 'Geburtsdatum', weight: 25, strong: true, norm: normDate, doc: (i) => i.geburtsdatum, vorg: (k) => k.geburtsdatum },
  { feld: 'vorname', label: 'Vorname', weight: 12, strong: false, norm: normText, doc: (i) => i.vorname, vorg: (k) => k.vorname },
  { feld: 'plz', label: 'PLZ', weight: 6, strong: false, norm: normText, doc: (i) => i.plz, vorg: (k) => k.plz },
  { feld: 'ort', label: 'Ort', weight: 6, strong: false, norm: normText, doc: (i) => i.ort, vorg: (k) => k.ort },
  { feld: 'strasse', label: 'Straße', weight: 6, strong: false, norm: normText, doc: (i) => i.strasse, vorg: (k) => k.strasse },
  { feld: 'hausnummer', label: 'Hausnummer', weight: 6, strong: false, norm: normText, doc: (i) => i.hausnummer, vorg: (k) => k.hausnummer },
];

const LEVEL_HOCH = 55;
const LEVEL_MITTEL = 30;

/** Unabhängige Übereinstimmungen: Nachname, Vorname, Geburtsdatum; Adresse zählt als eine. */
export function unabhaengigeTreffer(gleich: Set<string>): number {
  let n = 0;
  for (const f of ['nachname', 'vorname', 'geburtsdatum']) if (gleich.has(f)) n++;
  if ((gleich.has('strasse') && gleich.has('hausnummer')) || (gleich.has('plz') && gleich.has('ort'))) n++;
  return n;
}

export function hatIdentifizierendeDaten(ident: MatchIdent): boolean {
  return FELD_DEFS.some((d) => d.norm(d.doc(ident)));
}

/**
 * Bewertet alle Kandidaten gegen `ident`: nur score > 0, absteigend, Top 5.
 * Level-Regeln: Abweichung in Name/Geburtsdatum/Nummer ⇒ nie „hoch"; abweichendes Geburtsdatum
 * ⇒ „gering" (andere Person), außer das Aktenzeichen stimmt; weniger als zwei unabhängige
 * Übereinstimmungen ⇒ „gering".
 */
export function matchVorgaenge(ident: MatchIdent, kandidaten: MatchKandidat[]): ScoredKandidat[] {
  if (!ident || !hatIdentifizierendeDaten(ident)) return [];
  const results: ScoredKandidat[] = [];

  for (const k of kandidaten) {
    let score = 0;
    let starkeAbweichung = false;
    const gleich = new Set<string>();
    const abweichend = new Set<string>();
    const vergleich: VergleichZeile[] = [];

    for (const d of FELD_DEFS) {
      const docRaw = d.doc(ident);
      const vorgRaw = d.feld === 'aktenzeichen' ? nummerImVorgang(ident, k) : d.vorg(k);
      const docN = d.norm(docRaw);
      const vorgN = d.norm(vorgRaw);
      if (!docN && !vorgN) continue;
      // Nummer nur zeigen/werten, wenn das Dokument eine nennt (jeder Vorgang hat eine Nummer).
      if (d.feld === 'aktenzeichen' && !docN) continue;

      let status: VergleichStatus;
      if (!docN || !vorgN) status = 'fehlt';
      else if (docN === vorgN) status = 'gleich';
      else status = 'abweichung';

      if (status === 'gleich') { score += d.weight; gleich.add(d.feld); }
      if (status === 'abweichung') {
        score -= d.strong ? d.weight : d.weight / 2;
        abweichend.add(d.feld);
        if (d.strong) starkeAbweichung = true;
      }
      vergleich.push({ feld: d.feld, label: d.label, ausDokument: docRaw?.trim() || undefined, imVorgang: vorgRaw?.trim() || undefined, status });
    }

    if (score <= 0) continue;
    let level: MatchLevel = score >= LEVEL_HOCH ? 'hoch' : score >= LEVEL_MITTEL ? 'mittel' : 'gering';
    const nummerGleich = gleich.has('aktenzeichen');
    if (starkeAbweichung && level === 'hoch') level = 'mittel';
    if (abweichend.has('geburtsdatum') && !nummerGleich) level = 'gering';
    if (!nummerGleich && unabhaengigeTreffer(gleich) < 2) level = 'gering';

    results.push({
      vorgangId: k.vorgangId, antragsId: k.vorgangsnummer, vorgangsnummer: k.vorgangsnummer,
      akteName: k.akteName, antragstellerName: k.antragstellerName, score, level, vergleich,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}
