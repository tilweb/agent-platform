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
};

function StatusberichtPersonen({ data, projektauftrag, config }) {
  const organizationSnapshot = data.organization_snapshot || [];
  const stakeholdersSnapshot = data.stakeholders_snapshot || [];

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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Personen</h2>
        <p style={styles.subtitle}>
          Projektteam und Stakeholder zum Zeitpunkt der Statusbericht-Erstellung (read-only).
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusberichtPersonen;
