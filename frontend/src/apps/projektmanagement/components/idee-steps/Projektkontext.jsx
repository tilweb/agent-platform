/**
 * Projektkontext — Tab 3.
 * Zwei freie Textfelder: Ausgangslage (warum/wofuer) und Rahmenbedingungen
 * (von welchen Faktoren abhaengig).
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
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '160px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
};

export default function Projektkontext({ projektidee, onChange }) {
  const ctx = projektidee.context ?? { ausgangslage: '', rahmenbedingungen: '' };
  const update = (field, value) =>
    onChange({ ...projektidee, context: { ...ctx, [field]: value } });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>3. Projektkontext</h2>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Ausgangslage</label>
        <span style={styles.hint}>Warum und in welchem Rahmen ist die Projektidee entstanden?</span>
        <textarea
          style={styles.textarea}
          placeholder="Beschreiben Sie die Ausgangslage..."
          value={ctx.ausgangslage || ''}
          onChange={(e) => update('ausgangslage', e.target.value)}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Rahmenbedingungen</label>
        <span style={styles.hint}>Von welchen Faktoren ist die Projektidee abhaengig?</span>
        <textarea
          style={styles.textarea}
          placeholder="z.B. Budget-Freigabe, Personalverfuegbarkeit, regulatorische Anforderungen..."
          value={ctx.rahmenbedingungen || ''}
          onChange={(e) => update('rahmenbedingungen', e.target.value)}
        />
      </div>
    </div>
  );
}
