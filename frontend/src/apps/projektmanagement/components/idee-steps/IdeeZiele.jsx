/**
 * IdeeZiele — Tab 2.
 * Nur Projektziele-Textfeld; Erfolgskriterien sind bewusst raus
 * (laut PDF, weil zu früh in der Idee-Phase).
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xl },
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  required: { color: theme.colors.error, marginLeft: '2px' },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '180px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  tip: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    lineHeight: '1.6',
  },
  tipTitle: { fontWeight: theme.typography.weights.semibold, marginBottom: theme.spacing.xs },
};

export default function IdeeZiele({ projektidee, onChange }) {
  const update = (field, value) => onChange({ ...projektidee, [field]: value });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>2. Ziele</h2>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>
          Projektziele<span style={styles.required}>*</span>
        </label>
        <textarea
          style={styles.textarea}
          placeholder={`Beschreiben Sie die Ziele der Idee...

Beispiel:
- Steigerung der Kundenzufriedenheit um 20%
- Reduzierung der Bearbeitungszeit um 30%
- Einführung eines neuen digitalen Service-Portals`}
          value={projektidee.goals || ''}
          onChange={(e) => update('goals', e.target.value)}
        />
      </div>

      <div style={styles.tip}>
        <div style={styles.tipTitle}>Tipp: RUHR PM Masterclass</div>
        <div>Gute Projektziele sind der Schlüssel zum Erfolg. Stellen Sie sicher, dass Ihre Ziele:</div>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>Klar und eindeutig formuliert sind</li>
          <li>Messbare Ergebnisse definieren</li>
          <li>Realistisch erreichbar sind</li>
          <li>Einen klaren Zeitrahmen haben</li>
        </ul>
      </div>
    </div>
  );
}
