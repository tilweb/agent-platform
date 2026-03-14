import { useState } from 'react';
import { theme } from '../../../../config/theme';

const DEFAULT_AUDIT_TYPEN = [
  { id: 'vertragspruefung', label: 'Vertragspruefung' },
  { id: 'soc_bericht', label: 'SOC-Bericht' },
  { id: 'bonitaetspruefung', label: 'Bonitaetspruefung' },
  { id: 'interview', label: 'Interview' },
  { id: 'vor_ort_pruefung', label: 'Vor-Ort-Pruefung' },
  { id: 'dokumentenpruefung', label: 'Dokumentenpruefung' },
];

const BEWERTUNGEN = [
  { id: 'bestanden', label: 'Bestanden' },
  { id: 'bestanden_mit_auflagen', label: 'Bestanden mit Auflagen' },
  { id: 'nicht_bestanden', label: 'Nicht bestanden' },
];

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
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
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
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
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: 80,
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
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

const DEFAULT_SCOPES = [
  { id: 'fachpruefung', label: 'Fachpruefung' },
  { id: 'compliance_pruefung', label: 'Compliance-Pruefung' },
];

export default function AuditForm({ audit, supplierId, leistungen, teams, scopes, auditTypen, onSave, onCancel }) {
  const scopeOptions = scopes && scopes.length > 0 ? scopes : DEFAULT_SCOPES;
  const typOptions = auditTypen && auditTypen.length > 0 ? auditTypen : DEFAULT_AUDIT_TYPEN;

  const [values, setValues] = useState({
    supplier_id: audit?.supplier_id || supplierId || '',
    leistung_id: audit?.leistung_id || '',
    scope: audit?.scope || '',
    typ: audit?.typ || 'dokumentenpruefung',
    status: audit?.status || 'geplant',
    geplant_fuer: audit?.geplant_fuer || '',
    durchgefuehrt_am: audit?.durchgefuehrt_am || '',
    bewertung: audit?.bewertung || '',
    team_id: audit?.team_id || '',
    notizen: audit?.notizen || '',
  });

  const update = (field, value) => setValues({ ...values, [field]: value });

  return (
    <div style={styles.form}>
      {leistungen && leistungen.length > 0 && (
        <div style={styles.field}>
          <label style={styles.label}>Leistung</label>
          <select style={styles.select} value={values.leistung_id} onChange={(e) => update('leistung_id', e.target.value)}>
            <option value="">-- Waehlen --</option>
            {leistungen.map((l) => (
              <option key={l.id} value={l.id}>{l.bezeichnung}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: theme.spacing.lg }}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Pruefungs-Scope</label>
          <select style={styles.select} value={values.scope} onChange={(e) => update('scope', e.target.value)}>
            <option value="">-- Waehlen --</option>
            {scopeOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Pruefungstyp</label>
          <select style={styles.select} value={values.typ} onChange={(e) => update('typ', e.target.value)}>
            {typOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {teams && teams.length > 0 && (
        <div style={styles.field}>
          <label style={styles.label}>Verantwortliches Team</label>
          <select style={styles.select} value={values.team_id} onChange={(e) => update('team_id', e.target.value)}>
            <option value="">-- Kein Team --</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: theme.spacing.lg }}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Status</label>
          <select style={styles.select} value={values.status} onChange={(e) => update('status', e.target.value)}>
            <option value="geplant">Geplant</option>
            <option value="in_durchfuehrung">In Durchfuehrung</option>
            <option value="abgeschlossen">Abgeschlossen</option>
            <option value="uebersprungen">Uebersprungen</option>
          </select>
        </div>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Bewertung</label>
          <select style={styles.select} value={values.bewertung || ''} onChange={(e) => update('bewertung', e.target.value || null)}>
            <option value="">-- Keine --</option>
            {BEWERTUNGEN.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: theme.spacing.lg }}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Geplant fuer</label>
          <input type="date" style={styles.input} value={values.geplant_fuer} onChange={(e) => update('geplant_fuer', e.target.value)} />
        </div>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Durchgefuehrt am</label>
          <input type="date" style={styles.input} value={values.durchgefuehrt_am} onChange={(e) => update('durchgefuehrt_am', e.target.value)} />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Notizen</label>
        <textarea style={styles.textarea} value={values.notizen} onChange={(e) => update('notizen', e.target.value)} />
      </div>

      <div style={styles.actions}>
        {onCancel && <button style={styles.btnSecondary} onClick={onCancel}>Abbrechen</button>}
        <button style={styles.btnPrimary} onClick={() => onSave(values)}>Speichern</button>
      </div>
    </div>
  );
}
