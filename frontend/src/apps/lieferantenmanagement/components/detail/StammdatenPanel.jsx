import { useState } from 'react';
import { theme } from '../../../../config/theme';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktiv' },
  { value: 'inactive', label: 'Inaktiv' },
  { value: 'beendet', label: 'Beendet' },
];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  fieldFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    gridColumn: '1 / -1',
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: theme.typography.sizes.sm,
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
    fontFamily: theme.typography.fontFamily,
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
  btnDanger: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSmall: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.lg,
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  },
  th: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    textAlign: 'left',
  },
  td: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    verticalAlign: 'middle',
  },
  tdInput: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    width: '100%',
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  zertRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  zertInfo: {
    display: 'flex',
    gap: theme.spacing.xl,
    alignItems: 'center',
    flex: 1,
  },
  zertField: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  zertLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
};

const STATUS_COLORS = {
  active: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  inactive: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  beendet: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const EMPTY_AP = { name: '', rolle: '', email: '', telefon: '', ist_hauptansprechpartner: false };
const EMPTY_ZERT = { typ: '', gueltig_bis: '', zertifizierer: '', nachweis_vorhanden: false };

export default function StammdatenPanel({ supplier, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [editingApIdx, setEditingApIdx] = useState(null);
  const [apForm, setApForm] = useState(EMPTY_AP);
  const [addingAp, setAddingAp] = useState(false);
  const [addingZert, setAddingZert] = useState(false);
  const [zertForm, setZertForm] = useState(EMPTY_ZERT);

  if (!supplier) {
    return <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted }}>Laden...</div>;
  }

  const sd = supplier.stammdaten || {};
  const adr = sd.adresse || {};

  const startEdit = () => {
    setForm({
      firmenname: supplier.firmenname || '',
      status: supplier.status || 'active',
      kundennummer: sd.kundennummer || '',
      vertragsnummern: (sd.vertragsnummern || []).join(', '),
      auftragsnummern: (sd.auftragsnummern || []).join(', '),
      url: sd.url || '',
      strasse: adr.strasse || '',
      plz: adr.plz || '',
      ort: adr.ort || '',
      land: adr.land || 'Deutschland',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
  };

  const saveEdit = () => {
    const updated = {
      firmenname: form.firmenname,
      status: form.status,
      stammdaten: {
        ...sd,
        kundennummer: form.kundennummer,
        vertragsnummern: form.vertragsnummern.split(',').map((s) => s.trim()).filter(Boolean),
        auftragsnummern: form.auftragsnummern.split(',').map((s) => s.trim()).filter(Boolean),
        url: form.url,
        adresse: {
          strasse: form.strasse,
          plz: form.plz,
          ort: form.ort,
          land: form.land,
        },
      },
    };
    onUpdate(updated);
    setEditing(false);
  };

  const updateField = (key, value) => setForm({ ...form, [key]: value });

  const ansprechpartner = supplier.ansprechpartner || [];
  const zertifizierungen = supplier.zertifizierungen || [];

  const startEditAp = (idx) => {
    setEditingApIdx(idx);
    setApForm({ ...ansprechpartner[idx] });
  };

  const saveAp = () => {
    const updated = [...ansprechpartner];
    if (addingAp) {
      updated.push({ ...apForm, id: `ap_${Date.now()}` });
      setAddingAp(false);
    } else {
      updated[editingApIdx] = { ...updated[editingApIdx], ...apForm };
      setEditingApIdx(null);
    }
    onUpdate({ ansprechpartner: updated });
    setApForm(EMPTY_AP);
  };

  const deleteAp = (idx) => {
    const updated = ansprechpartner.filter((_, i) => i !== idx);
    onUpdate({ ansprechpartner: updated });
  };

  const saveZert = () => {
    const updated = [...zertifizierungen, { ...zertForm, id: `zert_${Date.now()}` }];
    onUpdate({ zertifizierungen: updated });
    setAddingZert(false);
    setZertForm(EMPTY_ZERT);
  };

  const deleteZert = (idx) => {
    const updated = zertifizierungen.filter((_, i) => i !== idx);
    onUpdate({ zertifizierungen: updated });
  };

  const getDisplayValue = (key) => {
    if (key === 'firmenname') return supplier.firmenname || '-';
    if (key === 'status') return null; // handled separately
    if (key === 'vertragsnummern') return (sd.vertragsnummern || []).join(', ') || '-';
    if (key === 'auftragsnummern') return (sd.auftragsnummern || []).join(', ') || '-';
    if (key === 'kundennummer') return sd.kundennummer || '-';
    if (key === 'url') return sd.url || '-';
    return '-';
  };

  const renderField = (label, key, type = 'text') => (
    <div style={styles.field}>
      <span style={styles.label}>{label}</span>
      {editing ? (
        type === 'select-status' ? (
          <select style={styles.select} value={form[key] || ''} onChange={(e) => updateField(key, e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input style={styles.input} type={type} value={form[key] || ''} onChange={(e) => updateField(key, e.target.value)} />
        )
      ) : (
        <span style={styles.value}>
          {key === 'status' ? (
            <span style={{ ...styles.statusBadge, ...(STATUS_COLORS[supplier.status] || {}) }}>
              {STATUS_OPTIONS.find((o) => o.value === supplier.status)?.label || supplier.status}
            </span>
          ) : (
            getDisplayValue(key)
          )}
        </span>
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Firmenname & Status */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Allgemein</span>
          {!editing ? (
            <button style={styles.btnSecondary} onClick={startEdit}>Bearbeiten</button>
          ) : (
            <div style={{ display: 'flex', gap: theme.spacing.sm }}>
              <button style={styles.btnSecondary} onClick={cancelEdit}>Abbrechen</button>
              <button style={styles.btnPrimary} onClick={saveEdit}>Speichern</button>
            </div>
          )}
        </div>
        <div style={styles.grid}>
          {renderField('Firmenname', 'firmenname')}
          {renderField('Status', 'status', 'select-status')}
        </div>
      </div>

      {/* Stammdaten */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Stammdaten</span>
        </div>
        <div style={styles.grid}>
          {renderField('Kundennummer', 'kundennummer')}
          {renderField('URL', 'url')}
          {renderField('Vertragsnummern', 'vertragsnummern')}
          {renderField('Auftragsnummern', 'auftragsnummern')}
        </div>
      </div>

      {/* Adresse */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Adresse</span>
        </div>
        <div style={styles.grid}>
          <div style={styles.fieldFull}>
            <span style={styles.label}>Strasse</span>
            {editing ? (
              <input style={styles.input} value={form.strasse || ''} onChange={(e) => updateField('strasse', e.target.value)} />
            ) : (
              <span style={styles.value}>{adr.strasse || '-'}</span>
            )}
          </div>
          <div style={styles.field}>
            <span style={styles.label}>PLZ</span>
            {editing ? (
              <input style={styles.input} value={form.plz || ''} onChange={(e) => updateField('plz', e.target.value)} />
            ) : (
              <span style={styles.value}>{adr.plz || '-'}</span>
            )}
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Ort</span>
            {editing ? (
              <input style={styles.input} value={form.ort || ''} onChange={(e) => updateField('ort', e.target.value)} />
            ) : (
              <span style={styles.value}>{adr.ort || '-'}</span>
            )}
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Land</span>
            {editing ? (
              <input style={styles.input} value={form.land || ''} onChange={(e) => updateField('land', e.target.value)} />
            ) : (
              <span style={styles.value}>{adr.land || '-'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Ansprechpartner */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Ansprechpartner</span>
          <button style={styles.btnSmall} onClick={() => { setAddingAp(true); setApForm(EMPTY_AP); }}>
            + Hinzufuegen
          </button>
        </div>
        {ansprechpartner.length === 0 && !addingAp && (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Keine Ansprechpartner vorhanden.
          </div>
        )}
        {(ansprechpartner.length > 0 || addingAp) && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Rolle</th>
                <th style={styles.th}>E-Mail</th>
                <th style={styles.th}>Telefon</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Haupt</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {ansprechpartner.map((ap, idx) => (
                <tr key={ap.id || idx}>
                  {editingApIdx === idx ? (
                    <>
                      <td style={styles.td}><input style={styles.tdInput} value={apForm.name} onChange={(e) => setApForm({ ...apForm, name: e.target.value })} /></td>
                      <td style={styles.td}><input style={styles.tdInput} value={apForm.rolle} onChange={(e) => setApForm({ ...apForm, rolle: e.target.value })} /></td>
                      <td style={styles.td}><input style={styles.tdInput} value={apForm.email} onChange={(e) => setApForm({ ...apForm, email: e.target.value })} /></td>
                      <td style={styles.td}><input style={styles.tdInput} value={apForm.telefon} onChange={(e) => setApForm({ ...apForm, telefon: e.target.value })} /></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <input type="checkbox" checked={apForm.ist_hauptansprechpartner} onChange={(e) => setApForm({ ...apForm, ist_hauptansprechpartner: e.target.checked })} />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'flex-end' }}>
                          <button style={styles.btnSmall} onClick={saveAp}>Speichern</button>
                          <button style={{ ...styles.btnSmall, color: theme.colors.textMuted, borderColor: theme.colors.border }} onClick={() => setEditingApIdx(null)}>Abbrechen</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={styles.td}>{ap.name}</td>
                      <td style={styles.td}>{ap.rolle || '-'}</td>
                      <td style={styles.td}>{ap.email || '-'}</td>
                      <td style={styles.td}>{ap.telefon || '-'}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{ap.ist_hauptansprechpartner ? 'Ja' : '-'}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'flex-end' }}>
                          <button style={styles.btnSmall} onClick={() => startEditAp(idx)}>Bearbeiten</button>
                          <button style={styles.btnDanger} onClick={() => deleteAp(idx)}>Entfernen</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {addingAp && (
                <tr>
                  <td style={styles.td}><input style={styles.tdInput} placeholder="Name" value={apForm.name} onChange={(e) => setApForm({ ...apForm, name: e.target.value })} /></td>
                  <td style={styles.td}><input style={styles.tdInput} placeholder="Rolle" value={apForm.rolle} onChange={(e) => setApForm({ ...apForm, rolle: e.target.value })} /></td>
                  <td style={styles.td}><input style={styles.tdInput} placeholder="E-Mail" value={apForm.email} onChange={(e) => setApForm({ ...apForm, email: e.target.value })} /></td>
                  <td style={styles.td}><input style={styles.tdInput} placeholder="Telefon" value={apForm.telefon} onChange={(e) => setApForm({ ...apForm, telefon: e.target.value })} /></td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <input type="checkbox" checked={apForm.ist_hauptansprechpartner} onChange={(e) => setApForm({ ...apForm, ist_hauptansprechpartner: e.target.checked })} />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'flex-end' }}>
                      <button style={styles.btnPrimary} onClick={saveAp}>Hinzufuegen</button>
                      <button style={styles.btnSecondary} onClick={() => { setAddingAp(false); setApForm(EMPTY_AP); }}>Abbrechen</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Zertifizierungen */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Zertifizierungen</span>
          <button style={styles.btnSmall} onClick={() => { setAddingZert(true); setZertForm(EMPTY_ZERT); }}>
            + Hinzufuegen
          </button>
        </div>
        {zertifizierungen.length === 0 && !addingZert && (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Keine Zertifizierungen vorhanden.
          </div>
        )}
        {zertifizierungen.map((zert, idx) => (
          <div key={zert.id || idx} style={styles.zertRow}>
            <div style={styles.zertInfo}>
              <div>
                <div style={styles.zertLabel}>Typ</div>
                <div style={styles.zertField}>{zert.typ || '-'}</div>
              </div>
              <div>
                <div style={styles.zertLabel}>Gueltig bis</div>
                <div style={styles.zertField}>
                  {zert.gueltig_bis ? new Date(zert.gueltig_bis).toLocaleDateString('de-DE') : '-'}
                </div>
              </div>
              <div>
                <div style={styles.zertLabel}>Zertifizierer</div>
                <div style={styles.zertField}>{zert.zertifizierer || '-'}</div>
              </div>
              <div>
                <div style={styles.zertLabel}>Nachweis</div>
                <div style={styles.zertField}>{zert.nachweis_vorhanden ? 'Ja' : 'Nein'}</div>
              </div>
            </div>
            <button style={styles.btnDanger} onClick={() => deleteZert(idx)}>Entfernen</button>
          </div>
        ))}
        {addingZert && (
          <div style={{ padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.lg, marginTop: theme.spacing.md }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <div style={styles.field}>
                <span style={styles.label}>Typ</span>
                <input style={styles.input} value={zertForm.typ} onChange={(e) => setZertForm({ ...zertForm, typ: e.target.value })} placeholder="z.B. ISO 27001" />
              </div>
              <div style={styles.field}>
                <span style={styles.label}>Gueltig bis</span>
                <input style={styles.input} type="date" value={zertForm.gueltig_bis} onChange={(e) => setZertForm({ ...zertForm, gueltig_bis: e.target.value })} />
              </div>
              <div style={styles.field}>
                <span style={styles.label}>Zertifizierer</span>
                <input style={styles.input} value={zertForm.zertifizierer} onChange={(e) => setZertForm({ ...zertForm, zertifizierer: e.target.value })} />
              </div>
              <div style={styles.field}>
                <span style={styles.label}>Nachweis vorhanden</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
                  <input type="checkbox" checked={zertForm.nachweis_vorhanden} onChange={(e) => setZertForm({ ...zertForm, nachweis_vorhanden: e.target.checked })} />
                  <span style={{ fontSize: theme.typography.sizes.sm }}>Ja</span>
                </label>
              </div>
            </div>
            <div style={styles.actions}>
              <button style={styles.btnSecondary} onClick={() => { setAddingZert(false); setZertForm(EMPTY_ZERT); }}>Abbrechen</button>
              <button style={styles.btnPrimary} onClick={saveZert}>Hinzufuegen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
