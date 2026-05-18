/**
 * PortfolioAssignCard — Portfolio-Karte fuer den Uebersicht-Tab im Projekt-Detail.
 *
 * Zeigt das aktuell zugeordnete Portfolio (Link) oder „Keinem Portfolio
 * zugeordnet". Editor+ kann via Modal aendern.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../../../hooks/useProjektmanagement';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.lg,
  },
  link: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    display: 'block',
  },
  emptyHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
  },
  actionBtn: {
    marginTop: theme.spacing.lg,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  // Modal
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  btn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
  },
  errorBanner: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
  },
};

export default function PortfolioAssignCard({ projekt, canEdit, onUpdated }) {
  const navigate = useNavigate();
  const { listPortfolios, getPortfolio, updateProjekt } = useProjektmanagement();
  const [portfolio, setPortfolio] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [availablePortfolios, setAvailablePortfolios] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    if (projekt?.portfolioId) {
      getPortfolio(projekt.portfolioId)
        .then((p) => { if (active) setPortfolio(p); })
        .catch(() => { if (active) setPortfolio(null); })
        .finally(() => { if (active) setIsLoading(false); });
    } else {
      setPortfolio(null);
      setIsLoading(false);
    }
    return () => { active = false; };
  }, [projekt?.portfolioId, getPortfolio]);

  const openAssign = async () => {
    setShowAssign(true);
    setError(null);
    try {
      const list = await listPortfolios({ status: 'active' });
      setAvailablePortfolios(list);
      setSelectedId(projekt?.portfolioId || '');
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const newId = selectedId || null;
      const updated = await updateProjekt(
        projekt.id,
        { portfolioId: newId },
        { expectedVersion: projekt.version },
      );
      setShowAssign(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Das Projekt wurde von jemand anderem geändert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Portfolio</div>
      {isLoading ? (
        <div style={styles.emptyHint}>Lade…</div>
      ) : portfolio ? (
        <button
          type="button"
          style={styles.link}
          onClick={() => navigate(`/apps/projektmanagement/portfolios/${portfolio.id}`)}
        >
          {portfolio.name}
        </button>
      ) : (
        <div style={styles.emptyHint}>Keinem Portfolio zugeordnet.</div>
      )}
      {canEdit && (
        <button type="button" style={styles.actionBtn} onClick={openAssign}>
          {portfolio ? 'Portfolio ändern' : 'Portfolio zuordnen'}
        </button>
      )}

      {showAssign && (
        <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !isSaving) setShowAssign(false); }}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Portfolio zuordnen</div>
            {error && <div style={styles.errorBanner}>{error}</div>}
            <select
              style={styles.select}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              autoFocus
            >
              <option value="">— Keinem Portfolio zugeordnet —</option>
              {availablePortfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div style={styles.modalActions}>
              <button type="button" style={styles.btn} onClick={() => setShowAssign(false)} disabled={isSaving}>
                Abbrechen
              </button>
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={save}
                disabled={isSaving}
              >
                {isSaving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
