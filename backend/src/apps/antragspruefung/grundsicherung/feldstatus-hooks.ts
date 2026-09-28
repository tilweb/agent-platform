/**
 * Grundsicherung — fachliche Hooks der Feld-Provenienz (rein, testbar).
 * Beim Verwerfen eines KI-Vorschlags wird der vorgeschlagene Feldwert am Ziel geleert.
 */

/** Pflichtspalten (NOT NULL): beim Verwerfen auf Default zurücksetzen statt leeren. */
export const VORGANG_FELD_DEFAULTS: Record<string, unknown> = { antragsart: 'erstantrag' };
export const PERSON_FELD_DEFAULTS: Record<string, unknown> = { nachname: '', vorname: '' };

/**
 * Updates-Objekt zum Leeren eines Feldpfads (eine oder zwei Ebenen, z. B. `antragsdatum`
 * oder `wohnung.kaltmiete`). Das übergeordnete Objekt bleibt erhalten, nur der Schlüssel fällt weg.
 */
export function leereFeldUpdates(
  ziel: Record<string, unknown>,
  feldPfad: string,
  defaults: Record<string, unknown> = {},
): Record<string, unknown> {
  const punkt = feldPfad.indexOf('.');
  if (punkt > 0) {
    const oben = feldPfad.slice(0, punkt);
    const rest = feldPfad.slice(punkt + 1);
    const alt = ziel[oben];
    if (!alt || typeof alt !== 'object' || Array.isArray(alt)) return {};
    const neu: Record<string, unknown> = { ...(alt as Record<string, unknown>) };
    delete neu[rest];
    return { [oben]: neu };
  }
  if (feldPfad in defaults) return { [feldPfad]: defaults[feldPfad] };
  return { [feldPfad]: undefined };
}
