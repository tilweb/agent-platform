import { useState } from 'react';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';
import RegulatorikForm from '../shared/RegulatorikForm';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    transition: `all ${theme.transitions.fast}`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.xl,
    cursor: 'pointer',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    flex: 1,
  },
  cardName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  indicators: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  indicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  indicatorActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  indicatorInactive: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  indicatorExpired: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  indicatorMissing: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  cardBody: {
    padding: `0 ${theme.spacing.xl} ${theme.spacing.xl}`,
    borderTop: `1px solid ${theme.colors.border}`,
    paddingTop: theme.spacing.lg,
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

export default function RegulatorikPanel({ supplier, onUpdate }) {
  const { updateRegulatorik, uploadDokument } = useSuppliers();
  const [expandedId, setExpandedId] = useState(null);

  if (!supplier) {
    return <div style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted }}>Laden...</div>;
  }

  const leistungen = (supplier.leistungen || []).filter((l) => l.status === 'active');

  const handleSave = async (leistId, values) => {
    try {
      const updated = await updateRegulatorik(supplier.id, leistId, values);
      onUpdate(updated);
      setExpandedId(null);
    } catch (err) {
      console.error('Error updating Regulatorik:', err);
    }
  };

  // status: 'erfuellt' | 'abgelaufen' | 'fehlend' | 'nicht_vorhanden'
  const renderIndicator = (label, status) => {
    const styleMap = {
      erfuellt: styles.indicatorActive,
      abgelaufen: styles.indicatorExpired,
      fehlend: styles.indicatorMissing,
      nicht_vorhanden: styles.indicatorInactive,
    };
    return (
      <span style={{ ...styles.indicator, ...(styleMap[status] || styles.indicatorInactive) }}>
        {status === 'erfuellt' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {status === 'abgelaufen' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        )}
        {status === 'fehlend' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.error} strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {status === 'nicht_vorhanden' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
        {label}
      </span>
    );
  };

  const isExpired = (doc) => {
    if (!doc?.gueltig_bis) return false;
    return new Date(doc.gueltig_bis) < new Date();
  };

  const getDocStatus = (reg, docKey) => {
    const doc = reg[docKey];
    if (doc?.vorhanden) {
      return isExpired(doc) ? 'abgelaufen' : 'erfuellt';
    }
    // AVV ist erforderlich wenn personenbezogene Daten + Auftragsverarbeiter
    if (docKey === 'avv' && reg.personenbezogene_daten && reg.datenschutz_rolle === 'auftragsverarbeiter') {
      return 'fehlend';
    }
    return 'nicht_vorhanden';
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>Regulatorik pro Leistung</div>

      {leistungen.length === 0 && (
        <div style={styles.empty}>Keine aktiven Leistungen vorhanden.</div>
      )}

      {leistungen.map((leistung) => {
        const isExpanded = expandedId === leistung.id;
        const reg = leistung.regulatorik || {};

        return (
          <div key={leistung.id} style={styles.card}>
            <div
              style={styles.cardHeader}
              onClick={() => setExpandedId(isExpanded ? null : leistung.id)}
            >
              <div style={styles.cardLeft}>
                <div>
                  <div style={styles.cardName}>{leistung.bezeichnung}</div>
                  <div style={styles.cardMeta}>{leistung.abteilung || '-'}</div>
                </div>
                <div style={styles.indicators}>
                  {renderIndicator('AVV', getDocStatus(reg, 'avv'))}
                  {renderIndicator('NDA', getDocStatus(reg, 'nda'))}
                  {renderIndicator('Rahmenvertrag', getDocStatus(reg, 'rahmenvertrag'))}
                </div>
              </div>
              <span style={styles.chevron}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
            </div>

            {isExpanded && (
              <div style={styles.cardBody}>
                <RegulatorikForm
                  regulatorik={reg}
                  onSave={(values) => handleSave(leistung.id, values)}
                  onCancel={() => setExpandedId(null)}
                  supplierId={supplier.id}
                  onUploadDokument={uploadDokument}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
