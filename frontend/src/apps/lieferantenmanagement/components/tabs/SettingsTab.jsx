import { useState, useEffect } from 'react';
import { theme } from '../../../../config/theme';
import { apiGet, apiPut } from '../../../../utils/apiFetch';

const BASE = '/apps/lieferantenmanagement';

const BIA_FIELD_LABELS = {
  sla_relevanz: 'SLA-Relevanz',
  datenschutz_niveau: 'Datenschutz-Niveau',
  vertraulichkeit: 'Vertraulichkeit',
  kundenbezug: 'Kundenbezug',
  ausschreibungsvolumen: 'Ausschreibungsvolumen',
};

const RISIKO_LEVELS = [
  { id: 'very_high', label: 'Sehr hoch' },
  { id: 'high', label: 'Hoch' },
  { id: 'medium', label: 'Mittel' },
  { id: 'low', label: 'Niedrig' },
];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
    maxWidth: 900,
  },
  section: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  sectionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  body: {
    padding: theme.spacing.xl,
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
    textAlign: 'left',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  td: {
    padding: `${theme.spacing.md} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    verticalAlign: 'middle',
  },
  input: {
    width: '100%',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputSmall: {
    width: 60,
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    textAlign: 'center',
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
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  btnAdd: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    border: `1px dashed ${theme.colors.primary}40`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    width: '100%',
    marginTop: theme.spacing.md,
  },
  saved: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.success,
    fontWeight: theme.typography.weights.medium,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  biaSubsection: {
    marginBottom: theme.spacing.xl,
  },
  biaSubtitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
};

export default function SettingsTab({ config, onConfigUpdate }) {
  const [teams, setTeams] = useState([]);
  const [biaOptionen, setBiaOptionen] = useState({});
  const [pruefungsScopes, setPruefungsScopes] = useState([]);
  const [scopeRegeln, setScopeRegeln] = useState({});
  const [auditTypen, setAuditTypen] = useState([]);
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (config) {
      setTeams(config.teams || []);
      setBiaOptionen(config.bia_optionen || {});
      setPruefungsScopes(config.pruefungs_scopes || []);
      setScopeRegeln(config.scope_regeln || {});
      setAuditTypen(config.audit_typen || []);
    }
  }, [config]);

  const saveSection = async (section, data) => {
    setSaving(section);
    setSaved(null);
    try {
      const res = await apiPut(`${BASE}/config`, { [section]: data });
      if (res.ok) {
        const updated = await res.json();
        onConfigUpdate?.(updated);
        setSaved(section);
        setTimeout(() => setSaved(null), 2000);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(null);
    }
  };

  // --- Teams ---
  const updateTeam = (idx, field, value) => {
    const updated = [...teams];
    updated[idx] = { ...updated[idx], [field]: value };
    setTeams(updated);
  };

  const addTeam = () => {
    const id = 'team-' + Date.now().toString(36);
    setTeams([...teams, { id, name: '', email: '' }]);
  };

  const removeTeam = (idx) => {
    setTeams(teams.filter((_, i) => i !== idx));
  };

  // --- BIA Optionen ---
  const updateBiaOption = (fieldKey, idx, prop, value) => {
    const updated = { ...biaOptionen };
    updated[fieldKey] = [...(updated[fieldKey] || [])];
    updated[fieldKey][idx] = { ...updated[fieldKey][idx], [prop]: prop === 'wert' ? parseInt(value) || 0 : value };
    setBiaOptionen(updated);
  };

  const addBiaOption = (fieldKey) => {
    const updated = { ...biaOptionen };
    const arr = [...(updated[fieldKey] || [])];
    arr.push({ value: '', label: '', wert: 1 });
    updated[fieldKey] = arr;
    setBiaOptionen(updated);
  };

  const removeBiaOption = (fieldKey, idx) => {
    const updated = { ...biaOptionen };
    updated[fieldKey] = (updated[fieldKey] || []).filter((_, i) => i !== idx);
    setBiaOptionen(updated);
  };

  // --- Pruefungs-Scopes ---
  const updateScope = (idx, field, value) => {
    const updated = [...pruefungsScopes];
    updated[idx] = { ...updated[idx], [field]: value };
    setPruefungsScopes(updated);
  };

  const addScope = () => {
    setPruefungsScopes([...pruefungsScopes, { id: '', label: '' }]);
  };

  const removeScope = (idx) => {
    setPruefungsScopes(pruefungsScopes.filter((_, i) => i !== idx));
  };

  // --- Scope-Regeln ---
  const toggleScopeRegel = (level, scopeId) => {
    const updated = { ...scopeRegeln };
    const current = updated[level] || [];
    if (current.includes(scopeId)) {
      updated[level] = current.filter((s) => s !== scopeId);
    } else {
      updated[level] = [...current, scopeId];
    }
    setScopeRegeln(updated);
  };

  const saveScopesAndRegeln = async () => {
    setSaving('scopes');
    setSaved(null);
    try {
      const res = await apiPut(`${BASE}/config`, {
        pruefungs_scopes: pruefungsScopes,
        scope_regeln: scopeRegeln,
      });
      if (res.ok) {
        const updated = await res.json();
        onConfigUpdate?.(updated);
        setSaved('scopes');
        setTimeout(() => setSaved(null), 2000);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(null);
    }
  };

  // --- Audit-Typen ---
  const updateAuditTyp = (idx, field, value) => {
    const updated = [...auditTypen];
    updated[idx] = { ...updated[idx], [field]: value };
    setAuditTypen(updated);
  };

  const addAuditTyp = () => {
    setAuditTypen([...auditTypen, { id: '', label: '' }]);
  };

  const removeAuditTyp = (idx) => {
    setAuditTypen(auditTypen.filter((_, i) => i !== idx));
  };

  if (!config) {
    return <div style={styles.loading}>Laden...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Teams */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Teams</div>
            <div style={styles.sectionDescription}>
              Teams koennen Leistungen, Audits und Reviews zugeordnet werden.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            {saved === 'teams' && <span style={styles.saved}>Gespeichert</span>}
            <button
              style={styles.btnPrimary}
              onClick={() => saveSection('teams', teams)}
              disabled={saving === 'teams'}
            >
              {saving === 'teams' ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
        <div style={styles.body}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={{ ...styles.th, width: 260 }}>E-Mail</th>
                <th style={{ ...styles.th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, idx) => (
                <tr key={team.id || idx}>
                  <td style={styles.td}>
                    <input
                      style={styles.input}
                      value={team.name}
                      onChange={(e) => updateTeam(idx, 'name', e.target.value)}
                      placeholder="Teamname"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.input}
                      value={team.email}
                      onChange={(e) => updateTeam(idx, 'email', e.target.value)}
                      placeholder="team@firma.de"
                    />
                  </td>
                  <td style={styles.td}>
                    <button style={styles.btnDanger} onClick={() => removeTeam(idx)}>Entfernen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={styles.btnAdd} onClick={addTeam}>+ Team hinzufuegen</button>
        </div>
      </div>

      {/* Pruefungs-Scopes & Scope-Regeln */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Pruefungs-Scopes</div>
            <div style={styles.sectionDescription}>
              Pruefungsbereiche und welche bei welcher BIA-Stufe erforderlich sind.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            {saved === 'scopes' && <span style={styles.saved}>Gespeichert</span>}
            <button
              style={styles.btnPrimary}
              onClick={saveScopesAndRegeln}
              disabled={saving === 'scopes'}
            >
              {saving === 'scopes' ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
        <div style={styles.body}>
          {/* Scopes List */}
          <div style={styles.biaSubsection}>
            <div style={styles.biaSubtitle}>Verfuegbare Scopes</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Bezeichnung</th>
                  <th style={{ ...styles.th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {pruefungsScopes.map((scope, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={scope.id}
                        onChange={(e) => updateScope(idx, 'id', e.target.value)}
                        placeholder="technischer_key"
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={scope.label}
                        onChange={(e) => updateScope(idx, 'label', e.target.value)}
                        placeholder="Anzeigename"
                      />
                    </td>
                    <td style={styles.td}>
                      <button style={styles.btnDanger} onClick={() => removeScope(idx)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button style={styles.btnAdd} onClick={addScope}>+ Scope hinzufuegen</button>
          </div>

          {/* Scope-Regeln Matrix */}
          <div style={styles.biaSubsection}>
            <div style={styles.biaSubtitle}>Erforderliche Scopes pro BIA-Stufe</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>BIA-Stufe</th>
                  {pruefungsScopes.filter((s) => s.id).map((scope) => (
                    <th key={scope.id} style={{ ...styles.th, textAlign: 'center' }}>{scope.label || scope.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RISIKO_LEVELS.map((level) => (
                  <tr key={level.id}>
                    <td style={{ ...styles.td, fontWeight: theme.typography.weights.medium }}>{level.label}</td>
                    {pruefungsScopes.filter((s) => s.id).map((scope) => {
                      const isChecked = (scopeRegeln[level.id] || []).includes(scope.id);
                      return (
                        <td key={scope.id} style={{ ...styles.td, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleScopeRegel(level.id, scope.id)}
                            style={{ cursor: 'pointer', width: 18, height: 18 }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pruefungstypen */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Pruefungstypen</div>
            <div style={styles.sectionDescription}>
              Methoden fuer die Durchfuehrung von Pruefungen (z.B. Dokumentenpruefung, Interview).
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            {saved === 'audit_typen' && <span style={styles.saved}>Gespeichert</span>}
            <button
              style={styles.btnPrimary}
              onClick={() => saveSection('audit_typen', auditTypen)}
              disabled={saving === 'audit_typen'}
            >
              {saving === 'audit_typen' ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
        <div style={styles.body}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Bezeichnung</th>
                <th style={{ ...styles.th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {auditTypen.map((typ, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>
                    <input
                      style={styles.input}
                      value={typ.id}
                      onChange={(e) => updateAuditTyp(idx, 'id', e.target.value)}
                      placeholder="technischer_key"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.input}
                      value={typ.label}
                      onChange={(e) => updateAuditTyp(idx, 'label', e.target.value)}
                      placeholder="Anzeigename"
                    />
                  </td>
                  <td style={styles.td}>
                    <button style={styles.btnDanger} onClick={() => removeAuditTyp(idx)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={styles.btnAdd} onClick={addAuditTyp}>+ Pruefungstyp hinzufuegen</button>
        </div>
      </div>

      {/* BIA Optionen */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>BIA-Bewertungskriterien</div>
            <div style={styles.sectionDescription}>
              Optionen fuer die Business Impact Analyse. Der Wert bestimmt die Gewichtung (Maximalprinzip).
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            {saved === 'bia_optionen' && <span style={styles.saved}>Gespeichert</span>}
            <button
              style={styles.btnPrimary}
              onClick={() => saveSection('bia_optionen', biaOptionen)}
              disabled={saving === 'bia_optionen'}
            >
              {saving === 'bia_optionen' ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
        <div style={styles.body}>
          {Object.entries(BIA_FIELD_LABELS).map(([fieldKey, fieldLabel]) => {
            const options = biaOptionen[fieldKey] || [];
            return (
              <div key={fieldKey} style={styles.biaSubsection}>
                <div style={styles.biaSubtitle}>{fieldLabel}</div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Bezeichnung</th>
                      <th style={{ ...styles.th, width: 80 }}>Wert</th>
                      <th style={{ ...styles.th, width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((opt, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>
                          <input
                            style={styles.input}
                            value={opt.value}
                            onChange={(e) => updateBiaOption(fieldKey, idx, 'value', e.target.value)}
                            placeholder="technischer_key"
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            style={styles.input}
                            value={opt.label}
                            onChange={(e) => updateBiaOption(fieldKey, idx, 'label', e.target.value)}
                            placeholder="Anzeigename"
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            style={styles.inputSmall}
                            type="number"
                            value={opt.wert}
                            onChange={(e) => updateBiaOption(fieldKey, idx, 'wert', e.target.value)}
                            min="1"
                          />
                        </td>
                        <td style={styles.td}>
                          <button style={styles.btnDanger} onClick={() => removeBiaOption(fieldKey, idx)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button style={styles.btnAdd} onClick={() => addBiaOption(fieldKey)}>+ Option</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
