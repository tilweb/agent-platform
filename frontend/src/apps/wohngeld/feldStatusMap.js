/** Feld-Status-Map-Helfer (WP3) — getrennt von der Komponente wegen Fast-Refresh. */

/** Schlüssel für die Feld-Status-Map. */
export function fsKey(zielTyp, zielId, feldPfad) {
  return `${zielTyp}:${zielId}:${feldPfad}`;
}

/** Baut eine Map (Schlüssel → FeldStatus) der unbestätigten KI-Vorschläge. */
export function buildFeldStatusMap(feldStatus = []) {
  const map = {};
  for (const fs of feldStatus) {
    if (fs.quelle === 'llm' && !fs.bestaetigt) {
      map[fsKey(fs.zielTyp, fs.zielId, fs.feldPfad)] = fs;
    }
  }
  return map;
}
