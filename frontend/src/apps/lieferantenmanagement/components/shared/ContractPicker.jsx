import { useState, useEffect } from 'react';
import { theme } from '../../../../config/theme';
import { apiGet } from '../../../../utils/apiFetch';

const VM_BASE = '/apps/vertragsmanagement';

const STATUS_STYLES = {
  active: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  expiring: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  expired: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const STATUS_LABELS = {
  active: 'Aktiv',
  expiring: 'Auslaufend',
  expired: 'Abgelaufen',
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.lg,
  },
  contractItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing.sm,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  contractLeft: {
    flex: 1,
  },
  contractParties: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  contractMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
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

/**
 * Contract picker modal — loads contracts from Vertragsmanagement API
 * @param {string} contractType - 'nda' or 'dienstleistung'
 * @param {function} onSelect - (contract) => void
 * @param {function} onClose
 */
export default function ContractPicker({ contractType, onSelect, onClose }) {
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await apiGet(`${VM_BASE}/contracts?type=${contractType}&status=active`);
        if (res.ok) {
          const data = await res.json();
          setContracts(data.contracts || []);
        } else {
          setError('Vertraege konnten nicht geladen werden');
        }
      } catch (err) {
        console.error('Error loading contracts:', err);
        setError('Verbindung zum Vertragsmanagement fehlgeschlagen');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [contractType]);

  const typeLabel = contractType === 'nda' ? 'NDA' : 'Rahmenvertrag / Dienstleistungsvertrag';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>Vertrag verknuepfen</div>
          <div style={styles.subtitle}>
            {typeLabel} aus dem Vertragsmanagement waehlen
          </div>
        </div>

        <div style={styles.body}>
          {isLoading ? (
            <div style={styles.empty}>Laden...</div>
          ) : error ? (
            <div style={{ ...styles.empty, color: theme.colors.error }}>{error}</div>
          ) : contracts.length === 0 ? (
            <div style={styles.empty}>
              Keine aktiven {typeLabel}-Vertraege im Vertragsmanagement gefunden.
            </div>
          ) : (
            contracts.map((c) => (
              <div
                key={c.id}
                style={styles.contractItem}
                onClick={() => onSelect(c)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                <div style={styles.contractLeft}>
                  <div style={styles.contractParties}>
                    {c.computed?.party_a || '-'} / {c.computed?.party_b || '-'}
                  </div>
                  <div style={styles.contractMeta}>
                    {c.upload_filename}
                    {c.computed?.end_date && ` · bis ${new Date(c.computed.end_date).toLocaleDateString('de-DE')}`}
                  </div>
                </div>
                <span style={{
                  ...styles.statusBadge,
                  ...(STATUS_STYLES[c.computed?.status] || {}),
                }}>
                  {STATUS_LABELS[c.computed?.status] || c.computed?.status}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline display of a linked contract
 */
export function LinkedContract({ contractId, onRemove }) {
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!contractId) { setIsLoading(false); return; }
    (async () => {
      try {
        const res = await apiGet(`${VM_BASE}/contracts/${contractId}`);
        if (res.ok) {
          const data = await res.json();
          setContract(data.contract);
        }
      } catch (err) {
        console.error('Error loading contract:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [contractId]);

  if (isLoading) {
    return <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Laden...</span>;
  }

  if (!contract) {
    return <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Vertrag {contractId}</span>;
  }

  const status = contract.computed?.status;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      backgroundColor: theme.colors.surfaceHover,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.sizes.xs,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <a
        href={`/apps/vertragsmanagement/${contractId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: theme.colors.primary, textDecoration: 'none', fontWeight: theme.typography.weights.medium }}
        onClick={(e) => e.stopPropagation()}
      >
        {contract.computed?.party_a} / {contract.computed?.party_b}
      </a>
      {status && (
        <span style={{
          ...styles.statusBadge,
          ...(STATUS_STYLES[status] || {}),
          fontSize: '10px',
          padding: `1px ${theme.spacing.xs}`,
        }}>
          {STATUS_LABELS[status]}
        </span>
      )}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: theme.colors.textMuted, padding: 0, display: 'inline-flex',
          }}
          title="Verknuepfung entfernen"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
