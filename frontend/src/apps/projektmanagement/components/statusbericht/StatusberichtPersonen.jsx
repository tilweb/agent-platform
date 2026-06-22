/**
 * StatusberichtPersonen
 * Read-only Auflistung der Projektpersonen (Projektteam + Stakeholder) im
 * Statusbericht. Daten stammen aus dem Snapshot, der bei SB-Erstellung vom
 * Projektauftrag kopiert wurde. Drift-Hinweis, wenn sich die Projekt-Personen
 * seither geaendert haben (analog StatusberichtZiele/Roadmap).
 */

import { theme } from '../../../../config/theme';

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
  driftBanner: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.warning,
  },
  groupLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  cardName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${theme.spacing.xs} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  metaItem: {
    display: 'flex',
    gap: theme.spacing.xs,
  },
  metaKey: {
    color: theme.colors.textMuted,
  },
  freeText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    whiteSpace: 'pre-wrap',
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  trackingBox: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  trackingField: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  trackingLabel: {
    fontSize: '10px',
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  trackingSelect: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  trackingInput: {
    flex: 1,
    minWidth: '180px',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
};

// Personen-Veränderung im Projektverlauf (pro Bericht). Werte stabil halten;
// Labels sind Anzeige.
const PERSON_STATUS = [
  { value: 'unveraendert', label: 'Unverändert' },
  { value: 'neu', label: 'Neu hinzugekommen' },
  { value: 'ausgeschieden', label: 'Ausgeschieden' },
  { value: 'geaendert', label: 'Rolle/Daten geändert' },
];

function StatusberichtPersonen({ data, projektauftrag, config, onChange }) {
  const organizationSnapshot = data.organization_snapshot || [];
  const stakeholdersSnapshot = data.stakeholders_snapshot || [];
  const orgTracking = data.organization_tracking || [];
  const shTracking = data.stakeholders_tracking || [];

  // Tracking-Eintrag aktualisieren (index-aligned zum Snapshot).
  const updateTracking = (key, index, field, value, count) => {
    const arr = [...(data[key] || [])];
    while (arr.length < count) arr.push({ status: 'unveraendert', bemerkung: '' });
    arr[index] = { ...(arr[index] || { status: 'unveraendert', bemerkung: '' }), [field]: value };
    onChange && onChange({ [key]: arr });
  };

  const currentOrganization = projektauftrag?.organization || [];
  const currentStakeholders = projektauftrag?.stakeholders || [];

  // Drift: hat sich die Personen-Liste seit dem Snapshot geaendert? (einfacher
  // Laengen-/Namens-Vergleich, analog zu den anderen SB-Abschnitten)
  const namesOf = (arr) => arr.map((p) => p.name || '').join('|');
  const hasOrgDrift = organizationSnapshot.length > 0 && currentOrganization.length > 0
    && (organizationSnapshot.length !== currentOrganization.length
      || namesOf(organizationSnapshot) !== namesOf(currentOrganization));
  const hasShDrift = stakeholdersSnapshot.length > 0 && currentStakeholders.length > 0
    && (stakeholdersSnapshot.length !== currentStakeholders.length
      || namesOf(stakeholdersSnapshot) !== namesOf(currentStakeholders));

  const labelOf = (key, value) => {
    if (!value) return '';
    const opt = (config?.[key] || []).find((o) => o.value === value);
    return opt ? opt.label : value;
  };

  const einsatzText = (e) => {
    if (!e || (e.wert === '' || e.wert === undefined || e.wert === null)) return '';
    return `${e.wert} ${e.einheit || '%'}`;
  };

  const renderMeta = (items) => (
    <div style={styles.metaRow}>
      {items.filter((it) => it.value).map((it) => (
        <span key={it.key} style={styles.metaItem}>
          <span style={styles.metaKey}>{it.key}:</span>
          <span>{it.value}</span>
        </span>
      ))}
    </div>
  );

  // Editierbares Tracking je Person (Veränderung im Projektverlauf).
  const renderTracking = (key, index, tracking, count) => {
    const t = tracking || { status: 'unveraendert', bemerkung: '' };
    return (
      <div style={styles.trackingBox}>
        <div style={styles.trackingField}>
          <span style={styles.trackingLabel}>Veränderung</span>
          <select
            value={t.status || 'unveraendert'}
            onChange={(e) => updateTracking(key, index, 'status', e.target.value, count)}
            style={styles.trackingSelect}
            disabled={!onChange}
          >
            {PERSON_STATUS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ ...styles.trackingField, flex: 1 }}>
          <span style={styles.trackingLabel}>Bemerkung (Bericht)</span>
          <input
            type="text"
            value={t.bemerkung || ''}
            onChange={(e) => updateTracking(key, index, 'bemerkung', e.target.value, count)}
            placeholder="z. B. seit KW 12 im Team, Rolle gewechselt …"
            style={styles.trackingInput}
            disabled={!onChange}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Personen</h2>
        <p style={styles.subtitle}>
          Projektteam und Stakeholder zum Zeitpunkt der Statusbericht-Erstellung (Stammdaten read-only).
          Veränderungen im Projektverlauf je Person über Status + Bemerkung dokumentieren.
        </p>
      </div>

      {(hasOrgDrift || hasShDrift) && (
        <div style={styles.driftBanner}>
          ⚠ Die Personen im Projektauftrag haben sich seit Erstellung dieses Statusberichts geändert.
        </div>
      )}

      {/* Projektteam */}
      <div>
        <div style={styles.groupLabel}>Projektteam ({organizationSnapshot.length})</div>
        {organizationSnapshot.length === 0 ? (
          <p style={styles.empty}>Keine Teammitglieder erfasst.</p>
        ) : (
          <div style={styles.list}>
            {organizationSnapshot.map((m, i) => (
              <div key={m.id || i} style={styles.card}>
                <div style={styles.cardName}>{m.name || '— ohne Namen —'}</div>
                {renderMeta([
                  { key: 'Gruppe', value: labelOf('gruppe', m.gruppe) },
                  { key: 'Rolle', value: labelOf('role', m.role) },
                  { key: 'Unternehmen', value: m.company },
                  { key: 'Status', value: labelOf('member_status', m.status) },
                  { key: 'Aufgabe', value: m.aufgabe },
                  { key: 'Interesse', value: labelOf('interest', m.interest) },
                  { key: 'Einfluss', value: labelOf('influence', m.influence) },
                  { key: 'Geplanter Einsatz', value: einsatzText(m.geplanter_einsatz) },
                ])}
                {m.bemerkung && <div style={styles.freeText}>{m.bemerkung}</div>}
                {renderTracking('organization_tracking', i, orgTracking[i], organizationSnapshot.length)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stakeholder */}
      <div>
        <div style={styles.groupLabel}>Stakeholder ({stakeholdersSnapshot.length})</div>
        {stakeholdersSnapshot.length === 0 ? (
          <p style={styles.empty}>Keine Stakeholder erfasst.</p>
        ) : (
          <div style={styles.list}>
            {stakeholdersSnapshot.map((s, i) => (
              <div key={s.id || i} style={styles.card}>
                <div style={styles.cardName}>{s.name || '— ohne Namen —'}</div>
                {renderMeta([
                  { key: 'Rolle / Position', value: labelOf('role', s.role) },
                  { key: 'Status', value: labelOf('member_status', s.status) },
                  { key: 'Interesse', value: labelOf('interest', s.interest) },
                  { key: 'Einfluss', value: labelOf('influence', s.influence) },
                ])}
                {s.expectations && <div style={styles.freeText}>{s.expectations}</div>}
                {renderTracking('stakeholders_tracking', i, shTracking[i], stakeholdersSnapshot.length)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusberichtPersonen;
