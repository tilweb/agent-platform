/**
 * StatusberichtBasis
 * Ampel-Toggle, Datum, Management Summary
 */

import { theme } from '../../../../config/theme';

const AMPEL_OPTIONS = [
  { value: 'gruen', color: theme.colors.success, label: 'Grün' },
  { value: 'gelb', color: theme.colors.warning, label: 'Gelb' },
  { value: 'rot', color: theme.colors.error, label: 'Rot' },
];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  required: {
    color: theme.colors.error,
    marginLeft: '2px',
  },
  ampelGroup: {
    display: 'flex',
    gap: theme.spacing.lg,
  },
  ampelOption: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.lg,
    border: `2px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: theme.colors.surface,
  },
  ampelDot: {
    width: '20px',
    height: '20px',
    borderRadius: theme.borderRadius.full,
  },
  ampelLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    width: '200px',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '200px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
};

function StatusberichtBasis({ data, onChange }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Basis</h2>
        <p style={styles.subtitle}>
          Bewerten Sie den Gesamtstatus des Projekts und fassen Sie den aktuellen Stand zusammen.
        </p>
      </div>

      {/* Status-Zeile */}
      <div style={styles.statusRow}>
        <span style={{
          ...styles.statusBadge,
          backgroundColor: data.status === 'final' ? theme.colors.successLight : theme.colors.surfaceHover,
          color: data.status === 'final' ? theme.colors.success : theme.colors.textMuted,
        }}>
          {data.status === 'final' ? 'Final' : 'Entwurf'}
        </span>
        <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
          Bericht #{data.nummer}
        </span>
      </div>

      {/* Ampel */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Projekt-Ampel<span style={styles.required}>*</span>
        </label>
        <div style={styles.ampelGroup}>
          {AMPEL_OPTIONS.map((opt) => {
            const isSelected = data.ampel === opt.value;
            return (
              <div
                key={opt.value}
                style={{
                  ...styles.ampelOption,
                  borderColor: isSelected ? opt.color : theme.colors.border,
                  backgroundColor: isSelected ? `${opt.color}15` : theme.colors.surface,
                }}
                onClick={() => onChange({ ampel: opt.value })}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = opt.color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
                <div style={{ ...styles.ampelDot, backgroundColor: opt.color }} />
                <span style={{ ...styles.ampelLabel, color: isSelected ? opt.color : theme.colors.text }}>
                  {opt.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Datum */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Berichtsdatum<span style={styles.required}>*</span>
        </label>
        <input
          type="date"
          value={data.datum || ''}
          onChange={(e) => onChange({ datum: e.target.value })}
          style={styles.input}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
      </div>

      {/* Management Summary */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Management Summary<span style={styles.required}>*</span>
        </label>
        <textarea
          value={data.management_summary || ''}
          onChange={(e) => onChange({ management_summary: e.target.value })}
          placeholder="Zusammenfassung des aktuellen Projektstatus...

- Wesentliche Fortschritte seit dem letzten Bericht
- Aktuelle Herausforderungen und Risiken
- Nächste Schritte und geplante Maßnahmen"
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <p style={styles.hint}>
          Kurze, prägnante Zusammenfassung für das Management
        </p>
      </div>
    </div>
  );
}

export default StatusberichtBasis;
