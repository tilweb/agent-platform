import { useState } from 'react';
import { theme } from '../../../../config/theme';
import RiskBadge from './RiskBadge';

// Fallback if config doesn't have bia_optionen yet
const DEFAULT_BIA_FIELDS = [
  { key: 'sla_relevanz', label: 'SLA-Relevanz', options: [
    { value: 'sla_kritisch', label: 'SLA-kritisch', wert: 4 },
    { value: 'sla_relevant', label: 'SLA-relevant', wert: 3 },
    { value: 'sla_gering', label: 'SLA-gering', wert: 2 },
    { value: 'sla_keine', label: 'Keine SLA-Relevanz', wert: 1 },
  ]},
  { key: 'datenschutz_niveau', label: 'Datenschutz-Niveau', options: [
    { value: 'hoch_vertraulich', label: 'Hoch vertraulich', wert: 4 },
    { value: 'gelegentlich_hoch', label: 'Gelegentlich hoch', wert: 3 },
    { value: 'nicht_sensibel', label: 'Nicht sensibel', wert: 2 },
    { value: 'keine', label: 'Keine', wert: 1 },
  ]},
  { key: 'vertraulichkeit', label: 'Vertraulichkeit', options: [
    { value: 'dauerhaft_hoch', label: 'Dauerhaft hoch', wert: 4 },
    { value: 'gelegentlich_hoch', label: 'Gelegentlich hoch', wert: 3 },
    { value: 'nicht_sensibel', label: 'Nicht sensibel', wert: 2 },
    { value: 'keine', label: 'Keine', wert: 1 },
  ]},
  { key: 'kundenbezug', label: 'Kundenbezug', options: [
    { value: 'direkt', label: 'Direkt', wert: 4 },
    { value: 'indirekt', label: 'Indirekt', wert: 2 },
    { value: 'kein', label: 'Kein', wert: 1 },
  ]},
  { key: 'ausschreibungsvolumen', label: 'Ausschreibungsvolumen', options: [
    { value: 'ueber_250k', label: 'Ueber 250.000 EUR', wert: 4 },
    { value: '120k_250k', label: '120.000 - 250.000 EUR', wert: 3 },
    { value: '10k_120k', label: '10.000 - 120.000 EUR', wert: 2 },
    { value: 'unter_10k', label: 'Unter 10.000 EUR', wert: 1 },
  ]},
];

const BIA_FIELD_LABELS = {
  sla_relevanz: 'SLA-Relevanz',
  datenschutz_niveau: 'Datenschutz-Niveau',
  vertraulichkeit: 'Vertraulichkeit',
  kundenbezug: 'Kundenbezug',
  ausschreibungsvolumen: 'Ausschreibungsvolumen',
};

function getBiaFields(config) {
  const biaOpts = config?.bia_optionen;
  if (!biaOpts) return DEFAULT_BIA_FIELDS;
  return Object.keys(BIA_FIELD_LABELS).map((key) => ({
    key,
    label: BIA_FIELD_LABELS[key],
    options: biaOpts[key] || DEFAULT_BIA_FIELDS.find((f) => f.key === key)?.options || [],
  }));
}

const REVIEW_CYCLES = {
  very_high: '12 Monate',
  high: '36 Monate',
  medium: null,
  low: null,
};

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
  },
  result: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
  },
  resultLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
  },
  btnPrimary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

export default function BiaForm({ bia, onSave, onCancel, config }) {
  const biaFields = getBiaFields(config);

  const [values, setValues] = useState(() => {
    const initial = {};
    for (const field of biaFields) {
      const lastOpt = field.options[field.options.length - 1];
      initial[field.key] = bia?.[field.key] || lastOpt?.value || '';
    }
    return initial;
  });

  // Calculate preview result (Maximalprinzip) - use wert from config options
  const maxScore = Math.max(
    ...biaFields.map((field) => {
      const selected = values[field.key];
      const opt = field.options.find((o) => o.value === selected);
      return opt?.wert || 1;
    })
  );
  const previewLevel = maxScore >= 4 ? 'very_high' : maxScore >= 3 ? 'high' : maxScore >= 2 ? 'medium' : 'low';

  const reviewCycle = REVIEW_CYCLES[previewLevel];

  return (
    <div style={styles.form}>
      <div style={styles.fieldsGrid}>
        {biaFields.map((field) => (
          <div key={field.key} style={styles.field}>
            <label style={styles.label}>{field.label}</label>
            <select
              style={styles.select}
              value={values[field.key]}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={styles.result}>
        <div>
          <span style={styles.resultLabel}>BIA-Ergebnis (Maximalprinzip)</span>
          {reviewCycle && (
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 }}>
              Review-Zyklus: {reviewCycle} — naechste Pruefung wird automatisch gesetzt
            </div>
          )}
          {!reviewCycle && (
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 }}>
              Kein Pflicht-Review-Zyklus fuer diese Stufe
            </div>
          )}
        </div>
        <RiskBadge level={previewLevel} />
      </div>

      <div style={styles.actions}>
        {onCancel && <button style={styles.btnSecondary} onClick={onCancel}>Abbrechen</button>}
        <button style={styles.btnPrimary} onClick={() => onSave(values)}>Speichern</button>
      </div>
    </div>
  );
}
