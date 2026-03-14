import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';

const styles = {
  container: {
    maxWidth: 700,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  row: {
    display: 'flex',
    gap: theme.spacing.lg,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    flex: 1,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.lg,
  },
  btnPrimary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
  },
};

export default function SupplierFormTab({ onCreated }) {
  const navigate = useNavigate();
  const { createSupplier } = useSuppliers();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({
    firmenname: '',
    kundennummer: '',
    strasse: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    url: '',
  });

  const update = (field, value) => setValues({ ...values, [field]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.firmenname.trim()) {
      setError('Firmenname ist ein Pflichtfeld.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supplier = await createSupplier({
        firmenname: values.firmenname.trim(),
        kundennummer: values.kundennummer.trim() || undefined,
        adresse: {
          strasse: values.strasse.trim() || undefined,
          plz: values.plz.trim() || undefined,
          ort: values.ort.trim() || undefined,
          land: values.land.trim() || undefined,
        },
        url: values.url.trim() || undefined,
      });

      onCreated?.(supplier);
      navigate(`/apps/lieferantenmanagement/${supplier.id}`);
    } catch (err) {
      setError(err.message || 'Fehler beim Erstellen des Lieferanten.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>Neuen Lieferanten anlegen</div>

        {error && <div style={styles.error}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>
              Firmenname <span style={styles.required}>*</span>
            </label>
            <input
              style={styles.input}
              type="text"
              value={values.firmenname}
              onChange={(e) => update('firmenname', e.target.value)}
              placeholder="z.B. Beispiel GmbH"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Kundennummer</label>
            <input
              style={styles.input}
              type="text"
              value={values.kundennummer}
              onChange={(e) => update('kundennummer', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Strasse</label>
            <input
              style={styles.input}
              type="text"
              value={values.strasse}
              onChange={(e) => update('strasse', e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>PLZ</label>
              <input
                style={styles.input}
                type="text"
                value={values.plz}
                onChange={(e) => update('plz', e.target.value)}
              />
            </div>
            <div style={{ ...styles.field, flex: 2 }}>
              <label style={styles.label}>Ort</label>
              <input
                style={styles.input}
                type="text"
                value={values.ort}
                onChange={(e) => update('ort', e.target.value)}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Land</label>
              <input
                style={styles.input}
                type="text"
                value={values.land}
                onChange={(e) => update('land', e.target.value)}
              />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Webseite</label>
              <input
                style={styles.input}
                type="url"
                value={values.url}
                onChange={(e) => update('url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={() => navigate('/apps/lieferantenmanagement')}
            >
              Abbrechen
            </button>
            <button type="submit" style={styles.btnPrimary} disabled={isSaving}>
              {isSaving ? 'Erstelle...' : 'Lieferant anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
