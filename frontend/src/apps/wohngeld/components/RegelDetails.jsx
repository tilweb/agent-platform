import { theme } from '../../../config/theme';
import { PRUEF_KATEGORIE_LABEL, PRUEF_TYP_LABEL } from '../api';

const styles = {
  box: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, lineHeight: 1.55, display: 'grid', gridTemplateColumns: 'minmax(110px, max-content) 1fr', gap: `${theme.spacing.xs} ${theme.spacing.md}` },
  k: { color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium },
  v: { color: theme.colors.text },
  hinweise: { margin: 0, paddingLeft: theme.spacing.lg },
};

const BEZUG_LABEL = { vorgang: 'Vorgang', person: 'je Person', dokument: 'je Dokument' };

/**
 * Beschreibung einer Prüfregel: Auslöser, geforderter Nachweis, Rechtsgrundlage,
 * Erledigung und Hinweise zur Anwendung. `kompakt` blendet Kategorie/Typ aus
 * (am Prüfschritt stehen sie schon als Badges).
 */
export default function RegelDetails({ regel, kompakt = false }) {
  if (!regel) return null;
  return (
    <div style={styles.box}>
      {!kompakt && (
        <>
          <span style={styles.k}>Art</span>
          <span style={styles.v}>{PRUEF_KATEGORIE_LABEL[regel.kategorie] || regel.kategorie} · {PRUEF_TYP_LABEL[regel.typ] || regel.typ} · {BEZUG_LABEL[regel.bezug] || regel.bezug}</span>
        </>
      )}
      <span style={styles.k}>Wann meldet die App?</span>
      <span style={styles.v}>{regel.ausloeser}</span>
      {regel.nachweis && (
        <>
          <span style={styles.k}>Geforderter Nachweis</span>
          <span style={styles.v}>{regel.nachweis}</span>
        </>
      )}
      <span style={styles.k}>Rechtsgrundlage</span>
      <span style={styles.v}>{regel.rechtsgrundlage}</span>
      <span style={styles.k}>So erledigen</span>
      <span style={styles.v}>{regel.erledigung}</span>
      {regel.hinweise?.length > 0 && (
        <>
          <span style={styles.k}>Hinweise zur Anwendung</span>
          <ul style={styles.hinweise}>{regel.hinweise.map((h) => <li key={h} style={styles.v}>{h}</li>)}</ul>
        </>
      )}
    </div>
  );
}
