/**
 * Grundsicherung — Normalisierung von Namen und Datumsangaben (rein, deterministisch).
 * Grundlage für Match (Posteingang → Vorgang) und Personenzuordnung der Nachweise.
 */

/** lowercase, Umlaute → ae/oe/ue/ss, Whitespace kollabiert, getrimmt. */
export function normText(v?: string): string {
  if (!v) return '';
  return v.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ').trim();
}

/** Datum auf ISO (JJJJ-MM-TT) normalisieren; toleriert TT.MM.JJJJ und JJJJ-MM-TT. Sonst ''. */
export function normDate(v?: string): string {
  if (!v) return '';
  const s = v.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`;
  return '';
}

/** IDs/Aktenzeichen: nur alphanumerisch, lowercase. */
export function normId(v?: string): string {
  return v ? v.replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
}

/** Namensvergleich: ohne Diakritika, Kleinschreibung, nur Buchstaben/Leerzeichen/Bindestrich. */
export function normName(v?: string): string {
  if (!v) return '';
  const basis = normText(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
  return basis.replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const teile = (v: string) => v.split(/[\s-]+/).filter(Boolean);

/** Vornamen gleich: erster Vorname gleich oder einer vollständig im anderen enthalten. */
export function vornameGleich(a?: string, b?: string): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y || teile(x)[0] === teile(y)[0]) return true;
  const tx = new Set(teile(x)), ty = teile(y);
  return ty.every((t) => tx.has(t)) || [...tx].every((t) => ty.includes(t));
}

/** Nachnamen gleich (Doppelnamen: ein gemeinsamer Namensteil > 2 Zeichen genügt). */
export function nachnameGleich(a?: string, b?: string): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const ty = teile(y);
  return teile(x).some((t) => t.length > 2 && ty.includes(t));
}

/** Gleiche Person nach Name (Vorname entscheidet, Nachname falls beidseitig vorhanden). */
export function gleichePerson(a: { vorname?: string; nachname?: string }, b: { vorname?: string; nachname?: string }): boolean {
  if (!normName(a.vorname) || !normName(b.vorname)) {
    return !normName(a.vorname) && !normName(b.vorname) && nachnameGleich(a.nachname, b.nachname);
  }
  return vornameGleich(a.vorname, b.vorname) && (!normName(a.nachname) || !normName(b.nachname) || nachnameGleich(a.nachname, b.nachname));
}
